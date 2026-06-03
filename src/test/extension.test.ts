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

    test('default options reproduce AES/CBC output byte-for-byte', () => {
        const plaintext = 'mySecretPassword123';
        assert.strictEqual(encrypt(plaintext, key16), encrypt(plaintext, key16, { algorithm: 'AES', mode: 'CBC' }));
    });

    test('round-trips with random IVs (different ciphertext each time)', () => {
        const plaintext = 'mySecretPassword123';
        const options = { algorithm: 'AES', mode: 'CBC', useRandomIv: true } as const;
        const a = encrypt(plaintext, key32, options);
        const b = encrypt(plaintext, key32, options);
        assert.notStrictEqual(a, b, 'random IV should produce different ciphertext');
        assert.strictEqual(decrypt(a, key32, options), plaintext);
        assert.strictEqual(decrypt(b, key32, options), plaintext);
    });

    test('round-trips across AES cipher modes', () => {
        const plaintext = 'mode coverage test';
        for (const mode of ['CBC', 'CFB', 'ECB', 'OFB'] as const) {
            assert.strictEqual(
                decrypt(encrypt(plaintext, key16, { mode }), key16, { mode }),
                plaintext,
                `AES/${mode} should round-trip`
            );
        }
    });

    test('round-trips with DESede (3DES)', () => {
        const plaintext = '3des secret';
        const options = { algorithm: 'DESede', mode: 'CBC' } as const;
        assert.strictEqual(decrypt(encrypt(plaintext, key32, options), key32, options), plaintext);
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
