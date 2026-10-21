// -*- coding: utf-8 -*-
'use strict';

const assert = require('assert');
const path = require('path');
const core = require(path.join(__dirname, '..', 'vscode-extension', 'insertCore.js'));

const sqlFile = [
  'SELECT id, name FROM users WHERE age > 18;',
  '',
  '-- 原有注释，不翻译',
  'DELETE FROM users WHERE id = 2;'
];

// 1) 全文件插入
let r = core.transformRange(sqlFile, 0, sqlFile.length - 1, 'sql', '译文：');
console.log(r.lines.join('\n'));
assert.strictEqual(r.added, 2, '应插入 2 条');
assert.ok(r.lines[1].startsWith('-- 译文：'));
assert.ok(r.lines[0] === sqlFile[0], '原代码行保持不变');

// 2) 重复执行：应替换旧注释而不是叠加
const again = core.transformRange(r.lines, 0, r.lines.length - 1, 'sql', '译文：');
assert.strictEqual(again.added, 2);
assert.strictEqual(again.lines.length, r.lines.length, '重复执行后行数不变');
assert.strictEqual(again.removed, 2, '旧注释被替换');

// 3) 只选中代码行，不包含已生成的注释行：应自动扩展并去重
const codeOnlyStart = 0;
const codeOnlyEnd = 0;
const one = core.transformRange(r.lines, codeOnlyStart, codeOnlyEnd, 'sql', '译文：');
const merged = r.lines.slice(0, one.start).concat(one.lines, r.lines.slice(one.end + 1));
assert.strictEqual(merged.length, r.lines.length, '选中代码行时不应产生重复注释');
assert.strictEqual(one.added, 1);

// 4) 移除
const removed = core.removeMarkers(r.lines, 'sql', '译文：');
assert.strictEqual(removed.removed, 2);
assert.deepStrictEqual(removed.lines, sqlFile);

// 5) Python / JS 注释前缀
let py = core.transformRange(['def add(a, b):', '    return a + b'], 0, 1, 'python', '译文：');
assert.ok(py.lines[1].startsWith('# 译文：'), 'Python 使用 #');
assert.ok(py.lines[3].startsWith('    # 译文：'), 'Python 保持缩进');
let js = core.transformRange(['const x = 10;'], 0, 0, 'javascript', '译文：');
assert.ok(js.lines[1].startsWith('// 译文：'));

// 6) 空行 / 纯注释不插入
let blanks = core.transformRange(['', '// just a comment'], 0, 1, 'javascript', '译文：');
assert.strictEqual(blanks.added, 0);

// 7) HTML：块注释 <!-- 译文：… -->
const htmlLines = ['<div class="box">', '  <p>Hello</p>', '</div>'];
let html = core.transformRange(htmlLines, 0, 2, 'html', '译文：');
assert.ok(html.lines[1].startsWith('<!-- 译文：'), 'HTML 使用 <!--');
assert.ok(html.lines[1].endsWith(' -->'), 'HTML 注释以 --> 结尾');
assert.ok(html.lines[1].includes('区块容器'));
assert.strictEqual(html.lines.length, 6, 'HTML 3 行各插入 1 条注释');

// 8) CSS：块注释 /* 译文：… */
const cssLines = ['.btn {', '  color: red;', '}'];
let css = core.transformRange(cssLines, 0, 2, 'css', '译文：');
assert.ok(css.lines[1].startsWith('/* 译文：'), 'CSS 使用 /*');
assert.ok(css.lines[1].endsWith(' */'), 'CSS 注释以 */ 结尾');

// 9) HTML 内嵌 script：应使用 JS 的 // 注释
const mixed = ['<script>', 'const x = 1;', '</script>'];
let mixedResult = core.transformRange(mixed, 0, 2, 'html', '译文：');
assert.ok(mixedResult.lines.some((l) => l.startsWith('// 译文：')), 'script 内使用 // 注释');

// 10) 再次执行不叠加
const againHtml = core.transformRange(html.lines, 0, html.lines.length - 1, 'html', '译文：');
assert.strictEqual(againHtml.lines.length, html.lines.length, 'HTML 重复执行不叠加');

console.log('\ninsertCore 测试通过 ✅');
