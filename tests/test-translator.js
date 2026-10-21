// -*- coding: utf-8 -*-
'use strict';

const assert = require('assert');
const path = require('path');
const T = require(path.join(__dirname, '..', 'shared', 'engine', 'translator.js'));

const cases = [
  // SQL
  ['SELECT id, name FROM users WHERE age > 18 ORDER BY id DESC;', 'sql'],
  ['SELECT count(*) AS total FROM orders WHERE status = 1;', 'sql'],
  ['SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id;', 'sql'],
  ['INSERT INTO users (name, age) VALUES (\'张三\', 20);', 'sql'],
  ['UPDATE users SET age = 21, status = 0 WHERE id = 1;', 'sql'],
  ['DELETE FROM users WHERE id = 2;', 'sql'],
  ['CREATE TABLE orders (id INT PRIMARY KEY, user_id INT, amount DECIMAL(10,2));', 'sql'],
  ['ALTER TABLE users ADD COLUMN email VARCHAR(100);', 'sql'],
  ['DROP TABLE IF EXISTS temp;', 'sql'],
  ['where age >= 18 and name like \'%张%\';', 'sql'],
  ['order by created_at desc;', 'sql'],
  ['limit 10;', 'sql'],
  ['use mysql;', 'sql'],
  ['show tables;', 'sql'],
  ['start transaction;', 'sql'],
  ['commit;', 'sql'],
  // Python
  ['def add(a, b):', 'python'],
  ['    return a + b', 'python'],
  ['x = 10', 'python'],
  ['for i in range(10):', 'python'],
  ['print("hello world")', 'python'],
  ['if x > 5 and y < 3:', 'python'],
  ['import os', 'python'],
  ['from collections import defaultdict', 'python'],
  ['class Student:', 'python'],
  ['try:', 'python'],
  ['except ValueError as e:', 'python'],
  ['with open("a.txt") as f:', 'python'],
  ['# 这是注释', 'python'],
  ['', 'python'],
  // JS / Java
  ['const x = 10;', 'javascript'],
  ['function foo(a, b) {', 'javascript'],
  ['console.log("hi");', 'javascript'],
  ['if (x > 5) {', 'javascript'],
  ['for (let i = 0; i < 10; i++) {', 'javascript'],
  ['import React from "react";', 'javascript'],
  ['public static void main(String[] args) {', 'java'],
  ['System.out.println("ok");', 'java'],
  ['// comment', 'javascript'],
  ['{', 'javascript']
];

for (const [line, lang] of cases) {
  const zh = T.translateLine(line, lang);
  console.log(`${lang.padEnd(10)} | ${line.trim().padEnd(55)} => ${zh === null ? '(跳过)' : zh}`);
}

// 关键断言
assert.ok(T.translateLine('SELECT id, name FROM users WHERE age > 18;', 'sql').includes('查询'));
assert.ok(T.translateLine('SELECT id, name FROM users WHERE age > 18;', 'sql').includes('用户'));
assert.ok(T.translateLine('DELETE FROM users WHERE id = 2;', 'sql').includes('删除'));
assert.ok(T.translateLine('def add(a, b):', 'python').includes('函数 add'));
assert.ok(T.translateLine('const x = 10;', 'javascript').includes('常量 x'));
assert.strictEqual(T.translateLine('{', 'javascript'), null);
assert.strictEqual(T.translateLine('', 'python'), null);
assert.strictEqual(T.translateLine('# 注释', 'python'), null);

// 多行
const multi = T.translateText('SELECT * FROM users;\nwhere age > 18;', 'sql');
assert.strictEqual(multi.length, 2);
assert.ok(multi[0].zh && multi[1].zh);
assert.strictEqual(T.commentPrefix('python'), '#');
assert.strictEqual(T.commentPrefix('sql'), '--');
assert.strictEqual(T.commentPrefix('javascript'), '//');

// ---------------- Web：HTML / CSS / JS ----------------
const htmlCases = [
  ['<!DOCTYPE html>', 'HTML5'],
  ['<div class="container" id="app">', '区块容器'],
  ['</div>', '结束'],
  ['<img src="a.png" alt="图片" />', '图片'],
  ['<a href="https://x.com" target="_blank">链接</a>', '超链接'],
  ['<input type="text" placeholder="请输入">', '输入框']
];
for (const [line, expect] of htmlCases) {
  const zh = T.translateLine(line, 'html');
  assert.ok(zh && zh.includes(expect), `HTML 翻译失败：${line} => ${zh}`);
}

const cssCases = [
  ['.btn {', '类名为'],
  ['color: red;', '文字颜色'],
  ['display: flex;', '弹性布局'],
  ['margin: 0 auto;', '外边距'],
  ['a:hover {', '鼠标悬停'],
  ['@media (max-width: 600px) {', '媒体查询'],
  ['}', '样式块结束']
];
for (const [line, expect] of cssCases) {
  const zh = T.translateLine(line, 'css');
  assert.ok(zh && zh.includes(expect), `CSS 翻译失败：${line} => ${zh}`);
}

const jsWebCases = [
  ['const add = (a, b) => a + b;', '箭头函数'],
  ['const el = document.querySelector(".btn");', '页面元素'],
  ['btn.addEventListener("click", handle);', '事件监听'],
  ['await fetch("/api");', '异步'],
  ['const obj = {', '对象']
];
for (const [line, expect] of jsWebCases) {
  const zh = T.translateLine(line, 'javascript');
  assert.ok(zh && zh.includes(expect), `JS 翻译失败：${line} => ${zh}`);
}

// 块注释样式
assert.deepStrictEqual(T.commentStyle('html'), { prefix: '<!--', suffix: ' -->' });
assert.deepStrictEqual(T.commentStyle('css'), { prefix: '/*', suffix: ' */' });
assert.deepStrictEqual(T.commentStyle('sql'), { prefix: '--', suffix: '' });

// HTML 内嵌 script / style 上下文识别
const doc = [
  '<div>',
  '<script>',
  'const x = 1;',
  'console.log(x);',
  '</script>',
  '<style>',
  '.a {',
  'color: red;',
  '}',
  '</style>',
  '</div>'
].join('\n');
const parsed = T.translateDocument(doc, 'html');
assert.strictEqual(parsed[2].lang, 'javascript');
assert.strictEqual(parsed[2].style.prefix, '//');
assert.strictEqual(parsed[6].lang, 'css');
assert.strictEqual(parsed[6].style.prefix, '/*');
assert.strictEqual(parsed[0].style.prefix, '<!--');
assert.ok(parsed[2].zh.includes('常量'));

console.log('\n所有断言通过 ✅');
