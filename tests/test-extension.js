// -*- coding: utf-8 -*-
// 用最小 vscode 模拟对象验证扩展能正常 activate（不启动 VS Code）
'use strict';

const assert = require('assert');
const path = require('path');
const Module = require('module');

const registered = [];
const commands = [];

const statusItem = {
  text: '', tooltip: '', command: '',
  show() {}, dispose() {}
};
const panel = {
  webview: { html: '', onDidReceiveMessage() {} },
  onDidDispose() {}, reveal() {}, dispose() {}
};

const vscodeMock = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Beside: -2 },
  Range: class Range { constructor(...a) { this.args = a; } },
  Position: class Position { constructor(...a) { this.args = a; } },
  window: {
    activeTextEditor: undefined,
    createStatusBarItem: () => statusItem,
    createWebviewPanel: () => panel,
    showInformationMessage: (msg) => commands.push(['info', msg]),
    setStatusBarMessage: () => {},
    onDidChangeTextEditorSelection: () => ({ dispose() {} })
  },
  workspace: {
    getConfiguration: () => ({ get: (key, def) => def }),
    onDidSaveTextDocument: () => ({ dispose() {} })
  },
  commands: {
    registerCommand: (id, fn) => {
      assert.strictEqual(typeof fn, 'function', '命令处理函数应为函数');
      registered.push(id);
      return { dispose() {} };
    },
    executeCommand: () => {}
  }
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  return origLoad.apply(this, arguments);
};

const ext = require(path.join(__dirname, '..', 'vscode-extension', 'extension.js'));
const context = { subscriptions: [] };
ext.activate(context);

assert.deepStrictEqual(
  registered.sort(),
  [
    'codeZhTranslator.insertComments',
    'codeZhTranslator.preview',
    'codeZhTranslator.removeComments'
  ].sort(),
  '应注册 3 个命令'
);
assert.ok(context.subscriptions.length >= 3, '事件监听应加入 subscriptions');
assert.strictEqual(statusItem.text, '$(book) 译', '状态栏按钮文本');

ext.deactivate();
console.log('扩展 activate/deactivate 测试通过 ✅');
