import { License } from '@rocket.chat/license';

import { settings } from './server/settings';

export const startRocketChat = async () => {
	await License.setWorkspaceUrl(settings.get<string>('Site_Url') ?? '');

	settings.watch<string>('Site_Url', (value) => {
		void License.setWorkspaceUrl(value);
	});
};
