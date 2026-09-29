import type { SettingValue } from '@rocket.chat/core-typings';
import { License } from '@rocket.chat/license';
import { Settings } from '@rocket.chat/models';
import type { SignedSupportedVersions } from '@rocket.chat/server-cloud-communication';

import { supportedVersionsChooseLatest } from './supportedVersionsChooseLatest';
import { supportedVersions as supportedVersionsFromBuild } from '../../../../app/utils/rocketchat-supported-versions.info';
import { settings } from '../../../settings';
import { updateAuditedBySystem } from '../../../settings/lib/auditedSettingUpdates';
import { SystemLogger } from '../../logger/system';
import { notifyOnSettingChangedById } from '../../notifyListener';
import { buildVersionUpdateMessage } from '../version-check/functions/buildVersionUpdateMessage';

declare module '@rocket.chat/core-typings' {
	interface ILicenseV3 {
		supportedVersions?: SignedSupportedVersions;
	}
}

/** HELPERS */

export const wrapPromise = <T>(
	promise: Promise<T>,
): Promise<
	| {
			success: true;
			result: T;
	  }
	| {
			success: false;
			error: any;
	  }
> =>
	promise
		.then((result) => ({ success: true, result }) as const)
		.catch((error) => ({
			success: false,
			error,
		}));

const cacheValueInSettings = <T extends SettingValue>(
	key: string,
	fn: (retry?: number) => Promise<T>,
): (() => Promise<T>) & {
	reset: (retry?: number) => Promise<T>;
} => {
	const reset = async (retry?: number) => {
		SystemLogger.debug({
			msg: 'Resetting cached value in settings',
			key,
		});
		const value = await fn(retry);

		if (
			(
				await updateAuditedBySystem({
					reason: 'cacheValueInSettings reset',
				})(Settings.updateValueById, key, value)
			).modifiedCount
		) {
			void notifyOnSettingChangedById(key);
		}

		return value;
	};

	return Object.assign(
		async () => {
			const storedValue = settings.get<T>(key);

			if (storedValue) {
				return storedValue;
			}

			return reset();
		},
		{
			reset,
		},
	);
};

const getSupportedVersionsFromCloud = async () => {
	if (process.env.CLOUD_SUPPORTED_VERSIONS_TOKEN) {
		return {
			success: true,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			result: JSON.parse(process.env.CLOUD_SUPPORTED_VERSIONS!),
		};
	}

	// FOSS: do not phone home to releases.rocket.chat. The 5s timeout aborts the
	// request and retries five times, which only spams logs. Use the versions
	// bundled in the build instead.
	return { success: true, result: undefined } as const;
};

const getSupportedVersionsToken = async () => {
	/**
	 * Gets the supported versions from the license
	 * Gets the supported versions from the cloud
	 * Gets the latest version
	 * return the token
	 */
	const [versionsFromLicense, cloudResponse] = await Promise.all([License.getLicense(), getSupportedVersionsFromCloud()]);

	const supportedVersions = await supportedVersionsChooseLatest(
		supportedVersionsFromBuild,
		versionsFromLicense?.supportedVersions,
		(cloudResponse.success && cloudResponse.result) || undefined,
	);

	SystemLogger.debug({
		msg: 'Supported versions',
		supportedVersionsFromBuild: supportedVersionsFromBuild.timestamp,
		versionsFromLicense: versionsFromLicense?.supportedVersions?.timestamp,
		response: cloudResponse.success && cloudResponse.result?.timestamp,
	});

	switch (supportedVersions) {
		case supportedVersionsFromBuild:
			SystemLogger.info({
				msg: 'Using supported versions from build',
			});
			break;
		case versionsFromLicense?.supportedVersions:
			SystemLogger.info({
				msg: 'Using supported versions from license',
			});
			break;
		case cloudResponse.success && cloudResponse.result:
			SystemLogger.info({
				msg: 'Using supported versions from cloud',
			});
			break;
	}

	if (cloudResponse.success) {
		await buildVersionUpdateMessage(supportedVersions?.versions);
	}

	return supportedVersions?.signed;
};

export const getCachedSupportedVersionsToken = cacheValueInSettings('Cloud_Workspace_Supported_Versions_Token', getSupportedVersionsToken);
