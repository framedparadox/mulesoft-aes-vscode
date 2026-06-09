import * as vscode from 'vscode';
import {
    DEFAULT_AES_KEY_IDENTIFIERS,
    getAesKeyIdentifiers,
    normalizeAesKeyIdentifiers,
    setAesKeyIdentifiers,
} from '../storage/keyStore';
import { contentSecurityPolicy, createNonce, iconUri } from './webviewUtils';

const EYE_SVG =
    '<svg class="icon-show" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8.5A3.5 3.5 0 1 1 8 4.5a3.5 3.5 0 0 1 0 7zm0-5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg><svg class="icon-hide" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.05 2.05a.5.5 0 0 1 .7 0l11.2 11.2a.5.5 0 0 1-.7.7l-2.06-2.05A8.7 8.7 0 0 1 8 13c-3.5 0-6.5-2.5-8-5 .8-1.33 2.06-2.84 3.7-3.94L2.05 2.76a.5.5 0 0 1 0-.71zM4.43 5.14C3.13 6 2.07 7.13 1.4 8c1.1 1.45 3.4 3.5 6.6 3.5.95 0 1.83-.18 2.62-.48l-1.4-1.4a2.5 2.5 0 0 1-3.34-3.34L4.43 5.14zM8 3c-.6 0-1.18.07-1.73.2l1.16 1.16A2.5 2.5 0 0 1 10.64 7.57l1.85 1.85C13.6 8.55 14.4 7.6 14.6 7c-1.1-1.45-3.4-3.5-6.6-3.5z"/></svg>';

/** Settings panel for managing AES key identifiers. */
export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private readonly _onSaved?: () => void;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, onSaved?: () => void) {
        this._panel = panel;
        this._context = context;
        this._onSaved = onSaved;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._initHtml();

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'save': {
                        const keyIdentifiers = normalizeAesKeyIdentifiers(message.aesKeyIdentifiers);
                        await setAesKeyIdentifiers(this._context, keyIdentifiers);
                        this._panel.webview.postMessage({ command: 'saved' });
                        this._onSaved?.();
                        return;
                    }
                    case 'reset': {
                        await setAesKeyIdentifiers(this._context, DEFAULT_AES_KEY_IDENTIFIERS);
                        await this._initHtml();
                        this._onSaved?.();
                        return;
                    }
                }
            },
            null,
            this._disposables
        );
    }

    public static render(context: vscode.ExtensionContext, onSaved?: () => void): void {
        const column = vscode.ViewColumn.One;
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('aes.settings', 'Settings', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri],
        });
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'settings.svg');
        SettingsPanel.currentPanel = new SettingsPanel(panel, context, onSaved);
    }

    public dispose(): void {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }

    private async _initHtml(): Promise<void> {
        const webview = this._panel.webview;
        const nonce = createNonce();
        const csp = contentSecurityPolicy(webview, nonce);
        const aesKeyIdentifiers = await getAesKeyIdentifiers(this._context);
        const escapeAttr = (value: string): string =>
            value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const settingsIcon = iconUri(webview, this._context.extensionUri, 'settings.svg');
        const aesIcon = iconUri(webview, this._context.extensionUri, 'aes.svg');

        const aesRows = aesKeyIdentifiers
            .map(
                (keyIdentifier) => `<tr>
            <td>
                <input type="text" class="keyidentifier-name" value="${escapeAttr(keyIdentifier.keyIdentifier)}" placeholder="KeyIdentifier" />
            </td>
            <td>
                <div class="key-wrapper">
                    <input type="password" class="keyidentifier-key" value="${escapeAttr(keyIdentifier.key)}" placeholder="Encryption key (min 16 chars)" />
                    <button type="button" class="eye-btn" title="Show key" aria-label="Show key" aria-pressed="false">${EYE_SVG}</button>
                </div>
            </td>
            <td class="table-actions">
                <button type="button" class="del-btn">Delete</button>
            </td>
        </tr>`
            )
            .join('');

        this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Settings</title>
<style>
    body {
        padding: 20px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
    }
    .container { max-width: 980px; margin: 0 auto; }
    h2 { display: flex; align-items: center; gap: 10px; margin-top: 0; }
    .header-icon { width: 26px; height: 26px; }
    .card {
        border: 1px solid var(--vscode-input-border);
        border-radius: 12px;
        padding: 18px;
        background-color: var(--vscode-editor-background);
        margin-bottom: 16px;
    }
    .card-title {
        font-size: 1em; font-weight: bold; margin: 0 0 14px;
        display: flex; align-items: center; gap: 7px;
        border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px;
    }
    .local-note {
        margin: 0 0 14px;
        padding: 9px 10px;
        border-left: 3px solid var(--vscode-textLink-foreground);
        background: var(--vscode-textBlockQuote-background);
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
        line-height: 1.4;
    }
    .card-title-icon { width: 16px; height: 16px; }
    .aes-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .aes-table thead th:nth-child(1) { width: 180px; }
    .aes-table thead th:nth-child(3) { width: 96px; text-align: center; }
    .aes-table thead th {
        text-align: left;
        font-size: 0.8em;
        color: var(--vscode-descriptionForeground);
        padding: 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
    }
    .aes-table td {
        padding: 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
        vertical-align: middle;
        word-break: break-word;
    }
    .aes-table td:last-child { text-align: center; }
    .aes-table tr:last-child td { border-bottom: none; }
    .key-wrapper { display: flex; gap: 6px; align-items: center; }
    .key-wrapper input { flex: 1; }
    .table-actions { width: 90px; text-align: center; }
    input[type=text], input[type=password] {
        width: 100%;
        padding: 7px 8px;
        box-sizing: border-box;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        font-family: monospace;
        font-size: 12.5px;
        border-radius: 6px;
    }
    .tab-actions {
        margin-top: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    .actions {
        position: sticky; bottom: -20px;
        margin: 24px -20px -20px; padding: 14px 20px;
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        background: var(--vscode-editor-background);
        border-top: 1px solid var(--vscode-panel-border);
        z-index: 5;
    }
    button {
        padding: 8px 18px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
        font-family: var(--vscode-font-family);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-align: center;
        line-height: 1.2;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .eye-btn { padding: 6px 8px; display: inline-flex; align-items: center; justify-content: center;
               background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
               border: 1px solid var(--vscode-input-border); cursor: pointer; }
    .eye-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .eye-btn .icon-hide { display: none; }
    .eye-btn[aria-pressed="true"] .icon-show { display: none; }
    .eye-btn[aria-pressed="true"] .icon-hide { display: inline-block; }
    .del-btn { background: #c0392b; color: #fff; padding: 6px 10px; }
    .del-btn:hover { background: #e74c3c; }
    #savedMsg { color: #4CAF50; font-weight: bold; display: none; font-size: 0.88em; }
</style>
</head>
<body>
<div class="container">
    <h2>
        <img class="header-icon" src="${settingsIcon}" alt="" />
        Settings
    </h2>

    <section class="card" id="aes-settings-section">
        <div class="card-title">
            <img class="card-title-icon" src="${aesIcon}" alt="" />
            AES KeyIdentifier Settings
        </div>
        <p class="local-note">
            KeyIdentifier names and encryption keys are stored locally ONLY in VS Code secret storage on this machine.
        </p>
        <table class="aes-table">
            <thead>
                <tr>
                    <th>KeyIdentifier</th>
                    <th>Encryption Key</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="keyIdentifierTable">${aesRows}</tbody>
        </table>
        <div class="tab-actions">
            <button id="addKeyIdentifierBtn" type="button" class="btn-secondary">+ Add KeyIdentifier</button>
        </div>
    </section>

    <div class="actions">
        <button id="saveBtn">&#10003; Save Changes</button>
        <button id="resetBtn" class="btn-secondary">Reset to Defaults</button>
        <span id="savedMsg">&#10003; Saved!</span>
    </div>
</div>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const eyeSvg = ${JSON.stringify(EYE_SVG)};
    const keyIdentifierTable = document.getElementById('keyIdentifierTable');

    function attachRowListeners(row) {
        row.querySelector('.del-btn').addEventListener('click', () => row.remove());
        const eyeBtn = row.querySelector('.eye-btn');
        eyeBtn.addEventListener('click', () => {
            const keyInput = row.querySelector('.keyidentifier-key');
            const willShow = keyInput.type === 'password';
            keyInput.type = willShow ? 'text' : 'password';
            eyeBtn.setAttribute('aria-pressed', String(willShow));
            const label = willShow ? 'Hide key' : 'Show key';
            eyeBtn.setAttribute('aria-label', label);
            eyeBtn.setAttribute('title', label);
        });
    }

    function addRow(keyIdentifier, key) {
        const row = document.createElement('tr');
        row.innerHTML =
            '<td><input type="text" class="keyidentifier-name" placeholder="KeyIdentifier" /></td>' +
            '<td><div class="key-wrapper"><input type="password" class="keyidentifier-key" placeholder="Encryption key (min 16 chars)" />' +
            '<button type="button" class="eye-btn" title="Show key" aria-label="Show key" aria-pressed="false">' + eyeSvg + '</button></div></td>' +
            '<td class="table-actions"><button type="button" class="del-btn">Delete</button></td>';
        row.querySelector('.keyidentifier-name').value = keyIdentifier;
        row.querySelector('.keyidentifier-key').value = key;
        keyIdentifierTable.appendChild(row);
        attachRowListeners(row);
    }

    Array.from(keyIdentifierTable.querySelectorAll('tr')).forEach(attachRowListeners);

    document.getElementById('addKeyIdentifierBtn').addEventListener('click', () => addRow('', ''));

    document.getElementById('saveBtn').addEventListener('click', () => {
        const aesKeyIdentifiers = Array.from(keyIdentifierTable.querySelectorAll('tr')).map((row) => ({
            keyIdentifier: row.querySelector('.keyidentifier-name').value.trim(),
            key: row.querySelector('.keyidentifier-key').value
        }));
        vscode.postMessage({ command: 'save', aesKeyIdentifiers });
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'reset' });
    });

    window.addEventListener('message', (e) => {
        if (e.data.command === 'saved') {
            const msg = document.getElementById('savedMsg');
            msg.style.display = 'inline';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }
    });
</script>
</body>
</html>`;
    }
}
