import * as assert from 'assert';
import { CryptoOptions, decrypt, encrypt, SUPPORTED_ALGORITHMS, SUPPORTED_MODES } from '../aesEnhanced/secureCrypto';

// 32-char key satisfies the key-length requirement of every algorithm
// (AES-256 = 32, DESede = 24, RC2 = 16, DES = 8).
const KEY = '0123456789abcdef0123456789abcdef';

// Algorithms guaranteed to be available in modern OpenSSL (no legacy provider).
// The remaining algorithms (Blowfish, DES, RC2, RCA) are offered in the UI for
// fidelity but may be unavailable at runtime, in which case the module reports a
// clear error rather than crashing.
const ALWAYS_SUPPORTED = ['AES', 'DESede'];

/** Every option combination worth exercising for a given algorithm. */
function combinationsFor(algorithm: string): CryptoOptions[] {
    // RCA (RC4) is a stream cipher: the mode and IV are ignored.
    if (algorithm === 'RCA') {
        return [{ algorithm: 'RCA' }];
    }

    const combinations: CryptoOptions[] = [];
    for (const mode of SUPPORTED_MODES) {
        combinations.push({ algorithm, mode } as CryptoOptions);
        // Random IVs only apply when the mode actually uses an IV (not ECB).
        if (mode !== 'ECB') {
            combinations.push({ algorithm, mode, useRandomIv: true } as CryptoOptions);
        }
    }
    return combinations;
}

function describe(options: CryptoOptions): string {
    const mode = options.mode ? `/${options.mode}` : '';
    const iv = options.useRandomIv ? ' +randomIV' : '';
    return `${options.algorithm}${mode}${iv}`;
}

suite('Secure Properties Crypto', () => {
    const plaintext = 'MySecret Value 123! — café';

    test('defaults to AES/CBC with a derived IV', () => {
        assert.strictEqual(
            encrypt(plaintext, KEY),
            encrypt(plaintext, KEY, { algorithm: 'AES', mode: 'CBC', useRandomIv: false })
        );
    });

    test('wraps output in MuleSoft ![...] format', () => {
        const result = encrypt(plaintext, KEY);
        assert.ok(result.startsWith('!['));
        assert.ok(result.endsWith(']'));
    });

    test('decrypt accepts values without the ![...] wrapper', () => {
        const wrapped = encrypt('plain text value', KEY);
        const raw = wrapped.substring(2, wrapped.length - 1);
        assert.strictEqual(decrypt(raw, KEY), 'plain text value');
    });

    test('rejects keys shorter than 16 characters', () => {
        assert.throws(() => encrypt('x', 'short'), /at least 16/);
        assert.throws(() => decrypt('![abc]', 'short'), /at least 16/);
    });

    test('rejects random-IV payloads that do not contain ciphertext', () => {
        const ivOnly = `![${Buffer.alloc(16).toString('base64')}]`;
        assert.throws(() => decrypt(ivOnly, KEY, { algorithm: 'AES', mode: 'CBC', useRandomIv: true }), /too short/);
    });

    test('round-trips Unicode text', () => {
        const unicode = 'Hello, World! 日本語 🔐';
        assert.strictEqual(decrypt(encrypt(unicode, KEY), KEY), unicode);
    });

    // Exhaustively exercise every algorithm × mode × random-IV combination.
    for (const algorithm of SUPPORTED_ALGORITHMS) {
        for (const options of combinationsFor(algorithm)) {
            test(`round-trips ${describe(options)}`, () => {
                let ciphertext: string;
                try {
                    ciphertext = encrypt(plaintext, KEY, options);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    if (ALWAYS_SUPPORTED.includes(algorithm)) {
                        throw error; // these must always work
                    }
                    // Algorithm not available on this runtime: must fail clearly.
                    assert.match(message, /not supported by this runtime|requires a key/);
                    return;
                }

                assert.ok(ciphertext.startsWith('![') && ciphertext.endsWith(']'), 'output should be wrapped');
                assert.strictEqual(decrypt(ciphertext, KEY, options), plaintext, 'should round-trip');

                if (options.useRandomIv) {
                    // Random IV must produce different ciphertext on each run.
                    assert.notStrictEqual(ciphertext, encrypt(plaintext, KEY, options));
                } else {
                    // Deterministic (derived/no IV) must be reproducible.
                    assert.strictEqual(ciphertext, encrypt(plaintext, KEY, options));
                }
            });
        }
    }

    test('AES key length selects 128/192/256 and all round-trip', () => {
        const keys = ['0123456789abcdef', '0123456789abcdef01234567', '0123456789abcdef0123456789abcdef'];
        for (const key of keys) {
            for (const mode of SUPPORTED_MODES) {
                const options = { algorithm: 'AES', mode } as CryptoOptions;
                assert.strictEqual(decrypt(encrypt(plaintext, key, options), key, options), plaintext, `AES key ${key.length}/${mode}`);
            }
        }
    });
});
