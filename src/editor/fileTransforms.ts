import { decrypt, encrypt } from "../aes/aesCrypto";
import {
  FileCryptoOperation,
  FileFieldCandidate,
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
): FieldReplacementResult {
  validateAesKey(key);

  const replacements: FieldReplacement[] = [];
  const failures: FieldTransformFailure[] = [];

  for (const field of fields) {
    try {
      if (operation === "encrypt") {
        if (field.encrypted || isSecureValue(field.value)) {
          throw new Error("Value is already encrypted.");
        }
        replacements.push({ field, replacement: encrypt(field.value, key) });
      } else {
        if (!field.encrypted && !isSecureValue(field.value)) {
          throw new Error("Value is not encrypted.");
        }
        replacements.push({ field, replacement: decrypt(field.value, key) });
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
