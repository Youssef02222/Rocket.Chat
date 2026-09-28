import type { IMessage, IRoom, IUser } from '@rocket.chat/core-typings';

export class BeforeSaveCannedResponse {
	static enabled = false;

	async replacePlaceholders({ message }: { message: IMessage; room: IRoom; user: Pick<IUser, '_id'> }): Promise<IMessage> {
		return message;
	}
}
