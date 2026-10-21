# 贡献指南

感谢你愿意一起完善「代码中文翻译」！

## 开发环境

- Node.js 18+
- VS Code 1.70+
- Windows 打包需要 PowerShell（`tools/build-vsix.ps1`）

## 本地运行

```bash
# 1. 运行测试
node tests/test-translator.js
node tests/test-insert-core.js
node tests/test-extension.js

# 2. 打包 VSIX
powershell -ExecutionPolicy Bypass -File tools/build-vsix.ps1

# 3. 安装（生成后）
code --install-extension dist/code-zh-translator-*.vsix
```

## 项目结构

```text
shared/engine/translator.js   # 翻译引擎（HTML / CSS / JS / SQL / Python …）
shared/glossary.json          # 词库
vscode-extension/             # 扩展本体（打包时独立携带 engine.js 与 glossary.json）
vscode-extension/insertCore.js# 注释插入/移除逻辑（不依赖 vscode，可直接测试）
tests/                        # 单元测试
tools/build-vsix.ps1          # 打包脚本
```

## 想加语言 / 加规则？

1. 在 `shared/engine/translator.js` 里新增 `translateXxx` 函数，并在 `translateLine` 中分发；
2. 在 `shared/glossary.json` 里补词；
3. 在 `tests/test-translator.js` 里加断言；
4. 执行 `node tests/test-translator.js` 确认通过；
5. 把引擎和词库同步到 `vscode-extension/`：

```powershell
Copy-Item shared/engine/translator.js vscode-extension/engine.js
Copy-Item shared/glossary.json vscode-extension/glossary.json
```

## 提交 PR

- 一个 PR 只做一件事，描述里写清楚动机和效果；
- 必须带上通过测试的说明；
- 涉及翻译规则时，附 1—3 个「输入 → 输出」示例；
- 提交前运行 `npm test`（或上面三条 node 命令）。

## 词库约定

- `keywords`：语句关键字（如 `select` → `查询`）
- `words`：标识符常用词（如 `user` → `用户`）
- `html.tags` / `html.attrs`：HTML 标签与属性
- `css.props` / `css.values` / `css.colors`：CSS 属性、取值、颜色
- 译文尽量短、面向初学者；不确定的复杂表达式保留原文即可。
