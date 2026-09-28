import type { LicenseBehavior } from '@rocket.chat/core-typings';

export function validateWarnLimit(max: number, currentValue: number, behavior: LicenseBehavior, extraCount = 0) {
	switch (behavior) {
		case 'prevent_action':
			return extraCount ? currentValue > max : currentValue >= max;
		default:
			return currentValue > max;
	}
}
