import { AppSourceStorage } from '@rocket.chat/apps/dist/server/storage/AppSourceStorage';
import type { IAppStorageItem } from '@rocket.chat/apps/dist/server/storage/IAppStorageItem';

import { FileSystemPackageStore } from './FileSystemPackageStore';
import { GridFSPackageStore } from './GridFSPackageStore';

export class PackageStore extends AppSourceStorage {
	private readonly filesystem = new FileSystemPackageStore();

	private readonly gridfs = new GridFSPackageStore();

	private storage!: AppSourceStorage;

	constructor(storageType: string | undefined, filesystemStoragePath: string | undefined) {
		super();
		this.setStorage(storageType ?? 'gridfs');
		this.setFileSystemStoragePath(filesystemStoragePath ?? '');
	}

	public setStorage(type: string): void {
		this.storage = type === 'filesystem' ? this.filesystem : this.gridfs;
	}

	public setFileSystemStoragePath(path: string): void {
		this.filesystem.setPath(path);
	}

	public async store(item: IAppStorageItem, zip: Buffer): Promise<string> {
		return this.storage.store(item, zip);
	}

	public async fetch(item: IAppStorageItem): Promise<Buffer> {
		return this.storage.fetch(item);
	}

	public async update(item: IAppStorageItem, zip: Buffer): Promise<string> {
		return this.storage.update(item, zip);
	}

	public async remove(item: IAppStorageItem): Promise<void> {
		return this.storage.remove(item);
	}
}
