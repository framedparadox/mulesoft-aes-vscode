# MuleSoft AES & Secure Properties Encrypt / Decrypt

![License](https://img.shields.io/badge/license-MIT-green)

A VS Code extension for encrypting and decrypting MuleSoft secure configuration
properties without leaving your editor. All cryptography runs locally; keys and
KeyIdentifier names are held only in VS Code's secret storage and are never
transmitted.

The extension bundles three tools:

| Tool | Purpose |
|------|---------|
| **MuleSoft AES Encrypt / Decrypt** | Focused AES/CBC workflow matching MuleSoft's most common setup. |
| **Secure Properties Encrypt / Decrypt** | Full generator parity: multiple algorithms, cipher modes, and random IVs. |
| **Base64 Encode / Decode** | Quick text and file Base64 utility. |

---

## Feature Summary

| Tool | Algorithms | Modes | Random IV | Editor toolbar button |
|------|------------|-------|-----------|-----------------------|
| AES Encrypt / Decrypt | AES-128 / AES-256 | CBC | No (derived IV) | Yes (`.yaml`, `.yml`, `.properties`) |
| Secure Properties Encrypt / Decrypt | AES, Blowfish, DES, DESede, RC2, RCA | CBC, CFB, ECB, OFB | Optional | No (sidebar / palette) |
| Base64 Encode / Decode | — | — | — | No |

The two encryption tools are independent screens. The AES tool is the one wired
into the YAML/properties editor toolbar; the Secure Properties tool is launched
from the sidebar or Command Palette. With its defaults (AES / CBC / no random
IV), the Secure Properties tool produces output that is byte-for-byte identical
to the AES tool, so the two are interchangeable for standard values.

---

## Tool 1 — MuleSoft AES Encrypt / Decrypt

The streamlined option for projects using MuleSoft's standard AES configuration.

- **MuleSoft compatible:** AES-128-CBC or AES-256-CBC with PKCS5 padding.
- **Key-driven strength:** a 16-character key selects AES-128; a 32-character
  key selects AES-256.
- **Derived IV:** taken from the first 16 characters of the key, so encryption
  is deterministic — identical input always yields identical output.
- **Output format:** `![base64EncodedString]`, ready to paste into MuleSoft
  config files.
- **Editor integration:** a toolbar button appears automatically when editing
  `.yaml`, `.yml`, and `.properties` files.

| Property | Value |
|----------|-------|
| Algorithm | AES-128-CBC or AES-256-CBC |
| Block size | 128 bits |
| Padding | PKCS5 |
| IV | Derived from the first 16 characters of the key |
| Output encoding | Base64, wrapped in `![ ... ]` |

---

## Tool 2 — Secure Properties Encrypt / Decrypt

A dedicated screen that replicates the
[MuleSoft Secure Properties generator](https://secure-properties-api.us-e1.cloudhub.io/).
Use it when you need an algorithm or cipher mode other than AES/CBC, or random
initialization vectors. It mirrors the AES layout with an additional options row:

```
┌─────────────────────────────────────────────────────────────┐
│ Algorithm ▼     State (Mode) ▼     ☐ Use Random IVs           │  ← options row
├─────────────────────────────────────────────────────────────┤
│ Encryption Key  [••••••••] 👁 💾    KeyIdentifier ▼           │
├─────────────────────────────────────────────────────────────┤
│ Input Text                                                    │
├─────────────────────────────────────────────────────────────┤
│ [ Encrypt ]  [ Decrypt ]  [ Clear ]                           │
│ Output                                          [ Copy ]      │
└─────────────────────────────────────────────────────────────┘
```

### Options

| Control | Type | Choices | Default |
|---------|------|---------|---------|
| Algorithm | dropdown | AES, Blowfish, DES, DESede, RC2, RCA | AES |
| State (Mode) | dropdown | CBC, CFB, ECB, OFB | CBC |
| Use Random IVs | checkbox | on / off | off |

### Supported algorithms

| Algorithm | Description | IV size | Key requirement |
|-----------|-------------|---------|-----------------|
| AES | Advanced Encryption Standard (default) | 16 bytes | 16 / 24 / 32 chars → AES-128 / 192 / 256 |
| Blowfish | Bruce Schneier's block cipher | 8 bytes | ≥ 16 chars (up to 56 bytes used) |
| DES | Data Encryption Standard (legacy) | 8 bytes | ≥ 16 chars (first 8 bytes used) |
| DESede | Triple DES (3DES) | 8 bytes | ≥ 24 chars |
| RC2 | Rivest Cipher 2 | 8 bytes | ≥ 16 chars |
| RCA | RC4 / ARCFOUR stream cipher | none | ≥ 16 chars |

### Cipher modes ("state")

| Mode | Name | Uses an IV? |
|------|------|-------------|
| CBC | Cipher Block Chaining (default) | Yes |
| CFB | Cipher Feedback | Yes |
| ECB | Electronic Codebook | No |
| OFB | Output Feedback | Yes |

### Initialization Vectors

- **Derived IV (default):** the IV is the first *N* characters of the key (`N` =
  the algorithm's IV size — 16 for AES, 8 for the others). Encryption is
  deterministic, matching the AES tool's behaviour.
- **Random IV (checkbox on):** a cryptographically random IV is generated per
  encryption, prepended to the ciphertext before Base64 encoding, and read back
  automatically during decryption. Each run produces different ciphertext, which
  is generally more secure.

### Adaptive controls

The options row prevents invalid combinations:

- **ECB** uses no IV, so the **Use Random IVs** checkbox is disabled.
- **RCA (RC4)** is a stream cipher with no mode and no IV, so both the **State
  (Mode)** dropdown and the **Use Random IVs** checkbox are disabled.

### Runtime availability

Ciphers run through Node.js / OpenSSL as provided by the VS Code runtime:

- **Always available:** AES (all modes) and DESede (all modes).
- **May require the OpenSSL "legacy" provider:** Blowfish, DES, RC2, RCA (RC4).

If the runtime cannot provide a selected algorithm, the tool returns a clear,
non-crashing error (for example, `Cipher "bf-cbc" is not supported by this
runtime`) rather than failing silently. The full algorithm set is always offered
for fidelity with the MuleSoft generator.

### Output format

All output is wrapped in MuleSoft's secure properties format, `![base64String]`.
When random IVs are enabled, the IV bytes are included at the front of the
payload (inside the wrapper), keeping the value a single self-contained token.

---

## Tool 3 — Base64 Encode / Decode

- Encode plain text or files to Base64.
- Decode Base64 strings back to plain text.
- Drag and drop or browse for files; copy results to the clipboard.

---

## Key Management

Both encryption tools draw from the same set of **KeyIdentifiers**, managed from
the **Settings** screen in the sidebar.

- **Presets** for common environments: DEV, FIT, UAT, PROD.
- **Custom KeyIdentifiers:** add your own named keys.
- **Secure storage:** keys live in VS Code's built-in secret storage and never
  leave the machine.
- **Visibility toggle:** show or hide keys with partial masking.

Selecting a KeyIdentifier from the dropdown fills in (and masks) its key.
Choosing **Custom** lets you type a one-off key. Changes saved in **Settings**
refresh any open encryption panels automatically.

### Save a key from the encrypt screen

When you type a custom key, a **save** button (disk icon) appears between the
show/hide toggle and the KeyIdentifier dropdown. Click it to open a dialog,
enter a **Key Identifier** name, and save — the key is stored in secret storage
and immediately added to the dropdown on both encryption screens.

### Refresh keys

Each encryption screen has a **refresh** button in the top-right corner that
reloads KeyIdentifiers from storage, so newly added keys appear without closing
and reopening the panel.

---

## Quick Start

**Install**

1. Open VS Code and go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **MuleSoft AES** and click **Install**.

**Use**

1. Click the **MuleSoft AES** icon in the activity bar.
2. Open **Settings** and configure your encryption keys.
3. Pick a tool from the sidebar:
   - **MuleSoft AES Encrypt / Decrypt** for standard AES/CBC values.
   - **Secure Properties Encrypt / Decrypt** for other algorithms, modes, or
     random IVs.
4. Enter your text, choose a KeyIdentifier (and, for Secure Properties, the
   algorithm/mode/IV settings), then click **Encrypt** or **Decrypt**.
5. Use **Copy to Clipboard** to grab the result.

---

## Usage Examples

**Encrypt a database password (AES tool)**

1. Open `application.yaml`.
2. Click the AES button in the editor toolbar, or open the AES tool from the
   sidebar.
3. Enter `myDatabasePassword`, select KeyIdentifier `PROD`, and click
   **Encrypt**.
4. Paste the result into your YAML:
   ```yaml
   db:
     password: ![EncryptedValueHere]
   ```

**Encrypt with a non-default algorithm (Secure Properties tool)**

1. Open **Secure Properties Encrypt / Decrypt** from the sidebar.
2. Choose an algorithm/mode (for example, AES / CBC) and, optionally, check
   **Use Random IVs**.
3. Select a KeyIdentifier or type a custom key, enter your secret, and click
   **Encrypt**. With random IVs on, encrypting the same value twice yields two
   different tokens that both decrypt to the original.

**Decrypt an existing value**

1. Paste the `![ ... ]` value into **Input Text**.
2. Select the same KeyIdentifier used to encrypt.
3. In the Secure Properties tool, also match the algorithm, mode, and **Use
   Random IVs** setting that produced the value.
4. Click **Decrypt**.

---

## Commands

| Command | Title | Where |
|---------|-------|-------|
| `aes.encryptDecrypt` | MuleSoft AES Encrypt / Decrypt | Sidebar, editor toolbar, palette |
| `aesEnhanced.encryptDecrypt` | MuleSoft Secure Properties Encrypt / Decrypt | Sidebar, palette |
| `base64.encodeDecode` | Base64 Encode / Decode | Sidebar, palette |
| `aes.openSettings` | MuleSoft AES: Settings | Sidebar |

The AES editor toolbar button appears for `.yaml`, `.yml`, and `.properties`
files. The Secure Properties tool has no editor button by design.

---

## Security

- Keys are stored in VS Code's secure storage, which maps to the OS keychain:
  Windows Credential Manager, macOS Keychain, or `pass` / `secretservice` on
  Linux.
- All encryption and decryption happens locally. No keys or data are sent over
  the network, and there are no external API calls.
- Keys are partially masked in the UI.

**Best practices**

1. Use strong keys — 32 characters is recommended and unlocks AES-256.
2. Prefer random IVs for new secrets where your MuleSoft runtime supports them.
3. Rotate keys periodically in production.
4. Use different keys per environment (DEV / FIT / UAT / PROD).
5. Avoid legacy algorithms (DES, RC2, RC4) for new data; they exist for
   compatibility with existing values only.

---

## Requirements

- **VS Code:** 1.105.0 or higher
- **Node.js:** v18+ (development only)
- **Disk space:** < 5 MB

---

## Troubleshooting

**Selecting Blowfish / DES / RC2 / RCA returns a "not supported by this runtime"
error.** These legacy algorithms depend on the OpenSSL "legacy" provider, which
may not be enabled in your VS Code runtime. AES and DESede always work; use AES
for new secrets.

**Decrypted output is garbage or decryption fails.** Ensure every setting
matches the values used to encrypt — the key / KeyIdentifier and, in the Secure
Properties tool, the algorithm, mode, and **Use Random IVs** option.

**The same input gives a different encrypted value each time.** That is expected
when **Use Random IVs** is checked; uncheck it for deterministic output.

**An encryption key is not saving.** Confirm VS Code can access secret storage,
then restart VS Code.

**The AES button does not appear in the editor.** It only shows for `.yaml`,
`.yml`, and `.properties` files. The Secure Properties tool has no editor button
by design — open it from the sidebar.

---

## Contributing

Contributions are welcome. Please submit issues and enhancement requests through
the repository.

## License

Licensed under the [MIT License](LICENSE).

## Links

- **Repository:** [framedparadox/mulesoft-aes-vscode](https://github.com/framedparadox/mulesoft-aes-vscode)
- **Issues:** [Report a bug](https://github.com/framedparadox/mulesoft-aes-vscode/issues)
- **MuleSoft docs:** [Secure Configuration Properties](https://docs.mulesoft.com/mule-runtime/latest/secure-configuration-properties)
- **Reference tool:** [Secure Properties generator](https://secure-properties-api.us-e1.cloudhub.io/)
