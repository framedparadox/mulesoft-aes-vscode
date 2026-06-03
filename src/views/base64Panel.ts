import * as vscode from 'vscode';
import { decodeBase64, encodeBase64 } from '../base64/base64Codec';
import { contentSecurityPolicy, createNonce, iconUri } from './webviewUtils';

/** Webview panel for Base64 encode / decode. */
export class Base64Panel {
    public static currentPanel: Base64Panel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtml(this._panel.webview);

        this._panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'encode':
                        // For files the webview already produced base64 via FileReader.
                        this._respond('encodeResult', () =>
                            message.isFile ? message.text : encodeBase64(message.text), 'Encoding'
                        );
                        return;
                    case 'decode':
                        this._respond('decodeResult', () => decodeBase64(message.text), 'Decoding');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static render(context: vscode.ExtensionContext): void {
        const column = vscode.ViewColumn.One;
        if (Base64Panel.currentPanel) {
            Base64Panel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel('base64.encodeDecode', 'Base64 Encode / Decode', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri],
        });
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'base64.svg');
        Base64Panel.currentPanel = new Base64Panel(panel, context);
    }

    public dispose(): void {
        Base64Panel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }

    private _respond(resultCommand: string, run: () => string, label: string): void {
        try {
            this._panel.webview.postMessage({ command: resultCommand, result: run() });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this._panel.webview.postMessage({ command: 'error', message: `${label} error: ${detail}` });
        }
    }

    private _getHtml(webview: vscode.Webview): string {
        const nonce = createNonce();
        const csp = contentSecurityPolicy(webview, nonce);
        const headerIcon = iconUri(webview, this._context.extensionUri, 'base64.svg');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Base64 Encode / Decode</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .container { max-width: 900px; margin: 0 auto; }
        h2 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .header-icon { width: 28px; height: 28px; }
        .input-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: var(--vscode-foreground); }
        textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: 'Courier New', monospace;
            box-sizing: border-box;
            resize: vertical;
            min-height: 120px;
        }
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
        .result-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .error {
            color: var(--vscode-errorForeground);
            margin-top: 10px;
            padding: 8px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        .success { color: var(--vscode-terminal-ansiGreen); margin-top: 10px; padding: 8px; }
        .info {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            margin: 10px 0;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .file-upload-area {
            border: 2px dashed var(--vscode-input-border);
            border-radius: 4px;
            padding: 30px;
            text-align: center;
            background-color: var(--vscode-editor-background);
            margin-bottom: 20px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .file-upload-area:hover, .file-upload-area.drag-over {
            border-color: var(--vscode-textLink-foreground);
            background-color: var(--vscode-textBlockQuote-background);
        }
        .file-info { margin-top: 10px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
        .mode-toggle { display: flex; gap: 10px; margin-bottom: 20px; }
        .mode-btn {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            cursor: pointer;
        }
        .mode-btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-background);
        }
        #fileInput { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h2>
            <img class="header-icon" src="${headerIcon}" alt="" />
            Base64 Encode / Decode
        </h2>

        <div class="info">
            <strong>Base64</strong> is a binary-to-text encoding scheme that represents binary data in ASCII string format.
            Commonly used for encoding data in URLs, emails, and data URIs.
        </div>

        <div class="mode-toggle">
            <button class="mode-btn active" id="textModeBtn">Text Input</button>
            <button class="mode-btn" id="fileModeBtn">File Upload</button>
        </div>

        <div id="textMode">
            <div class="input-group">
                <label for="input">Input Text:</label>
                <textarea id="input" placeholder="Enter text to encode or Base64 string to decode"></textarea>
            </div>
        </div>

        <div id="fileMode" style="display: none;">
            <div class="file-upload-area" id="fileUploadArea">
                <div>📁 Click to select a file or drag &amp; drop here</div>
                <div class="file-info" id="fileInfo"></div>
            </div>
            <input type="file" id="fileInput" />
        </div>

        <div class="button-group">
            <button id="encodeBtn">Encode to Base64</button>
            <button id="decodeBtn">Decode from Base64</button>
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

        const inputText = document.getElementById('input');
        const outputText = document.getElementById('output');
        const messageDiv = document.getElementById('message');
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const textMode = document.getElementById('textMode');
        const fileMode = document.getElementById('fileMode');
        const textModeBtn = document.getElementById('textModeBtn');
        const fileModeBtn = document.getElementById('fileModeBtn');

        let currentMode = 'text';
        let currentFile = null;

        textModeBtn.addEventListener('click', () => {
            currentMode = 'text';
            textMode.style.display = 'block';
            fileMode.style.display = 'none';
            textModeBtn.classList.add('active');
            fileModeBtn.classList.remove('active');
            currentFile = null;
            fileInfo.textContent = '';
        });

        fileModeBtn.addEventListener('click', () => {
            currentMode = 'file';
            textMode.style.display = 'none';
            fileMode.style.display = 'block';
            fileModeBtn.classList.add('active');
            textModeBtn.classList.remove('active');
        });

        fileUploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFile(file);
            }
        });

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });
        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
        });
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFile(file);
            }
        });

        function handleFile(file) {
            currentFile = file;
            fileInfo.textContent = 'Selected: ' + file.name + ' (' + formatFileSize(file.size) + ')';
        }

        function formatFileSize(bytes) {
            if (bytes === 0) { return '0 Bytes'; }
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }

        document.getElementById('encodeBtn').addEventListener('click', () => {
            if (currentMode === 'text') {
                const text = inputText.value;
                if (!text) {
                    showError('Please enter text to encode');
                    return;
                }
                vscode.postMessage({ command: 'encode', text, isFile: false });
            } else {
                if (!currentFile) {
                    showError('Please select a file');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target && typeof e.target.result === 'string' ? e.target.result : '';
                    const commaIdx = result.indexOf(',');
                    if (commaIdx < 0) {
                        showError('Failed to read file');
                        return;
                    }
                    vscode.postMessage({ command: 'encode', text: result.slice(commaIdx + 1), isFile: true });
                };
                reader.onerror = () => showError('Failed to read file');
                reader.readAsDataURL(currentFile);
            }
        });

        document.getElementById('decodeBtn').addEventListener('click', () => {
            const text = currentMode === 'text' ? inputText.value : outputText.value;
            if (!text) {
                showError('Please enter Base64 text to decode');
                return;
            }
            vscode.postMessage({ command: 'decode', text, isFile: currentMode === 'file' });
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            inputText.value = '';
            outputText.value = '';
            messageDiv.innerHTML = '';
            currentFile = null;
            fileInfo.textContent = '';
            fileInput.value = '';
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
                case 'encodeResult':
                    outputText.value = message.result;
                    showSuccess('Successfully encoded to Base64!');
                    break;
                case 'decodeResult':
                    outputText.value = message.result;
                    showSuccess('Successfully decoded from Base64!');
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
