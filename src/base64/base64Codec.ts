/** Base64 encode / decode helpers. */

/** Encode UTF-8 text to a Base64 string. */
export function encodeBase64(text: string): string {
    return Buffer.from(text, 'utf8').toString('base64');
}

/** Decode a Base64 string to UTF-8 text. */
export function decodeBase64(text: string): string {
    return Buffer.from(text, 'base64').toString('utf8');
}
