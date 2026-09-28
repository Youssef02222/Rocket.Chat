import { Presence } from '@rocket.chat/core-services';
import { InstanceStatus } from '@rocket.chat/instance-status';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { throttle } from 'underscore';

const updateConns = throttle(function _updateConns() {
	void InstanceStatus.updateConnections(Meteor.server.sessions.size);
}, 30000);

Meteor.startup(() => {
	const nodeId = InstanceStatus.id();

	Meteor.onConnection((connection) => {
		const session = Meteor.server.sessions.get(connection.id);

		connection.onClose(async () => {
			if (!session) {
				return;
			}

			await Presence.removeConnection(session.userId, connection.id, nodeId);
			updateConns();
		});
	});

	process.on('exit', async () => {
		await Presence.removeLostConnections(nodeId);
	});

	Accounts.onLogin((login: { connection?: { id?: string }; user?: { _id: string } }): void => {
		if (!login.connection?.id) {
			return;
		}

		const session = Meteor.server.sessions.get(login.connection.id);
		if (!session) {
			return;
		}

		void (async function () {
			if (login.user?._id) {
				await Presence.newConnection(login.user._id, login.connection?.id, nodeId);
			}
			updateConns();
		})();
	});

	Accounts.onLogout((login: { connection?: { id?: string }; user?: { _id: string } }): void => {
		void Presence.removeConnection(login.user?._id, login.connection?.id, nodeId);
		updateConns();
	});
});
