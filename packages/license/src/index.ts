import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import type { ILicenseV3, LicenseInfo, LicenseLimitKind, LicenseModule } from '@rocket.chat/core-typings';

import { validateLimit, validateWarnLimit } from './validation/validateLimit';

export { validateLimit, validateWarnLimit };
export type { LicenseModule };

export class DuplicatedLicenseError extends Error {
	constructor(message = 'Duplicated license') {
		super(message);
		this.name = 'DuplicatedLicense';
	}
}

const unlimitedLimits: Record<LicenseLimitKind, { max: number }> = {
	activeUsers: { max: -1 },
	guestUsers: { max: -1 },
	roomsPerGuest: { max: -1 },
	privateApps: { max: -1 },
	marketplaceApps: { max: -1 },
	monthlyActiveContacts: { max: -1 },
};

const openActions: Record<LicenseLimitKind, boolean> = {
	activeUsers: false,
	guestUsers: false,
	roomsPerGuest: false,
	privateApps: false,
	marketplaceApps: false,
	monthlyActiveContacts: false,
};

export class LicenseManager extends EventEmitter {
	public encryptedLicense: string | undefined;

	private workspaceUrl: string | undefined;

	hasModule(_module?: LicenseModule): boolean {
		return false;
	}

	hasValidLicense(): boolean {
		return false;
	}

	hasOfflineLicense(): boolean {
		return false;
	}

	getLicense(): ILicenseV3 | undefined {
		return undefined;
	}

	getModules(): LicenseModule[] {
		return [];
	}

	getModuleDefinition(_moduleName: LicenseModule) {
		return undefined;
	}

	getExternalModules() {
		return [];
	}

	getTags(): Array<{ name: string }> {
		return [];
	}

	getWorkspaceUrl(): string | undefined {
		return this.workspaceUrl;
	}

	async setWorkspaceUrl(url: string): Promise<void> {
		this.workspaceUrl = url;
	}

	hashWorkspaceUrl(url: string): string {
		return crypto.createHash('sha256').update(url).digest('hex');
	}

	getHashedWorkspaceUrl(): string | undefined {
		if (!this.workspaceUrl) {
			return undefined;
		}

		return this.hashWorkspaceUrl(this.workspaceUrl);
	}

	async shouldPreventAction(_action?: LicenseLimitKind, _extraCount?: number, _context?: unknown): Promise<boolean> {
		return false;
	}

	async shouldPreventActionResultsMap(): Promise<Record<LicenseLimitKind, boolean>> {
		return { ...openActions };
	}

	syncShouldPreventActionResults(_actions: Record<LicenseLimitKind, boolean>): void {
		// FOSS: no license limits to synchronize.
	}

	setLicenseLimitCounter(_kind?: LicenseLimitKind, _fn?: () => number | Promise<number>): void {
		// FOSS: counters are unused because actions are never prevented.
	}

	async getCurrentValueForLicenseLimit(_kind?: LicenseLimitKind): Promise<number> {
		return 0;
	}

	async isLimitReached(_action?: LicenseLimitKind, _context?: unknown): Promise<boolean> {
		return false;
	}

	getMaxActiveUsers(): number {
		return -1;
	}

	getAppsConfig() {
		return {
			maxPrivateApps: -1,
			maxMarketplaceApps: -1,
		};
	}

	getUnmodifiedLicenseAndModules() {
		return undefined;
	}

	async setLicense(_license: string, _isNewLicense?: boolean): Promise<boolean> {
		return false;
	}

	remove(): void {
		this.emit('removed');
	}

	overwriteClassOnLicense(_module: LicenseModule, _target: unknown, _replacements: unknown): void {
		// FOSS: licensed class patches are not applied.
	}

	onChange(cb: () => void): void {
		this.on('sync', cb);
	}

	onInstall(cb: () => void): void {
		this.on('installed', cb);
	}

	onRemoveLicense(cb: () => void): void {
		this.on('removed', cb);
	}

	onInvalidate(cb: () => void): void {
		cb();
		this.on('invalidate', cb);
	}

	onValidateLicense(cb: () => void): void {
		this.on('validate', cb);
	}

	onInvalidateLicense(cb: () => void): void {
		this.on('invalidate', cb);
	}

	onValidFeature(feature: LicenseModule, cb: () => void): () => void {
		this.on(`valid:${feature}`, cb);
		return () => {
			this.off(`valid:${feature}`, cb);
		};
	}

	onInvalidFeature(feature: LicenseModule, cb: () => void): () => void {
		this.on(`invalid:${feature}`, cb);
		cb();
		return () => {
			this.off(`invalid:${feature}`, cb);
		};
	}

	onToggledFeature(
		_feature: LicenseModule,
		{ down }: { up?: () => Promise<void> | void; down?: () => Promise<void> | void },
	): () => void {
		void down?.();
		return () => undefined;
	}

	onModule(cb: (data: { module: LicenseModule; external: boolean; valid: boolean }) => void): void {
		this.on('module', cb);
	}

	onLimitReached(limitKind: LicenseLimitKind, cb: () => void): void {
		this.on(`limitReached:${limitKind}`, cb);
	}

	onBehaviorTriggered(_behavior: string, cb: (...args: unknown[]) => void): void {
		this.on('behavior', cb);
	}

	onBehaviorToggled(_behavior: string, cb: (...args: unknown[]) => void): void {
		this.on('behaviorToggled', cb);
	}

	onLicense(_feature: LicenseModule, cb: () => void): void {
		this.on(`valid:${_feature}`, cb);
	}

	async getInfo(_options?: { limits?: boolean; currentValues?: boolean; license?: boolean }): Promise<LicenseInfo> {
		return {
			license: undefined,
			activeModules: [],
			externalModules: [],
			preventedActions: { ...openActions },
			limits: { ...unlimitedLimits },
			tags: [],
			trial: false,
			hasValidLicense: false,
		};
	}
}

export const License = new LicenseManager();

export const applyLicense = async (_license?: string, _isNewLicense?: boolean): Promise<boolean> => false;

export const applyLicenseOrRemove = async (_license?: string, _isNewLicense?: boolean): Promise<boolean> => false;

export const applyNewestLicense = async (..._licenses: string[]): Promise<boolean> => false;

class AirGappedRestrictionClass extends EventEmitter {
	public restricted = false;

	public async computeRestriction(_encryptedToken?: string): Promise<void> {
		this.restricted = false;
		this.emit('remainingDays', { days: -1 });
	}

	public isWarningPeriod(_days: number): boolean {
		return false;
	}
}

export const AirGappedRestriction = new AirGappedRestrictionClass();
