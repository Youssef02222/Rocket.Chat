import type { IBrokerNode, IPresence } from '@rocket.chat/core-services';
import { ServiceClass } from '@rocket.chat/core-services';
import type { IUser } from '@rocket.chat/core-typings';
import { UserStatus } from '@rocket.chat/core-typings';
import { Users, UsersSessions } from '@rocket.chat/models';

const STATUS_TEXT_MAX_LENGTH = 120;

const normalizeStatusText = (text: string): string => text.trim().substring(0, STATUS_TEXT_MAX_LENGTH);

export class Presence extends ServiceClass implements IPresence {
	protected name = 'presence';

	private broadcastEnabled = true;

	private peakConnections = 0;

	async newConnection(
		uid: string | undefined,
		session: string | undefined,
		nodeId: string,
	): Promise<{ uid: string; connectionId: string } | undefined> {
		if (!uid || !session) {
			return;
		}

		await UsersSessions.addConnectionById(uid, {
			id: session,
			instanceId: nodeId,
			status: UserStatus.ONLINE,
		});

		await this.refreshUserPresence(uid);
		return { uid, connectionId: session };
	}

	async removeConnection(
		uid: string | undefined,
		session: string | undefined,
		_nodeId?: string,
	): Promise<{ uid: string; session: string } | undefined> {
		if (!uid || !session) {
			return;
		}

		await UsersSessions.removeConnectionByConnectionId(session);
		await this.refreshUserPresence(uid);
		return { uid, session };
	}

	async updateConnection(uid: string, connectionId: string): Promise<{ uid: string; connectionId: string } | undefined> {
		const result = await UsersSessions.updateOne(
			{ '_id': uid, 'connections.id': connectionId },
			{ $set: { 'connections.$._updatedAt': new Date() } },
		);

		if (result.modifiedCount === 0) {
			return;
		}

		await this.refreshUserPresence(uid);
		return { uid, connectionId };
	}

	async removeLostConnections(nodeID?: string): Promise<string[]> {
		if (nodeID) {
			const affectedUsers = await UsersSessions.findByInstanceId(nodeID).toArray();
			const { modifiedCount } = await UsersSessions.removeConnectionsFromInstanceId(nodeID);
			if (modifiedCount === 0) {
				return [];
			}

			const ids = affectedUsers.map(({ _id }) => _id);
			await Promise.all(ids.map((id) => this.refreshUserPresence(id)));
			return ids;
		}

		const nodes = (await this.api?.nodeList()) || [];
		const ids = nodes.filter((node) => node.available).map(({ id }) => id);
		if (ids.length === 0) {
			return [];
		}

		const affectedUsers = await UsersSessions.findByOtherInstanceIds(ids, { projection: { _id: 1 } }).toArray();
		const { modifiedCount } = await UsersSessions.removeConnectionsFromOtherInstanceIds(ids);
		if (modifiedCount === 0) {
			return [];
		}

		const userIds = affectedUsers.map(({ _id }) => _id);
		await Promise.all(userIds.map((id) => this.refreshUserPresence(id)));
		return userIds;
	}

	async setStatus(userId: string, status: UserStatus, statusText?: string, _statusExpiresAt?: Date): Promise<boolean> {
		if (status === UserStatus.ONLINE && !statusText) {
			return this.clearActiveState(userId);
		}

		return this.setActiveState(userId, {
			statusDefault: status,
			...(statusText != null && { statusText: normalizeStatusText(statusText) }),
		});
	}

	async setActiveState(
		userId: string,
		newState: Pick<IUser, 'statusDefault' | 'statusSource' | 'statusText' | 'statusExpiresAt' | 'statusId'>,
	): Promise<boolean> {
		const user = await Users.findOneById(userId, { projection: { status: 1 } });
		if (!user) {
			return false;
		}

		const status = newState.statusDefault ?? UserStatus.ONLINE;
		await Users.updateStatusById(userId, {
			status,
			statusConnection: status,
			statusDefault: newState.statusDefault,
			statusText: newState.statusText,
		});
		this.broadcast(
			{
				_id: userId,
				status,
				statusText: newState.statusText,
				roles: [],
			},
			user.status,
		);
		return true;
	}

	async endActiveState(userId: string, _statusId?: string): Promise<boolean> {
		return this.refreshUserPresence(userId);
	}

	async clearActiveState(userId: string): Promise<boolean> {
		return this.refreshUserPresence(userId);
	}

	async setConnectionStatus(uid: string, status: UserStatus, session: string): Promise<boolean> {
		const result = await UsersSessions.updateConnectionStatusById(uid, session, status);
		await this.refreshUserPresence(uid);
		return !!result.modifiedCount;
	}

	toggleBroadcast(enabled: boolean): void {
		this.broadcastEnabled = enabled;
	}

	getConnectionCount(): { current: number; max: number } {
		return { current: 0, max: -1 };
	}

	getPeakConnections(reset = false): number {
		const peak = this.peakConnections;
		if (reset) {
			this.peakConnections = 0;
		}
		return peak;
	}

	resetPeakConnections(): void {
		this.peakConnections = 0;
	}

	async onNodeDisconnected({ node }: { node: IBrokerNode }): Promise<void> {
		const affectedUsers = await this.removeLostConnections(node.id);
		await Promise.all(affectedUsers.map((uid) => this.refreshUserPresence(uid)));
	}

	private async refreshUserPresence(uid: string): Promise<boolean> {
		const user = await Users.findOneById(uid, {
			projection: { username: 1, status: 1, statusDefault: 1, statusText: 1, roles: 1 },
		});
		if (!user) {
			return false;
		}

		const session = await UsersSessions.findOneById(uid);
		const connections = session?.connections ?? [];
		const hasOnline = connections.some((connection) => connection.status === UserStatus.ONLINE);
		const hasAway = connections.some((connection) => connection.status === UserStatus.AWAY);

		const statusConnection = hasOnline ? UserStatus.ONLINE : hasAway ? UserStatus.AWAY : UserStatus.OFFLINE;
		const statusDefault = user.statusDefault ?? UserStatus.ONLINE;
		const status =
			statusConnection === UserStatus.OFFLINE
				? UserStatus.OFFLINE
				: statusDefault === UserStatus.ONLINE
					? statusConnection
					: statusDefault;

		if (status === user.status && statusConnection === (user as { statusConnection?: UserStatus }).statusConnection) {
			return false;
		}

		await Users.updateStatusById(uid, {
			status,
			statusConnection,
			statusText: user.statusText,
		});

		this.broadcast(
			{
				_id: uid,
				username: user.username,
				status,
				statusText: user.statusText,
				roles: user.roles,
			},
			user.status,
		);
		return true;
	}

	private broadcast(
		user: Pick<IUser, '_id' | 'username' | 'status' | 'statusText' | 'roles'>,
		previousStatus: UserStatus | undefined,
	): void {
		if (!this.broadcastEnabled) {
			return;
		}

		void this.api?.broadcast('presence.status', {
			user,
			previousStatus,
		});
	}
}
