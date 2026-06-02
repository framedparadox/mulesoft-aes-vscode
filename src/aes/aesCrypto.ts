import * as crypto from 'crypto';

/**
 * MuleSoft-compatible AES encryption / decryption.
 *
 * MuleSoft's secure configuration properties use AES/CBC/PKCS5 with the IV
 * derived from the first 16 characters of the key, and wrap the ciphertext in
 * the `![base64]` format. A 16-character key selects AES-128-CBC; a
 * 32-character key selects AES-256-CBC.
 */

const MIN_KEY_LENGTH = 16;

function resolveAlgorithm(keyByteLength: number): 'aes-128-cbc' | 'aes-256-cbc' {
    return keyByteLength === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
}

function buildCipherInputs(key: string): { algorithm: 'aes-128-cbc' | 'aes-256-cbc'; keyBytes: Buffer; iv: Buffer } {
    if (key.length < MIN_KEY_LENGTH) {
        throw new Error(`Key must be at least ${MIN_KEY_LENGTH} characters long`);
    }

    const keyBuffer = Buffer.from(key, 'utf8');
    const algorithm = resolveAlgorithm(keyBuffer.length);
    const keyBytes = keyBuffer.subarray(0, algorithm === 'aes-256-cbc' ? 32 : 16);
    const iv = Buffer.from(key.substring(0, 16), 'utf8');

    return { algorithm, keyBytes, iv };
}

/** Encrypt plaintext and wrap it in MuleSoft's `![base64]` format. */
export function encrypt(text: string, key: string): string {
    const { algorithm, keyBytes, iv } = buildCipherInputs(key);
    const cipher = crypto.createCipheriv(algorithm, keyBytes, iv);
    const encrypted = cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
    return `![${encrypted}]`;
}

/** Decrypt a value, accepting either raw base64 or MuleSoft's `![base64]` wrapper. */
export function decrypt(text: string, key: string): string {
    const { algorithm, keyBytes, iv } = buildCipherInputs(key);

    let encryptedText = text.trim();
    if (encryptedText.startsWith('![') && encryptedText.endsWith(']')) {
        encryptedText = encryptedText.substring(2, encryptedText.length - 1);
    }

    const decipher = crypto.createDecipheriv(algorithm, keyBytes, iv);
    return decipher.update(encryptedText, 'base64', 'utf8') + decipher.final('utf8');
}
