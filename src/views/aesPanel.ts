import * as vscode from 'vscode';
import { decrypt, encrypt, SUPPORTED_ALGORITHMS, SUPPORTED_MODES } from '../aes/aesCrypto';
import { getAesKeyIdentifiers } from '../storage/keyStore';
import { contentSecurityPolicy, createNonce, escapeHtml, iconUri } from './webviewUtils';

/** Webview panel for MuleSoft AES encrypt / decrypt. */
export class AesPanel {
    public static currentPanel: AesPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._initHtml();

        this._panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'encrypt':
                        this._runCrypto('encryptResult', () => encrypt(message.text, message.key, message.options), 'Encryption');
                        return;
                    case 'decrypt':
                        this._runCrypto('decryptResult', () => decrypt(message.text, message.key, message.options), 'Decryption');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static render(context: vscode.ExtensionContext): void {
        const column = vscode.ViewColumn.One;
        if (AesPanel.currentPanel) {
            AesPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'aes.encryptDecrypt',
            'MuleSoft AES Encrypt / Decrypt',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri],
            }
        );
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'aes.svg');
        AesPanel.currentPanel = new AesPanel(panel, context);
    }

    public refreshKeyIdentifiers(): void {
        this._initHtml();
    }

    public dispose(): void {
        AesPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }

    private _runCrypto(resultCommand: string, run: () => string, label: string): void {
        try {
            this._panel.webview.postMessage({ command: resultCommand, result: run() });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this._panel.webview.postMessage({ command: 'error', message: `${label} error: ${detail}` });
        }
    }

    private maskKeyForDisplay(key: string): string {
        if (key.length <= 8) {
            return '*'.repeat(key.length);
        }
        return `${key.substring(0, 5)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 3)}`;
    }

    private async _initHtml(): Promise<void> {
        const webview = this._panel.webview;
        const nonce = createNonce();
        const csp = contentSecurityPolicy(webview, nonce);
        const keyIdentifiers = await getAesKeyIdentifiers(this._context);
        const firstKey = keyIdentifiers[0]?.key ?? '';
        const firstKeyMasked = this.maskKeyForDisplay(firstKey);
        const headerIcon = iconUri(webview, this._context.extensionUri, 'aes.svg');
        const keyIdentifierOptions = keyIdentifiers
            .map(
                (keyIdentifier, index) =>
                    `<option value="${escapeHtml(keyIdentifier.key)}"${index === 0 ? ' selected' : ''}>${escapeHtml(keyIdentifier.keyIdentifier)}</option>`
            )
            .join('');
        const algorithmOptions = SUPPORTED_ALGORITHMS.map(
            (algorithm) => `<option value="${algorithm}"${algorithm === 'AES' ? ' selected' : ''}>${algorithm}</option>`
        ).join('');
        const modeOptions = SUPPORTED_MODES.map(
            (mode) => `<option value="${mode}"${mode === 'CBC' ? ' selected' : ''}>${mode}</option>`
        ).join('');

        this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>MuleSoft AES Encrypt / Decrypt</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .container { max-width: 900px; margin: 0 auto; }
        h2 {
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header-icon { width: 32px; height: 32px; }
        .input-group { margin-bottom: 20px; }
        .options-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
        .option-field { flex: 1; min-width: 140px; }
        .option-field.checkbox-field {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 8px;
        }
        .option-field.checkbox-field label { margin-bottom: 0; }
        .option-field.checkbox-field input[type="checkbox"] { width: auto; }
        select:disabled, input:disabled { opacity: 0.5; cursor: not-allowed; }
        .key-row { display: flex; gap: 10px; align-items: flex-end; }
        .key-input { flex: 1; position: relative; }
        .key-input-wrapper { position: relative; display: flex; gap: 5px; }
        .toggle-visibility {
            padding: 8px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            white-space: nowrap;
            min-width: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .toggle-visibility:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        .toggle-visibility svg { width: 18px; height: 18px; fill: currentColor; }
        .keyidentifier-select { width: 150px; }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        textarea, input[type="text"], input[type="password"], select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
            resize: vertical;
        }
        textarea { min-height: 100px; font-family: 'Courier New', monospace; }
        .button-group { margin: 20px 0; display: flex; gap: 10px; flex-wrap: wrap; }
        button {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }
        button:hover { background-color: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border, var(--vscode-input-border));
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        button.secondary:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        button.secondary svg.btn-icon { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
        .result { margin-top: 20px; }
        .result-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .error {
            color: var(--vscode-errorForeground);
            margin-top: 10px;
            padding: 8px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        .success {
            color: var(--vscode-terminal-ansiGreen);
            margin-top: 10px;
            padding: 8px;
        }
        .info {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            margin: 10px 0;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>
            <img class="header-icon" src="${headerIcon}" alt="" />
            MuleSoft AES Encrypt / Decrypt
        </h2>

        <div class="info">
            <strong>Note:</strong> This tool replicates MuleSoft secure configuration properties encryption.
            Choose an algorithm, cipher mode (state) and whether to use random IVs. The defaults (AES / CBC, no random IV)
            match the original MuleSoft AES/CBC/PKCS5 behaviour. Encrypted values are wrapped in ![...] format.
        </div>

        <div class="input-group">
            <div class="options-row">
                <div class="option-field">
                    <label for="algorithm">Algorithm:</label>
                    <select id="algorithm">${algorithmOptions}</select>
                </div>
                <div class="option-field">
                    <label for="mode">State (Mode):</label>
                    <select id="mode">${modeOptions}</select>
                </div>
                <div class="option-field checkbox-field">
                    <input type="checkbox" id="useRandomIv" />
                    <label for="useRandomIv">Use Random IVs</label>
                </div>
            </div>
        </div>

        <div class="input-group">
            <div class="key-row">
                <div class="key-input">
                    <label for="key">Encryption Key (min 16 chars, 32 for AES-256):</label>
                    <div class="key-input-wrapper">
                        <input type="text" id="key" placeholder="Enter your encryption key" value="${escapeHtml(firstKeyMasked)}" />
                        <button type="button" id="toggleKeyVisibility" class="toggle-visibility" title="Hide key">
                            <svg id="eyeIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="keyidentifier-select">
                    <label for="keyIdentifier">KeyIdentifier:</label>
                    <select id="keyIdentifier">
                        <option value="">Custom</option>
                        ${keyIdentifierOptions}
                    </select>
                </div>
            </div>
        </div>

        <div class="input-group">
            <label for="input">Input Text:</label>
            <textarea id="input" placeholder="Enter text to encrypt or encrypted text (![...]) to decrypt"></textarea>
        </div>

        <div class="button-group">
            <button id="encryptBtn">Encrypt</button>
            <button id="decryptBtn">Decrypt</button>
            <button id="clearBtn" class="secondary"><svg class="btn-icon" viewBox="0 0 16 16"><path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/></svg>Clear</button>
        </div>

        <div class="result">
            <div class="result-actions">
                <label for="output">Output:</label>
                <button id="copyBtn" class="secondary" style="padding: 5px 15px;"><svg class="btn-icon" viewBox="0 0 16 16"><path d="M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7zM3 1L2 2v10l1 1V2h6.414l-1-1H3z"/></svg>Copy to Clipboard</button>
            </div>
            <textarea id="output" readonly></textarea>
        </div>

        <div id="message"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const keyInput = document.getElementById('key');
        const keyIdentifierSelect = document.getElementById('keyIdentifier');
        const algorithmSelect = document.getElementById('algorithm');
        const modeSelect = document.getElementById('mode');
        const randomIvCheckbox = document.getElementById('useRandomIv');
        const inputText = document.getElementById('input');
        const outputText = document.getElementById('output');
        const messageDiv = document.getElementById('message');
        const toggleKeyBtn = document.getElementById('toggleKeyVisibility');

        let isKeyVisible = true;
        let isKeyIdentifierSelected = false;
        let actualKeyValue = '';

        const eyeOpenIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
        const eyeClosedIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';

        function maskKey(key) {
            if (key.length <= 8) {
                return '*'.repeat(key.length);
            }
            return key.substring(0, 5) + '*'.repeat(key.length - 8) + key.substring(key.length - 3);
        }

        function updateToggleButton() {
            if (isKeyIdentifierSelected) {
                toggleKeyBtn.disabled = true;
                toggleKeyBtn.innerHTML = eyeClosedIcon;
                toggleKeyBtn.title = 'KeyIdentifier key is masked';
                return;
            }
            toggleKeyBtn.disabled = false;
            toggleKeyBtn.innerHTML = isKeyVisible ? eyeOpenIcon : eyeClosedIcon;
            toggleKeyBtn.title = isKeyVisible ? 'Hide key' : 'Show key';
        }

        function applyKeyIdentifierSelection(selectedKey) {
            if (selectedKey) {
                isKeyIdentifierSelected = true;
                isKeyVisible = false;
                actualKeyValue = selectedKey;
                keyInput.value = maskKey(selectedKey);
            } else {
                isKeyIdentifierSelected = false;
                isKeyVisible = true;
                actualKeyValue = '';
                keyInput.value = '';
            }
            updateToggleButton();
        }

        function switchToCustomModeForTyping() {
            if (!isKeyIdentifierSelected) {
                return;
            }
            keyIdentifierSelect.value = '';
            isKeyIdentifierSelected = false;
            isKeyVisible = true;
            actualKeyValue = '';
            keyInput.value = '';
            updateToggleButton();
        }

        applyKeyIdentifierSelection(keyIdentifierSelect.value);

        toggleKeyBtn.addEventListener('click', () => {
            if (isKeyIdentifierSelected) {
                return;
            }
            if (isKeyVisible) {
                actualKeyValue = keyInput.value;
                if (actualKeyValue) {
                    keyInput.value = maskKey(actualKeyValue);
                }
                isKeyVisible = false;
            } else {
                keyInput.value = actualKeyValue;
                isKeyVisible = true;
            }
            updateToggleButton();
        });

        keyInput.addEventListener('input', () => {
            if (isKeyVisible) {
                actualKeyValue = keyInput.value;
            }
        });

        keyInput.addEventListener('keydown', (e) => {
            if (isKeyIdentifierSelected) {
                const isCharacterInput = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
                const isDeleteKey = e.key === 'Backspace' || e.key === 'Delete';
                if (isCharacterInput || isDeleteKey) {
                    switchToCustomModeForTyping();
                    if (isDeleteKey) {
                        e.preventDefault();
                    }
                }
                return;
            }
            if (!isKeyVisible) {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    actualKeyValue = '';
                    keyInput.value = '';
                } else if (e.key.length === 1) {
                    e.preventDefault();
                }
            }
        });

        keyInput.addEventListener('paste', () => {
            if (isKeyIdentifierSelected) {
                switchToCustomModeForTyping();
            }
        });

        keyIdentifierSelect.addEventListener('change', () => {
            applyKeyIdentifierSelection(keyIdentifierSelect.value);
        });

        // RCA (RC4) is a stream cipher: no mode and no IV. ECB mode uses no IV.
        function updateOptionAvailability() {
            const isStream = algorithmSelect.value === 'RCA';
            modeSelect.disabled = isStream;
            const noIv = isStream || modeSelect.value === 'ECB';
            randomIvCheckbox.disabled = noIv;
            if (noIv) {
                randomIvCheckbox.checked = false;
            }
        }

        algorithmSelect.addEventListener('change', updateOptionAvailability);
        modeSelect.addEventListener('change', updateOptionAvailability);
        updateOptionAvailability();

        function currentKey() {
            return isKeyVisible ? keyInput.value : actualKeyValue;
        }

        function submit(command) {
            const key = currentKey();
            const text = inputText.value;
            if (!key || !text) {
                showError('Please enter both key and text');
                return;
            }
            if (key.length < 16) {
                showError('Key must be at least 16 characters long');
                return;
            }
            const options = {
                algorithm: algorithmSelect.value,
                mode: modeSelect.disabled ? 'CBC' : modeSelect.value,
                useRandomIv: !randomIvCheckbox.disabled && randomIvCheckbox.checked,
            };
            vscode.postMessage({ command, key, text, options });
        }

        document.getElementById('encryptBtn').addEventListener('click', () => submit('encrypt'));
        document.getElementById('decryptBtn').addEventListener('click', () => submit('decrypt'));

        document.getElementById('clearBtn').addEventListener('click', () => {
            inputText.value = '';
            outputText.value = '';
            messageDiv.innerHTML = '';
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            const output = outputText.value;
            if (!output) {
                showError('Nothing to copy');
                return;
            }
            navigator.clipboard.writeText(output)
                .then(() => showSuccess('Copied to clipboard!'))
                .catch((err) => showError('Failed to copy: ' + err));
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.command) {
                case 'encryptResult':
                    outputText.value = message.result;
                    showSuccess('Encryption successful! Output format: ![base64]');
                    break;
                case 'decryptResult':
                    outputText.value = message.result;
                    showSuccess('Decryption successful!');
                    break;
                case 'error':
                    showError(message.message);
                    break;
            }
        });

        function showError(msg) {
            messageDiv.className = 'error';
            messageDiv.textContent = msg;
        }

        function showSuccess(msg) {
            messageDiv.className = 'success';
            messageDiv.textContent = msg;
        }
    </script>
</body>
</html>`;
    }
}
