# MuleSoft AES Encrypt / Decrypt

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0%2B-007ACC)

A powerful VS Code extension for encrypting and decrypting MuleSoft secure configuration properties using AES encryption. Fully compatible with MuleSoft's secure properties format, it brings encryption tools directly into your editor.

## ✨ Features

### 🔒 AES Encryption & Decryption
- **MuleSoft Compatible**: Uses AES-128-CBC or AES-256-CBC with PKCS5 padding
- **Output Format**: Generates `![base64EncodedString]` format for direct use in MuleSoft config files
- **Bidirectional**: Encrypt plain text or decrypt existing encrypted values
- **Fast Processing**: Instant encryption/decryption with real-time feedback

### 🎯 Smart Integration
- **Editor Integration**: Toolbar button appears automatically in YAML and .properties files
- **Activity Bar Access**: Dedicated MuleSoft AES panel in VS Code activity bar
- **Quick Actions**: One-click encryption/decryption with copy-to-clipboard
- **Auto-Detection**: Intelligently detects file types and enables features accordingly

### 🔑 Key Management
- **KeyIdentifier Presets**: Pre-configured keys for common environments:
  - **DEV** - Development environment
  - **FIT** - Functional Integration Testing
  - **UAT** - User Acceptance Testing
  - **PROD** - Production environment
- **Custom Keys**: Add your own KeyIdentifiers and encryption keys
- **Secure Storage**: Keys are stored securely in VS Code's built-in secret storage
- **Key Visibility Toggle**: Show/hide keys with partial masking for security
- **Never Leaves Your Machine**: All encryption happens locally; keys are never sent anywhere

### 📋 Base64 Utilities
- **Encode**: Convert plain text to Base64
- **Decode**: Convert Base64 strings back to plain text
- **Instant Copy**: Copy encoded/decoded results to clipboard

## 🚀 Quick Start

### Installation
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "MuleSoft AES"
4. Click Install

### First Steps
1. Click the MuleSoft AES icon in the activity bar (left sidebar)
2. Configure your encryption keys in **Settings**
3. Open a `.yaml` or `.properties` file
4. Click the AES encrypt button in the editor toolbar
5. Enter your text and select the KeyIdentifier
6. Click encrypt and copy the result

## 🔧 Configuration

### Setting Up Keys
Access the Settings panel from the MuleSoft AES activity bar sidebar:

1. **Click Settings** in the AES panel
2. **Select or Create KeyIdentifier** (DEV, FIT, UAT, PROD, or custom)
3. **Enter Encryption Key** (minimum 16 characters, 32+ recommended for AES-256)
4. **Save** - Keys are stored securely in VS Code

### Key Requirements
- **Minimum Length**: 16 characters (for AES-128)
- **Recommended**: 32+ characters (for AES-256)
- **Character Set**: Alphanumeric, special characters supported
- **Storage**: Secure and never transmitted outside VS Code

## 🔐 Technical Details

### Encryption Specifications
| Property | Value |
|----------|-------|
| **Algorithm** | AES-128-CBC or AES-256-CBC |
| **Block Size** | 128 bits |
| **Padding** | PKCS5 |
| **IV (Initialization Vector)** | Derived from first 16 chars of key |
| **Output Encoding** | Base64 |

### MuleSoft Format
The extension generates encrypted values in MuleSoft's secure properties format:
```
![base64EncodedString]
```

This format is directly compatible with MuleSoft's secure configuration system.

### Example Encryption
```
Plain Text:    mySecretPassword123
Key (DEV):     abcdefghijklmnop
Encrypted:     ![YWJjZGVmZ2hpamtsbW5vcA==]
Algorithm:     AES-256-CBC
```

## 📝 Usage Examples

### Encrypt a Database Password
1. Open your `application.yaml` file
2. Click the AES button in the toolbar
3. Paste: `myDatabasePassword`
4. Select KeyIdentifier: `PROD`
5. Click Encrypt
6. Copy the result: `![EncryptedValueHere]`
7. Paste into your YAML file:
   ```yaml
   db:
     password: ![EncryptedValueHere]
   ```

### Decrypt an Existing Value
1. Copy the encrypted value from your config: `![EncryptedValueHere]`
2. Open AES tool and paste the encrypted value
3. Select the same KeyIdentifier that was used for encryption
4. Click Decrypt to see the original value

### Base64 Encoding
1. Click the Base64 button in editor toolbar
2. Enter text to encode
3. Click Encode
4. Copy the result

## 📋 Supported Files

The encryption button automatically appears when editing:
- **YAML files** (`.yaml`, `.yml`)
- **Properties files** (`.properties`)

## 🔍 Features Breakdown

| Feature | Description |
|---------|-------------|
| **AES Encrypt** | Encrypt plain text using selected KeyIdentifier |
| **AES Decrypt** | Decrypt MuleSoft-format encrypted values |
| **Base64 Encode** | Convert text to Base64 encoding |
| **Base64 Decode** | Convert Base64 to plain text |
| **Settings** | Manage encryption keys and KeyIdentifiers |
| **Copy to Clipboard** | One-click copy of results |
| **Key Toggle** | Show/hide keys with partial masking |

## 🛡️ Security

### Key Safety
- ✅ Keys stored in VS Code's secure storage
- ✅ Encryption happens locally on your machine
- ✅ No network transmission of keys or sensitive data
- ✅ No external API calls required
- ✅ Partial key masking in UI for added security

### Best Practices
1. **Use Strong Keys**: Minimum 32 characters recommended
2. **Rotate Keys**: Periodically update encryption keys in production
3. **Backup Keys**: Keep a secure backup of your KeyIdentifiers and keys
4. **Different Keys**: Use different keys for each environment (DEV/FIT/UAT/PROD)
5. **Workspace Isolation**: Keys are isolated per VS Code workspace

## 💾 Storage

Keys are stored securely using VS Code's built-in secret storage:
- Windows: Windows Credential Manager
- macOS: Keychain
- Linux: `pass` or `secretservice` (depending on system config)

## ✅ Requirements

- **VS Code**: Version 1.105.0 or higher
- **Node.js**: v18+ (for development only)
- **Disk Space**: < 5MB for extension

## 🐛 Known Issues & Limitations

Currently no known issues. If you encounter any problems, please report them on our [GitHub Issues](https://github.com/framedparadox/mulesoft-aes-vscode/issues).

### Common Troubleshooting

**Q: My encryption key is not saving**
- A: Ensure VS Code has permission to access secret storage. Restart VS Code.

**Q: Button doesn't appear in my editor**
- A: Ensure your file is `.yaml`, `.yml`, or `.properties` format.

**Q: Decryption returns garbage**
- A: Verify you're using the correct KeyIdentifier that was used for encryption.

## 📊 Version History

### v0.0.1 (Initial Release) - 2026-06-02
- ✨ MuleSoft AES Encrypt/Decrypt functionality
- 🔑 KeyIdentifier preset management (DEV, FIT, UAT, PROD)
- 🎯 Activity bar integration with dedicated panel
- 📋 Base64 encode/decode utilities
- 🔐 Secure key visibility toggle with partial masking
- 📋 Copy to clipboard for all operations
- 🔧 Settings panel for key configuration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

## 📄 License

This extension is licensed under the [MIT License](LICENSE).

## 🔗 Links

- **Repository**: [framedparadox/mulesoft-aes-vscode](https://github.com/framedparadox/mulesoft-aes-vscode)
- **Issues**: [Report a bug](https://github.com/framedparadox/mulesoft-aes-vscode/issues)
- **MuleSoft Docs**: [MuleSoft Secure Configuration Properties](https://docs.mulesoft.com/mule-runtime/latest/)

---

## 🎓 MuleSoft Development Tips

### Recommended Key Patterns
```
DEV:   dev_env_base_key_12345
FIT:   fit_test_secure_key_67890
UAT:   uat_accept_crypt_abcde
PROD:  prod_secure_secret_12345
```

### File Structure Example
```
src/main/resources/
├── application.yaml
├── application-dev.yaml
├── application-fit.yaml
├── application-uat.yaml
└── application-prod.yaml
```

### In Your MuleSoft Config
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

---

**Made with ❤️ for MuleSoft Developers**