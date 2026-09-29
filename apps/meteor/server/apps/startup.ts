import { appsOrchestrator } from './orchestrator';
import { settings } from '../settings';

export const startupApps = async (): Promise<void> => {
	appsOrchestrator.initialize();
	void appsOrchestrator.load();

	settings.change<'filesystem' | 'gridfs'>('Apps_Framework_Source_Package_Storage_Type', (value) =>
		appsOrchestrator.getAppSourceStorage()?.setStorage(value),
	);

	settings.change<string>('Apps_Framework_Source_Package_Storage_FileSystem_Path', (value) =>
		appsOrchestrator.getAppSourceStorage()?.setFileSystemStoragePath(value),
	);
};
