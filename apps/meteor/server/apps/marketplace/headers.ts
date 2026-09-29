import { Info } from '../../../app/utils/rocketchat.info';

export const marketplaceEngineVersion = Info.marketplaceApiVersion.replace(/-.*/g, '');

export function getMarketplaceHeaders(): Record<string, string> {
	return {
		'X-Apps-Engine-Version': marketplaceEngineVersion,
	};
}
