// -*- coding: utf-8 -*-
'use strict';
const T = require('../shared/engine/translator.js');

const samples = [
  ['<!DOCTYPE html>', 'html'],
  ['<div class="container" id="app">', 'html'],
  ['</div>', 'html'],
  ['<img src="a.png" alt="图片" />', 'html'],
  ['<a href="https://x.com" target="_blank">链接</a>', 'html'],
  ['<input type="text" placeholder="请输入">', 'html'],
  ['.btn {', 'css'],
  ['color: red;', 'css'],
  ['display: flex;', 'css'],
  ['margin: 0 auto;', 'css'],
  ['a:hover {', 'css'],
  ['@media (max-width: 600px) {', 'css'],
  ['}', 'css'],
  ['const add = (a, b) => a + b;', 'javascript'],
  ['const el = document.querySelector(".btn");', 'javascript'],
  ['btn.addEventListener("click", handle);', 'javascript'],
  ['await fetch("/api");', 'javascript'],
  ['const obj = {', 'javascript'],
  ['items.map(x => x * 2);', 'javascript']
];

for (const [line, lang] of samples) {
  console.log(String(lang).padEnd(10), '|', line.padEnd(52), '=>', T.translateLine(line, lang));
}

console.log('--- document context ---');
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
for (const r of T.translateDocument(doc, 'html')) {
  console.log(String(r.lang).padEnd(10), '|', r.line.padEnd(20), '=>', r.zh, ' style=', r.style.prefix, r.style.suffix);
}
