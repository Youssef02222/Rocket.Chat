import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { registerOrchestrator, type AppEvents, type IAppConvertersMap, type IAppServerOrchestrator } from '@rocket.chat/apps';
import { AppManager } from '@rocket.chat/apps/dist/server/AppManager';
import { EssentialAppDisabledException } from '@rocket.chat/apps-engine/definition/exceptions';
import { Logger } from '@rocket.chat/logger';
import { AppLogs, Apps as AppsModel, AppsPersistence } from '@rocket.chat/models';
import { Meteor } from 'meteor/meteor';

import { AppNotifier } from './notifier';
import { AppsRestApi } from './rest';
import { AppLogStore } from './storage/AppLogStore';
import { AppMetadataStore } from './storage/AppMetadataStore';
import { PackageStore } from './storage/PackageStore';
import { RealAppBridges } from '../../app/apps/server/bridges';
import {
	AppContactsConverter,
	AppDepartmentsConverter,
	AppMessagesConverter,
	AppRolesConverter,
	AppRoomsConverter,
	AppSettingsConverter,
	AppUploadsConverter,
	AppUsersConverter,
	AppVideoConferencesConverter,
	AppVisitorsConverter,
} from '../../app/apps/server/converters';
import { AppThreadsConverter } from '../../app/apps/server/converters/threads';
import { settings } from '../settings';

export class AppServerOrchestrator implements IAppServerOrchestrator {
	private _isInitialized = false;

	private _rocketchatLogger!: Logger;

	private _storage!: AppMetadataStore;

	private _logStorage!: AppLogStore;

	private _persistModel = AppsPersistence;

	private _appSourceStorage!: PackageStore;

	private _converters!: IAppConvertersMap;

	private _bridges!: RealAppBridges;

	private _manager!: AppManager;

	private _notifier!: AppNotifier;

	initialize(): void {
		if (this._isInitialized) {
			return;
		}

		this._rocketchatLogger = new Logger('Rocket.Chat Apps');
		this._storage = new AppMetadataStore(AppsModel);
		this._logStorage = new AppLogStore(AppLogs);
		this._appSourceStorage = new PackageStore(
			settings.get('Apps_Framework_Source_Package_Storage_Type'),
			settings.get('Apps_Framework_Source_Package_Storage_FileSystem_Path'),
		);

		this._converters = new Map() as IAppConvertersMap;
		this._converters.set('messages', new AppMessagesConverter(this));
		this._converters.set('rooms', new AppRoomsConverter(this));
		this._converters.set('settings', new AppSettingsConverter(this));
		this._converters.set('users', new AppUsersConverter(this));
		this._converters.set('visitors', new AppVisitorsConverter(this));
		this._converters.set('contacts', new AppContactsConverter(this));
		this._converters.set('departments', new AppDepartmentsConverter(this));
		this._converters.set('uploads', new AppUploadsConverter(this));
		this._converters.set('videoConferences', new AppVideoConferencesConverter());
		this._converters.set('threads', new AppThreadsConverter(this));
		this._converters.set('roles', new AppRolesConverter(this));

		this._bridges = new RealAppBridges(this);

		const tempFilePath = path.join(os.tmpdir(), 'apps-engine-temp');
		try {
			fs.mkdirSync(tempFilePath);
		} catch (error: unknown) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
				throw new Error('Failed to initialize the Apps-Engine', { cause: error });
			}
		}

		this._manager = new AppManager({
			metadataStorage: this._storage,
			logStorage: this._logStorage,
			bridges: this._bridges,
			sourceStorage: this._appSourceStorage,
			tempFilePath,
		});

		this._notifier = new AppNotifier();
		void new AppsRestApi(this, this._manager);

		this._isInitialized = true;
	}

	isInitialized(): boolean {
		return this._isInitialized;
	}

	isLoaded(): boolean {
		return this._manager?.areAppsLoaded() ?? false;
	}

	isDebugging(): boolean {
		return process.env.TEST_MODE !== 'true';
	}

	debugLog(...args: unknown[]): void {
		if (this.isDebugging()) {
			this.getRocketChatLogger().debug({ msg: 'Apps debug', args });
		}
	}

	getNotifier(): AppNotifier {
		return this._notifier;
	}

	getManager(): AppManager {
		return this._manager;
	}

	getConverters(): IAppConvertersMap {
		return this._converters;
	}

	getPersistenceModel() {
		return this._persistModel;
	}

	getRocketChatLogger(): Logger {
		return this._rocketchatLogger;
	}

	getBridges(): RealAppBridges {
		return this._bridges;
	}

	getStorage(): AppMetadataStore {
		return this._storage;
	}

	getAppSourceStorage(): PackageStore {
		return this._appSourceStorage;
	}

	async load(): Promise<void> {
		if (this.isLoaded()) {
			return;
		}

		await this.getManager().load();

		const apps = await this.getManager().get();
		for (const app of apps) {
			try {
				await this.getManager().loadOne(app.getID(), true);
			} catch (error) {
				this._rocketchatLogger.warn({
					msg: 'App could not be enabled',
					appName: app.getInfo().name,
					err: error,
				});
			}
		}

		await this.getBridges().getSchedulerBridge().startScheduler();

		const appCount = (await this.getManager().get({ enabled: true })).length;
		this._rocketchatLogger.info({
			msg: 'Loaded the Apps Framework and apps',
			appCount,
		});
	}

	async triggerEvent(event: AppEvents, ...payload: unknown[]): Promise<unknown> {
		if (!this.isLoaded()) {
			return payload.at(-1);
		}

		try {
			return await this.getBridges()
				.getListenerBridge()
				.handleEvent({ event, payload } as never);
		} catch (error) {
			if (error instanceof EssentialAppDisabledException) {
				throw new Meteor.Error('error-essential-app-disabled');
			}

			throw error;
		}
	}
}

export const appsOrchestrator = new AppServerOrchestrator();

export const registerAppsOrchestrator = (): void => {
	registerOrchestrator(appsOrchestrator);
};
