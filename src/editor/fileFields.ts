import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { Node, Pair } from "yaml";

export type FileKind = "yaml" | "properties";
export type FileCryptoOperation = "encrypt" | "decrypt";

export interface TextOffsetRange {
  start: number;
  end: number;
}

export interface FileFieldCandidate {
  id: string;
  name: string;
  path: string;
  value: string;
  range: TextOffsetRange;
  encrypted: boolean;
  line: number;
}

interface SourceLine {
  text: string;
  start: number;
  end: number;
}

const SECURE_VALUE_PATTERN = /^!\[[^\]\r\n]+\]$/;

export function isSecureValue(value: string): boolean {
  return SECURE_VALUE_PATTERN.test(value.trim());
}

export function getSupportedFileKind(
  fileName: string,
  languageId?: string,
): FileKind | undefined {
  const lowerFileName = fileName.toLowerCase();
  if (
    languageId === "yaml" ||
    lowerFileName.endsWith(".yaml") ||
    lowerFileName.endsWith(".yml")
  ) {
    return "yaml";
  }
  if (languageId === "properties" || lowerFileName.endsWith(".properties")) {
    return "properties";
  }
  return undefined;
}

export function collectFileFields(
  text: string,
  kind: FileKind,
  operation: FileCryptoOperation,
): FileFieldCandidate[] {
  return kind === "yaml"
    ? collectYamlFields(text, operation)
    : collectPropertiesFields(text, operation);
}

function collectYamlFields(
  text: string,
  operation: FileCryptoOperation,
): FileFieldCandidate[] {
  if (operation === "decrypt") {
    return collectYamlSecureValues(text);
  }
  return collectYamlPlainValues(text);
}

function collectYamlPlainValues(text: string): FileFieldCandidate[] {
  const fields: FileFieldCandidate[] = [];
  const seenRanges = new Set<string>();
  const document = parseDocument(text, { keepSourceTokens: true });

  function visit(node: Node | null | undefined, path: string[]): void {
    if (!node) {
      return;
    }

    if (isMap(node)) {
      for (const item of node.items as Pair[]) {
        const key = scalarKey(item.key);
        visit(
          item.value as Node | null | undefined,
          key ? [...path, key] : path,
        );
      }
      return;
    }

    if (isSeq(node)) {
      node.items.forEach((item, index) =>
        visit(item as Node | null | undefined, [...path, `[${index}]`]),
      );
      return;
    }

    if (!isScalar(node)) {
      return;
    }

    const value = node.value;
    if (value === null || value === undefined) {
      return;
    }

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return;
    }

    const range = node.range;
    if (!range || range[1] <= range[0]) {
      return;
    }

    const start = range[0];
    const end = range[1];
    const source = text.slice(start, end);
    if (
      !source.trim() ||
      isSecureValue(source) ||
      isWrappedBySecureSyntax(text, start, end)
    ) {
      return;
    }

    const rangeId = `${start}:${end}`;
    if (seenRanges.has(rangeId)) {
      return;
    }
    seenRanges.add(rangeId);

    fields.push(
      createField(pathToLabel(path), String(value), start, end, false, text),
    );
  }

  visit(document.contents as Node | null | undefined, []);
  return sortFields(fields);
}

function collectYamlSecureValues(text: string): FileFieldCandidate[] {
  const fields: FileFieldCandidate[] = [];
  for (const line of splitLines(text)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const contentEnd = findTrailingCommentStart(line.text, ["#"]);
    const content =
      contentEnd >= 0 ? line.text.slice(0, contentEnd) : line.text;
    const secureValuePattern = /!\[[^\]\r\n]+\]/g;
    let match: RegExpExecArray | null;
    while ((match = secureValuePattern.exec(content)) !== null) {
      const value = match[0];
      const before = content.slice(0, match.index);
      const after = content.slice(match.index + value.length);
      if (after.trim()) {
        continue;
      }
      if (!isYamlValuePosition(before)) {
        continue;
      }
      const start = line.start + match.index;
      const end = start + value.length;
      fields.push(
        createField(
          yamlLineLabel(before, lineNumberAt(text, start)),
          value,
          start,
          end,
          true,
          text,
        ),
      );
    }
  }
  return sortFields(fields);
}

function collectPropertiesFields(
  text: string,
  operation: FileCryptoOperation,
): FileFieldCandidate[] {
  const fields: FileFieldCandidate[] = [];
  let inContinuation = false;

  for (const line of splitLines(text)) {
    if (inContinuation) {
      inContinuation = endsWithUnescapedBackslash(line.text);
      continue;
    }

    if (endsWithUnescapedBackslash(line.text)) {
      inContinuation = true;
      continue;
    }

    const parsed = parsePropertiesLine(line.text);
    if (!parsed) {
      continue;
    }

    const start = line.start + parsed.valueStart;
    const end = line.start + parsed.valueEnd;
    const value = text.slice(start, end);
    if (!value.trim()) {
      continue;
    }

    const encrypted = isSecureValue(value);
    if (
      (operation === "encrypt" && !encrypted) ||
      (operation === "decrypt" && encrypted)
    ) {
      fields.push(createField(parsed.key, value, start, end, encrypted, text));
    }
  }

  return sortFields(fields);
}

function parsePropertiesLine(
  line: string,
): { key: string; valueStart: number; valueEnd: number } | undefined {
  const firstNonWhitespace = line.search(/\S/);
  if (firstNonWhitespace < 0) {
    return undefined;
  }

  const firstChar = line[firstNonWhitespace];
  if (firstChar === "#" || firstChar === "!") {
    return undefined;
  }

  const explicitSeparator = findFirstUnescaped(
    line,
    ["=", ":"],
    firstNonWhitespace,
  );
  let keyEnd: number;
  let valueStart: number;

  if (explicitSeparator >= 0) {
    keyEnd = explicitSeparator;
    valueStart = explicitSeparator + 1;
  } else {
    const whitespaceSeparator = findFirstUnescapedWhitespace(
      line,
      firstNonWhitespace,
    );
    if (whitespaceSeparator < 0) {
      return undefined;
    }
    keyEnd = whitespaceSeparator;
    valueStart = whitespaceSeparator + 1;
  }

  while (valueStart < line.length && /\s/.test(line[valueStart])) {
    valueStart++;
  }

  const key = line.slice(firstNonWhitespace, keyEnd).trim();
  if (!key) {
    return undefined;
  }

  const rawValue = line.slice(valueStart);
  const commentStart = findTrailingCommentStart(rawValue, ["#", "!"]);
  const valueWithoutComment =
    commentStart >= 0 ? rawValue.slice(0, commentStart) : rawValue;
  const trimmedValueLength = valueWithoutComment.trimEnd().length;
  const valueEnd = valueStart + trimmedValueLength;
  if (valueEnd <= valueStart) {
    return undefined;
  }

  return { key, valueStart, valueEnd };
}

function splitLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  while (start < text.length) {
    const newlineIndex = findNextNewline(text, start);
    if (newlineIndex < 0) {
      lines.push({ text: text.slice(start), start, end: text.length });
      break;
    }
    const newlineLength = text.startsWith("\r\n", newlineIndex) ? 2 : 1;
    lines.push({
      text: text.slice(start, newlineIndex),
      start,
      end: newlineIndex,
    });
    start = newlineIndex + newlineLength;
  }
  return lines;
}

function findNextNewline(text: string, start: number): number {
  for (let index = start; index < text.length; index++) {
    if (text[index] === "\r" || text[index] === "\n") {
      return index;
    }
  }
  return -1;
}

function findTrailingCommentStart(text: string, markers: string[]): number {
  for (let index = 0; index < text.length; index++) {
    if (!markers.includes(text[index])) {
      continue;
    }
    if (isEscaped(text, index)) {
      continue;
    }
    if (index > 0 && /\s/.test(text[index - 1])) {
      return index;
    }
  }
  return -1;
}

function findFirstUnescaped(
  text: string,
  chars: string[],
  start: number,
): number {
  for (let index = start; index < text.length; index++) {
    if (chars.includes(text[index]) && !isEscaped(text, index)) {
      return index;
    }
  }
  return -1;
}

function findFirstUnescapedWhitespace(text: string, start: number): number {
  for (let index = start; index < text.length; index++) {
    if (/\s/.test(text[index]) && !isEscaped(text, index)) {
      return index;
    }
  }
  return -1;
}

function endsWithUnescapedBackslash(text: string): boolean {
  let slashCount = 0;
  for (
    let index = text.length - 1;
    index >= 0 && text[index] === "\\";
    index--
  ) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function isYamlValuePosition(prefix: string): boolean {
  const trimmed = prefix.trim();
  return /^-\s*$/.test(trimmed) || /:\s*$/.test(prefix);
}

function yamlLineLabel(prefix: string, line: number): string {
  const mappingMatch = prefix.match(/(?:^|\s|-\s*)([^:\s][^:]*)\s*:\s*$/);
  if (mappingMatch) {
    return mappingMatch[1].trim();
  }
  return `Line ${line}`;
}

function scalarKey(node: unknown): string | undefined {
  if (!node || !isScalar(node)) {
    return undefined;
  }
  const value = node.value;
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
}

function pathToLabel(path: string[]): string {
  if (path.length === 0) {
    return "value";
  }
  return path.reduce((label, segment) => {
    if (segment.startsWith("[")) {
      return `${label}${segment}`;
    }
    return label ? `${label}.${segment}` : segment;
  }, "");
}

function isWrappedBySecureSyntax(
  text: string,
  start: number,
  end: number,
): boolean {
  return (
    start >= 2 &&
    text[start - 2] === "!" &&
    text[start - 1] === "[" &&
    text[end] === "]"
  );
}

function createField(
  path: string,
  value: string,
  start: number,
  end: number,
  encrypted: boolean,
  text: string,
): FileFieldCandidate {
  return {
    id: `${start}:${end}`,
    name: leafName(path),
    path,
    value,
    range: { start, end },
    encrypted,
    line: lineNumberAt(text, start),
  };
}

function leafName(path: string): string {
  const lastDot = path.lastIndexOf(".");
  return lastDot >= 0 ? path.slice(lastDot + 1) : path;
}

function sortFields(fields: FileFieldCandidate[]): FileFieldCandidate[] {
  return fields.sort((left, right) => left.range.start - right.range.start);
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) {
    if (text[index] === "\n") {
      line++;
    }
  }
  return line;
}
