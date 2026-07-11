# Changelog

All notable changes to the **MuleSoft AES & Secure Properties Encrypt / Decrypt**
extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses the version numbers from `package.json` (not strict
SemVer, since this is a pre-1.0 VS Code extension).

## [Unreleased]

Changes on `main` since the `v0.0.5` tag. `package.json` currently reports
version `0.0.6`, but no `v0.0.6` tag has been cut yet.

### Added

- **"Open in sidebar" button** on the whole-file encrypt/decrypt panel
  (`aes.fileEncryptDecrypt`). A new icon button next to the panel title sends
  an `openSidebar` message that focuses and reveals the MuleSoft AES
  activity-bar view, so you can jump from the file workflow straight to the
  main sidebar tools without hunting for the icon.
- `SIDEBAR_VIEW_ID` and `SIDEBAR_FOCUS_COMMAND` exported from
  `sidebarProvider.ts`, giving other panels a stable way to reveal/focus the
  sidebar view programmatically (used by the new "Open in sidebar" button).
- New `mule-secure.svg` icon resource.

### Changed

- Bumped extension version to `0.0.6` in `package.json`.
- Reworked the icon path handling in `package.json` and refined the
  `mule-secure.svg` markup/structure.

---

## [0.0.5] — Inline & whole-file encrypt/decrypt

### Added

- **Whole-file encrypt/decrypt workflow** (`aes.fileEncryptDecrypt`, "MuleSoft
  AES: Encrypt / Decrypt File"): opens a webview panel beside the active
  `.yaml`, `.yml`, or `.properties` editor. Encrypt mode scans the file for
  plain scalar values and lets you multi-select which ones to encrypt in a
  single edit; decrypt mode automatically targets every complete `![ ... ]`
  secure value in the file. Each field row shows its name, value, and full
  path with line number. Includes **Select all**, **Clear**, and **Refresh**
  controls, and a KeyIdentifier dropdown with the same masked-key preview
  behavior as the main AES screen.
  (`src/views/fileCryptoPanel.ts`, `src/editor/fileFields.ts`,
  `src/editor/fileTransforms.ts`)
- **Inline selection encrypt/decrypt** via new commands
  `aes.encryptSelection` ("MuleSoft AES: Encrypt Selection") and
  `aes.decryptSelection` ("MuleSoft AES: Decrypt Selection"), available from
  the editor right-click context menu when text is selected in a supported
  file type. Replaces the selection in place using a saved KeyIdentifier or a
  one-off manual key. (`src/editor/editorCommands.ts`)
- Editor-title toolbar button for `aes.fileEncryptDecrypt`, shown
  automatically when editing `.yaml`, `.yml`, or `.properties` files.
- Compact "editor crypto" mode added to the activity-bar sidebar
  (`SidebarProvider`), giving quick access to encrypt/decrypt actions and key
  identifiers without opening a full panel.
- Test coverage for the new field-scanning and transform logic
  (`src/test/fileFields.test.ts`, `src/test/fileTransforms.test.ts`).

### Changed

- Reworked `package.json` command/menu contributions to register the new
  editor-integration commands, toolbar button, and context-menu entries.
- Updated `extension.ts` to register the new editor commands and sidebar
  wiring.
- Rewrote large portions of the README to document the new editor-integrated
  workflows alongside the existing sidebar tools.

---

## [0.0.4] — Save-from-encrypt-screen, publish workflow

### Added

- **Save a key directly from the encrypt screen:** typing a custom key on
  either the AES or Secure Properties screen now reveals a save (disk icon)
  button. Clicking it opens a small dialog to name the key as a new
  KeyIdentifier; it's stored in secret storage and immediately available in
  the dropdown on both encryption screens without visiting Settings.
  (`addAesKeyIdentifier` in `src/storage/keyStore.ts`,
  `src/views/aesPanel.ts`, `src/views/aesEnhancedPanel.ts`)

### Changed

- Reworked the GitHub Actions publish workflow (`.github/workflows/publish.yml`).
- Trimmed `.gitignore` / `.vscodeignore` and removed the standalone
  `docs/PUBLISHING.md` and `docs/VSIX_BUILD_INFO.md` docs, consolidating that
  guidance back into the README.
- General README restructuring to match the updated key-management flow.

---

## [0.0.3] — Secure Properties tool (multi-algorithm support)

### Added

- **MuleSoft Secure Properties Encrypt / Decrypt** (`aesEnhanced.encryptDecrypt`):
  a second, full-featured encryption screen alongside the original AES tool.
  Adds selectable **Algorithm** (AES, Blowfish, DES, DESede, RC2, RCA),
  **State/Mode** (CBC, CFB, ECB, OFB), and a **Use Random IVs** option for
  non-deterministic ciphertext. Output remains MuleSoft's `![base64String]`
  format; with default settings (AES / CBC / derived IV) it produces
  byte-for-byte identical output to the original AES tool.
  (`src/aesEnhanced/secureCrypto.ts`, `src/views/aesEnhancedPanel.ts`)
- Adaptive UI controls: the **Use Random IVs** checkbox disables automatically
  for ECB (which uses no IV); the **State (Mode)** dropdown and **Use Random
  IVs** checkbox both disable for RCA/RC4 (a mode-less, IV-less stream
  cipher).
- New `aes-plus.svg` icon for the Secure Properties tool's sidebar entry.
- Test coverage for the new cipher logic (`src/test/secureCrypto.test.ts`).
- CI/publish scaffolding: `.github/workflows/publish.yml`, `.vscodeignore`,
  `docs/PUBLISHING.md`, `docs/VSIX_BUILD_INFO.md`.

### Changed

- Extended `settingsPanel.ts` and `sidebarProvider.ts` so the new tool shares
  the same KeyIdentifier storage and sidebar entry point as the original AES
  tool.
- Substantially expanded the README with dedicated documentation for the
  Secure Properties tool, its algorithm/mode/IV tables, and adaptive control
  behavior.
- Fixed the Base64 tool's icon background (circle → square).

---

## [0.0.1] — Initial release

### Added

- **MuleSoft AES Encrypt / Decrypt** (`aes.encryptDecrypt`): AES-128-CBC or
  AES-256-CBC encryption (selected by key length) with PKCS5 padding and an
  IV derived from the first 16 characters of the key, matching MuleSoft's
  standard secure-configuration-properties format (`![base64]`).
  (`src/aes/aesCrypto.ts`, `src/views/aesPanel.ts`)
- **Base64 Encode / Decode** (`base64.encodeDecode`): encode plain text or
  files to Base64, decode Base64 strings back to text, with drag-and-drop /
  browse file support and clipboard copy. (`src/base64/base64Codec.ts`,
  `src/views/base64Panel.ts`)
- **Settings screen** (`aes.openSettings`) for managing KeyIdentifiers: preset
  slots for DEV / FIT / UAT / PROD plus custom named keys, stored in VS
  Code's built-in secret storage with a show/hide visibility toggle and
  partial masking. (`src/storage/keyStore.ts`, `src/views/settingsPanel.ts`)
- Activity-bar sidebar entry point (`src/views/sidebarProvider.ts`) linking to
  the AES tool, Base64 tool, and Settings screen.

[unreleased]: https://github.com/framedparadox/mulesoft-aes-vscode/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/framedparadox/mulesoft-aes-vscode/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/framedparadox/mulesoft-aes-vscode/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/framedparadox/mulesoft-aes-vscode/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/framedparadox/mulesoft-aes-vscode/releases/tag/v0.0.1
