import * as vscode from 'vscode';
import { contentSecurityPolicy, createNonce, escapeHtml, iconUri } from './webviewUtils';

interface SidebarItem {
    label: string;
    description: string;
    command: string;
    iconFile: string;
}

const TOOLS: SidebarItem[] = [
    {
        label: 'MuleSoft AES Encrypt / Decrypt',
        description: 'Encrypt or decrypt text using AES',
        command: 'aes.encryptDecrypt',
        iconFile: 'aes.svg',
    },
    {
        label: 'Secure Properties Encrypt / Decrypt',
        description: 'Encrypt or decrypt with multiple algorithms',
        command: 'secureProperties.encryptDecrypt',
        iconFile: 'secure-properties.svg',
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

    constructor(context: vscode.ExtensionContext) {
        this._extensionUri = context.extensionUri;
    }

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'runTool' && typeof message.toolCommand === 'string') {
                await vscode.commands.executeCommand(message.toolCommand);
            }
        });
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

    private _getHtml(webview: vscode.Webview): string {
        const nonce = createNonce();
        const csp = contentSecurityPolicy(webview, nonce);
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
}
