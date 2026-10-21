// -*- coding: utf-8 -*-
'use strict';

const vscode = require('vscode');
const engine = require('./engine.js');
const core = require('./insertCore.js');

let statusBarItem;
let previewPanel;
let selectionTimer = null;

function getMarker() {
  const cfg = vscode.workspace.getConfiguration('codeZhTranslator');
  return cfg.get('marker', '译文：') || '译文：';
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('codeZhTranslator.insertComments', insertComments),
    vscode.commands.registerCommand('codeZhTranslator.preview', showPreview),
    vscode.commands.registerCommand('codeZhTranslator.removeComments', removeComments)
  );

  const cfg = vscode.workspace.getConfiguration('codeZhTranslator');
  if (cfg.get('showStatusBar', true)) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(book) 译';
    statusBarItem.tooltip = '代码中文翻译：点击预览（Ctrl+Alt+P）；Ctrl+Alt+T 插入注释';
    statusBarItem.command = 'codeZhTranslator.preview';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
  }

  // 预览面板打开时，选区变化 / 保存后自动刷新
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => {
      if (!previewPanel) return;
      clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => renderPreview(), 180);
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      if (previewPanel) renderPreview();
    })
  );
}

function deactivate() {
  if (previewPanel) previewPanel.dispose();
}

function currentRange(editor) {
  const doc = editor.document;
  const sel = editor.selection;
  if (sel.isEmpty) return [0, doc.lineCount - 1];
  return [sel.start.line, sel.end.line];
}

function docLines(doc) {
  const lines = [];
  for (let i = 0; i < doc.lineCount; i++) lines.push(doc.lineAt(i).text);
  return lines;
}

async function insertComments() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('请先打开一个代码文件。');
    return;
  }
  const doc = editor.document;
  const langId = doc.languageId;
  const marker = getMarker();
  const lines = docLines(doc);
  const [start, end] = currentRange(editor);

  const result = core.transformRange(lines, start, end, langId, marker);

  const range = new vscode.Range(
    result.start, 0,
    result.end, doc.lineAt(result.end).text.length
  );
  const ok = await editor.edit(
    (builder) => builder.replace(range, result.lines.join('\n')),
    { undoStopBefore: true, undoStopAfter: true }
  );
  if (ok) {
    vscode.window.setStatusBarMessage(
      `代码中文翻译：已插入 ${result.added} 条注释${result.removed ? `，替换 ${result.removed} 条旧注释` : ''}`,
      5000
    );
  }
  if (previewPanel) renderPreview();
}

async function removeComments() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const marker = getMarker();
  const lines = docLines(doc);
  const result = core.removeMarkers(lines, doc.languageId, marker);
  if (!result.removed) {
    vscode.window.showInformationMessage('没有找到由本扩展插入的注释。');
    return;
  }
  const fullRange = new vscode.Range(0, 0, doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length);
  const ok = await editor.edit((builder) => builder.replace(fullRange, result.lines.join('\n')));
  if (ok) vscode.window.setStatusBarMessage(`代码中文翻译：已移除 ${result.removed} 条注释`, 5000);
  if (previewPanel) renderPreview();
}

function showPreview() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('请先打开一个代码文件。');
    return;
  }
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'codeZhTranslator.preview',
      '代码中文翻译',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    previewPanel.onDidDispose(() => { previewPanel = undefined; });
    previewPanel.webview.onDidReceiveMessage((msg) => {
      if (!msg) return;
      if (msg.type === 'refresh') renderPreview();
      else if (msg.type === 'insert') vscode.commands.executeCommand('codeZhTranslator.insertComments');
      else if (msg.type === 'remove') vscode.commands.executeCommand('codeZhTranslator.removeComments');
    });
  }
  previewPanel.reveal(vscode.ViewColumn.Beside);
  renderPreview();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPreview() {
  if (!previewPanel) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    previewPanel.webview.html = messageHtml('请先打开一个代码文件。');
    return;
  }
  const doc = editor.document;
  const [start, end] = currentRange(editor);
  const lines = docLines(doc);
  const langId = doc.languageId;
  const parsed = engine.translateDocument(lines.slice(start, end + 1).join('\n'), langId);
  const rows = parsed.map((r, i) => ({
    no: start + i + 1,
    code: r.line,
    zh: r.zh || ''
  }));
  const count = parsed.filter((r) => r.zh).length;
  const title = `${doc.fileName.split(/[\\/]/).pop()}（${langId}，${start + 1}–${end + 1} 行）`;
  previewPanel.webview.html = previewHtml(title, rows, count);
}

function messageHtml(text) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  body{font-family:"Microsoft YaHei",sans-serif;padding:24px;color:#ccc;}
  </style></head><body><p>${escapeHtml(text)}</p></body></html>`;
}

function previewHtml(title, rows, count) {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const body = rows.map((r) => {
    const code = escapeHtml(r.code) || '&nbsp;';
    const zh = r.zh ? escapeHtml(r.zh) : '<span class="none">（无需翻译 / 注释行）</span>';
    return `<tr><td class="no">${r.no}</td><td class="code"><pre>${code}</pre></td><td class="zh">${zh}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  body { font-family: "Microsoft YaHei", "Segoe UI", sans-serif; padding: 12px 16px; color: var(--vscode-foreground); }
  h2 { font-size: 14px; font-weight: 600; margin: 0 0 6px; }
  .meta { font-size: 12px; opacity: .7; margin-bottom: 10px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
  button { font-size: 12px; padding: 4px 12px; border-radius: 4px; cursor: pointer;
    border: 1px solid var(--vscode-button-border, #555);
    background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.secondary { background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, inherit); }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  th, td { border-bottom: 1px solid var(--vscode-panel-border, #333); padding: 5px 8px; vertical-align: top; text-align: left; }
  th { position: sticky; top: 0; background: var(--vscode-editor-background); font-weight: 600; }
  td.no { width: 44px; opacity: .55; text-align: right; font-family: Consolas, monospace; }
  td.code { width: 46%; }
  td.code pre { margin: 0; font-family: Consolas, "Courier New", monospace; white-space: pre-wrap; word-break: break-all; }
  td.zh { color: #7ec699; }
  .none { opacity: .4; }
</style>
</head>
<body>
  <h2>代码中文翻译</h2>
  <div class="meta">${escapeHtml(title)} · 可翻译 ${count} 行 · 离线词库</div>
  <div class="toolbar">
    <button id="insert">插入中文注释（Ctrl+Alt+T）</button>
    <button id="remove" class="secondary">移除中文注释</button>
    <button id="refresh" class="secondary">刷新</button>
  </div>
  <table>
    <thead><tr><th>行</th><th>代码</th><th>中文说明</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('insert').addEventListener('click', () => vscode.postMessage({ type: 'insert' }));
    document.getElementById('remove').addEventListener('click', () => vscode.postMessage({ type: 'remove' }));
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  </script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
