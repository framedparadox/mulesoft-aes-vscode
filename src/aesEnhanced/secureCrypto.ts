import * as crypto from 'crypto';

/**
 * MuleSoft Secure Properties compatible symmetric encryption / decryption.
 *
 * Unlike the AES-only tool, this module replicates the broader MuleSoft secure
 * configuration properties generator: it supports several algorithms (AES,
 * Blowfish, DES, DESede, RC2, RCA), cipher modes (CBC, CFB, ECB, OFB) and an
 * optional random IV, wrapping the ciphertext in the `![base64]` format.
 *
 * With AES / CBC and no random IV the IV is derived from the first 16
 * characters of the key — a 16-character key selects AES-128, 24 selects
 * AES-192 and 32 selects AES-256.
 *
 * When random IVs are enabled the generated IV is prepended to the ciphertext
 * before base64 encoding (and read back from the front on decryption).
 */

export type CryptoAlgorithm = 'AES' | 'Blowfish' | 'DES' | 'DESede' | 'RC2' | 'RCA';
export type CryptoMode = 'CBC' | 'CFB' | 'ECB' | 'OFB';

export interface CryptoOptions {
    algorithm?: CryptoAlgorithm;
    mode?: CryptoMode;
    useRandomIv?: boolean;
}

/** Algorithms offered in the UI (matching the MuleSoft secure properties tool). */
export const SUPPORTED_ALGORITHMS: CryptoAlgorithm[] = ['AES', 'Blowfish', 'DES', 'DESede', 'RC2', 'RCA'];

/** Cipher modes ("state") offered in the UI. */
export const SUPPORTED_MODES: CryptoMode[] = ['CBC', 'CFB', 'ECB', 'OFB'];

const MIN_KEY_LENGTH = 16;

interface ResolvedCipher {
    /** OpenSSL cipher name, e.g. `aes-256-cbc`. */
    name: string;
    /** Key material sized for the algorithm. */
    keyBytes: Buffer;
    /** IV length in bytes (0 for stream ciphers). */
    ivLength: number;
    /** Stream ciphers (RC4) take no mode and no IV. */
    isStream: boolean;
}

function requireKeyBytes(keyBuffer: Buffer, length: number, algorithm: CryptoAlgorithm): Buffer {
    if (keyBuffer.length < length) {
        throw new Error(`${algorithm} requires a key of at least ${length} characters`);
    }
    return keyBuffer.subarray(0, length);
}

function resolveCipher(algorithm: CryptoAlgorithm, mode: CryptoMode, keyBuffer: Buffer): ResolvedCipher {
    const modeName = mode.toLowerCase();

    switch (algorithm) {
        case 'AES': {
            const bits = keyBuffer.length >= 32 ? 256 : keyBuffer.length >= 24 ? 192 : 128;
            return {
                name: `aes-${bits}-${modeName}`,
                keyBytes: keyBuffer.subarray(0, bits / 8),
                ivLength: 16,
                isStream: false,
            };
        }
        case 'Blowfish':
            return {
                name: `bf-${modeName}`,
                keyBytes: keyBuffer.subarray(0, Math.min(keyBuffer.length, 56)),
                ivLength: 8,
                isStream: false,
            };
        case 'DES':
            return { name: `des-${modeName}`, keyBytes: requireKeyBytes(keyBuffer, 8, algorithm), ivLength: 8, isStream: false };
        case 'DESede':
            return {
                name: `des-ede3-${modeName}`,
                keyBytes: requireKeyBytes(keyBuffer, 24, algorithm),
                ivLength: 8,
                isStream: false,
            };
        case 'RC2':
            return { name: `rc2-${modeName}`, keyBytes: requireKeyBytes(keyBuffer, 16, algorithm), ivLength: 8, isStream: false };
        case 'RCA':
            return {
                name: 'rc4',
                keyBytes: keyBuffer.subarray(0, Math.min(keyBuffer.length, 256)),
                ivLength: 0,
                isStream: true,
            };
        default:
            throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
}

function ensureSupported(name: string): void {
    if (!crypto.getCiphers().includes(name)) {
        throw new Error(`Cipher "${name}" is not supported by this runtime`);
    }
}

function validateKey(key: string): void {
    if (key.length < MIN_KEY_LENGTH) {
        throw new Error(`Key must be at least ${MIN_KEY_LENGTH} characters long`);
    }
}

/** Whether the algorithm/mode combination uses an initialization vector. */
function usesIv(spec: ResolvedCipher, mode: CryptoMode): boolean {
    return !spec.isStream && mode !== 'ECB' && spec.ivLength > 0;
}

/** Encrypt plaintext and wrap it in MuleSoft's `![base64]` format. */
export function encrypt(text: string, key: string, options: CryptoOptions = {}): string {
    const { algorithm = 'AES', mode = 'CBC', useRandomIv = false } = options;
    validateKey(key);

    const keyBuffer = Buffer.from(key, 'utf8');
    const spec = resolveCipher(algorithm, mode, keyBuffer);
    ensureSupported(spec.name);

    let iv: Buffer | null = null;
    if (usesIv(spec, mode)) {
        iv = useRandomIv ? crypto.randomBytes(spec.ivLength) : Buffer.from(key.substring(0, spec.ivLength), 'utf8');
    }

    const cipher = crypto.createCipheriv(spec.name, spec.keyBytes, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]);
    const payload = useRandomIv && iv ? Buffer.concat([iv, encrypted]) : encrypted;

    return `![${payload.toString('base64')}]`;
}

/** Decrypt a value, accepting either raw base64 or MuleSoft's `![base64]` wrapper. */
export function decrypt(text: string, key: string, options: CryptoOptions = {}): string {
    const { algorithm = 'AES', mode = 'CBC', useRandomIv = false } = options;
    validateKey(key);

    const keyBuffer = Buffer.from(key, 'utf8');
    const spec = resolveCipher(algorithm, mode, keyBuffer);
    ensureSupported(spec.name);

    let encryptedText = text.trim();
    if (encryptedText.startsWith('![') && encryptedText.endsWith(']')) {
        encryptedText = encryptedText.substring(2, encryptedText.length - 1);
    }

    let data = Buffer.from(encryptedText, 'base64');
    let iv: Buffer | null = null;
    if (usesIv(spec, mode)) {
        if (useRandomIv) {
            if (data.length <= spec.ivLength) {
                throw new Error(`Encrypted payload is too short to contain a ${spec.ivLength}-byte random IV`);
            }
            iv = data.subarray(0, spec.ivLength);
            data = data.subarray(spec.ivLength);
        } else {
            iv = Buffer.from(key.substring(0, spec.ivLength), 'utf8');
        }
    }

    const decipher = crypto.createDecipheriv(spec.name, spec.keyBytes, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
