import fileType from 'file-type';

import { mime as MIME } from '../../app/utils/lib/mimeTypes';

export function determineFileType(buffer: Buffer, name: string): string {
	const lookup = MIME.lookup(name);
	if (lookup) {
		return Array.isArray(lookup) ? lookup[0] : lookup;
	}

	const detectedType = fileType(buffer);
	if (detectedType) {
		return detectedType.mime;
	}

	return 'application/octet-stream';
}
