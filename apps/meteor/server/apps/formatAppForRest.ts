import type { ProxiedApp } from '@rocket.chat/apps/dist/server/ProxiedApp';
import type { IAppStorageItem } from '@rocket.chat/apps/dist/server/storage/IAppStorageItem';
import type { AppStatus } from '@rocket.chat/apps-engine/definition/AppStatus';
import type { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';

import { getInstallationSourceFromAppStorageItem } from '../../lib/apps/getInstallationSourceFromAppStorageItem';

export type AppRestPayload = IAppInfo & {
	status: AppStatus;
	languages: IAppStorageItem['languageContent'];
	private: boolean;
	migrated: boolean;
	licenseValidation?: unknown;
};

export async function formatAppForRest(app: ProxiedApp): Promise<AppRestPayload> {
	const storageItem = app.getStorageItem();
	const payload: AppRestPayload = {
		...app.getInfo(),
		status: await app.getStatus(),
		languages: storageItem.languageContent,
		private: getInstallationSourceFromAppStorageItem(storageItem) === 'private',
		migrated: Boolean(storageItem.migrated),
	};

	const licenseValidation = app.getLatestLicenseValidationResult();
	if (licenseValidation?.hasErrors || licenseValidation?.hasWarnings) {
		payload.licenseValidation = licenseValidation;
	}

	return payload;
}
