import type { LicenseManager } from '@rocket.chat/license';
import type { MiddlewareHandler } from 'hono';

import type { FailureResult, TypedOptions } from '../../definition';

export const license =
	(options: TypedOptions, licenseManager: LicenseManager): MiddlewareHandler =>
	async (c, next) => {
		if (!options.license) {
			return next();
		}

		const allowed = options.license.every((moduleName) => licenseManager.hasModule(moduleName));

		const failure: FailureResult<{
			error: string;
			errorType: string;
		}> = {
			statusCode: 400,
			body: {
				success: false,
				error: 'This is an enterprise feature [error-action-not-allowed]',
				errorType: 'error-action-not-allowed',
			},
		};

		if (!allowed) {
			return c.json(failure.body, failure.statusCode);
		}

		return next();
	};
