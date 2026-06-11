import * as vscode from "vscode";
import { getAesKeyIdentifiers } from "../storage/keyStore";
import { FileCryptoPanel } from "../views/fileCryptoPanel";
import { FileCryptoOperation, getSupportedFileKind } from "./fileFields";
import { transformSelectedText, validateAesKey } from "./fileTransforms";

interface KeyPick extends vscode.QuickPickItem {
  key?: string;
  manual?: boolean;
}

export function registerEditorCommands(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("aes.encryptSelection", () =>
      runSelectionCrypto(context, "encrypt"),
    ),
    vscode.commands.registerCommand("aes.decryptSelection", () =>
      runSelectionCrypto(context, "decrypt"),
    ),
    vscode.commands.registerCommand("aes.fileEncryptDecrypt", () =>
      FileCryptoPanel.render(context),
    ),
  ];
}

export async function resolveAesKey(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const keyIdentifiers = await getAesKeyIdentifiers(context);
  const configuredKeys = keyIdentifiers.filter(
    (entry) =>
      entry.keyIdentifier.trim().length > 0 && entry.key.trim().length > 0,
  );
  const keyItems: KeyPick[] = configuredKeys.map((entry) => ({
    label: entry.keyIdentifier,
    description: "KeyIdentifier",
    key: entry.key,
  }));

  const manualItem: KeyPick = {
    label: "Input key manually",
    description: "Use a key for this operation only",
    manual: true,
  };

  const pick = await vscode.window.showQuickPick([...keyItems, manualItem], {
    placeHolder: "Select a KeyIdentifier or input key",
    ignoreFocusOut: true,
  });
  if (!pick) {
    return undefined;
  }

  const key = pick.manual
    ? await vscode.window.showInputBox({
        prompt: "Enter the AES encryption key",
        password: true,
        ignoreFocusOut: true,
      })
    : pick.key;

  if (key === undefined) {
    return undefined;
  }

  try {
    validateAesKey(key);
    return key;
  } catch (error) {
    vscode.window.showErrorMessage(
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

async function runSelectionCrypto(
  context: vscode.ExtensionContext,
  operation: FileCryptoOperation,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !ensureSupportedActiveEditor(editor)) {
    return;
  }

  if (editor.selection.isEmpty) {
    vscode.window.showErrorMessage("Select a value to encrypt or decrypt.");
    return;
  }

  const selectedText = editor.document.getText(editor.selection);
  const key = await resolveAesKey(context);
  if (key === undefined) {
    return;
  }

  let replacement: string;
  try {
    replacement = transformSelectedText(selectedText, key, operation);
  } catch (error) {
    vscode.window.showErrorMessage(
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  const applied = await editor.edit((editBuilder) => {
    editBuilder.replace(editor.selection, replacement);
  });

  if (!applied) {
    vscode.window.showErrorMessage(
      `Unable to ${operation} the selected value.`,
    );
  }
}

function ensureSupportedActiveEditor(
  editor = vscode.window.activeTextEditor,
): boolean {
  if (!editor) {
    vscode.window.showErrorMessage("Open a YAML or properties file first.");
    return false;
  }

  const kind = getSupportedFileKind(
    editor.document.fileName,
    editor.document.languageId,
  );
  if (!kind) {
    vscode.window.showErrorMessage(
      "MuleSoft AES editor actions only support .yaml, .yml, and .properties files.",
    );
    return false;
  }

  return true;
}
