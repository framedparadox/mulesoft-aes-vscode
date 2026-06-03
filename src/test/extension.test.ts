import * as assert from 'assert';
import { decrypt, encrypt } from '../aes/aesCrypto';
import { decodeBase64, encodeBase64 } from '../base64/base64Codec';

suite('AES Crypto', () => {
    const key16 = '0123456789abcdef'; // 16 chars -> AES-128-CBC
    const key32 = '0123456789abcdef0123456789abcdef'; // 32 chars -> AES-256-CBC

    test('encrypt wraps output in MuleSoft ![...] format', () => {
        const result = encrypt('mySecret', key16);
        assert.ok(result.startsWith('!['));
        assert.ok(result.endsWith(']'));
    });

    test('round-trips with a 16-char (AES-128) key', () => {
        const plaintext = 'mySecretPassword123';
        assert.strictEqual(decrypt(encrypt(plaintext, key16), key16), plaintext);
    });

    test('round-trips with a 32-char (AES-256) key', () => {
        const plaintext = 'another secret value';
        assert.strictEqual(decrypt(encrypt(plaintext, key32), key32), plaintext);
    });

    test('decrypt accepts values without the ![...] wrapper', () => {
        const wrapped = encrypt('plain', key16);
        const raw = wrapped.substring(2, wrapped.length - 1);
        assert.strictEqual(decrypt(raw, key16), 'plain');
    });

    test('rejects keys shorter than 16 characters', () => {
        assert.throws(() => encrypt('x', 'short'), /at least 16/);
        assert.throws(() => decrypt('![abc]', 'short'), /at least 16/);
    });
});

suite('Base64 Codec', () => {
    test('encodes UTF-8 text to Base64', () => {
        assert.strictEqual(encodeBase64('Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==');
    });

    test('round-trips Unicode text', () => {
        const text = 'Hello, World! 日本語';
        assert.strictEqual(decodeBase64(encodeBase64(text)), text);
    });
});
