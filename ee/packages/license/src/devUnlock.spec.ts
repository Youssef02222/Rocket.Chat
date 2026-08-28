import { CoreModules } from '@rocket.chat/core-typings';

import { getReadyLicenseManager } from '../__tests__/MockedLicenseBuilder';
import { buildDevUnlockLicense, isDevUnlockAllowed, parseDevUnlockModules } from './devUnlock';

describe('parseDevUnlockModules', () => {
	it('returns an empty list when unset', () => {
		expect(parseDevUnlockModules(undefined)).toEqual([]);
		expect(parseDevUnlockModules('')).toEqual([]);
		expect(parseDevUnlockModules('   ')).toEqual([]);
	});

	it('parses a comma-separated module list', () => {
		expect(parseDevUnlockModules('ldap-enterprise, custom-roles')).toEqual(['ldap-enterprise', 'custom-roles']);
	});

	it('ignores unknown names that are not external modules', () => {
		expect(parseDevUnlockModules('ldap-enterprise,not-a-module,custom-roles')).toEqual(['ldap-enterprise', 'custom-roles']);
	});

	it('expands * to every core module', () => {
		expect(parseDevUnlockModules('*')).toEqual([...CoreModules]);
	});
});

describe('isDevUnlockAllowed', () => {
	it('allows non-production environments', () => {
		expect(isDevUnlockAllowed('development')).toBe(true);
		expect(isDevUnlockAllowed('test')).toBe(true);
	});

	it('rejects production', () => {
		expect(isDevUnlockAllowed('production')).toBe(false);
	});
});

describe('buildDevUnlockLicense', () => {
	it('is offline, non-cancellable, and has no seat cap', () => {
		const license = buildDevUnlockLicense(['ldap-enterprise', 'custom-roles']);

		expect(license.information.offline).toBe(true);
		expect(license.information.cancellable).toBe(false);
		expect(license.limits.activeUsers).toEqual([]);
		expect(license.grantedModules.map(({ module }) => module)).toEqual(['ldap-enterprise', 'custom-roles']);
	});
});

describe('License.applyDevUnlock', () => {
	it('enables requested modules without a user seat cap', async () => {
		const licenseManager = await getReadyLicenseManager();

		await expect(licenseManager.applyDevUnlock(['ldap-enterprise', 'custom-roles'])).resolves.toBe(true);

		expect(licenseManager.hasValidLicense()).toBe(true);
		expect(licenseManager.hasOfflineLicense()).toBe(true);
		expect(licenseManager.isDevUnlock()).toBe(true);
		expect(licenseManager.hasModule('ldap-enterprise')).toBe(true);
		expect(licenseManager.hasModule('custom-roles')).toBe(true);
		expect(licenseManager.hasModule('auditing')).toBe(false);

		licenseManager.setLicenseLimitCounter('activeUsers', () => 500);
		await expect(licenseManager.shouldPreventAction('activeUsers')).resolves.toBe(false);
	});

	it('does nothing when no modules are requested', async () => {
		const licenseManager = await getReadyLicenseManager();

		await expect(licenseManager.applyDevUnlock([])).resolves.toBe(false);
		expect(licenseManager.hasValidLicense()).toBe(false);
	});
});
