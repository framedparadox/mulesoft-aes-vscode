import * as vscode from "vscode";
import { getAesKeyIdentifiers } from "../storage/keyStore";
import {
  collectFileFields,
  FileCryptoOperation,
  FileFieldCandidate,
  getSupportedFileKind,
} from "../editor/fileFields";
import {
  computeFieldReplacements,
  validateAesKey,
} from "../editor/fileTransforms";
import {
  contentSecurityPolicy,
  createNonce,
  escapeHtml,
  iconUri,
} from "./webviewUtils";
import { AesPanel } from "./aesPanel";
import { AESEnhancedPanel } from "./aesEnhancedPanel";

interface ApplyMessage {
  command: "apply";
  operation: FileCryptoOperation;
  manualKey?: string;
  selectedIds?: string[];
}

interface RefreshMessage {
  command: "refreshFields";
  operation: FileCryptoOperation;
  requestId?: number;
}

interface OpenAesPanelMessage {
  command: "openAesPanel";
}

type PanelMessage = ApplyMessage | RefreshMessage | OpenAesPanelMessage;

interface FieldViewModel {
  id: string;
  name: string;
  path: string;
  value: string;
  line: number;
  encrypted: boolean;
}

/** Editor-side webview for encrypting or decrypting values in the active file. */
export class FileCryptoPanel {
  public static currentPanel: FileCryptoPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _documentUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  /** Bumped to invalidate in-flight `_initHtml` / `_postFields` completions. */
  private _renderGeneration = 0;

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
  ) {
    this._panel = panel;
    this._context = context;
    this._documentUri = document.uri;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: PanelMessage) => {
        if (message.command === "openAesPanel") {
          this._replaceWithAesPanel();
          return;
        }
        if (message.command === "refreshFields") {
          void this._postFields(message.operation, "", message.requestId);
          return;
        }
        if (message.command === "apply") {
          void this._apply(message);
        }
      },
      null,
      this._disposables,
    );

    void this._initHtml();
  }

  public static render(context: vscode.ExtensionContext): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Open a YAML or properties file first.");
      return;
    }

    const kind = getSupportedFileKind(
      editor.document.fileName,
      editor.document.languageId,
    );
    if (!kind) {
      vscode.window.showErrorMessage(
        "MuleSoft AES file actions only support .yaml, .yml, and .properties files.",
      );
      return;
    }

    if (FileCryptoPanel.currentPanel) {
      FileCryptoPanel.currentPanel._documentUri = editor.document.uri;
      // reveal() without a column keeps the panel in its current editor group.
      FileCryptoPanel.currentPanel._panel.reveal();
      void FileCryptoPanel.currentPanel._initHtml();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "aes.fileEncryptDecrypt",
      "MuleSoft AES File Encrypt / Decrypt",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      "resources",
      "icons",
      "aes2.svg",
    );
    FileCryptoPanel.currentPanel = new FileCryptoPanel(
      panel,
      context,
      editor.document,
    );
  }

  public dispose(): void {
    this._renderGeneration += 1;
    FileCryptoPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  /** Hand the webview panel to AesPanel without closing the editor tab. */
  private _replaceWithAesPanel(): void {
    // An AES panel is already open, so there is nothing to hand over: reveal it
    // and leave this panel (and the user's field selections) intact.
    if (AesPanel.currentPanel) {
      AesPanel.revealCurrent();
      return;
    }

    // Invalidate any in-flight `_initHtml` so a late completion cannot overwrite
    // the AES screen that `renderReplacing` is about to paint on this webview.
    this._renderGeneration += 1;
    const panel = this._panel;
    FileCryptoPanel.currentPanel = undefined;
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
    AesPanel.renderReplacing(panel, this._context, () =>
      AESEnhancedPanel.currentPanel?.refreshKeyIdentifiers(),
    );
  }

  private async _initHtml(): Promise<void> {
    const generation = ++this._renderGeneration;
    const webview = this._panel.webview;
    const nonce = createNonce();
    const csp = contentSecurityPolicy(webview, nonce);
    const headerIcon = iconUri(webview, this._context.extensionUri, "aes2.svg");
    const muleAesIcon = iconUri(webview, this._context.extensionUri, "aes.svg");
    const keyIdentifiers = await getAesKeyIdentifiers(this._context);
    if (generation !== this._renderGeneration) {
      return;
    }
    const configuredKeyIdentifiers = keyIdentifiers.filter(
      (entry) =>
        entry.keyIdentifier.trim().length > 0 && entry.key.trim().length > 0,
    );
    const fields = await this._fieldsForOperation("encrypt");
    if (generation !== this._renderGeneration) {
      return;
    }
    const state = serializeForScript({
      fields: fields.map(toViewModel),
    });

    const keyOptions = configuredKeyIdentifiers
      .map(
        (entry) =>
          `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.keyIdentifier)}</option>`,
      )
      .join("");

    if (generation !== this._renderGeneration) {
      return;
    }
    this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>MuleSoft AES File Encrypt / Decrypt</title>
    <style>
        body {
            padding: 16px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
        }
        .root {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 260px;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header img {
            width: 28px;
            height: 28px;
        }
        h2 {
            font-size: 16px;
            line-height: 1.3;
            margin: 0;
        }
        .open-ext-btn {
            margin-left: auto;
            padding: 6px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .open-ext-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .open-ext-btn img {
            width: 18px;
            height: 18px;
        }
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 6px;
        }
        select, input[type="password"], input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            padding: 7px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
        }
        .key-row {
            display: flex;
            gap: 6px;
        }
        .key-row input {
            flex: 1;
        }
        .toggle-visibility {
            padding: 8px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            min-width: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .toggle-visibility:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .toggle-visibility svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        .toggle-visibility:disabled {
            cursor: default;
            opacity: 0.6;
        }
        .mode-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .mode-row button, .actions button {
            padding: 8px 10px;
            border: 1px solid var(--vscode-button-border, var(--vscode-input-border));
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }
        .mode-row button.active, .actions button.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .mode-row button:hover, .actions button:hover {
            background: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
        }
        .actions button:disabled {
            opacity: 0.55;
            cursor: default;
            pointer-events: none;
        }
        .fields {
            border: 1px solid var(--vscode-input-border);
            max-height: 46vh;
            overflow: auto;
        }
        .field-row {
            display: grid;
            grid-template-columns: auto 1fr 1.4fr;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-input-border);
            align-items: start;
        }
        .field-row:last-child {
            border-bottom: 0;
        }
        .field-name {
            min-width: 0;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            word-break: break-all;
        }
        .field-details {
            min-width: 0;
        }
        .field-path-line {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .field-value {
            color: var(--vscode-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .muted {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .fields-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        .fields-header label {
            margin-bottom: 0;
        }
        .select-all-row {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }
        .select-all-row input {
            margin: 0;
            cursor: pointer;
        }
        .refresh-btn {
            margin-left: auto;
            padding: 2px 10px;
            font-size: 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .refresh-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .message {
            min-height: 18px;
            font-size: 12px;
        }
        .message.error {
            color: var(--vscode-errorForeground);
        }
        .message.success {
            color: var(--vscode-terminal-ansiGreen);
        }
    </style>
</head>
<body>
    <div class="root">
        <div class="header">
            <img src="${headerIcon}" alt="" />
            <h2>MuleSoft AES File Encrypt / Decrypt</h2>
            <button type="button" id="openAesBtn" class="open-ext-btn" title="Open MuleSoft AES Encrypt / Decrypt">
                <img src="${muleAesIcon}" alt="" />
            </button>
        </div>

        <div>
            <label>Operation</label>
            <div class="mode-row">
                <button type="button" id="encryptMode" class="active">Encrypt</button>
                <button type="button" id="decryptMode">Decrypt</button>
            </div>
        </div>

        <div>
            <label for="keyIdentifier">Key Identifier</label>
            <select id="keyIdentifier">
                <option value="">Custom</option>
                ${keyOptions}
            </select>
        </div>

        <div id="manualKeyGroup">
            <label for="manualKey">Input key</label>
            <div class="key-row">
                <input id="manualKey" type="text" autocomplete="off" />
                <button type="button" id="toggleKey" class="toggle-visibility" title="Hide key">
                    <svg id="eyeIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                </button>
            </div>
        </div>

        <div>
            <div class="fields-header">
                <label class="select-all-row" for="selectAllCheckbox">
                    <input type="checkbox" id="selectAllCheckbox" />
                    <span id="selectAllLabel">Select all</span>
                </label>
                <label id="fieldsLabel">Plain values</label>
                <button type="button" id="refreshBtn" class="refresh-btn" title="Re-read the file and rebuild this list">Refresh</button>
            </div>
            <div id="fields" class="fields"></div>
            <div id="emptyState" class="muted" style="display: none;"></div>
        </div>

        <div class="actions">
            <button type="button" id="applyBtn" class="primary">Encrypt selected values</button>
        </div>

        <div id="message" class="message"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const initialState = ${state};
        let operation = 'encrypt';
        let fields = initialState.fields;
        let fieldsRequestId = 0;
        let pendingFieldsRequestId = 0;
        let refreshInFlight = false;

        const keyIdentifier = document.getElementById('keyIdentifier');
        const manualKey = document.getElementById('manualKey');
        const toggleKey = document.getElementById('toggleKey');
        const encryptMode = document.getElementById('encryptMode');
        const decryptMode = document.getElementById('decryptMode');
        const fieldsContainer = document.getElementById('fields');
        const fieldsLabel = document.getElementById('fieldsLabel');
        const emptyState = document.getElementById('emptyState');
        const applyBtn = document.getElementById('applyBtn');
        const openAesBtn = document.getElementById('openAesBtn');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const message = document.getElementById('message');

        function setApplyEnabled(enabled) {
            applyBtn.disabled = !enabled;
        }

        function requestFieldsRefresh() {
            pendingFieldsRequestId = ++fieldsRequestId;
            refreshInFlight = true;
            setApplyEnabled(false);
            showInfo('Refreshing fields...');
            vscode.postMessage({
                command: 'refreshFields',
                operation,
                requestId: pendingFieldsRequestId,
            });
        }

        function setOperation(nextOperation) {
            operation = nextOperation;
            encryptMode.classList.toggle('active', operation === 'encrypt');
            decryptMode.classList.toggle('active', operation === 'decrypt');
            applyBtn.textContent = operation === 'encrypt' ? 'Encrypt selected values' : 'Decrypt selected values';
            fieldsLabel.textContent = operation === 'encrypt' ? 'Plain values' : 'Secure values';
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            requestFieldsRefresh();
        }

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
                toggleKey.disabled = true;
                toggleKey.innerHTML = eyeClosedIcon;
                toggleKey.title = 'KeyIdentifier key is masked';
                return;
            }
            toggleKey.disabled = false;
            toggleKey.innerHTML = isKeyVisible ? eyeOpenIcon : eyeClosedIcon;
            toggleKey.title = isKeyVisible ? 'Hide key' : 'Show key';
        }

        function applyKeyIdentifierSelection(selectedKey) {
            if (selectedKey) {
                isKeyIdentifierSelected = true;
                isKeyVisible = false;
                actualKeyValue = selectedKey;
                manualKey.value = maskKey(selectedKey);
            } else {
                isKeyIdentifierSelected = false;
                isKeyVisible = true;
                actualKeyValue = '';
                manualKey.value = '';
            }
            updateToggleButton();
        }

        function switchToCustomModeForTyping() {
            if (!isKeyIdentifierSelected) {
                return;
            }
            keyIdentifier.value = '';
            isKeyIdentifierSelected = false;
            isKeyVisible = true;
            actualKeyValue = '';
            manualKey.value = '';
            updateToggleButton();
        }

        function fieldCheckboxes() {
            return Array.from(fieldsContainer.querySelectorAll('input[type="checkbox"]'));
        }

        function selectedIds() {
            return fieldCheckboxes()
                .filter((input) => input.checked)
                .map((input) => input.value);
        }

        function syncSelectAllCheckbox() {
            const checkboxes = fieldCheckboxes();
            if (checkboxes.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.disabled = true;
                return;
            }
            selectAllCheckbox.disabled = false;
            const checkedCount = checkboxes.filter((input) => input.checked).length;
            selectAllCheckbox.checked = checkedCount === checkboxes.length;
            selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }

        function renderFields() {
            fieldsContainer.innerHTML = '';
            emptyState.style.display = fields.length === 0 ? '' : 'none';
            emptyState.textContent = operation === 'encrypt'
                ? 'No plain scalar values found in this file.'
                : 'No secure values found in this file.';
            for (const field of fields) {
                const row = document.createElement('div');
                row.className = 'field-row';

                const selector = document.createElement('div');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = field.id;
                checkbox.checked = false;
                checkbox.setAttribute('aria-label', 'Select ' + (field.path || field.name));
                checkbox.addEventListener('change', syncSelectAllCheckbox);
                selector.appendChild(checkbox);

                const name = document.createElement('div');
                name.className = 'field-name';
                name.textContent = field.name;

                const details = document.createElement('div');
                details.className = 'field-details';

                const value = document.createElement('div');
                value.className = 'field-value';
                value.textContent = field.value;

                const pathLine = document.createElement('div');
                pathLine.className = 'field-path-line';
                pathLine.textContent = field.path + ' (Line ' + field.line + ')';

                details.appendChild(value);
                details.appendChild(pathLine);
                row.appendChild(selector);
                row.appendChild(name);
                row.appendChild(details);
                fieldsContainer.appendChild(row);
            }
            syncSelectAllCheckbox();
        }

        function showInfo(text) {
            message.className = 'message';
            message.textContent = text;
        }

        function showError(text) {
            message.className = 'message error';
            message.textContent = text;
        }

        function showSuccess(text) {
            message.className = 'message success';
            message.textContent = text;
        }

        encryptMode.addEventListener('click', () => setOperation('encrypt'));
        decryptMode.addEventListener('click', () => setOperation('decrypt'));
        keyIdentifier.addEventListener('change', () => {
            applyKeyIdentifierSelection(keyIdentifier.value);
        });
        toggleKey.addEventListener('click', () => {
            if (isKeyIdentifierSelected) {
                return;
            }
            if (isKeyVisible) {
                actualKeyValue = manualKey.value;
                if (actualKeyValue) {
                    manualKey.value = maskKey(actualKeyValue);
                }
                isKeyVisible = false;
            } else {
                manualKey.value = actualKeyValue;
                isKeyVisible = true;
            }
            updateToggleButton();
        });
        manualKey.addEventListener('input', () => {
            if (isKeyVisible) {
                actualKeyValue = manualKey.value;
            }
        });
        manualKey.addEventListener('keydown', (e) => {
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
                    manualKey.value = '';
                } else if (e.key.length === 1) {
                    e.preventDefault();
                }
            }
        });
        manualKey.addEventListener('paste', () => {
            if (isKeyIdentifierSelected) {
                switchToCustomModeForTyping();
            }
        });
        selectAllCheckbox.addEventListener('change', () => {
            const checked = selectAllCheckbox.checked;
            fieldCheckboxes().forEach((input) => {
                input.checked = checked;
            });
            selectAllCheckbox.indeterminate = false;
        });
        document.getElementById('refreshBtn').addEventListener('click', () => {
            requestFieldsRefresh();
        });
        openAesBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'openAesPanel' });
        });
        applyBtn.addEventListener('click', () => {
            if (applyBtn.disabled) {
                return;
            }
            showInfo(operation === 'encrypt' ? 'Encrypting selected values...' : 'Decrypting selected values...');
            vscode.postMessage({
                command: 'apply',
                operation,
                manualKey: actualKeyValue,
                selectedIds: selectedIds(),
            });
        });

        window.addEventListener('message', (event) => {
            const payload = event.data;
            if (payload.command === 'fields') {
                // Ignore stale responses from an earlier operation/refresh.
                if (
                    (payload.requestId !== undefined && payload.requestId !== pendingFieldsRequestId) ||
                    (payload.operation !== undefined && payload.operation !== operation)
                ) {
                    return;
                }
                fields = payload.fields;
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                renderFields();
                refreshInFlight = false;
                setApplyEnabled(true);
                showInfo(payload.message || '');
                return;
            }
            if (payload.command === 'applied') {
                if (payload.operation !== undefined && payload.operation !== operation) {
                    return;
                }
                fields = payload.fields;
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                renderFields();
                setApplyEnabled(true);
                showSuccess(payload.message);
                return;
            }
            if (payload.command === 'error') {
                // Re-enable Apply after apply failures; keep disabled while a refresh is pending.
                if (!refreshInFlight) {
                    setApplyEnabled(true);
                }
                showError(payload.message);
            }
        });

        applyKeyIdentifierSelection(keyIdentifier.value);
        renderFields();
        setApplyEnabled(true);
    </script>
</body>
</html>`;
  }

  private async _postFields(
    operation: FileCryptoOperation,
    message = "",
    requestId?: number,
  ): Promise<void> {
    const generation = this._renderGeneration;
    const fields = await this._fieldsForOperation(operation);
    if (generation !== this._renderGeneration) {
      return;
    }
    await this._panel.webview.postMessage({
      command: "fields",
      operation,
      requestId,
      fields: fields.map(toViewModel),
      message,
    });
  }

  private async _apply(message: ApplyMessage): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(
        this._documentUri,
      );
      const kind = getSupportedFileKind(document.fileName, document.languageId);
      if (!kind) {
        throw new Error(
          "The active file is no longer a supported YAML or properties file.",
        );
      }

      const fields = collectFileFields(
        document.getText(),
        kind,
        message.operation,
      );
      const selectedFields = this._selectedFields(fields, message);
      if (selectedFields.length === 0) {
        // Field ids are byte offsets, so editing the file after the list was
        // rendered invalidates every selection. Say so instead of claiming the
        // user selected nothing.
        const selectionCount = message.selectedIds?.length ?? 0;
        if (selectionCount > 0) {
          throw new Error(
            "The file changed since this list was built. Press Refresh and select the values again.",
          );
        }
        throw new Error(
          message.operation === "encrypt"
            ? "Select at least one plain value to encrypt."
            : "Select at least one secure value to decrypt.",
        );
      }

      const key = await this._resolveKey(message);
      const result = computeFieldReplacements(
        selectedFields,
        key,
        message.operation,
        kind,
      );
      if (result.failures.length > 0) {
        const details = result.failures
          .slice(0, 5)
          .map((failure) => `${failure.field.path}: ${failure.message}`)
          .join("; ");
        throw new Error(`No changes were applied. ${details}`);
      }

      const edit = new vscode.WorkspaceEdit();
      for (const replacement of result.replacements) {
        edit.replace(
          document.uri,
          new vscode.Range(
            document.positionAt(replacement.field.range.start),
            document.positionAt(replacement.field.range.end),
          ),
          replacement.replacement,
        );
      }

      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        throw new Error("VS Code did not apply the file edits.");
      }

      const refreshedDocument = await vscode.workspace.openTextDocument(
        this._documentUri,
      );
      const refreshedFields = collectFileFields(
        refreshedDocument.getText(),
        kind,
        message.operation,
      );
      await this._panel.webview.postMessage({
        command: "applied",
        operation: message.operation,
        fields: refreshedFields.map(toViewModel),
        message: `${result.replacements.length} value${result.replacements.length === 1 ? "" : "s"} ${message.operation}ed.`,
      });
    } catch (error) {
      await this._panel.webview.postMessage({
        command: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private _selectedFields(
    fields: FileFieldCandidate[],
    message: ApplyMessage,
  ): FileFieldCandidate[] {
    const selectedIds = new Set(message.selectedIds ?? []);
    return fields.filter((field) => selectedIds.has(field.id));
  }

  private async _resolveKey(message: ApplyMessage): Promise<string> {
    const key = (message.manualKey ?? "").trim();
    if (!key) {
      throw new Error("Enter an AES key or select a KeyIdentifier.");
    }

    validateAesKey(key);
    return key;
  }

  private async _fieldsForOperation(
    operation: FileCryptoOperation,
  ): Promise<FileFieldCandidate[]> {
    const document = await vscode.workspace.openTextDocument(this._documentUri);
    const kind = getSupportedFileKind(document.fileName, document.languageId);
    return kind ? collectFileFields(document.getText(), kind, operation) : [];
  }
}

function toViewModel(field: FileFieldCandidate): FieldViewModel {
  return {
    id: field.id,
    name: field.name,
    path: field.path,
    value:
      field.value.length > 120
        ? `${field.value.slice(0, 117)}...`
        : field.value,
    line: field.line,
    encrypted: field.encrypted,
  };
}

function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003C");
}
