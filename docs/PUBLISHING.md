# Publishing Guide

This document describes how to publish the MuleSoft AES extension to the VS Code Marketplace and OpenVSX.

## Prerequisites

1. **VS Code Marketplace Account**: Create a publisher account at https://marketplace.visualstudio.com/manage
2. **Personal Access Token (PAT)**: Generate a PAT with `Marketplace > Manage` scope
3. **OpenVSX Account** (optional): Create an account at https://open-vsx.org
4. **OpenVSX Token** (optional): Generate a token at https://open-vsx.org/user/settings/tokens

## Automated Publishing (via GitHub Actions)

The GitHub Actions workflow in `.github/workflows/publish.yml` automatically publishes new releases:

1. **Set up secrets** in your GitHub repository:
   - `VSCE_TOKEN`: Your VS Code Marketplace PAT
   - `OVSX_TOKEN`: Your OpenVSX token (optional)

2. **Create a release tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. The workflow will automatically:
   - Run linting and tests
   - Build the package
   - Publish to VS Code Marketplace
   - Publish to OpenVSX (optional, continues on error)

## Manual Publishing

If you need to publish manually:

### VS Code Marketplace

1. **Install `vsce` globally** (if not already installed):
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Package the extension**:
   ```bash
   npm run package
   ```

3. **Publish**:
   ```bash
   npm run publish -- --pat <YOUR_PAT>
   ```

   Or, if your PAT is in the `VSCE_TOKEN` environment variable:
   ```bash
   VSCE_TOKEN=<YOUR_PAT> npm run publish
   ```

### OpenVSX Registry

1. **Install `ovsx` globally** (if not already installed):
   ```bash
   npm install -g ovsx
   ```

2. **Publish**:
   ```bash
   npm run publish:ovsx -- --pat <YOUR_PAT>
   ```

## Version Bumping

Before publishing, update the version in `package.json`:

```json
{
  "version": "1.0.0"
}
```

Follow [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features (backward compatible)
- **Patch** (0.0.1): Bug fixes and maintenance

## Marketplace Assets

The following files are used on the marketplace:

- **Icon**: `resources/icon.png` (256×256 px)
- **README**: `README.md`
- **License**: `LICENSE` (MIT)

## Troubleshooting

### "Package size exceeds limit"
Check `.vscodeignore` to ensure unnecessary files are excluded (src, node_modules, .git, etc.).

### "Extension already published at this version"
Update the version in `package.json` before publishing.

### "Invalid PAT"
Verify your token has the correct scope (`Marketplace > Manage`) and hasn't expired.

## Resources

- [VS Code Extension Publishing Docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [VSCE CLI Reference](https://github.com/microsoft/vscode-vsce)
- [OpenVSX Publishing Guide](https://github.com/EclipseFdn/openvsx/wiki/Publishing-Extensions)
