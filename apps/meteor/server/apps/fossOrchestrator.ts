import { registerOrchestrator, type IAppServerOrchestrator } from '@rocket.chat/apps';

class FossAppOrchestrator {
	initialize(): void {
		// Apps Engine hosting lives in premium code; FOSS registers a no-op orchestrator
		// so MIT call sites and migrations can boot without the EE package.
	}

	isInitialized(): boolean {
		return false;
	}

	isLoaded(): boolean {
		return false;
	}

	isDebugging(): boolean {
		return false;
	}

	debugLog(..._args: unknown[]): void {
		// no-op
	}

	async triggerEvent(_event: string, ...payload: unknown[]): Promise<unknown> {
		return payload.length ? payload[payload.length - 1] : undefined;
	}

	getManager() {
		return {
			get: async () => [],
			getSignatureManager: () => ({
				signApp: async () => '',
			}),
		};
	}

	getConverters() {
		return new Map();
	}

	getBridges() {
		return {};
	}

	getStorage() {
		return {
			retrieveAll: async () => new Map(),
			retrieveAllPrivate: async () => new Map(),
			updatePartialAndReturnDocument: async (doc: unknown) => doc,
		};
	}

	getAppSourceStorage() {
		return {
			setStorage() {
				// no-op
			},
			setFileSystemStoragePath() {
				// no-op
			},
		};
	}

	getNotifier() {
		return {};
	}

	getPersistenceModel() {
		return {};
	}

	getRocketChatLogger() {
		return console;
	}
}

export const registerFossAppsOrchestrator = (): void => {
	registerOrchestrator(new FossAppOrchestrator() as unknown as IAppServerOrchestrator);
};
