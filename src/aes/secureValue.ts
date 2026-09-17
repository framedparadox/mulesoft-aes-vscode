/**
 * Helpers shared by the AES and Secure Properties crypto modules for reading
 * values written in MuleSoft's `![base64]` format.
 */

/**
 * Strip the decorations a secure value picks up in a config file so only the
 * base64 payload is left.
 *
 * Values copied out of a YAML file usually keep the quotes that YAML requires
 * around `![...]` (a bare `!` is a tag indicator), and `.properties` files are
 * often hand-quoted too. Both wrappers are optional and are removed in the
 * order they nest: quotes outside, `![...]` inside.
 */
export function unwrapSecureValue(text: string): string {
    let value = text.trim();

    const quote = value[0];
    if (
        value.length >= 2 &&
        (quote === '"' || quote === "'") &&
        value.endsWith(quote)
    ) {
        value = value.slice(1, -1).trim();
    }

    if (value.startsWith('![') && value.endsWith(']')) {
        value = value.substring(2, value.length - 1);
    }

    return value;
}
