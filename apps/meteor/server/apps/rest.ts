import type { AppManager } from '@rocket.chat/apps/dist/server/AppManager';
import type { IMarketplaceInfo } from '@rocket.chat/apps/dist/server/marketplace/IMarketplaceInfo';
import { AppStatus, AppStatusUtils } from '@rocket.chat/apps-engine/definition/AppStatus';
import type { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { License } from '@rocket.chat/license';
import { Logger } from '@rocket.chat/logger';

import { formatAppForRest } from './formatAppForRest';
import { marketplaceFetch, marketplaceUrl } from './marketplace/client';
import { MarketplaceAppsError, MarketplaceConnectionError, MarketplaceUnsupportedVersionError } from './marketplace/errors';
import { fetchMarketplaceApps } from './marketplace/fetchApps';
import { fetchMarketplaceCategories } from './marketplace/fetchCategories';
import { getMarketplaceHeaders } from './marketplace/headers';
import { notifyMarketplaceInstall } from './marketplace/notify';
import type { AppServerOrchestrator } from './orchestrator';
import { Info } from '../../app/utils/rocketchat.info';
import { getInstallationSourceFromAppStorageItem } from '../../lib/apps/getInstallationSourceFromAppStorageItem';
import { API } from '../api';
import { getUploadFormData } from '../api/lib/getUploadFormData';
import { loggerMiddleware } from '../api/v1/middlewares/logger';
import { metricsMiddleware } from '../api/v1/middlewares/metrics';
import { tracerSpanMiddleware } from '../api/v1/middlewares/tracer';
import { getWorkspaceAccessToken, getWorkspaceAccessTokenWithScope } from '../lib/cloud';
import { metrics } from '../lib/metrics';
import { settings } from '../settings';

const purchaseTypes = new Set(['buy', 'subscription']);

const handleMarketplaceError = (orch: AppServerOrchestrator, message: string, error: unknown) => {
	orch.getRocketChatLogger().error({ msg: message, err: error });

	if (error instanceof MarketplaceConnectionError) {
		return API.v1.internalError('Could not reach the Marketplace');
	}

	if (error instanceof MarketplaceAppsError || error instanceof MarketplaceUnsupportedVersionError) {
		return API.v1.failure({ error: error.message });
	}

	return API.v1.internalError();
};

export class AppsRestApi {
	constructor(
		private readonly orch: AppServerOrchestrator,
		private readonly manager: AppManager,
	) {
		void this.loadAPI();
	}

	private loadAPI(): void {
		const api = new API.ApiClass({
			apiPath: '',
			useDefaultAuth: true,
			prettyJson: false,
			enableCors: false,
			version: 'apps',
		});

		const logger = new Logger('APPS');

		api.router
			.use(
				metricsMiddleware({
					basePathRegex: new RegExp(/^\/api\/apps\//),
					api,
					settings,
					endpointTimeSummary: metrics.rocketchatRestApi,
					endpointTimeHistogram: metrics.rocketchatRestApiSeconds,
					responseSizeHistogram: metrics.rocketchatRestApiResponseSizeBytes,
					activeRequestsGauge: metrics.rocketchatRestApiActiveRequests,
				}),
			)
			.use(tracerSpanMiddleware)
			.use(loggerMiddleware(logger));

		this.addRoutes(api);
		API.api.use(api.router);
	}

	private addRoutes(api: InstanceType<(typeof API)['ApiClass']>): void {
		const { orch: orchestrator, manager } = this;

		api.addRoute(
			'actionButtons',
			{ authRequired: false },
			{
				async get() {
					const buttons = await manager.getUIActionButtonManager().getAllActionButtons();
					return API.v1.success(buttons);
				},
			},
		);

		api.addRoute(
			'languages',
			{ authRequired: false },
			{
				async get() {
					const apps = await manager.get();
					return API.v1.success({
						apps: apps.map((app) => ({
							id: app.getID(),
							languages: app.getStorageItem().languageContent || {},
						})),
					});
				},
			},
		);

		api.addRoute(
			'count',
			{ authRequired: false },
			{
				async get() {
					const apps = await manager.get({ enabled: true });
					const { maxMarketplaceApps, maxPrivateApps } = License.getAppsConfig();

					return API.v1.success({
						totalMarketplaceEnabled: apps.filter((app) => getInstallationSourceFromAppStorageItem(app.getStorageItem()) === 'marketplace')
							.length,
						totalPrivateEnabled: apps.filter((app) => getInstallationSourceFromAppStorageItem(app.getStorageItem()) === 'private').length,
						maxMarketplaceApps,
						maxPrivateApps,
					});
				},
			},
		);

		api.addRoute(
			'marketplace',
			{ authRequired: true },
			{
				async get() {
					try {
						const apps = await fetchMarketplaceApps(this.queryParams.isAdminUser === 'false' ? this.user._id : undefined);
						return API.v1.success(apps);
					} catch (error) {
						return handleMarketplaceError(orchestrator, 'Unable to access Marketplace', error);
					}
				},
			},
		);

		api.addRoute(
			'categories',
			{ authRequired: true },
			{
				async get() {
					try {
						const categories = await fetchMarketplaceCategories();
						return API.v1.success(categories);
					} catch (error) {
						return handleMarketplaceError(orchestrator, 'Error fetching categories from Marketplace', error);
					}
				},
			},
		);

		api.addRoute(
			'featured-apps',
			{ authRequired: true },
			{
				async get() {
					const headers: Record<string, string> = { ...getMarketplaceHeaders() };
					const token = await getWorkspaceAccessToken();
					if (token) {
						headers.Authorization = `Bearer ${token}`;
					}

					try {
						const request = await marketplaceFetch('v1/featured-apps', {
							headers,
							ignoreSsrfValidation: true,
						});
						if (request.status !== 200) {
							orchestrator.getRocketChatLogger().error({
								msg: 'Error getting the Featured Apps from the Marketplace',
								response: await request.json(),
							});
							return API.v1.failure();
						}

						return API.v1.success(await request.json());
					} catch (error) {
						return handleMarketplaceError(orchestrator, 'Unable to access Marketplace', error);
					}
				},
			},
		);

		api.addRoute(
			'app-request/stats',
			{ authRequired: true },
			{
				async get() {
					const headers: Record<string, string> = { ...getMarketplaceHeaders() };
					try {
						const token = await getWorkspaceAccessToken();
						if (token) {
							headers.Authorization = `Bearer ${token}`;
						}

						const request = await marketplaceFetch('v1/app-request/stats', {
							headers,
							ignoreSsrfValidation: true,
						});
						if (request.ok) {
							return API.v1.success(await request.json());
						}
					} catch (error) {
						orchestrator.getRocketChatLogger().error({ msg: 'Error getting app request stats from marketplace', err: error });
					}

					return API.v1.success({ data: { totalSeen: 0, totalUnseen: 0 } });
				},
			},
		);

		api.addRoute(
			'installed',
			{ authRequired: true },
			{
				async get() {
					const apps = await manager.get();
					const formatted = await Promise.all(apps.map((app) => formatAppForRest(app)));
					return API.v1.success({ apps: formatted });
				},
			},
		);

		api.addRoute(
			'incompatibleModal',
			{ authRequired: true },
			{
				async get() {
					const workspaceId = String(settings.get<string>('Cloud_Workspace_Id') ?? '');
					const { action, appId, appVersion } = this.queryParams;

					return API.v1.success({
						url: `${marketplaceUrl}/apps/${appId}/incompatible/${appVersion}/${action}?workspaceId=${workspaceId}&rocketChatVersion=${Info.version}`,
					});
				},
			},
		);

		api.addRoute(
			'buildExternalUrl',
			{ authRequired: true },
			{
				async get() {
					if (!this.queryParams.purchaseType || !purchaseTypes.has(this.queryParams.purchaseType)) {
						return API.v1.failure({ error: 'Invalid purchase type' });
					}

					const response = await getWorkspaceAccessTokenWithScope({ scope: 'marketplace:purchase' });
					if (!response.token) {
						return API.v1.failure({ error: 'Unauthorized' });
					}

					const subscribeRoute = this.queryParams.details === 'true' ? 'subscribe/details' : 'subscribe';
					const workspaceId = String(settings.get<string>('Cloud_Workspace_Id') ?? '');

					return API.v1.success({
						url: `${marketplaceUrl}/apps/${this.queryParams.appId}/${
							this.queryParams.purchaseType === 'buy' ? this.queryParams.purchaseType : subscribeRoute
						}?workspaceId=${workspaceId}&token=${response.token}`,
					});
				},
			},
		);

		api.addRoute(
			'',
			{ authRequired: true, permissionsRequired: ['manage-apps'], applyMeteorContext: true },
			{
				async post() {
					let buff: Buffer | undefined;
					let marketplaceInfo: IMarketplaceInfo[] | undefined;
					let permissionsGranted;

					if ('appId' in this.bodyParams && this.bodyParams.appId && this.bodyParams.marketplace && this.bodyParams.version) {
						const headers = getMarketplaceHeaders();
						try {
							const downloadToken = await getWorkspaceAccessToken(true, 'marketplace:download', false);
							const marketplaceToken = await getWorkspaceAccessToken();

							const [downloadResponse, marketplaceResponse] = await Promise.all([
								marketplaceFetch(`v2/apps/${this.bodyParams.appId}/download/${this.bodyParams.version}?token=${downloadToken}`, {
									headers,
									ignoreSsrfValidation: true,
								}),
								marketplaceFetch(`v1/apps/${this.bodyParams.appId}?appVersion=${this.bodyParams.version}`, {
									headers: {
										Authorization: `Bearer ${marketplaceToken}`,
										...headers,
									},
									ignoreSsrfValidation: true,
								}),
							]);

							if (downloadResponse.headers.get('content-type') !== 'application/zip') {
								throw new Error('Invalid url. It doesn\'t exist or is not "application/zip".');
							}

							buff = Buffer.from(await downloadResponse.arrayBuffer());
							marketplaceInfo = await marketplaceResponse.json();

							if (!Array.isArray(marketplaceInfo) || marketplaceInfo.length !== 1) {
								throw new Error('Invalid response from the Marketplace');
							}

							permissionsGranted = this.bodyParams.permissionsGranted;
						} catch (error: unknown) {
							orchestrator.getRocketChatLogger().error({ msg: 'Error installing app from marketplace', err: error });
							return API.v1.failure({ error: error instanceof Error ? error.message : error });
						}
					} else if (this.bodyParams.url) {
						try {
							const response = await marketplaceFetch(this.bodyParams.url, { ignoreSsrfValidation: true });
							if (response.status !== 200 || response.headers.get('content-type') !== 'application/zip') {
								return API.v1.failure({
									error: 'Invalid url. It doesn\'t exist or is not "application/zip".',
								});
							}
							buff = Buffer.from(await response.arrayBuffer());
						} catch (error) {
							orchestrator.getRocketChatLogger().error({ msg: 'Error fetching App from URL', err: error });
							return API.v1.internalError();
						}
					} else {
						const uploaded = await getUploadFormData(
							{ request: this.request },
							{ field: 'app', sizeLimit: settings.get('FileUpload_MaxFileSize') },
						);
						buff = uploaded.fileBuffer;
						try {
							const permissions = JSON.parse(uploaded.fields?.permissions || '');
							permissionsGranted = permissions.length ? permissions : undefined;
						} catch {
							permissionsGranted = undefined;
						}
					}

					if (!buff) {
						return API.v1.failure({ error: 'app_file_error', message: 'Failed to get a file to install for the App. ' });
					}

					const user = orchestrator.getConverters().get('users').convertToApp(this.user);
					const aff = await manager.add(buff, {
						...(marketplaceInfo && { marketplaceInfo }),
						permissionsGranted,
						enable: false,
						user,
					});
					const info: IAppInfo & { status?: AppStatus } = aff.getAppInfo();

					if (aff.hasStorageError()) {
						return API.v1.failure({ error: 'app_storage_error', status: 'storage_error', messages: [aff.getStorageError()] });
					}

					if (aff.hasAppUserError()) {
						const appUserError = aff.getAppUserError() as { message: string; username: string };
						return API.v1.failure({
							error: 'app_user_error',
							status: 'app_user_error',
							messages: [appUserError.message],
							payload: { username: appUserError.username },
						});
					}

					info.status = await aff.getApp().getStatus();
					void notifyMarketplaceInstall('install', info);

					try {
						const success = await manager.changeStatus(info.id, AppStatus.MANUALLY_ENABLED);
						info.status = await success.getStatus();
					} catch (error) {
						orchestrator.getRocketChatLogger().warn({
							msg: 'App was installed but could not be enabled',
							appId: info.id,
							err: error,
						});
					}

					void orchestrator.getNotifier().appAdded(info.id);

					return API.v1.success({
						app: info,
						implemented: aff.getImplementedInferfaces(),
						licenseValidation: aff.getLicenseValidationResult(),
					});
				},
			},
		);

		api.addRoute(
			':id',
			{ authRequired: true, permissionsRequired: ['manage-apps'], applyMeteorContext: true },
			{
				async get() {
					if (this.queryParams.marketplace && this.queryParams.version) {
						const headers: Record<string, string> = {};
						const token = await getWorkspaceAccessToken();
						if (token) {
							headers.Authorization = `Bearer ${token}`;
						}

						try {
							const request = await marketplaceFetch(`v1/apps/${this.urlParams.id}?appVersion=${this.queryParams.version}`, {
								headers,
								ignoreSsrfValidation: true,
							});
							if (request.status !== 200) {
								return API.v1.failure();
							}

							const result = await request.json();
							return API.v1.success({ app: result[0] });
						} catch (error) {
							return handleMarketplaceError(orchestrator, 'Unable to access Marketplace', error);
						}
					}

					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					return API.v1.success({
						app: await formatAppForRest(app),
					});
				},
				async post() {
					let buff: Buffer | undefined;
					let permissionsGranted;

					if (this.bodyParams.appId && this.bodyParams.marketplace && this.bodyParams.version) {
						const headers = getMarketplaceHeaders();
						const token = await getWorkspaceAccessToken(true, 'marketplace:download', false);

						try {
							const response = await marketplaceFetch(
								`v2/apps/${this.bodyParams.appId}/download/${this.bodyParams.version}?token=${token}`,
								{
									headers,
									ignoreSsrfValidation: true,
								},
							);

							if (response.status !== 200 || response.headers.get('content-type') !== 'application/zip') {
								return API.v1.failure({
									error: 'Invalid url. It doesn\'t exist or is not "application/zip".',
								});
							}

							buff = Buffer.from(await response.arrayBuffer());
							permissionsGranted = this.bodyParams.permissionsGranted;
						} catch (error) {
							orchestrator.getRocketChatLogger().error({ msg: 'Error getting the App from the Marketplace', err: error });
							return API.v1.internalError();
						}
					} else {
						return API.v1.failure({ error: 'Failed to get a file to install for the App. ' });
					}

					if (!buff) {
						return API.v1.failure({ error: 'Failed to get a file to install for the App. ' });
					}

					const user = orchestrator.getConverters().get('users').convertToApp(this.user);
					const aff = await manager.update(buff, permissionsGranted, { user, loadApp: true });
					const info: IAppInfo & { status?: AppStatus } = aff.getAppInfo();

					if (aff.hasStorageError()) {
						return API.v1.failure({ status: 'storage_error', messages: [aff.getStorageError()] });
					}

					if (aff.hasAppUserError()) {
						const appUserError = aff.getAppUserError() as { message: string; username: string };
						return API.v1.failure({
							status: 'app_user_error',
							messages: [appUserError.message],
							payload: { username: appUserError.username },
						});
					}

					info.status = await aff.getApp().getStatus();
					void notifyMarketplaceInstall('update', info);
					void orchestrator.getNotifier().appUpdated(info.id);

					return API.v1.success({
						app: info,
						implemented: aff.getImplementedInferfaces(),
						licenseValidation: aff.getLicenseValidationResult(),
					});
				},
				async delete() {
					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					const user = orchestrator.getConverters().get('users').convertToApp(this.user);
					const info: IAppInfo & { status?: AppStatus } = app.getInfo();

					try {
						await manager.remove(app.getID(), { user });
						info.status = AppStatus.DISABLED;
					} catch {
						info.status = await app.getStatus();
						return API.v1.failure({ app: info });
					}

					void notifyMarketplaceInstall('uninstall', info);
					return API.v1.success({ app: info });
				},
			},
		);

		api.addRoute(
			':id/settings',
			{ authRequired: true, permissionsRequired: ['manage-apps'] },
			{
				get() {
					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					const settingsMap = { ...app.getStorageItem().settings };
					Object.keys(settingsMap).forEach((key) => {
						if (settingsMap[key].hidden) {
							delete settingsMap[key];
						}
					});

					return API.v1.success({ settings: settingsMap });
				},
				async post() {
					if (!this.bodyParams?.settings) {
						return API.v1.failure('The settings to update must be present.');
					}

					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					const { settings: currentSettings } = app.getStorageItem();
					const updated = [];

					for (const setting of this.bodyParams.settings) {
						if (currentSettings[setting.id] && currentSettings[setting.id].value !== setting.value) {
							await manager.getSettingsManager().updateAppSetting(this.urlParams.id, setting);
							updated.push(setting);
						}
					}

					return API.v1.success({ updated });
				},
			},
		);

		api.addRoute(
			':id/languages',
			{ authRequired: false },
			{
				get() {
					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					return API.v1.success({ languages: app.getStorageItem().languageContent || {} });
				},
			},
		);

		api.addRoute(
			':id/status',
			{ authRequired: true, permissionsRequired: ['manage-apps'] },
			{
				async get() {
					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					return API.v1.success({ status: await app.getStatus() });
				},
				async post() {
					const { status } = this.bodyParams;
					if (!status || typeof status !== 'string') {
						return API.v1.failure('Invalid status provided, it must be "status" field and a string.');
					}

					const app = manager.getOneById(this.urlParams.id);
					if (!app) {
						return API.v1.notFound(`No App found by the id of: ${this.urlParams.id}`);
					}

					if (AppStatusUtils.isEnabled(status) && app.getStorageItem().info.addon) {
						return API.v1.failure('app-addon-not-valid');
					}

					const result = await manager.changeStatus(app.getID(), status);
					return API.v1.success({ status: await result.getStatus() });
				},
			},
		);

		api.addRoute(
			':id/screenshots',
			{ authRequired: false },
			{
				async get() {
					try {
						const request = await marketplaceFetch(`v1/apps/${this.urlParams.id}/screenshots`, {
							headers: getMarketplaceHeaders(),
							ignoreSsrfValidation: true,
						});
						return API.v1.success({ screenshots: await request.json() });
					} catch (error: unknown) {
						orchestrator.getRocketChatLogger().error({ msg: 'Error getting the App screenshots from the Marketplace', err: error });
						return API.v1.failure(error instanceof Error ? error.message : 'Failed to fetch screenshots');
					}
				},
			},
		);

		api.addRoute(
			':id/versions',
			{ authRequired: true },
			{
				async get() {
					const headers: Record<string, string> = {};
					const token = await getWorkspaceAccessToken();
					if (token) {
						headers.Authorization = `Bearer ${token}`;
					}

					try {
						const request = await marketplaceFetch(`v1/apps/${this.urlParams.id}`, {
							headers,
							ignoreSsrfValidation: true,
						});
						const result = await request.json();
						if (!request.ok) {
							throw new Error(result.error);
						}

						return API.v1.success({ apps: result });
					} catch (error) {
						return handleMarketplaceError(orchestrator, 'Unable to access Marketplace', error);
					}
				},
			},
		);
	}
}
