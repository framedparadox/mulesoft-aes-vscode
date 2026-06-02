import * as crypto from 'crypto';
import * as vscode from 'vscode';

/** Generate a random nonce for the webview Content-Security-Policy. */
export function createNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
}

/** Build a strict CSP that only allows scripts carrying the given nonce. */
export function contentSecurityPolicy(webview: vscode.Webview, nonce: string): string {
    return [
        `default-src 'none'`,
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`,
    ].join('; ');
}

/** Resolve a webview URI for a file under resources/icons. */
export function iconUri(webview: vscode.Webview, extensionUri: vscode.Uri, file: string): string {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'icons', file)).toString();
}

/** Escape a string for safe insertion into HTML text or attribute context. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
