import * as assert from "assert";
import {
  collectFileFields,
  getSupportedFileKind,
  isSecureValue,
} from "../editor/fileFields";

suite("Editor File Field Detection", () => {
  test("detects supported YAML and properties files", () => {
    assert.strictEqual(
      getSupportedFileKind("application.yaml", "plaintext"),
      "yaml",
    );
    assert.strictEqual(
      getSupportedFileKind("application.yml", "plaintext"),
      "yaml",
    );
    assert.strictEqual(
      getSupportedFileKind("application.properties", "plaintext"),
      "properties",
    );
    assert.strictEqual(getSupportedFileKind("untitled", "yaml"), "yaml");
    assert.strictEqual(
      getSupportedFileKind("application.json", "json"),
      undefined,
    );
  });

  test("identifies complete secure values only", () => {
    assert.strictEqual(isSecureValue("![abc]"), true);
    assert.strictEqual(isSecureValue("  ![abc]  "), true);
    assert.strictEqual(isSecureValue("prefix ![abc]"), false);
    assert.strictEqual(isSecureValue("![abc] suffix"), false);
  });

  test("collects YAML plain scalar values for encryption", () => {
    const text = [
      "db:",
      "  user: app",
      "  password: plain # keep",
      '  quoted: "secret value"',
      "  secure: ![abc]",
      "  empty:",
      "  enabled: true",
      "servers:",
      "  - name: dev",
      "    token: plain2",
      "",
    ].join("\n");

    const fields = collectFileFields(text, "yaml", "encrypt");
    const byPath = new Map(fields.map((field) => [field.path, field]));

    assert.deepStrictEqual(
      fields.map((field) => field.path),
      [
        "db.user",
        "db.password",
        "db.quoted",
        "db.enabled",
        "servers[0].name",
        "servers[0].token",
      ],
    );
    assert.strictEqual(byPath.get("db.password")?.value, "plain");
    assert.strictEqual(
      text.slice(
        byPath.get("db.password")!.range.start,
        byPath.get("db.password")!.range.end,
      ),
      "plain",
    );
    assert.strictEqual(byPath.get("db.quoted")?.value, "secret value");
    assert.strictEqual(
      text.slice(
        byPath.get("db.quoted")!.range.start,
        byPath.get("db.quoted")!.range.end,
      ),
      '"secret value"',
    );
    assert.strictEqual(byPath.has("db.secure"), false);
    assert.strictEqual(byPath.has("db.empty"), false);
  });

  test("collects complete YAML secure values for decryption", () => {
    const text = [
      "db:",
      "  password: ![abc] # keep",
      "  mixed: before ![skip]",
      "list:",
      "  - ![def]",
      "",
    ].join("\n");

    const fields = collectFileFields(text, "yaml", "decrypt");

    assert.strictEqual(fields.length, 2);
    assert.deepStrictEqual(
      fields.map((field) => field.value),
      ["![abc]", "![def]"],
    );
    assert.strictEqual(fields[0].path, "password");
    assert.strictEqual(fields[0].line, 2);
    assert.strictEqual(fields[1].path, "Line 5");
  });

  test("collects properties plain values and preserves value ranges", () => {
    const text = [
      "# comment",
      "db.password=plain # keep",
      "db.user: app",
      "db.port 8081",
      "secure=![abc]",
      "empty=",
      "continued=value\\",
      "  next",
      "",
    ].join("\n");

    const fields = collectFileFields(text, "properties", "encrypt");
    const byPath = new Map(fields.map((field) => [field.path, field]));

    assert.deepStrictEqual(
      fields.map((field) => field.path),
      ["db.password", "db.user", "db.port"],
    );
    assert.strictEqual(byPath.get("db.password")?.value, "plain");
    assert.strictEqual(
      text.slice(
        byPath.get("db.password")!.range.start,
        byPath.get("db.password")!.range.end,
      ),
      "plain",
    );
    assert.strictEqual(byPath.has("secure"), false);
    assert.strictEqual(byPath.has("empty"), false);
    assert.strictEqual(byPath.has("continued"), false);
  });

  test("collects properties secure values for decryption", () => {
    const text = [
      "plain=value",
      "secret = ![abc] # keep",
      "another: ![def]",
      "",
    ].join("\n");

    const fields = collectFileFields(text, "properties", "decrypt");

    assert.deepStrictEqual(
      fields.map((field) => `${field.path}:${field.value}`),
      ["secret:![abc]", "another:![def]"],
    );
  });
});
