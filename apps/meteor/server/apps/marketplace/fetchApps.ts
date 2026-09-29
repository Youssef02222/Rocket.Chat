import type { App } from '@rocket.chat/core-typings';

import { marketplaceFetch } from './client';
import { MarketplaceAppsError, MarketplaceConnectionError, MarketplaceUnsupportedVersionError } from './errors';
import { getMarketplaceHeaders } from './headers';
import { getWorkspaceAccessToken } from '../../lib/cloud';
import { SystemLogger } from '../../lib/logger/system';
import { settings } from '../../settings';

export async function fetchMarketplaceApps(endUserID?: string): Promise<App[]> {
	const headers: Record<string, string> = { ...getMarketplaceHeaders() };
	try {
		const token = await getWorkspaceAccessToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
	} catch {
		// listing still works without a cloud token for public catalog data
	}

	let response;
	try {
		response = await marketplaceFetch('v1/apps', {
			headers,
			ignoreSsrfValidation: false,
			allowList: settings.get<string>('SSRF_Allowlist'),
			params: {
				...(endUserID && { endUserID }),
			},
		});
	} catch {
		throw new MarketplaceConnectionError('Marketplace_Bad_Marketplace_Connection');
	}

	const payload = await response.json();

	if (response.status === 200) {
		if (!Array.isArray(payload)) {
			throw new MarketplaceAppsError('Marketplace_Failed_To_Fetch_Apps');
		}

		return payload as App[];
	}

	SystemLogger.error({ msg: 'Error fetching marketplace apps', status: response.status, response: payload });

	if (response.status === 426 && payload?.errorMsg === 'unsupported version') {
		throw new MarketplaceUnsupportedVersionError();
	}

	if (response.status === 400 && payload?.code === 200) {
		throw new MarketplaceAppsError('Marketplace_Invalid_Apps_Engine_Version');
	}

	throw new MarketplaceAppsError('Marketplace_Failed_To_Fetch_Apps');
}
