import type { IMediaCall, IUser } from '@rocket.chat/core-typings';
import { Emitter } from '@rocket.chat/emitter';
import type { CallFeature, ClientMediaSignal, ServerMediaCallSignal, ServerMediaSignal } from '@rocket.chat/media-signaling';

export type VoipPushNotificationType = 'incoming_call' | 'remoteEnded' | 'answeredElsewhere' | 'declinedElsewhere' | 'unanswered';
export type VoipPushNotificationEventType = 'new' | 'answer' | 'end';

export type MediaCallServerEvents = {
	callUpdated: { callId: string; dtmf?: unknown };
	callActivated: { callId: string; uids: IUser['_id'][] };
	callEnded: { callId: string; uids: IUser['_id'][] };
	signalRequest: { toUid: IUser['_id']; signal: ServerMediaSignal };
	historyUpdate: { callId: string };
	pushNotificationRequest: { callId: string; event: VoipPushNotificationEventType };
};

export type IMediaCallServerSettings = {
	internalCalls: {
		requireExtensions: boolean;
		routeExternally: 'never' | 'preferably' | 'always';
	};
	sip: {
		enabled: boolean;
		drachtio: { host: string; port: number; secret: string };
		sipServer: { host: string; port: number };
	};
	mobileRinging: boolean;
	permissionCheck: (uid: IUser['_id'], callType: 'internal' | 'external' | 'any') => Promise<boolean>;
	isFeatureAvailableForUser: (uid: IUser['_id'], feature: CallFeature) => boolean;
};

const emitter = new Emitter<MediaCallServerEvents>();

export const callServer = {
	emitter,
	sendSignal(_toUid: IUser['_id'], _signal: ServerMediaSignal): void {
		// FOSS stub: team VoIP media calls are not started.
	},
	reportCallUpdate(_params: { callId: string }): void {
		// no-op
	},
	updateCallHistory(_params: { callId: string }): void {
		// no-op
	},
	sendPushNotification(_params: { callId: string; event: VoipPushNotificationEventType }): void {
		// no-op
	},
	async receiveSignal(_fromUid: IUser['_id'], _signal: ClientMediaSignal, _options?: { throwIfSkipped?: boolean }): Promise<void> {
		// no-op
	},
	receiveCallUpdate(_params: { callId: string }): void {
		// no-op
	},
	async hangupExpiredCalls(): Promise<void> {
		// no-op
	},
	scheduleExpirationCheck(): void {
		// no-op
	},
	configure(_settings: IMediaCallServerSettings): void {
		// no-op
	},
	async requestCall(_params: unknown): Promise<void> {
		// no-op
	},
	async permissionCheck(_uid: IUser['_id'], _callType: 'internal' | 'external' | 'any'): Promise<boolean> {
		return false;
	},
	isFeatureAvailableForUser(_uid: IUser['_id'], _feature: CallFeature): boolean {
		return false;
	},
};

export async function getSignalsForExistingCall(
	_call: IMediaCall,
	_uid: IUser['_id'],
	_contractId: string,
): Promise<ServerMediaCallSignal[]> {
	return [];
}
