import { decrypt, encrypt } from "../aes/aesCrypto";
import {
  FileCryptoOperation,
  FileFieldCandidate,
  FileKind,
  isSecureValue,
} from "./fileFields";

export interface FieldReplacement {
  field: FileFieldCandidate;
  replacement: string;
}

export interface FieldTransformFailure {
  field: FileFieldCandidate;
  message: string;
}

export interface FieldReplacementResult {
  replacements: FieldReplacement[];
  failures: FieldTransformFailure[];
}

const MIN_AES_KEY_LENGTH = 16;

/**
 * Values safe to emit as a bare YAML scalar: they start with a letter (so they
 * cannot be read as a number or an indicator) and contain no whitespace, flow
 * indicator, `:`, `#`, quote or backslash. Anything else is double quoted.
 */
const YAML_PLAIN_SAFE = /^[A-Za-z][^\s,[\]{}:#"'\\]*$/;

/**
 * Words YAML 1.1 readers (SnakeYAML, and therefore Mule) resolve to booleans or
 * null. They must stay quoted so the value survives as a string.
 */
const YAML_RESERVED_WORDS = new Set([
  "y",
  "n",
  "yes",
  "no",
  "true",
  "false",
  "on",
  "off",
  "null",
]);

/**
 * Render a value as a single-line YAML scalar.
 *
 * Field ranges for YAML cover the whole scalar token, quotes included, so the
 * replacement has to carry its own quoting. `![base64]` in particular must be
 * quoted: a bare `!` is a YAML tag indicator, so an unquoted secure value does
 * not parse.
 */
export function formatYamlScalar(value: string): string {
  if (
    YAML_PLAIN_SAFE.test(value) &&
    !YAML_RESERVED_WORDS.has(value.toLowerCase())
  ) {
    return value;
  }
  // JSON string escapes (\" \\ \b \f \n \r \t \uXXXX) are all valid inside a
  // YAML double-quoted scalar, and the result is always one line.
  return JSON.stringify(value);
}

export function validateAesKey(key: string): void {
  if (key.length < MIN_AES_KEY_LENGTH) {
    throw new Error(
      `Key must be at least ${MIN_AES_KEY_LENGTH} characters long`,
    );
  }
}

export function transformSelectedText(
  text: string,
  key: string,
  operation: FileCryptoOperation,
): string {
  if (text.length === 0) {
    throw new Error("Select a value to encrypt or decrypt.");
  }
  validateAesKey(key);

  if (operation === "encrypt") {
    if (isSecureValue(text)) {
      throw new Error("The selected value is already encrypted.");
    }
    return encrypt(text, key);
  }

  return decrypt(text, key);
}

export function computeFieldReplacements(
  fields: FileFieldCandidate[],
  key: string,
  operation: FileCryptoOperation,
  kind: FileKind,
): FieldReplacementResult {
  validateAesKey(key);

  const replacements: FieldReplacement[] = [];
  const failures: FieldTransformFailure[] = [];
  // Properties values are opaque byte strings with no quoting syntax, so the
  // raw transform output is written back verbatim. YAML needs scalar quoting.
  const format =
    kind === "yaml" ? formatYamlScalar : (value: string): string => value;

  for (const field of fields) {
    try {
      if (operation === "encrypt") {
        if (field.encrypted || isSecureValue(field.value)) {
          throw new Error("Value is already encrypted.");
        }
        replacements.push({
          field,
          replacement: format(encrypt(field.value, key)),
        });
      } else {
        if (!field.encrypted && !isSecureValue(field.value)) {
          throw new Error("Value is not encrypted.");
        }
        replacements.push({
          field,
          replacement: format(decrypt(field.value, key)),
        });
      }
    } catch (error) {
      failures.push({
        field,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { replacements, failures };
}
