// -*- coding: utf-8 -*-
'use strict';

/**
 * 插入/移除注释的纯逻辑（不依赖 vscode，便于单元测试）。
 * 支持单行注释（-- / # / //）与块注释（<!-- --> / /* *​/）。
 */

const engine = require('./engine.js');

function normalizeStyle(style) {
  return style && style.prefix ? style : { prefix: '//', suffix: '' };
}

function isMarkerLine(text, style, marker) {
  const st = normalizeStyle(style);
  const t = String(text == null ? '' : text).trim();
  if (!t.startsWith(st.prefix)) return false;
  return t.slice(st.prefix.length).trim().startsWith(marker);
}

function buildCommentLine(indent, style, marker, zh) {
  const st = normalizeStyle(style);
  return `${indent}${st.prefix} ${marker}${zh}${st.suffix}`;
}

/**
 * 处理 [start, end] 行区间：保留原行，在其下一行插入中文注释；
 * 区间内已有的「译文」行会被替换（避免重复）。
 * @returns {{start:number,end:number,lines:string[],added:number,removed:number}}
 */
function transformRange(lines, start, end, langId, marker) {
  const langs = engine.contextLanguages(lines, langId);
  const styles = langs.map((l) => engine.commentStyle(l));
  const n = lines.length;
  start = Math.max(0, Math.min(start, n - 1));
  end = Math.max(start, Math.min(end, n - 1));

  while (end + 1 < n && isMarkerLine(lines[end + 1], styles[end + 1], marker)) end++;
  while (start - 1 >= 0 && isMarkerLine(lines[start - 1], styles[start - 1], marker)) start--;

  const out = [];
  let added = 0;
  let removed = 0;
  for (let i = start; i <= end; i++) {
    const text = lines[i];
    if (isMarkerLine(text, styles[i], marker)) {
      removed++;
      continue;
    }
    out.push(text);
    const zh = engine.translateLine(text, langs[i]);
    if (zh) {
      const indent = (text.match(/^\s*/) || [''])[0];
      out.push(buildCommentLine(indent, styles[i], marker, zh));
      added++;
    }
  }
  return { start, end, lines: out, added, removed };
}

/** 移除全部「译文」行。 */
function removeMarkers(lines, langId, marker) {
  const styles = engine.contextLanguages(lines, langId).map((l) => engine.commentStyle(l));
  const kept = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isMarkerLine(lines[i], styles[i], marker)) {
      removed++;
      continue;
    }
    kept.push(lines[i]);
  }
  return { lines: kept, removed };
}

module.exports = { isMarkerLine, transformRange, removeMarkers, buildCommentLine };
