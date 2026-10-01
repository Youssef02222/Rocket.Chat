import { License } from '@rocket.chat/license';
import { Users } from '@rocket.chat/models';
import { isLicensesInfoProps, isLicensesValidateProps } from '@rocket.chat/rest-typings';
import { check } from 'meteor/check';

import { hasPermissionAsync } from '../../lib/authorization/hasPermission';
import { settings } from '../../settings';
import { API } from '../api';

/**
 * FOSS license surface. The marketplace UI reads `limits.privateApps` from
 * `/v1/licenses.info` to decide whether a private app (such as a sideloaded
 * Jitsi package) can be uploaded and enabled. This build does not apply a
 * commercial license, and the license manager already reports unlimited apps.
 */
API.v1.addRoute(
	'licenses.info',
	{ authRequired: true, validateParams: isLicensesInfoProps },
	{
		async get() {
			const unrestrictedAccess = await hasPermissionAsync(this.user, 'view-privileged-setting');
			const loadCurrentValues = unrestrictedAccess && Boolean(this.queryParams.loadValues);

			const license = await License.getInfo({
				limits: unrestrictedAccess,
				license: unrestrictedAccess,
				currentValues: loadCurrentValues,
			});

			try {
				const rawAnnouncement = settings.get<string>('Cloud_Sync_Announcement_Payload');
				const cloudSyncAnnouncement = JSON.parse(rawAnnouncement || 'null');
				const canManageCloud = await hasPermissionAsync(this.user, 'manage-cloud');
				return API.v1.success({
					license,
					...(canManageCloud && cloudSyncAnnouncement && { cloudSyncAnnouncement }),
				});
			} catch (error) {
				console.error('Unable to parse Cloud_Sync_Announcement_Payload', error);
			}

			return API.v1.success({
				license,
			});
		},
	},
);

API.v1.addRoute(
	'licenses.add',
	{ authRequired: true, permissionsRequired: ['edit-privileged-setting'] },
	{
		async post() {
			check(this.bodyParams, {
				license: String,
			});

			return API.v1.failure('Invalid license');
		},
	},
);

API.v1.addRoute(
	'licenses.validate',
	{ authRequired: true, permissionsRequired: ['edit-privileged-setting'], validateParams: isLicensesValidateProps },
	{
		async post() {
			return API.v1.failure({
				error: 'license-invalid',
				reasons: ['This build does not apply a commercial license. Install apps from a package instead.'],
			});
		},
	},
);

API.v1.addRoute(
	'licenses.maxActiveUsers',
	{ authRequired: true },
	{
		async get() {
			const maxActiveUsers = License.getMaxActiveUsers();
			const activeUsers = await Users.getActiveLocalUserCount();

			return API.v1.success({ maxActiveUsers: maxActiveUsers > 0 ? maxActiveUsers : null, activeUsers });
		},
	},
);
