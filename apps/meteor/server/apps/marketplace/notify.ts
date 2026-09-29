import type { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';

import { marketplaceFetch } from './client';
import { Info } from '../../../app/utils/rocketchat.info';
import { getWorkspaceAccessToken } from '../../lib/cloud';
import { settings } from '../../settings';

type MarketplaceInstallAction = 'install' | 'update' | 'uninstall';

export async function notifyMarketplaceInstall(action: MarketplaceInstallAction, appInfo: IAppInfo): Promise<void> {
	const headers: { Authorization?: string } = {};

	try {
		const token = await getWorkspaceAccessToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
	} catch {
		// workspace token is optional for this notification
	}

	try {
		await marketplaceFetch(`v1/apps/${appInfo.id}/install`, {
			method: 'POST',
			headers,
			body: {
				action,
				appName: appInfo.name,
				appSlug: appInfo.nameSlug,
				appVersion: appInfo.version,
				rocketChatVersion: Info.version,
				engineVersion: Info.marketplaceApiVersion,
				siteUrl: settings.get<string>('Site_Url') ?? '',
			},
			ignoreSsrfValidation: true,
		});
	} catch {
		// marketplace install telemetry must not block local install
	}
}
