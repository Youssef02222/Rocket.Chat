import type { ILoggerStorageEntry } from '@rocket.chat/apps/dist/server/logging/ILoggerStorageEntry';
import type { IAppLogStorageFindOptions } from '@rocket.chat/apps/dist/server/storage/AppLogStorage';
import { AppLogStorage } from '@rocket.chat/apps/dist/server/storage/AppLogStorage';
import { InstanceStatus } from '@rocket.chat/instance-status';
import type { AppLogs } from '@rocket.chat/models';

export class AppLogStore extends AppLogStorage {
	constructor(private readonly db: typeof AppLogs) {
		super('mongodb');
	}

	async findPaginated(query: { [field: string]: unknown }, options?: IAppLogStorageFindOptions) {
		const { cursor, totalCount } = this.db.findPaginated<ILoggerStorageEntry>(query, options);
		const [logs, total] = await Promise.all([cursor.toArray(), totalCount]);

		return { logs, total };
	}

	async storeEntries(logEntry: ILoggerStorageEntry): Promise<ILoggerStorageEntry> {
		logEntry.instanceId = InstanceStatus.id();
		const id = (await this.db.insertOne(logEntry)).insertedId;
		const stored = await this.db.findOneById(id);
		if (!stored) {
			throw new Error('Failed to store app log entry');
		}

		return stored as ILoggerStorageEntry;
	}

	async getEntriesFor(appId: string): Promise<ILoggerStorageEntry[]> {
		return this.db.find({ appId }).toArray() as Promise<ILoggerStorageEntry[]>;
	}

	async removeEntriesFor(appId: string): Promise<void> {
		await this.db.deleteOne({ appId });
	}
}
