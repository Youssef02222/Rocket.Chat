import { generateKeyPairSync } from 'node:crypto';

/**
 * Returns a 32-byte Ed25519 seed used as a default Matrix signing key.
 * The seed is generated with Node's native Ed25519 keygen (PKCS#8, last 32 bytes).
 */
export function generateEd25519RandomSecretKey(): Buffer {
	const { privateKey } = generateKeyPairSync('ed25519');
	const der = privateKey.export({ format: 'der', type: 'pkcs8' });
	return Buffer.from(der).subarray(-32);
}

/** Matrix MXID shape: @localpart:domain (public spec, independent of EE federation). */
export function validateFederatedUsername(mxid: string): boolean {
	if (!mxid.startsWith('@')) {
		return false;
	}

	const withoutAt = mxid.slice(1);
	const colon = withoutAt.indexOf(':');
	if (colon <= 0) {
		return false;
	}

	const localpart = withoutAt.slice(0, colon);
	const domain = withoutAt.slice(colon + 1);
	return localpart.length > 0 && domain.length > 0;
}
