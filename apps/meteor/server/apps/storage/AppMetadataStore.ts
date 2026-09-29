import type { IMarketplaceInfo } from '@rocket.chat/apps/dist/server/marketplace/IMarketplaceInfo';
import { AppMetadataStorage } from '@rocket.chat/apps/dist/server/storage/AppMetadataStorage';
import type { IAppStorageItem } from '@rocket.chat/apps/dist/server/storage/IAppStorageItem';
import type { AppStatus } from '@rocket.chat/apps-engine/definition/AppStatus';
import type { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import type { ISetting } from '@rocket.chat/apps-engine/definition/settings';
import type { Apps } from '@rocket.chat/models';
import { removeEmpty } from '@rocket.chat/tools';
import type { UpdateFilter } from 'mongodb';

export class AppMetadataStore extends AppMetadataStorage {
	constructor(private readonly db: typeof Apps) {
		super('mongodb');
	}

	public async create(item: IAppStorageItem): Promise<IAppStorageItem> {
		item.createdAt = new Date();
		item.updatedAt = new Date();

		const existing = await this.db.findOne({ $or: [{ id: item.id }, { 'info.nameSlug': item.info.nameSlug }] });
		if (existing) {
			throw new Error('App already exists.');
		}

		const document = removeEmpty(item);
		const id = (await this.db.insertOne(document)).insertedId as unknown as string;
		document._id = id;

		return document;
	}

	public async retrieveOne(id: string): Promise<IAppStorageItem | null> {
		return this.db.findOne({ $or: [{ _id: id }, { id }] }) as Promise<IAppStorageItem | null>;
	}

	public async retrieveAll(): Promise<Map<string, IAppStorageItem>> {
		const docs = await this.db.find({}).toArray();
		const items = new Map<string, IAppStorageItem>();
		docs.forEach((doc) => items.set(doc.id, doc));
		return items;
	}

	public async retrieveAllPrivate(): Promise<Map<string, IAppStorageItem>> {
		const docs = await this.db.find({ installationSource: 'private' }).toArray();
		const items = new Map<string, IAppStorageItem>();
		docs.forEach((doc) => items.set(doc.id, doc));
		return items;
	}

	public async remove(id: string): Promise<{ success: boolean }> {
		await this.db.deleteOne({ id });
		return { success: true };
	}

	public async updatePartialAndReturnDocument(
		{ _id, ...item }: IAppStorageItem,
		{ unsetPermissionsGranted = false } = {},
	): Promise<IAppStorageItem> {
		if (!_id) {
			throw new Error('Property _id is required to update an app storage item');
		}

		const updateQuery: UpdateFilter<IAppStorageItem> = {
			$set: item,
		};

		if (unsetPermissionsGranted) {
			delete item.permissionsGranted;
			updateQuery.$unset = { permissionsGranted: 1 };
		}

		const updated = await this.db.findOneAndUpdate({ _id }, updateQuery, { returnDocument: 'after' });
		if (!updated) {
			throw new Error('Failed to update app storage item');
		}

		return updated as IAppStorageItem;
	}

	public async updateStatus(_id: string, status: AppStatus): Promise<boolean> {
		const result = await this.db.updateOne({ _id }, { $set: { status } });
		return result.modifiedCount > 0;
	}

	public async updateSetting(_id: string, setting: ISetting): Promise<boolean> {
		const result = await this.db.updateOne({ _id }, { $set: { [`settings.${setting.id}`]: setting } });
		return result.modifiedCount > 0;
	}

	public async updateAppInfo(_id: string, info: IAppInfo): Promise<boolean> {
		const result = await this.db.updateOne({ _id }, { $set: { info } });
		return result.modifiedCount > 0;
	}

	public async updateMarketplaceInfo(_id: string, marketplaceInfo: IMarketplaceInfo[]): Promise<boolean> {
		const result = await this.db.updateOne({ _id }, { $set: { marketplaceInfo } });
		return result.modifiedCount > 0;
	}
}
