import * as vscode from 'vscode';

/** A named AES key identifier (e.g. DEV, FIT, UAT, PROD) and its encryption key. */
export interface AesKeyIdentifier {
    keyIdentifier: string;
    key: string;
}

const STORAGE_KEY = 'aes.keyIdentifiers';
const DEFAULT_NAMES = ['DEV', 'FIT', 'UAT', 'PROD'] as const;

export const DEFAULT_AES_KEY_IDENTIFIERS: AesKeyIdentifier[] = DEFAULT_NAMES.map((keyIdentifier) => ({
    keyIdentifier,
    key: '',
}));

type RawEntry = { keyIdentifier?: string; name?: string; key?: string };

export function normalizeAesKeyIdentifiers(entries: RawEntry[] | undefined): AesKeyIdentifier[] {
    if (!entries || entries.length === 0) {
        return DEFAULT_AES_KEY_IDENTIFIERS;
    }

    const normalized = entries.map((entry) => ({
        keyIdentifier: (entry.keyIdentifier ?? entry.name ?? '').trim(),
        key: entry.key ?? '',
    }));

    const hasAnyValue = normalized.some((entry) => entry.keyIdentifier.length > 0 || entry.key.length > 0);
    return hasAnyValue ? normalized : DEFAULT_AES_KEY_IDENTIFIERS;
}

export async function getAesKeyIdentifiers(context: vscode.ExtensionContext): Promise<AesKeyIdentifier[]> {
    const secretJson = await context.secrets.get(STORAGE_KEY);
    if (secretJson !== undefined) {
        try {
            return normalizeAesKeyIdentifiers(JSON.parse(secretJson));
        } catch {
            return DEFAULT_AES_KEY_IDENTIFIERS;
        }
    }
    return DEFAULT_AES_KEY_IDENTIFIERS;
}

export async function setAesKeyIdentifiers(
    context: vscode.ExtensionContext,
    identifiers: AesKeyIdentifier[]
): Promise<void> {
    await context.secrets.store(STORAGE_KEY, JSON.stringify(identifiers));
}

/**
 * Add a new KeyIdentifier, or update the key of an existing one with the same
 * (case-sensitive) name. Returns the resulting list.
 */
export async function addAesKeyIdentifier(
    context: vscode.ExtensionContext,
    keyIdentifier: string,
    key: string
): Promise<AesKeyIdentifier[]> {
    const trimmedName = keyIdentifier.trim();
    const existing = await getAesKeyIdentifiers(context);
    const next = existing.map((entry) => ({ ...entry }));
    const index = next.findIndex((entry) => entry.keyIdentifier === trimmedName);
    if (index >= 0) {
        next[index].key = key;
    } else {
        next.push({ keyIdentifier: trimmedName, key });
    }
    await setAesKeyIdentifiers(context, next);
    return next;
}
