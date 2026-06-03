# MuleSoft AES & Secure Properties Encrypt / Decrypt

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0%2B-007ACC)

A VS Code extension for encrypting and decrypting MuleSoft secure configuration
properties directly inside your editor. It ships **three complementary tools**:

1. **MuleSoft AES Encrypt / Decrypt** — the focused, AES-only workflow that
   matches MuleSoft's most common setup (AES/CBC/PKCS5).
2. **Secure Properties Encrypt / Decrypt** — a broader tool that replicates the
   MuleSoft secure properties generator, supporting **multiple algorithms,
   cipher modes, and random IVs**.
3. **Base64 Encode / Decode** — a quick text/file Base64 utility.

All encryption happens locally; keys are stored in VS Code's secret storage and
never leave your machine.

---

## ✨ Features at a Glance

| Tool | Sidebar entry | Algorithms | Modes | Random IV | Editor toolbar button |
|------|---------------|------------|-------|-----------|-----------------------|
| **AES Encrypt / Decrypt** | MuleSoft AES Encrypt / Decrypt | AES-128 / AES-256 | CBC | No (derived IV) | Yes (`.yaml`, `.yml`, `.properties`) |
| **Secure Properties Encrypt / Decrypt** | Secure Properties Encrypt / Decrypt | AES, Blowfish, DES, DESede, RC2, RCA | CBC, CFB, ECB, OFB | Optional | No (launch from sidebar / palette) |
| **Base64 Encode / Decode** | Base64 Encode / Decode | — | — | — | No |

> The two encryption tools are **independent screens**. The AES tool is
> intentionally unchanged and remains the one wired into the YAML/properties
> editor toolbar. The Secure Properties tool is launched from the sidebar or the
> Command Palette.

---

## 🔒 Tool 1 — MuleSoft AES Encrypt / Decrypt

The original, streamlined AES tool. Best when your project uses the standard
MuleSoft AES configuration and you want the fastest path.

- **MuleSoft compatible**: AES-128-CBC or AES-256-CBC with PKCS5 padding.
- **Key-driven algorithm selection**: a 16-character key selects AES-128; a
  32-character key selects AES-256.
- **Derived IV**: the initialization vector is taken from the first 16
  characters of the key (deterministic — the same input always encrypts to the
  same output).
- **Output format**: `![base64EncodedString]`, ready to paste into MuleSoft
  config files.
- **Editor integration**: a toolbar button appears automatically when editing
  `.yaml`, `.yml`, and `.properties` files.

### AES encryption specifications

| Property | Value |
|----------|-------|
| **Algorithm** | AES-128-CBC or AES-256-CBC |
| **Block size** | 128 bits |
| **Padding** | PKCS5 |
| **IV** | Derived from the first 16 characters of the key |
| **Output encoding** | Base64, wrapped in `![ ... ]` |

---

## 🧰 Tool 2 — Secure Properties Encrypt / Decrypt

A dedicated screen that replicates the broader
[MuleSoft Secure Properties generator](https://secure-properties-api.us-e1.cloudhub.io/).
Use this when you need an algorithm or cipher mode other than the AES/CBC
default, or when you want random initialization vectors.

It has its own sidebar entry (purple **SP** shield icon) and its own webview
panel. The screen is the AES layout **plus an extra options row** above the key
and KeyIdentifier fields:

```
┌─────────────────────────────────────────────────────────────┐
│ Algorithm ▼     State (Mode) ▼     ☐ Use Random IVs           │  ← new options row
├─────────────────────────────────────────────────────────────┤
│ Encryption Key  [••••••••] 👁     KeyIdentifier ▼             │
├─────────────────────────────────────────────────────────────┤
│ Input Text                                                    │
│ [ ........................................................ ]  │
├─────────────────────────────────────────────────────────────┤
│ [ Encrypt ]  [ Decrypt ]  [ Clear ]                           │
│ Output                                          [ Copy ]      │
│ [ ........................................................ ]  │
└─────────────────────────────────────────────────────────────┘
```

### Options row

| Control | Type | Choices | Default |
|---------|------|---------|---------|
| **Algorithm** | dropdown | AES, Blowfish, DES, DESede, RC2, RCA | **AES** |
| **State (Mode)** | dropdown | CBC, CFB, ECB, OFB | **CBC** |
| **Use Random IVs** | checkbox | on / off | **off (unchecked)** |

With the defaults (**AES / CBC / no random IV**) the output is **byte-for-byte
identical** to the AES tool, so you can use either screen interchangeably for
standard AES values.

### Supported algorithms

These mirror the algorithms offered by the MuleSoft secure properties tool:

| Algorithm | Description | IV size | Key requirement |
|-----------|-------------|---------|-----------------|
| **AES** | Advanced Encryption Standard (default) | 16 bytes | 16 / 24 / 32 chars → AES-128 / 192 / 256 |
| **Blowfish** | Bruce Schneier's block cipher | 8 bytes | ≥ 16 chars (up to 56 bytes used) |
| **DES** | Data Encryption Standard (legacy) | 8 bytes | ≥ 8 chars |
| **DESede** | Triple DES (3DES) | 8 bytes | ≥ 24 chars |
| **RC2** | Rivest Cipher 2 | 8 bytes | ≥ 16 chars |
| **RCA** | RC4 / ARCFOUR stream cipher | none | ≥ 16 chars |

### Supported cipher modes ("state")

| Mode | Name | Uses an IV? |
|------|------|-------------|
| **CBC** | Cipher Block Chaining (default) | Yes |
| **CFB** | Cipher Feedback | Yes |
| **ECB** | Electronic Codebook | **No** |
| **OFB** | Output Feedback | Yes |

### AES key length → strength

The Secure Properties tool selects the AES variant from the **byte length of
the key** you provide:

| Key length | AES variant |
|------------|-------------|
| 16 chars | AES-128 |
| 24 chars | AES-192 |
| 32 chars | AES-256 |

### Initialization Vectors (IVs)

- **Derived IV (default, "Use Random IVs" unchecked):** the IV is taken from the
  first *N* characters of the key (`N` = the algorithm's IV size — 16 for AES, 8
  for the others). Encryption is **deterministic**: the same plaintext, key, and
  options always produce the same ciphertext. This matches the AES tool's
  behaviour.
- **Random IV ("Use Random IVs" checked):** a cryptographically random IV is
  generated for every encryption, **prepended to the ciphertext** before Base64
  encoding, and automatically read back from the front during decryption.
  Each encryption of the same input produces **different** ciphertext, which is
  generally more secure.

### Smart control behaviour

The options row adapts to your selection so you can't build an invalid combo:

- **ECB mode** uses no IV, so the **Use Random IVs** checkbox is disabled when
  ECB is selected.
- **RCA (RC4)** is a stream cipher with no mode and no IV, so selecting it
  disables both the **State (Mode)** dropdown and the **Use Random IVs**
  checkbox.

### Runtime algorithm availability

This extension uses Node.js / OpenSSL ciphers via VS Code's runtime. Depending
on how that runtime's OpenSSL is built, some legacy algorithms may be
unavailable:

- **Always available:** **AES** (all modes) and **DESede** (all modes).
- **May require the OpenSSL "legacy" provider:** **Blowfish**, **DES**, **RC2**,
  and **RCA (RC4)**.

If you select an algorithm that the current runtime cannot provide, the tool
returns a clear, non-crashing error such as
`Encryption error: Cipher "bf-cbc" is not supported by this runtime` rather than
failing silently. The full set of algorithms is always offered in the dropdown
for fidelity with the MuleSoft tool.

### Output format

Like the AES tool, all output is wrapped in MuleSoft's secure properties format:

```
![base64EncodedString]
```

When random IVs are enabled, the random IV bytes are included at the front of
the Base64 payload (inside the `![ ... ]` wrapper), so the value remains a
single self-contained token that decrypts without any extra input.

---

## 📋 Tool 3 — Base64 Encode / Decode

- **Encode** plain text or **files** to Base64.
- **Decode** Base64 strings back to plain text.
- **Drag & drop** or browse for files; **copy** results to the clipboard.

---

## 🔑 Key Management (shared by both encryption tools)

Both encryption tools read from the same securely stored set of
**KeyIdentifiers**, configured from the **Settings** screen in the sidebar.

- **KeyIdentifier presets** for common environments:
  - **DEV** — Development
  - **FIT** — Functional Integration Testing
  - **UAT** — User Acceptance Testing
  - **PROD** — Production
- **Custom KeyIdentifiers**: add your own named keys.
- **Secure storage**: keys live in VS Code's built-in secret storage.
- **Key visibility toggle**: show/hide keys with partial masking.
- **Never leaves your machine**: all encryption is local; nothing is transmitted.

Selecting a KeyIdentifier from the dropdown fills in (and masks) its key.
Choosing **Custom** lets you type a one-off key by hand. Changes saved in
**Settings** refresh both open encryption panels automatically.

---

## 🚀 Quick Start

### Installation
1. Open VS Code.
2. Go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"MuleSoft AES"**.
4. Click **Install**.

### First steps
1. Click the **MuleSoft AES** icon in the activity bar (left sidebar).
2. Open **Settings** and configure your encryption keys.
3. Choose a tool from the sidebar:
   - **MuleSoft AES Encrypt / Decrypt** for standard AES/CBC values.
   - **Secure Properties Encrypt / Decrypt** for other algorithms, modes, or
     random IVs.
4. Enter your text, pick a KeyIdentifier (and, for Secure Properties, an
   algorithm/mode/IV setting), then click **Encrypt** or **Decrypt**.
5. Use **Copy to Clipboard** to grab the result.

---

## 📝 Usage Examples

### Encrypt a database password (AES tool)
1. Open `application.yaml`.
2. Click the **AES** button in the editor toolbar (or open the AES tool from the
   sidebar).
3. Enter: `myDatabasePassword`.
4. Select KeyIdentifier: `PROD`.
5. Click **Encrypt** and copy the `![ ... ]` result into your YAML:
   ```yaml
   db:
     password: ![EncryptedValueHere]
   ```

### Encrypt with a non-default algorithm (Secure Properties tool)
1. Open the **Secure Properties Encrypt / Decrypt** tool from the sidebar.
2. In the options row choose, for example, **Algorithm: AES**, **State: CBC**,
   and check **Use Random IVs**.
3. Select a KeyIdentifier (or type a custom key).
4. Enter your secret and click **Encrypt**.
5. Note: because random IVs are on, encrypting the same value twice yields two
   different `![ ... ]` tokens — both decrypt back to the original.

### Decrypt an existing value
1. Paste the `![ ... ]` value into the **Input Text** box.
2. Select the **same KeyIdentifier** used for encryption.
3. In the Secure Properties tool, also match the **algorithm**, **mode**, and
   **Use Random IVs** setting that produced the value.
4. Click **Decrypt**.

---

## 📋 Supported Files (AES editor button)

The AES encryption button appears automatically when editing:
- **YAML files** (`.yaml`, `.yml`)
- **Properties files** (`.properties`)

The Secure Properties tool does **not** attach to the editor toolbar; launch it
from the sidebar or the Command Palette.

---

## 🔍 Commands

| Command | Title | Where |
|---------|-------|-------|
| `aes.encryptDecrypt` | MuleSoft AES Encrypt / Decrypt | Sidebar, editor toolbar, palette |
| `secureProperties.encryptDecrypt` | MuleSoft Secure Properties Encrypt / Decrypt | Sidebar, palette |
| `base64.encodeDecode` | Base64 Encode / Decode | Sidebar, palette |
| `aes.openSettings` | MuleSoft AES: Settings | Sidebar |

---

## 🛡️ Security

### Key safety
- ✅ Keys stored in VS Code's secure storage.
- ✅ All encryption/decryption happens locally on your machine.
- ✅ No network transmission of keys or sensitive data; no external API calls.
- ✅ Partial key masking in the UI.

### Best practices
1. **Use strong keys** — 32 characters recommended (also unlocks AES-256).
2. **Prefer random IVs** for new secrets when supported by your MuleSoft runtime.
3. **Rotate keys** periodically in production.
4. **Use different keys per environment** (DEV / FIT / UAT / PROD).
5. **Avoid legacy algorithms** (DES, RC2, RC4) for new data — they are provided
   for compatibility with existing values only.

### Storage backends
VS Code's secret storage maps to the OS keychain:
- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: `pass` or `secretservice` (depending on configuration)

---

## ✅ Requirements

- **VS Code**: 1.105.0 or higher
- **Node.js**: v18+ (for development only)
- **Disk space**: < 5 MB

---

## 🐛 Troubleshooting

**Q: I selected Blowfish / DES / RC2 / RCA and got a "not supported by this
runtime" error.**
A: Those legacy algorithms depend on the OpenSSL "legacy" provider, which may
not be enabled in your VS Code runtime. AES and DESede always work. Use AES for
new secrets.

**Q: My decrypted output is garbage or decryption fails.**
A: Make sure every setting matches the values used to encrypt — the **key /
KeyIdentifier**, and (in the Secure Properties tool) the **algorithm**,
**mode**, and **Use Random IVs** option.

**Q: The same input gives a different encrypted value each time.**
A: That's expected when **Use Random IVs** is checked. Uncheck it for
deterministic (derived-IV) output.

**Q: My encryption key is not saving.**
A: Ensure VS Code can access secret storage, then restart VS Code.

**Q: The AES button doesn't appear in my editor.**
A: The button only appears for `.yaml`, `.yml`, and `.properties` files. The
Secure Properties tool has no editor button by design — open it from the sidebar.

---

## 📊 Version History

### v0.0.1
- ✨ MuleSoft AES Encrypt / Decrypt (AES-128/256-CBC, derived IV).
- 🧰 **Secure Properties Encrypt / Decrypt** tool: multiple algorithms (AES,
  Blowfish, DES, DESede, RC2, RCA), cipher modes (CBC, CFB, ECB, OFB), and an
  optional random-IV toggle, on its own sidebar entry and screen.
- 🔑 KeyIdentifier preset management (DEV, FIT, UAT, PROD) shared across both
  encryption tools.
- 🎯 Activity bar integration with a dedicated panel.
- 📋 Base64 encode/decode utilities (text and files).
- 🔐 Secure key visibility toggle with partial masking.
- 📋 Copy to clipboard for all operations.
- 🔧 Settings panel for key configuration.

---

## 🎓 MuleSoft Development Tips

### In your MuleSoft config
```yaml
# application.yaml
db:
  host: db.example.com
  port: 5432
  username: dbuser
  password: ![EncryptedValueHere]

api:
  key: ![AnotherEncryptedKey]
  secret: ![ThirdEncryptedSecret]
```

### File structure example
```
src/main/resources/
├── application.yaml
├── application-dev.yaml
├── application-fit.yaml
├── application-uat.yaml
└── application-prod.yaml
```

---

## 🤝 Contributing

Contributions are welcome — please submit issues and enhancement requests.

## 📄 License

Licensed under the [MIT License](LICENSE).

## 🔗 Links

- **Repository**: [framedparadox/mulesoft-aes-vscode](https://github.com/framedparadox/mulesoft-aes-vscode)
- **Issues**: [Report a bug](https://github.com/framedparadox/mulesoft-aes-vscode/issues)
- **MuleSoft Docs**: [Secure Configuration Properties](https://docs.mulesoft.com/mule-runtime/latest/secure-configuration-properties)
- **Reference tool**: [Secure Properties generator](https://secure-properties-api.us-e1.cloudhub.io/)

---

**Made with ❤️ for MuleSoft Developers**
