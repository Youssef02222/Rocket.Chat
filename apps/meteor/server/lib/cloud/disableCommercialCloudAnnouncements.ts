import { Banner } from '@rocket.chat/core-services';
import { Banners, Settings } from '@rocket.chat/models';

import { SystemLogger } from '../logger/system';
import { notifyOnSettingChangedById } from '../notifyListener';

const CLOUD_ANNOUNCEMENTS_APP_ID = 'cloud-announcements-core';

export async function disableCommercialCloudAnnouncements(): Promise<void> {
	const banners = await Banners.find({
		'view.appId': CLOUD_ANNOUNCEMENTS_APP_ID,
		'active': { $ne: false },
	}).toArray();

	for (const banner of banners) {
		await Banner.disable(banner._id);
	}

	if ((await Settings.updateValueById('Cloud_Sync_Announcement_Payload', 'null')).modifiedCount) {
		void notifyOnSettingChangedById('Cloud_Sync_Announcement_Payload');
	}

	if (banners.length > 0) {
		SystemLogger.info({
			msg: 'Disabled commercial Cloud announcement banners',
			count: banners.length,
		});
	}
}
