import { type ExtendedFetchOptions, serverFetch } from '@rocket.chat/server-fetch';

const defaultMarketplaceUrl = 'https://marketplace.rocket.chat';

const resolveMarketplaceUrl = (): string => {
	const overwrite = process.env.OVERWRITE_INTERNAL_MARKETPLACE_URL;
	if (typeof overwrite === 'string' && overwrite !== '') {
		return overwrite;
	}

	return defaultMarketplaceUrl;
};

export const marketplaceUrl = resolveMarketplaceUrl();

export function resolveMarketplaceRequestUrl(input: string): string {
	if (input.startsWith('http://') || input.startsWith('https://')) {
		return input;
	}

	return `${marketplaceUrl}${input.startsWith('/') ? '' : '/'}${input}`;
}

export function marketplaceFetch(input: string, options?: ExtendedFetchOptions, allowSelfSignedCerts?: boolean) {
	return serverFetch(resolveMarketplaceRequestUrl(input), options, allowSelfSignedCerts);
}
