import { CoreModules, type GrantedModules, type ILicenseV3, type LicenseModule } from '@rocket.chat/core-typings';

import { isInternalModuleName } from './modules';

export const DEV_UNLOCK_ENV = 'RC_DEV_UNLOCK_MODULES';

export function isDevUnlockAllowed(nodeEnv = process.env.NODE_ENV): boolean {
	return nodeEnv !== 'production';
}

export function parseDevUnlockModules(value: string | undefined): LicenseModule[] {
	if (!value?.trim()) {
		return [];
	}

	const trimmed = value.trim();
	if (trimmed === '*') {
		return [...CoreModules];
	}

	const requested = trimmed
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	const modules: LicenseModule[] = [];
	for (const name of requested) {
		if (isInternalModuleName(name) || name.includes('.')) {
			modules.push(name as LicenseModule);
		}
	}

	return [...new Set(modules)];
}

export function buildDevUnlockLicense(modules: LicenseModule[]): ILicenseV3 {
	const grantedModules: GrantedModules = modules.map((module) =>
		isInternalModuleName(module) ? { module } : { module: module as `${string}.${string}`, external: true },
	);

	return {
		version: '3.0',
		information: {
			autoRenew: false,
			trial: false,
			cancellable: false,
			offline: true,
			createdAt: new Date().toISOString(),
			grantedBy: {
				method: 'manual',
				seller: 'dev-unlock',
			},
			notes: 'Local offline test unlock via RC_DEV_UNLOCK_MODULES. Not a product license.',
			tags: [
				{
					name: 'Dev Offline Unlock',
					color: 'orange',
				},
			],
		},
		validation: {
			serverUrls: [
				{
					value: '*',
					type: 'regex',
				},
			],
			validPeriods: [],
			statisticsReport: {
				required: false,
			},
		},
		grantedModules,
		limits: {
			activeUsers: [],
			guestUsers: [],
			roomsPerGuest: [],
			privateApps: [],
			marketplaceApps: [],
			monthlyActiveContacts: [],
		},
	};
}
