import { NPS } from '@rocket.chat/core-services';
import type { Cloud, IBanner, Optional } from '@rocket.chat/core-typings';

import { getAndCreateNpsSurvey } from '../../../services/nps/getAndCreateNpsSurvey';

export const handleNpsOnWorkspaceSync = async (nps: Cloud.NpsSurveyAnnouncement) => {
	const { id: npsId, startAt, expireAt } = nps;

	await NPS.create({
		npsId,
		startAt,
		expireAt,
		createdBy: {
			_id: 'rocket.cat',
			username: 'rocket.cat',
		},
	});

	const now = new Date();

	if (startAt.getFullYear() === now.getFullYear() && startAt.getMonth() === now.getMonth() && startAt.getDate() === now.getDate()) {
		await getAndCreateNpsSurvey(npsId);
	}
};

export const handleBannerOnWorkspaceSync = async (_banners: Optional<IBanner, '_updatedAt'>[]) => {
	// FOSS: do not persist commercial Cloud banners (Starter plan / upsell dialogs).
};

export const handleAnnouncementsOnWorkspaceSync = async (_announcements: {
	create: Cloud.Announcement[];
	delete?: Cloud.Announcement['_id'][];
}) => {
	// FOSS: do not persist commercial Cloud announcements.
};
