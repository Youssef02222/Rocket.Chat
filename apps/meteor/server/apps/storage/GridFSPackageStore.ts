import { AppSourceStorage } from '@rocket.chat/apps/dist/server/storage/AppSourceStorage';
import type { IAppStorageItem } from '@rocket.chat/apps/dist/server/storage/IAppStorageItem';
import { streamToBuffer } from '@rocket.chat/tools';
import { MongoInternals } from 'meteor/mongo';
import { NpmModuleMongodb } from 'meteor/npm-mongo';
import { ObjectId } from 'mongodb';

export class GridFSPackageStore extends AppSourceStorage {
	private readonly pathPrefix = 'GridFS:/';

	private readonly bucket: NpmModuleMongodb.GridFSBucket;

	constructor() {
		super();

		const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo;
		this.bucket = new NpmModuleMongodb.GridFSBucket(db as never, {
			bucketName: 'rocketchat_apps_packages',
			chunkSizeBytes: 1024 * 255,
		});
	}

	public async store(item: IAppStorageItem, zip: Buffer): Promise<string> {
		return new Promise((resolve, reject) => {
			const writeStream = this.bucket
				.openUploadStream(this.itemToFilename(item))
				.on('finish', () => resolve(this.idToPath(writeStream.id)))
				.on('error', (error: Error) => reject(error));

			writeStream.write(zip);
			writeStream.end();
		});
	}

	public async fetch(item: IAppStorageItem): Promise<Buffer> {
		return streamToBuffer(this.bucket.openDownloadStream(this.itemToObjectId(item)));
	}

	public async update(item: IAppStorageItem, zip: Buffer): Promise<string> {
		return new Promise((resolve, reject) => {
			const writeStream = this.bucket
				.openUploadStream(this.itemToFilename(item))
				.on('finish', () => {
					resolve(this.idToPath(writeStream.id));
					void this.remove(item).catch(() => undefined);
				})
				.on('error', (error: Error) => reject(error));

			writeStream.write(zip);
			writeStream.end();
		});
	}

	public async remove(item: IAppStorageItem): Promise<void> {
		try {
			await this.bucket.delete(this.itemToObjectId(item));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : '';
			if (message.includes('File not found for id')) {
				return;
			}

			throw error;
		}
	}

	private itemToFilename(item: IAppStorageItem): string {
		return `${item.info.nameSlug}-${item.info.version}.package`;
	}

	private idToPath(id: NpmModuleMongodb.GridFSBucketWriteStream['id']): string {
		return this.pathPrefix + String(id);
	}

	private itemToObjectId(item: IAppStorageItem): ObjectId {
		return new ObjectId(item.sourcePath?.substring(this.pathPrefix.length));
	}
}
