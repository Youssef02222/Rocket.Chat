export class MarketplaceAppsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MarketplaceAppsError';
	}
}

export class MarketplaceConnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MarketplaceConnectionError';
	}
}

export class MarketplaceUnsupportedVersionError extends Error {
	constructor() {
		super('Marketplace_Unsupported_Version');
		this.name = 'MarketplaceUnsupportedVersionError';
	}
}
