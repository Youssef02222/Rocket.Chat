import { promises as fs } from 'node:fs';
import { join, normalize } from 'node:path';

import { AppSourceStorage } from '@rocket.chat/apps/dist/server/storage/AppSourceStorage';
import type { IAppStorageItem } from '@rocket.chat/apps/dist/server/storage/IAppStorageItem';

export class FileSystemPackageStore extends AppSourceStorage {
	private readonly pathPrefix = 'fs:/';

	private path = '';

	public setPath(path: string): void {
		this.path = path;
	}

	public async store(item: IAppStorageItem, zip: Buffer): Promise<string> {
		this.assertPath();
		const filePath = this.itemToFilename(item);
		await fs.writeFile(filePath, zip);
		return this.pathPrefix + filePath;
	}

	public async fetch(item: IAppStorageItem): Promise<Buffer> {
		if (!item.sourcePath) {
			throw new Error('Invalid source path');
		}

		return fs.readFile(item.sourcePath.substring(this.pathPrefix.length));
	}

	public async update(item: IAppStorageItem, zip: Buffer): Promise<string> {
		return this.store(item, zip);
	}

	public async remove(item: IAppStorageItem): Promise<void> {
		if (!item.sourcePath) {
			return;
		}

		await fs.unlink(item.sourcePath.substring(this.pathPrefix.length));
	}

	private assertPath(): void {
		if (!this.path) {
			throw new Error('Invalid path configured for file system App storage');
		}
	}

	private itemToFilename(item: IAppStorageItem): string {
		return `${normalize(join(this.path, item.id))}.zip`;
	}
}
