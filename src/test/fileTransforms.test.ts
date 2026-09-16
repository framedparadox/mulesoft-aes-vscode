import * as assert from "assert";
import { parseDocument } from "yaml";
import { collectFileFields, FileFieldCandidate } from "../editor/fileFields";
import {
  computeFieldReplacements,
  formatYamlScalar,
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

    const result = computeFieldReplacements(
      fields,
      KEY,
      "encrypt",
      "properties",
    );

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

    const result = computeFieldReplacements(
      fields,
      KEY,
      "decrypt",
      "properties",
    );

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

    const result = computeFieldReplacements(
      fields,
      KEY,
      "decrypt",
      "properties",
    );

    assert.strictEqual(result.failures.length, 1);
    assert.strictEqual(result.failures[0].field.path, "invalid");
    assert.strictEqual(result.replacements.length, 1);
  });

  test("quotes YAML scalars that would otherwise change meaning", () => {
    // Plain is fine only when the value cannot be read as anything else.
    assert.strictEqual(formatYamlScalar("p@ssw0rd"), "p@ssw0rd");
    assert.strictEqual(formatYamlScalar("localhost"), "localhost");

    // `!` opens a tag, so a secure value must always be quoted.
    assert.strictEqual(formatYamlScalar("![abc]"), '"![abc]"');

    // Structural characters, and YAML 1.1 booleans that SnakeYAML (Mule) reads
    // as `true`/`false` rather than strings.
    assert.strictEqual(formatYamlScalar("pa55: w0rd"), '"pa55: w0rd"');
    assert.strictEqual(formatYamlScalar("x, y"), '"x, y"');
    assert.strictEqual(
      formatYamlScalar("# not a comment"),
      '"# not a comment"',
    );
    assert.strictEqual(formatYamlScalar("yes"), '"yes"');
    assert.strictEqual(formatYamlScalar("off"), '"off"');
    assert.strictEqual(formatYamlScalar("123"), '"123"');
    assert.strictEqual(formatYamlScalar(""), '""');
    assert.strictEqual(formatYamlScalar("a\nb"), '"a\\nb"');
  });

  test("YAML round trips through encrypt and decrypt without corrupting the file", () => {
    const secrets = [
      "pa55: w0rd",
      "p@ssw0rd",
      "yes",
      "123",
      "x, y",
      "# hash",
      'quote"inside',
      "trailing ",
      "multi\nline",
    ];

    for (const secret of secrets) {
      const original = `db:\n  password: ${JSON.stringify(secret)}\n  host: localhost\n`;
      assert.strictEqual(
        parseDocument(original).errors.length,
        0,
        `fixture invalid for ${JSON.stringify(secret)}`,
      );

      const encrypted = applyReplacements(
        original,
        computeFieldReplacements(
          collectFileFields(original, "yaml", "encrypt"),
          KEY,
          "encrypt",
          "yaml",
        ).replacements,
      );
      assert.deepStrictEqual(
        parseDocument(encrypted).errors.map((error) => error.code),
        [],
        `encrypt produced invalid YAML for ${JSON.stringify(secret)}: ${encrypted}`,
      );

      const decrypted = applyReplacements(
        encrypted,
        computeFieldReplacements(
          collectFileFields(encrypted, "yaml", "decrypt"),
          KEY,
          "decrypt",
          "yaml",
        ).replacements,
      );
      assert.deepStrictEqual(
        parseDocument(decrypted).errors.map((error) => error.code),
        [],
        `decrypt produced invalid YAML for ${JSON.stringify(secret)}: ${decrypted}`,
      );
      assert.deepStrictEqual(
        parseDocument(decrypted).toJS(),
        { db: { password: secret, host: "localhost" } },
        `value did not survive the round trip: ${JSON.stringify(secret)}`,
      );
    }
  });

  test("decrypting a quoted YAML secure value keeps the document parseable", () => {
    const cipher = transformSelectedText("pa55: w0rd", KEY, "encrypt");
    const text = `db:\n  password: "${cipher}"\n  host: localhost\n`;

    const fields = collectFileFields(text, "yaml", "decrypt");
    assert.strictEqual(fields.length, 1);

    const next = applyReplacements(
      text,
      computeFieldReplacements(fields, KEY, "decrypt", "yaml").replacements,
    );

    assert.deepStrictEqual(parseDocument(next).errors, []);
    assert.deepStrictEqual(parseDocument(next).toJS(), {
      db: { password: "pa55: w0rd", host: "localhost" },
    });
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
