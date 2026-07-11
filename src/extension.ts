import * as vscode from "vscode";
import { AesPanel } from "./views/aesPanel";
import { Base64Panel } from "./views/base64Panel";
import { AESEnhancedPanel } from "./views/aesEnhancedPanel";
import { SettingsPanel } from "./views/settingsPanel";
import { SidebarProvider, SIDEBAR_VIEW_ID } from "./views/sidebarProvider";
import { registerEditorCommands } from "./editor/editorCommands";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new SidebarProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SIDEBAR_VIEW_ID,
      sidebarProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aes.encryptDecrypt", () => {
      AesPanel.render(context, () =>
        AESEnhancedPanel.currentPanel?.refreshKeyIdentifiers(),
      );
    }),

    vscode.commands.registerCommand("aesEnhanced.encryptDecrypt", () => {
      AESEnhancedPanel.render(context, () =>
        AesPanel.currentPanel?.refreshKeyIdentifiers(),
      );
    }),

    vscode.commands.registerCommand("base64.encodeDecode", () => {
      Base64Panel.render(context);
    }),

    vscode.commands.registerCommand("aes.openSettings", () => {
      SettingsPanel.render(context, () => {
        AesPanel.currentPanel?.refreshKeyIdentifiers();
        AESEnhancedPanel.currentPanel?.refreshKeyIdentifiers();
      });
    }),

    ...registerEditorCommands(context),
  );
}

export function deactivate(): void {}
