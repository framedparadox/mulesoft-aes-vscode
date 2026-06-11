import * as assert from "assert";
import { collectFileFields, FileFieldCandidate } from "../editor/fileFields";
import {
  computeFieldReplacements,
  transformSelectedText,
} from "../editor/fileTransforms";

const KEY = "0123456789abcdef";

suite("Editor File Transforms", () => {
  test("encrypts and decrypts selected text", () => {
    const encrypted = transformSelectedText("plain value", KEY, "encrypt");
    assert.ok(encrypted.startsWith("!["));
    assert.strictEqual(
      transformSelectedText(encrypted, KEY, "decrypt"),
      "plain value",
    );
  });

  test("rejects double encryption for selected text", () => {
    assert.throws(
      () => transformSelectedText("![alreadySecure]", KEY, "encrypt"),
      /already encrypted/,
    );
  });

  test("rejects short keys before transforming selected text", () => {
    assert.throws(
      () => transformSelectedText("plain value", "short", "encrypt"),
      /at least 16/,
    );
    assert.throws(
      () => transformSelectedText("![abc]", "short", "decrypt"),
      /at least 16/,
    );
  });

  test("computes bulk encryption replacements and preserves unrelated text", () => {
    const text = ["db.password=plain # keep", "secure=![abc]", ""].join("\n");
    const fields = collectFileFields(text, "properties", "encrypt");

    const result = computeFieldReplacements(fields, KEY, "encrypt");

    assert.strictEqual(result.failures.length, 0);
    assert.strictEqual(result.replacements.length, 1);

    const nextText = applyReplacements(text, result.replacements);
    assert.match(nextText, /^db\.password=!\[[^\]]+\] # keep/m);
    assert.match(nextText, /^secure=!\[abc\]$/m);
  });

  test("computes bulk decryption replacements", () => {
    const encrypted = transformSelectedText("plain value", KEY, "encrypt");
    const text = `secret=${encrypted}\n`;
    const fields = collectFileFields(text, "properties", "decrypt");

    const result = computeFieldReplacements(fields, KEY, "decrypt");

    assert.strictEqual(result.failures.length, 0);
    assert.strictEqual(result.replacements.length, 1);
    assert.strictEqual(result.replacements[0].replacement, "plain value");
  });

  test("reports failures before callers apply any bulk replacements", () => {
    const fields: FileFieldCandidate[] = [
      {
        id: "0:8",
        name: "valid",
        path: "valid",
        value: transformSelectedText("plain value", KEY, "encrypt"),
        range: { start: 0, end: 8 },
        encrypted: true,
        line: 1,
      },
      {
        id: "9:17",
        name: "invalid",
        path: "invalid",
        value: "![abc]",
        range: { start: 9, end: 17 },
        encrypted: true,
        line: 2,
      },
    ];

    const result = computeFieldReplacements(fields, KEY, "decrypt");

    assert.strictEqual(result.failures.length, 1);
    assert.strictEqual(result.failures[0].field.path, "invalid");
    assert.strictEqual(result.replacements.length, 1);
  });
});

function applyReplacements(
  text: string,
  replacements: Array<{ field: FileFieldCandidate; replacement: string }>,
): string {
  return [...replacements]
    .sort((left, right) => right.field.range.start - left.field.range.start)
    .reduce(
      (current, item) =>
        current.slice(0, item.field.range.start) +
        item.replacement +
        current.slice(item.field.range.end),
      text,
    );
}
