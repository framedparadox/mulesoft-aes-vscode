import * as vscode from 'vscode';
import { contentSecurityPolicy, createNonce, escapeHtml, iconUri } from './webviewUtils';
import { getAesKeyIdentifiers, type AesKeyIdentifier } from '../storage/keyStore';
import { getSupportedFileKind } from '../editor/fileFields';
import { transformSelectedText, validateAesKey } from '../editor/fileTransforms';

interface SidebarItem {
    label: string;
    description: string;
    command: string;
    iconFile: string;
}

export type SidebarMode = 'tools' | 'editorCrypto';

const TOOLS: SidebarItem[] = [
    {
        label: 'MuleSoft AES Encrypt / Decrypt',
        description: 'Encrypt or decrypt text using AES',
        command: 'aes.encryptDecrypt',
        iconFile: 'aes.svg',
    },
    {
        label: 'MuleSoft Secure Properties Encrypt / Decrypt',
        description: 'Encrypt or decrypt with multiple algorithms',
        command: 'aesEnhanced.encryptDecrypt',
        iconFile: 'aes-plus.svg',
    },
    {
        label: 'Base64 Encode / Decode',
        description: 'Encode or decode text and files',
        command: 'base64.encodeDecode',
        iconFile: 'base64.svg',
    },
];

const SETTINGS: SidebarItem = {
    label: 'Settings',
    description: 'Configure AES key identifiers',
    command: 'aes.openSettings',
    iconFile: 'settings.svg',
};

/** Activity-bar webview that launches the AES tool and settings. */
export class SidebarProvider implements vscode.WebviewViewProvider {
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView | undefined;
    private _currentMode: SidebarMode = 'tools';

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._extensionUri = context.extensionUri;
    }

    public setMode(mode: SidebarMode): void {
        this._currentMode = mode;
    }

    public getMode(): SidebarMode {
        return this._currentMode;
    }

    /** Re-render the current mode (useful after key changes or explicit switch). */
    public async renderForCurrentMode(): Promise<void> {
        if (this._webviewView) {
            this._webviewView.webview.html = await this._getHtmlForMode(this._webviewView.webview);
        }
    }

    /** Refresh key identifiers in the UI (re-renders only the compact editor-crypto view). */
    public async refreshKeyIdentifiers(): Promise<void> {
        if (this._currentMode === 'editorCrypto' && this._webviewView) {
            this._webviewView.webview.html = await this._getHtmlForMode(this._webviewView.webview);
        }
    }

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        // Initial render for whatever the current mode is
        void this._renderCurrent(webviewView);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            // Tools / navigation messages (full list mode)
            if (message.command === 'runTool' && typeof message.toolCommand === 'string') {
                await vscode.commands.executeCommand(message.toolCommand);
                return;
            }

            if (message.command === 'switchToTools') {
                this.setMode('tools');
                await this.renderForCurrentMode();
                return;
            }

            // Editor crypto (compact) mode actions
            if (this._currentMode === 'editorCrypto') {
                if (message.command === 'encrypt' || message.command === 'decrypt') {
                    await this._handleEditorCryptoAction(message.command, message.key);
                } else if (message.command === 'refreshKeys') {
                    await this.refreshKeyIdentifiers();
                }
            }
        });

        // Optional: when the view becomes visible, ensure correct content
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                void this._renderCurrent(webviewView);
            }
        });
    }

    private async _renderCurrent(webviewView: vscode.WebviewView): Promise<void> {
        webviewView.webview.html = await this._getHtmlForMode(webviewView.webview);
    }

    private renderItem(webview: vscode.Webview, item: SidebarItem): string {
        const iconSrc = iconUri(webview, this._extensionUri, item.iconFile);
        const safeLabel = escapeHtml(item.label);
        const safeDescription = escapeHtml(item.description);
        const safeCommand = escapeHtml(item.command);
        const safeTitle = escapeHtml(`${item.label}: ${item.description}`);

        return `<button type="button" class="tool-button" data-command="${safeCommand}" title="${safeTitle}">
            <img src="${iconSrc}" class="tool-icon" alt="" />
            <span class="tool-content">
                <span class="tool-title">${safeLabel}</span>
                <span class="tool-description">${safeDescription}</span>
            </span>
        </button>`;
    }

    private async _getHtmlForMode(webview: vscode.Webview): Promise<string> {
        const nonce = createNonce();
        const csp = contentSecurityPolicy(webview, nonce);

        if (this._currentMode === 'editorCrypto') {
            return this._getEditorCryptoHtml(webview, nonce, csp);
        }

        // Default: full tools list
        const mainRows = TOOLS.map((tool) => this.renderItem(webview, tool)).join('');
        const bottomRows = this.renderItem(webview, SETTINGS);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
    html, body {
        height: 100%;
        margin: 0;
        padding: 8px;
        box-sizing: border-box;
        color: var(--vscode-sideBar-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        overflow: hidden;
    }
    .sidebar-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 8px;
    }
    .tool-list-main {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }
    .tool-list-bottom {
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-top: 1px solid var(--vscode-sideBar-border, var(--vscode-input-border));
        padding-top: 8px;
        flex-shrink: 0;
    }
    .tool-button {
        width: 100%;
        border-radius: 8px;
        color: inherit;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: inherit;
        padding: 7px 8px;
        border: 1px solid var(--vscode-sideBar-border, var(--vscode-input-border));
        background: var(--vscode-editorWidget-background);
    }
    .tool-button:hover {
        background: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-list-hoverBackground);
    }
    .tool-button:focus-visible {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: 1px;
    }
    .tool-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }
    .tool-content {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .tool-title {
        font-weight: 600;
        font-size: 12px;
        line-height: 1.2;
        color: var(--vscode-sideBar-foreground);
    }
    .tool-description {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
</head>
<body>
    <div class="sidebar-root">
        <div class="tool-list-main">${mainRows}</div>
        <div class="tool-list-bottom">${bottomRows}</div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('.tool-button[data-command]').forEach((button) => {
            button.addEventListener('click', () => {
                vscode.postMessage({ command: 'runTool', toolCommand: button.getAttribute('data-command') });
            });
        });
    </script>
</body>
</html>`;
    }

    private async _getEditorCryptoHtml(webview: vscode.Webview, nonce: string, csp: string): Promise<string> {
        const keyIdentifiers: AesKeyIdentifier[] = await getAesKeyIdentifiers(this._context);
        const keyOptions = keyIdentifiers
            .filter(k => k.keyIdentifier && k.key)
            .map(k => `<option value="${escapeHtml(k.key)}">${escapeHtml(k.keyIdentifier)}</option>`)
            .join('');

        const headerIcon = iconUri(webview, this._extensionUri, 'aes.svg');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>MuleSoft AES - Editor Crypto</title>
<style>
    html, body {
        height: 100%;
        margin: 0;
        padding: 10px;
        box-sizing: border-box;
        color: var(--vscode-sideBar-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        font-size: 12px;
    }
    .ec-root { display: flex; flex-direction: column; gap: 10px; }
    .ec-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 13px;
    }
    .ec-header img { width: 18px; height: 18px; }
    .ec-back {
        margin-left: auto;
        font-size: 11px;
        padding: 2px 6px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
    }
    .ec-back:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .ec-group { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 11px; color: var(--vscode-descriptionForeground); }
    select, input[type="text"], input[type="password"] {
        width: 100%;
        padding: 5px 6px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: var(--vscode-font-family);
        box-sizing: border-box;
        font-size: 12px;
    }
    .ec-key-row { display: flex; gap: 6px; }
    .ec-key-row input { flex: 1; }
    .ec-btn-row { display: flex; gap: 8px; margin-top: 4px; }
    button {
        flex: 1;
        padding: 6px 10px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
        font-family: var(--vscode-font-family);
        font-size: 12px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .ec-status {
        font-size: 11px;
        min-height: 14px;
        color: var(--vscode-descriptionForeground);
    }
    .ec-status.error { color: var(--vscode-errorForeground); }
    .ec-status.success { color: var(--vscode-terminal-ansiGreen); }
</style>
</head>
<body>
<div class="ec-root">
    <div class="ec-header">
        <img src="${headerIcon}" alt="" />
        <span>Editor AES</span>
        <button type="button" class="ec-back" id="backToTools">Back to Tools</button>
    </div>

    <div class="ec-group">
        <label for="keyIdentifier">Key Identifier</label>
        <select id="keyIdentifier">
            <option value="">-- Select or enter key below --</option>
            ${keyOptions}
        </select>
    </div>

    <div class="ec-group">
        <label for="key">Key (min 16 chars)</label>
        <div class="ec-key-row">
            <input type="password" id="key" placeholder="Enter AES key" />
            <button type="button" id="toggleKey" class="secondary" title="Toggle visibility">👁</button>
        </div>
    </div>

    <div class="ec-btn-row">
        <button id="encryptBtn">Encrypt</button>
        <button id="decryptBtn">Decrypt</button>
    </div>

    <div class="ec-status" id="status"></div>
</div>

<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const keySelect = document.getElementById('keyIdentifier');
    const keyInput = document.getElementById('key');
    const toggleBtn = document.getElementById('toggleKey');
    const encryptBtn = document.getElementById('encryptBtn');
    const decryptBtn = document.getElementById('decryptBtn');
    const statusEl = document.getElementById('status');
    const backBtn = document.getElementById('backToTools');

    let keyVisible = false;

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg || '';
        statusEl.className = 'ec-status' + (isError ? ' error' : (msg ? ' success' : ''));
    }

    keySelect.addEventListener('change', () => {
        if (keySelect.value) {
            keyInput.value = '';
            keyInput.placeholder = 'Using selected KeyIdentifier';
        } else {
            keyInput.placeholder = 'Enter AES key';
        }
    });

    toggleBtn.addEventListener('click', () => {
        keyVisible = !keyVisible;
        keyInput.type = keyVisible ? 'text' : 'password';
        toggleBtn.textContent = keyVisible ? '🙈' : '👁';
    });

    function getEffectiveKey() {
        if (keySelect.value) {
            return keySelect.value;
        }
        return keyInput.value.trim();
    }

    async function perform(op) {
        const key = getEffectiveKey();
        if (!key) {
            setStatus('Key is required', true);
            return;
        }
        try {
            // Basic client-side length check (server will validate too)
            if (key.length < 16) {
                setStatus('Key must be at least 16 characters', true);
                return;
            }
            setStatus(op === 'encrypt' ? 'Encrypting...' : 'Decrypting...');
            vscode.postMessage({ command: op, key });
            // Status will be updated by extension after edit attempt
        } catch (e) {
            setStatus(e instanceof Error ? e.message : String(e), true);
        }
    }

    encryptBtn.addEventListener('click', () => perform('encrypt'));
    decryptBtn.addEventListener('click', () => perform('decrypt'));

    backBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'switchToTools' });
    });

    // Allow Enter in key field to encrypt
    keyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            perform('encrypt');
        }
    });

    // Listen for status updates from the extension (e.g. after successful in-place edit)
    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg && msg.command === 'status') {
            setStatus(msg.text || '', false);
            // Auto-clear after a short delay
            setTimeout(() => {
                if (statusEl.textContent === (msg.text || '')) {
                    setStatus('');
                }
            }, 2200);
        }
    });

    // Initial focus on key field
    setTimeout(() => keyInput.focus(), 50);
</script>
</body>
</html>`;
    }

    private async _handleEditorCryptoAction(operation: 'encrypt' | 'decrypt', providedKey?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        const kind = getSupportedFileKind(editor.document.fileName, editor.document.languageId);
        if (!kind) {
            vscode.window.showErrorMessage('AES editor actions only support .yaml, .yml, and .properties files.');
            return;
        }

        if (editor.selection.isEmpty) {
            vscode.window.showErrorMessage('Select a value to encrypt or decrypt.');
            return;
        }

        const selectedText = editor.document.getText(editor.selection);

        // Determine the key: prefer the one sent from the webview, otherwise fall back to prompting
        let key = (typeof providedKey === 'string' && providedKey.length > 0) ? providedKey : undefined;

        if (!key) {
            // If no key was provided from the sidebar UI, ask the user
            key = await vscode.window.showInputBox({
                prompt: 'Enter the AES encryption key',
                password: true,
                ignoreFocusOut: true,
            });
        }

        if (!key) {
            return;
        }

        try {
            validateAesKey(key);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(msg);
            return;
        }

        let replacement: string;
        try {
            replacement = transformSelectedText(selectedText, key, operation);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(msg);
            return;
        }

        const applied = await editor.edit((editBuilder) => {
            editBuilder.replace(editor.selection, replacement);
        });

        if (!applied) {
            vscode.window.showErrorMessage(`Unable to ${operation} the selected value.`);
            return;
        }

        // Provide subtle feedback in the sidebar if it is still in editorCrypto mode
        if (this._webviewView && this._currentMode === 'editorCrypto') {
            this._webviewView.webview.postMessage({
                command: 'status',
                text: `${operation === 'encrypt' ? 'Encrypted' : 'Decrypted'} successfully.`,
            });
        }
    }
}
