# VSIX Build Information

## Package Details

- **File Name**: `mule-aes-0.0.1.vsix`
- **File Size**: 47.24 KB
- **Version**: 0.0.1
- **Publisher**: framedparadox
- **Build Date**: 2026-06-02

## Build Process

The VSIX package was built using the following commands:

```bash
# 1. Build the extension (webpack)
npm run package

# 2. Create VSIX package (vsce)
npx vsce package --no-git-tag-version
```

## Package Contents

```
mule-aes-0.0.1.vsix
├─ [Content_Types].xml 
├─ extension.vsixmanifest 
└─ extension/
   ├─ LICENSE.txt [1.04 KB]
   ├─ package.json [3.47 KB]
   ├─ readme.md [8.1 KB]
   ├─ dist/
   │  ├─ extension.js [54.34 KB] (Webpack bundled)
   │  └─ extension.js.map [72.1 KB] (Source map)
   ├─ docs/
   │  └─ PUBLISHING.md [2.81 KB]
   └─ resources/
      ├─ icon.png [9.13 KB]
      ├─ icon.svg [1.1 KB]
      └─ icons/
         ├─ activitybar.svg [0.8 KB]
         ├─ aes.svg [0.77 KB]
         ├─ base64.svg [0.57 KB] (Fixed with square background)
         └─ settings.svg [1.4 KB]
```

## Installation Methods

### Method 1: Direct Installation in VS Code
```bash
code --install-extension mule-aes-0.0.1.vsix
```

### Method 2: Marketplace Publishing
```bash
# Prerequisites: VS Code Personal Access Token (PAT) for publisher account
npx vsce publish --packagePath mule-aes-0.0.1.vsix

# Or using ovsx for Open VSX Marketplace
npx ovsx publish mule-aes-0.0.1.vsix -p <token>
```

### Method 3: Manual Installation
1. In VS Code, open Command Palette (Cmd+Shift+P)
2. Run: `Extensions: Install from VSIX...`
3. Select `mule-aes-0.0.1.vsix`

## What's Included

✅ **Extension Code**
- Compiled TypeScript bundled with Webpack
- Minified production build (54.34 KB)

✅ **Documentation**
- Comprehensive README.md
- Publishing guide (docs/PUBLISHING.md)

✅ **Assets**
- Extension icon (PNG + SVG)
- Activity bar icon
- Command icons (AES, Base64, Settings)

✅ **Configuration**
- package.json with all dependencies and metadata
- MIT License

## Extension Features

- 🔒 AES Encrypt/Decrypt
- 📋 Base64 Encode/Decode
- 🔑 KeyIdentifier Management (DEV, FIT, UAT, PROD)
- 🎯 Activity Bar Integration
- 🔐 Secure Key Storage
- 📋 Copy to Clipboard

## Next Steps for Publishing

### To VS Code Marketplace
1. Create publisher account at https://marketplace.visualstudio.com
2. Generate Personal Access Token (PAT)
3. Run: `npx vsce publish --packagePath mule-aes-0.0.1.vsix`

### To Open VSX Marketplace
1. Create account at https://open-vsx.org
2. Generate token
3. Run: `npx ovsx publish mule-aes-0.0.1.vsix -p <token>`

## Build Quality Checklist

- ✅ Webpack build successful
- ✅ No compilation errors
- ✅ All icons included (fixed base64 icon)
- ✅ README with comprehensive documentation
- ✅ Package.json properly configured
- ✅ VSIX package created successfully
- ✅ File size optimized (47.24 KB)

---

For detailed publishing instructions, see [docs/PUBLISHING.md](docs/PUBLISHING.md)
