// -*- coding: utf-8 -*-
'use strict';

/**
 * 代码中文翻译引擎（离线词库 + 规则模板）
 * 供 VS Code 扩展与本地测试使用；桌面助手（PowerShell）复用同一份 glossary.json。
 */

const path = require('path');
const fs = require('fs');

const GLOSSARY = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'glossary.json'), 'utf8')
);

const KW = GLOSSARY.keywords;
const WORDS = GLOSSARY.words;
const OPS = GLOSSARY.operators;
const MARKER = '译文：';

const COMMENT_STYLE = {
  sql: { prefix: '--', suffix: '' }, mysql: { prefix: '--', suffix: '' },
  pgsql: { prefix: '--', suffix: '' }, sqlite: { prefix: '--', suffix: '' },
  plsql: { prefix: '--', suffix: '' },
  python: { prefix: '#', suffix: '' }, shellscript: { prefix: '#', suffix: '' },
  powershell: { prefix: '#', suffix: '' }, r: { prefix: '#', suffix: '' },
  ruby: { prefix: '#', suffix: '' }, perl: { prefix: '#', suffix: '' },
  yaml: { prefix: '#', suffix: '' }, toml: { prefix: '#', suffix: '' },
  lua: { prefix: '--', suffix: '' },
  html: { prefix: '<!--', suffix: ' -->' },
  xml: { prefix: '<!--', suffix: ' -->' },
  svg: { prefix: '<!--', suffix: ' -->' },
  vue: { prefix: '<!--', suffix: ' -->' },
  svelte: { prefix: '<!--', suffix: ' -->' },
  css: { prefix: '/*', suffix: ' */' },
  scss: { prefix: '/*', suffix: ' */' },
  less: { prefix: '/*', suffix: ' */' },
  sass: { prefix: '/*', suffix: ' */' },
  stylus: { prefix: '/*', suffix: ' */' },
  javascript: { prefix: '//', suffix: '' }, javascriptreact: { prefix: '//', suffix: '' },
  typescript: { prefix: '//', suffix: '' }, typescriptreact: { prefix: '//', suffix: '' },
  java: { prefix: '//', suffix: '' }, c: { prefix: '//', suffix: '' },
  cpp: { prefix: '//', suffix: '' }, csharp: { prefix: '//', suffix: '' },
  go: { prefix: '//', suffix: '' }, rust: { prefix: '//', suffix: '' },
  kotlin: { prefix: '//', suffix: '' }, swift: { prefix: '//', suffix: '' },
  php: { prefix: '//', suffix: '' }, scala: { prefix: '//', suffix: '' },
  dart: { prefix: '//', suffix: '' }
};

const DEFAULT_STYLE = { prefix: '//', suffix: '' };

function commentStyle(languageId) {
  return COMMENT_STYLE[String(languageId || '').toLowerCase()] || DEFAULT_STYLE;
}

function commentPrefix(languageId) {
  return commentStyle(languageId).prefix;
}

function hasCJK(s) {
  return /[\u4e00-\u9fff]/.test(s);
}

/** 标识符 → 中文（先整词，再按蛇形/驼峰拆词） */
function glossIdentifier(id) {
  if (id === undefined || id === null) return '';
  let s = String(id).trim();
  if (!s) return '';
  s = s.replace(/[`"'\[\]]/g, '');
  if (s === '*') return '所有列';
  if (/^\d+$/.test(s)) return s;
  if (s.includes('.')) {
    return s.split('.').map((p) => glossIdentifier(p)).join(' 的 ');
  }
  const low = s.toLowerCase();
  if (WORDS[low]) return WORDS[low];
  if (KW[low]) return KW[low];
  const parts = s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .split(/[_\s]+/)
    .filter(Boolean);
  const mapped = parts.map((p) => {
    const pl = p.toLowerCase();
    return WORDS[pl] || KW[pl] || (/^\d+$/.test(p) ? p : p);
  });
  const known = parts.filter((p) => WORDS[p.toLowerCase()] || KW[p.toLowerCase()]).length;
  if (known === 0) return s;
  if (parts.length === 1) return mapped[0];
  return mapped.join('');
}

/**
 * 表达式 → 中文：保护字符串字面量，翻译运算符/逻辑词/标识符。
 */
function glossExpression(expr) {
  if (expr === undefined || expr === null) return '';
  let s = String(expr).trim();
  if (!s) return '';
  if (hasCJK(s)) return s;
  const literals = [];
  s = s.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, (m) => {
    literals.push(m);
    return `\u0000${literals.length - 1}\u0000`;
  });
  s = s.replace(/\b(and|or|not|in|is|as)\b/gi, (m) => (KW[m.toLowerCase()] ? ` ${KW[m.toLowerCase()]} ` : m));
  s = s.replace(/>=|<=|<>|!=|==|&&|\|\||=>|->|[=<>+\-*/%!]/g, (m) => (OPS[m] ? ` ${OPS[m]} ` : m));
  s = s.replace(/\bnull\b/gi, '空值');
  s = s.replace(/\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\b/g, (m) => glossIdentifier(m));
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => literals[Number(i)]);
  return s.replace(/\s+/g, ' ').trim();
}

/** 拆分顶层逗号（忽略括号/引号内的逗号） */
function splitTop(str, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let buf = '';
  for (const ch of String(str || '')) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

// ------------------------------------------------------------------ SQL

function translateSqlExpression(expr) {
  let e = String(expr).trim();
  if (!e) return '';
  if (e === '*') return '所有列';
  let m;
  if ((m = e.match(/^([A-Za-z_]\w*)\.\*$/))) return `「${glossIdentifier(m[1])}」的所有列`;
  if ((m = e.match(/^(count|sum|avg|max|min|round)\s*\(\s*([\s\S]*?)\s*\)$/i))) {
    const fn = KW[m[1].toLowerCase()] || m[1];
    const arg = m[2].trim() === '*' ? '全部行' : translateSqlExpression(m[2]);
    return `${fn}（${arg}）`;
  }
  if ((m = e.match(/^distinct\s+([\s\S]+)$/i))) return `去重（${translateSqlExpression(m[1])}）`;
  if (/^'.*'$/.test(e) || /^".*"$/.test(e) || /^\d+(\.\d+)?$/.test(e)) return e;
  if ((m = e.match(/^([\w.]+)\s*([+\-*/])\s*([\w.]+)$/))) {
    return `${glossIdentifier(m[1])} ${OPS[m[2]] || m[2]} ${glossIdentifier(m[3])}`;
  }
  return glossIdentifier(e);
}

function translateColumns(cols) {
  return splitTop(cols, ',')
    .map((col) => {
      const m = col.match(/^([\s\S]+?)\s+as\s+([A-Za-z_]\w*)$/i);
      if (m) return `${translateSqlExpression(m[1])} 作为 ${glossIdentifier(m[2])}`;
      return translateSqlExpression(col);
    })
    .join('、');
}

function translateCondition(cond) {
  let s = String(cond || '').trim();
  if (!s) return '';
  const literals = [];
  s = s.replace(/'[^']*'|"[^"]*"/g, (m) => {
    literals.push(m);
    return `\u0000${literals.length - 1}\u0000`;
  });
  s = s.replace(/\b(and|or|not|like|between|in|is)\b/gi, (m) => ` ${KW[m.toLowerCase()]} `);
  s = s.replace(/>=|<=|<>|!=|==|&&|\|\||[=<>+\-*/%!]/g, (m) => (OPS[m] ? ` ${OPS[m]} ` : m));
  s = s.replace(/\bnull\b/gi, '空值');
  s = s.replace(/\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\b/g, (m) => {
    if (/^(asc|desc)$/i.test(m)) return KW[m.toLowerCase()];
    return glossIdentifier(m);
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => literals[Number(i)]);
  return s.replace(/\s+/g, ' ').trim();
}

function translateOrderList(list) {
  return splitTop(list, ',').map((item) => {
    const m = item.match(/^([\s\S]+?)\s+(asc|desc)$/i);
    if (m) return `${glossIdentifier(m[1])} ${KW[m[2].toLowerCase()]}`;
    return glossIdentifier(item);
  }).join('、');
}

function splitSqlClauses(rest) {
  const re = /\b(where|group\s+by|order\s+by|having|limit|offset|(?:left|right|inner|outer|cross)\s+join|join|union)\b/gi;
  const marks = [];
  let m;
  while ((m = re.exec(rest))) {
    marks.push({ key: m[1].toLowerCase().replace(/\s+/g, ' '), start: m.index, end: re.lastIndex });
  }
  const clauses = {};
  for (let i = 0; i < marks.length; i++) {
    const stop = i + 1 < marks.length ? marks[i + 1].start : rest.length;
    clauses[marks[i].key] = rest.slice(marks[i].end, stop).trim();
  }
  return clauses;
}

function translateSqlTail(rest) {
  const clauses = splitSqlClauses(rest || '');
  const parts = [];
  for (const [key, value] of Object.entries(clauses)) {
    if (!value) continue;
    if (key === 'where') parts.push(`条件：${translateCondition(value)}`);
    else if (key === 'group by') parts.push(`按 ${translateColumns(value)} 分组`);
    else if (key === 'having') parts.push(`分组后筛选：${translateCondition(value)}`);
    else if (key === 'order by') parts.push(`排序：${translateOrderList(value)}`);
    else if (key === 'limit') parts.push(`最多返回 ${value} 条`);
    else if (key === 'offset') parts.push(`跳过 ${value} 条`);
    else if (key === 'union') parts.push('合并另一个查询结果' + (value ? `（${value}）` : ''));
    else if (key.endsWith('join')) {
      const prefix = key === 'join' ? '' : (KW[key.replace(/\s*join$/, '')] || '');
      const m = value.match(/^([^\s]+)(?:\s+(?:as\s+)?([A-Za-z_]\w*))?\s+on\s+([\s\S]+)$/i);
      if (m) {
        parts.push(`${prefix}连接「${glossIdentifier(m[1])}」${m[2] ? `（别名 ${m[2]}）` : ''}，关联条件：${translateCondition(m[3])}`);
      } else {
        parts.push(`${prefix}连接「${glossIdentifier(value)}」`);
      }
    }
  }
  return parts.length ? '；' + parts.join('；') : '';
}

function translateSqlDefinitions(list) {
  return list.map((def) => {
    const m = def.match(/^`?([A-Za-z_]\w*)`?\s+(INT|INTEGER|VARCHAR|CHAR|TEXT|DECIMAL|FLOAT|DOUBLE|DATETIME|DATE|TIME|TIMESTAMP|BOOL|BOOLEAN)\b([\s\S]*)$/i);
    if (m) {
      const type = KW[m[2].toLowerCase()] || m[2];
      const extras = m[3] || '';
      const flags = [];
      if (/primary\s+key/i.test(extras)) flags.push('主键');
      if (/auto_increment/i.test(extras)) flags.push('自增');
      if (/not\s+null/i.test(extras)) flags.push('非空');
      if (/unique/i.test(extras)) flags.push('唯一');
      if (/default\s+(\S+)/i.test(extras)) flags.push('默认值 ' + extras.match(/default\s+(\S+)/i)[1]);
      return `${glossIdentifier(m[1])}（${type}${flags.length ? '，' + flags.join('，') : ''}）`;
    }
    return glossExpression(def);
  }).join('、');
}

function translateSql(line) {
  const original = String(line).trim();
  const s = original.replace(/;+\s*$/, '');
  if (!s) return null;
  if (/^--/.test(s)) return null;

  let m;

  // SELECT
  m = s.match(/^select\s+(distinct\s+)?([\s\S]+?)\s+from\s+([^\s,;]+)([\s\S]*)$/i);
  if (m) {
    const pre = m[1] ? '去重后从' : '从';
    return `${pre}「${glossIdentifier(m[3])}」中查询：${translateColumns(m[2])}${translateSqlTail(m[4])}`;
  }
  m = s.match(/^select\s+([\s\S]+)$/i);
  if (m) return `查询：${translateColumns(m[1])}`;

  // INSERT
  m = s.match(/^insert\s+(?:into\s+)?([^\s(]+)\s*(?:\(([^)]*)\))?\s*values\s*\(([\s\S]*)\)$/i);
  if (m) {
    const table = glossIdentifier(m[1]);
    const cols = m[2] ? splitTop(m[2], ',').map((c) => glossIdentifier(c)) : null;
    const vals = splitTop(m[3], ',').map((v) => translateSqlExpression(v));
    if (cols && cols.length === vals.length) {
      return `向「${table}」插入数据：${cols.map((c, i) => `${c} = ${vals[i]}`).join('、')}`;
    }
    return `向「${table}」插入数据：${vals.join('、')}`;
  }

  // UPDATE
  m = s.match(/^update\s+([^\s]+)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+))?$/i);
  if (m) {
    const sets = splitTop(m[2], ',').map((pair) => {
      const p = pair.match(/^([\w.]+)\s*=\s*([\s\S]+)$/);
      return p ? `${glossIdentifier(p[1])} 设为 ${translateSqlExpression(p[2])}` : glossExpression(pair);
    }).join('、');
    return `更新「${glossIdentifier(m[1])}」：${sets}${m[3] ? `；条件：${translateCondition(m[3])}` : ''}`;
  }

  // DELETE
  m = s.match(/^delete\s+from\s+([^\s]+)(?:\s+where\s+([\s\S]+))?$/i);
  if (m) {
    return `从「${glossIdentifier(m[1])}」删除数据${m[2] ? `；条件：${translateCondition(m[2])}` : '（删除全部数据）'}`;
  }

  // CREATE TABLE / DATABASE / INDEX / VIEW
  m = s.match(/^create\s+(table|database|index|view)\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*(?:\(([\s\S]*)\))?$/i);
  if (m) {
    const kind = { table: '表', database: '数据库', index: '索引', view: '视图' }[m[1].toLowerCase()];
    let out = `创建${kind}「${glossIdentifier(m[2])}」`;
    if (m[3]) {
      const defs = splitTop(m[3], ',');
      out += `，包含：${translateSqlDefinitions(defs)}`;
    }
    return out;
  }

  // DROP
  m = s.match(/^drop\s+(table|database|index|view)\s+(?:if\s+exists\s+)?([^\s;]+)/i);
  if (m) {
    const kind = { table: '表', database: '数据库', index: '索引', view: '视图' }[m[1].toLowerCase()];
    return `删除${kind}「${glossIdentifier(m[2])}」`;
  }

  // ALTER TABLE
  m = s.match(/^alter\s+table\s+([^\s]+)\s+([\s\S]+)$/i);
  if (m) {
    const rest = m[2].replace(/;+\s*$/, '');
    let action;
    if (/^add\s+(column\s+)?/i.test(rest)) action = '添加列 ' + glossExpression(rest.replace(/^add\s+(column\s+)?/i, ''));
    else if (/^drop\s+(column\s+)?/i.test(rest)) action = '删除列 ' + glossExpression(rest.replace(/^drop\s+(column\s+)?/i, ''));
    else if (/^modify\s+(column\s+)?/i.test(rest)) action = '修改列 ' + glossExpression(rest.replace(/^modify\s+(column\s+)?/i, ''));
    else if (/^rename\s+to\s+/i.test(rest)) action = '重命名为 ' + glossExpression(rest.replace(/^rename\s+to\s+/i, ''));
    else action = glossExpression(rest);
    return `修改表「${glossIdentifier(m[1])}」：${action}`;
  }

  // SHOW / USE / DESC / EXPLAIN / TRUNCATE
  if (/^show\s+tables/i.test(s)) return '显示所有表';
  if (/^show\s+databases/i.test(s)) return '显示所有数据库';
  m = s.match(/^use\s+([^\s;]+)/i);
  if (m) return `使用数据库「${m[1]}」`;
  m = s.match(/^(desc|describe)\s+([^\s;]+)/i);
  if (m) return `查看表「${glossIdentifier(m[2])}」的结构`;
  if (/^explain\s+/i.test(s)) return '查看语句的执行计划';
  m = s.match(/^truncate\s+(?:table\s+)?([^\s;]+)/i);
  if (m) return `清空表「${glossIdentifier(m[1])}」的全部数据`;

  // 事务 / 授权
  if (/^(start\s+transaction|begin)\b/i.test(s)) return '开始事务';
  if (/^commit\b/i.test(s)) return '提交事务（保存修改）';
  if (/^rollback\b/i.test(s)) return '回滚事务（撤销修改）';
  m = s.match(/^grant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+(.+)$/i);
  if (m) return `授予权限：${glossExpression(m[1])}，对象：${glossIdentifier(m[2])}，用户：${m[3]}`;
  m = s.match(/^revoke\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+from\s+(.+)$/i);
  if (m) return `撤销权限：${glossExpression(m[1])}，对象：${glossIdentifier(m[2])}`;

  // 多行语句片段
  m = s.match(/^where\s+([\s\S]+)$/i);
  if (m) return `筛选条件：${translateCondition(m[1])}`;
  m = s.match(/^(and|or)\s+([\s\S]+)$/i);
  if (m) return `${m[1].toLowerCase() === 'and' ? '并且' : '或者'}：${translateCondition(m[2])}`;
  m = s.match(/^group\s+by\s+([\s\S]+)$/i);
  if (m) return `按 ${translateColumns(m[1])} 分组`;
  m = s.match(/^order\s+by\s+([\s\S]+)$/i);
  if (m) return `排序：${translateOrderList(m[1])}`;
  m = s.match(/^having\s+([\s\S]+)$/i);
  if (m) return `分组后筛选：${translateCondition(m[1])}`;
  m = s.match(/^limit\s+([\s\S]+)$/i);
  if (m) return `最多返回 ${m[1]} 条`;
  m = s.match(/^values\s*\(([\s\S]*)\)$/i);
  if (m) return `值：${splitTop(m[1], ',').map((v) => translateSqlExpression(v)).join('、')}`;
  m = s.match(/^set\s+([\s\S]+)$/i);
  if (m) return `设置：${translateCondition(m[1])}`;

  // CREATE TABLE 内部的列定义行
  m = s.match(/^`?([A-Za-z_]\w*)`?\s+(INT|INTEGER|VARCHAR|CHAR|TEXT|DECIMAL|FLOAT|DOUBLE|DATETIME|DATE|TIME|TIMESTAMP|BOOL|BOOLEAN)\b([\s\S]*)$/i);
  if (m) return `列 ${translateSqlDefinitions([s])}`;

  // 兜底：只翻译关键字/标识符
  if (/^[A-Za-z_][\w\s,.()*'"]*$/.test(s)) {
    const glossed = glossExpression(s);
    if (glossed !== s) return glossed;
  }
  return null;
}

// ------------------------------------------------------------------ Python

function translatePython(line) {
  const t = String(line).trim();
  if (!t || t.startsWith('#')) return null;
  let m;

  m = t.match(/^@([\w.]+)/);
  if (m) return `装饰器 ${m[1]}`;

  m = t.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
  if (m) return `从模块 ${m[1]} 导入 ${glossExpression(m[2])}`;
  m = t.match(/^import\s+(.+)$/);
  if (m) return `导入模块 ${m[1]}`;

  m = t.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);
  if (m) {
    const params = m[2].trim()
      ? splitTop(m[2], ',').map((p) => p.split('=')[0].trim()).join('、')
      : '无';
    return `定义函数 ${m[1]}，参数：${params}`;
  }

  m = t.match(/^class\s+(\w+)\s*(?:\(([^)]*)\))?/);
  if (m) return `定义类 ${m[1]}${m[2] ? `，继承自 ${m[2]}` : ''}`;

  m = t.match(/^(if|elif)\s+([\s\S]+?):?$/);
  if (m) return `${m[1] === 'if' ? '如果' : '否则如果'} ${translateCondition(m[2])}`;

  if (/^else\s*:?$/.test(t)) return '否则';

  m = t.match(/^for\s+([\s\S]+?)\s+in\s+([\s\S]+?):?$/);
  if (m) return `循环：让 ${glossIdentifier(m[1])} 依次取 ${glossExpression(m[2])} 中的值`;

  m = t.match(/^while\s+([\s\S]+?):?$/);
  if (m) return `当 ${translateCondition(m[1])} 时循环`;

  m = t.match(/^return\s*([\s\S]*)$/);
  if (m) return m[1].trim() ? `返回 ${glossExpression(m[1])}` : '返回（结束函数）';

  if (/^break\b/.test(t)) return '跳出循环';
  if (/^continue\b/.test(t)) return '跳过本轮，继续下一轮';
  if (/^pass\b/.test(t)) return '占位，不执行任何操作';

  m = t.match(/^print\s*\(([\s\S]*)\)$/);
  if (m) return `打印 ${glossExpression(m[1])}`;

  m = t.match(/^with\s+([\s\S]+?)\s+as\s+(\w+)/);
  if (m) return `使用 ${glossExpression(m[1])}，并命名为 ${glossIdentifier(m[2])}`;

  if (/^try\s*:?$/.test(t)) return '尝试执行（捕获可能出现的异常）';
  m = t.match(/^except\s*([\w.]*)(?:\s+as\s+(\w+))?\s*:?$/);
  if (m) {
    const cls = m[1] ? `：${m[1]}` : '';
    const alias = m[2] ? `，异常对象命名为 ${m[2]}` : '';
    return `捕获异常${cls}${alias}`;
  }
  if (/^finally\s*:?$/.test(t)) return '无论是否异常都会执行';
  m = t.match(/^raise\s+([\s\S]+)$/);
  if (m) return `抛出异常 ${glossExpression(m[1])}`;

  m = t.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*([+\-*/%]?=)\s*([\s\S]+)$/);
  if (m) {
    const target = glossIdentifier(m[1]);
    const op = m[2];
    const value = glossExpression(m[3]);
    if (op === '=') return `把 ${value} 赋值给 ${target}`;
    const verb = { '+': '加上', '-': '减去', '*': '乘以', '/': '除以', '%': '对…取模' }[op.slice(0, -1)] || '更新为';
    return `把 ${target} ${verb} ${value}`;
  }

  m = t.match(/^([A-Za-z_][\w.]*)\s*\(/);
  if (m) return `调用 ${m[1]}(…)`;

  if (/^[()\[\]{}]+$/.test(t)) return null;
  const glossed = glossExpression(t);
  return glossed !== t ? glossed : null;
}

// ------------------------------------------------------- JS / Java / C 系

const C_LIKE_SKIP = /^(\/\/|\/\*|\*|<\/?[A-Za-z]|#include|#define|using\s+namespace|package\s)/;

function translateLoopStep(step) {
  let m = step.match(/^(\w+)\s*(\+\+|--)$/);
  if (m) return `${m[1]} 自${m[2] === '++' ? '增' : '减'} 1`;
  m = step.match(/^(\w+)\s*([+\-*/]?=)\s*([\s\S]+)$/);
  if (m) {
    const verb = { '+=': '加上', '-=': '减去', '*=': '乘以', '/=': '除以', '%=': '对…取模', '=': '设为' }[m[2]] || '更新为';
    return `${m[1]} ${verb} ${glossExpression(m[3])}`;
  }
  return glossExpression(step);
}

function translateCLike(line) {
  const t = String(line).trim();
  if (!t) return null;
  if (C_LIKE_SKIP.test(t)) return null;
  let m;

  // import ... from "module"
  m = t.match(/^import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"]/);
  if (m) return `从模块 ${m[2]} 导入 ${glossExpression(m[1])}`;
  m = t.match(/^import\s+['"]([^'"]+)['"]/);
  if (m) return `导入模块 ${m[1]}`;
  m = t.match(/^import\s+([\s\S]+?);?$/);
  if (m) return `导入 ${glossExpression(m[1])}`;
  m = t.match(/^(?:const|let|var)\s+[\w{}\[\],\s]+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (m) return `引入模块 ${m[1]}`;

  // 类 / 接口 / 枚举
  m = t.match(/^(?:(?:public|private|protected|abstract|final|static|export|default)\s+)*(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([\w.,\s]+))?/);
  if (m) return `定义${/interface/.test(t) ? '接口' : /enum/.test(t) ? '枚举' : '类'} ${m[1]}${m[2] ? `，继承自 ${m[2]}` : ''}${m[3] ? `，实现 ${m[3].trim()}` : ''}`;

  // 方法定义（Java/C# 风格）
  m = t.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|native|override|virtual)\s+)*([A-Za-z_][\w<>\[\],.]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$/);
  if (m && !/^(if|for|while|switch|catch|new|return|throw|else|do)$/.test(m[2]) && !/^(function|new|return|throw|typeof|catch|else|do|await)$/i.test(m[1])) {
    const params = m[3].trim()
      ? splitTop(m[3], ',').map((p) => p.trim()).join('、')
      : '无';
    return `定义方法 ${m[2]}，返回类型 ${glossExpression(m[1])}，参数：${params}`;
  }

  // function 关键字
  m = t.match(/^(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
  if (m) {
    const params = m[3].trim()
      ? splitTop(m[3], ',').map((p) => p.split(':')[0].split('=')[0].trim()).join('、')
      : '无';
    return `定义${m[1] ? '异步' : ''}函数 ${m[2]}，参数：${params}`;
  }

  // 箭头函数
  m = t.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*=>\s*([\s\S]+)$/);
  if (m) {
    const params = m[3].trim()
      ? splitTop(m[3], ',').map((p) => p.split(':')[0].split('=')[0].trim()).join('、')
      : '无';
    return `定义${m[2] ? '异步' : ''}箭头函数 ${m[1]}，参数：${params}，返回 ${glossExpression(m[4].replace(/;\s*$/, ''))}`;
  }
  m = t.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?(\w+)\s*=>\s*([\s\S]+)$/);
  if (m) {
    return `定义${m[2] ? '异步' : ''}箭头函数 ${m[1]}，参数：${m[3]}，返回 ${glossExpression(m[4].replace(/;\s*$/, ''))}`;
  }

  // DOM 查询
  m = t.match(/^(?:const|let|var)\s+(\w+)\s*=\s*document\.(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)\(\s*(['"`])(.*?)\3\s*\)/);
  if (m) {
    const what = {
      queryselector: '选择器', queryselectorall: '选择器', getelementbyid: 'id',
      getelementsbyclassname: '类名', getelementsbytagname: '标签名'
    }[m[2].toLowerCase()];
    return `查找页面元素：按${what}「${m[4]}」，赋值给 ${m[1]}`;
  }
  m = t.match(/^document\.(querySelector|querySelectorAll)\(\s*(['"`])(.*?)\2\s*\)/);
  if (m) return `查找页面元素：选择器「${m[3]}」`;

  // 事件监听
  m = t.match(/^(.+?)\.addEventListener\(\s*(['"`])(\w+)\2/);
  if (m) return `为 ${glossExpression(m[1])} 添加事件监听：${m[3]}`;

  // 数组方法
  m = t.match(/^(.+?)\.(map|filter|forEach|reduce|find|some|every|sort)\s*\(/);
  if (m) {
    const fnZh = {
      map: '映射', filter: '过滤', forEach: '遍历', reduce: '归约',
      find: '查找', some: '判断是否存在', every: '判断是否全部满足', sort: '排序'
    }[m[2]];
    return `对 ${glossExpression(m[1])} 执行 ${m[2]}（${fnZh}）操作`;
  }

  // async / await
  m = t.match(/^await\s+([\s\S]+)$/);
  if (m) return `等待异步结果：${glossExpression(m[1].replace(/;\s*$/, ''))}`;
  m = t.match(/^export\s+default\s+([\s\S]+)$/);
  if (m) return `默认导出 ${glossExpression(m[1].replace(/;\s*$/, ''))}`;

  // 对象 / 数组声明
  m = t.match(/^(?:const|let|var)\s+(\w+)\s*=\s*\{/);
  if (m) return `声明对象${t.startsWith('const') ? '常量' : '变量'} ${m[1]}`;
  m = t.match(/^(?:const|let|var)\s+(\w+)\s*=\s*\[/);
  if (m) return `声明数组${t.startsWith('const') ? '常量' : '变量'} ${m[1]}`;

  // for（经典三表达式）
  m = t.match(/^for\s*\(\s*(?:let|var|const|int|long|double|float|char|string|String)?\s*(\w+)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]*)\)\s*\{?\s*$/);
  if (m) {
    return `循环：${m[1]} 从 ${glossExpression(m[2])} 开始；当 ${translateCondition(m[3])} 时继续；每轮 ${translateLoopStep(m[4].trim())}`;
  }

  m = t.match(/^if\s*\(([\s\S]*?)\)\s*\{?\s*$/);
  if (m) return `如果 ${translateCondition(m[1])}`;
  m = t.match(/^else\s+if\s*\(([\s\S]*?)\)\s*\{?\s*$/);
  if (m) return `否则如果 ${translateCondition(m[1])}`;
  if (/^else\s*\{?\s*$/.test(t)) return '否则';

  m = t.match(/^for\s*\(([\s\S]*?)\)\s*\{?\s*$/);
  if (m) return `循环：${glossExpression(m[1])}`;
  m = t.match(/^while\s*\(([\s\S]*?)\)\s*\{?\s*$/);
  if (m) return `当 ${translateCondition(m[1])} 时循环`;

  m = t.match(/^switch\s*\(([\s\S]*?)\)\s*\{?\s*$/);
  if (m) return `根据 ${glossExpression(m[1])} 分支`;
  m = t.match(/^case\s+([\s\S]+?):?$/);
  if (m) return `当值为 ${glossExpression(m[1])} 时`;
  if (/^default\s*:?\s*$/.test(t)) return '其他情况';

  m = t.match(/^return\s*([\s\S]*)$/);
  if (m) return m[1].trim() ? `返回 ${glossExpression(m[1].replace(/;\s*$/, ''))}` : '返回（结束函数）';
  if (/^break\b/.test(t)) return '跳出循环';
  if (/^continue\b/.test(t)) return '继续下一轮';
  if (/^throw\b/.test(t)) return `抛出异常 ${glossExpression(t.replace(/^throw\s*/, ''))}`;
  if (/^try\s*\{?\s*$/.test(t)) return '尝试执行';
  m = t.match(/^catch\s*\(([\s\S]*?)\)/);
  if (m) return `捕获异常：${glossExpression(m[1])}`;
  if (/^finally\s*\{?\s*$/.test(t)) return '无论是否异常都会执行';

  // 打印
  m = t.match(/^(?:console\.log|System\.out\.println|System\.out\.print|print|printf|cout\s*<<|println)\s*\(?([\s\S]*?)\)?;?$/);
  if (m && /^(console\.log|System\.out\.|print|printf|cout|println)/.test(t)) {
    return `打印 ${glossExpression(m[1])}`;
  }

  // 赋值
  m = t.match(/^(?:const|let|var)\s+(\w+)\s*=\s*([\s\S]+)$/);
  if (m) {
    const kind = t.startsWith('const') ? '常量' : '变量';
    return `声明${kind} ${m[1]}，赋值为 ${glossExpression(m[2].replace(/;\s*$/, ''))}`;
  }
  m = t.match(/^(?:const|let|var)\s+(\w+)\s*;?$/);
  if (m) return `声明变量 ${m[1]}`;
  m = t.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*([+\-*/%]?=)\s*([\s\S]+)$/);
  if (m) {
    const target = glossIdentifier(m[1]);
    const op = m[2];
    const value = glossExpression(m[3].replace(/;\s*$/, ''));
    if (op === '=') return `把 ${value} 赋值给 ${target}`;
    return `把 ${target} 更新为 ${target} ${op.slice(0, -1)} ${value}`;
  }

  m = t.match(/^([A-Za-z_][\w.]*)\s*\(/);
  if (m) return `调用 ${m[1]}(…)`;

  if (/^[{}();,]+$/.test(t)) return null;
  const glossed = glossExpression(t);
  return glossed !== t ? glossed : null;
}

// ------------------------------------------------------------------ HTML

const HTML_TAGS = (GLOSSARY.html && GLOSSARY.html.tags) || {};
const HTML_ATTRS = (GLOSSARY.html && GLOSSARY.html.attrs) || {};
const CSS_PROPS = (GLOSSARY.css && GLOSSARY.css.props) || {};
const CSS_VALUES = (GLOSSARY.css && GLOSSARY.css.values) || {};
const CSS_COLORS = (GLOSSARY.css && GLOSSARY.css.colors) || {};

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function htmlTagDesc(tag) {
  const t = String(tag).toLowerCase();
  return HTML_TAGS[t] ? `HTML 元素 ${t}（${HTML_TAGS[t]}）` : `HTML 元素 ${t}`;
}

function translateCssValue(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  const low = v.toLowerCase();
  if (CSS_COLORS[low]) return CSS_COLORS[low];
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^-?[\d.]+(px|rem|em|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|ex|pt)?$/i.test(v)) return v;
  const words = v.split(/\s+/);
  return words.map((w) => {
    const wl = w.toLowerCase();
    if (CSS_COLORS[wl]) return CSS_COLORS[wl];
    if (CSS_VALUES[wl]) return `${w}（${CSS_VALUES[wl]}）`;
    return w;
  }).join(' ');
}

function translateInlineStyle(value) {
  return String(value)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const m = decl.match(/^([-\w]+)\s*:\s*(.+)$/);
      if (!m) return decl;
      const propZh = CSS_PROPS[m[1].toLowerCase()] || m[1];
      return `${propZh}：${translateCssValue(m[2].replace(/!important$/i, '').trim())}`;
    })
    .join('；');
}

function translateHtmlAttrs(attrText) {
  const src = String(attrText || '').trim();
  if (!src) return '';
  const parts = [];
  const re = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (!name || name === '/') continue;
    const raw = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
    const attrZh = HTML_ATTRS[name] ||
      (name.startsWith('on') ? `事件处理（${name}）` :
        name.startsWith('data-') ? '自定义数据属性' :
          name.startsWith('aria-') ? '无障碍属性' : name);
    if (raw === undefined || raw === '') {
      parts.push(`属性 ${attrZh}`);
    } else if (name === 'style') {
      parts.push(`内联样式：${translateInlineStyle(raw)}`);
    } else if (name.startsWith('on')) {
      parts.push(`事件 ${attrZh} 执行：${glossExpression(raw)}`);
    } else {
      parts.push(`属性 ${attrZh} 为 ${raw}`);
    }
  }
  return parts.length ? `，${parts.join('、')}` : '';
}

function translateHtml(line) {
  const t = String(line).trim();
  if (!t) return null;
  if (/^<!--/.test(t)) return null;
  if (/^<!doctype\s+html\s*>/i.test(t)) return '文档类型声明：HTML5';
  if (/^<!doctype/i.test(t)) return '文档类型声明';

  let m = t.match(/^<\/([a-zA-Z][\w-]*)\s*>$/);
  if (m) {
    const tag = m[1].toLowerCase();
    const name = HTML_TAGS[tag] ? `${tag}（${HTML_TAGS[tag]}）` : tag;
    return `结束 ${name}元素`;
  }

  // 同一行完成开闭：<p>内容</p>
  m = t.match(/^<([a-zA-Z][\w-]*)([^>]*)>([^<]+)<\/\1>$/);
  if (m) {
    return `${htmlTagDesc(m[1])}${translateHtmlAttrs(m[2])}，内容：${m[3].trim()}`;
  }

  // 开标签 / 自闭合标签
  m = t.match(/^<([a-zA-Z][\w-]*)([^>]*?)\s*\/?>$/);
  if (m) {
    const tag = m[1].toLowerCase();
    const selfClose = /\/>$/.test(t) || VOID_TAGS.has(tag);
    const tail = selfClose ? '（自闭合元素）' : '';
    return `${htmlTagDesc(tag)}${tail}${translateHtmlAttrs(m[2])}`;
  }
  return null;
}

// ------------------------------------------------------------------ CSS

function translateSimpleSelector(sel) {
  let s = String(sel).trim();
  if (!s) return '';
  if (s === '*') return '所有元素';

  s = s.replace(/:hover/gi, '（鼠标悬停时）')
    .replace(/:focus/gi, '（获得焦点时）')
    .replace(/:active/gi, '（按下时）')
    .replace(/:visited/gi, '（访问过后）')
    .replace(/:first-child/gi, '（第一个子元素）')
    .replace(/:last-child/gi, '（最后一个子元素）')
    .replace(/:nth-child\(([^)]*)\)/gi, '（第 $1 个子元素）')
    .replace(/:not\(([^)]*)\)/gi, '（排除 $1）')
    .replace(/::before/gi, '（前置伪元素）')
    .replace(/::after/gi, '（后置伪元素）')
    .replace(/::placeholder/gi, '（占位文本样式）');

  s = s.replace(/\[([\w-]+)(?:\s*=\s*["']?([^"'\]]*)["']?)?\]/g, (all, name, val) => {
    const zh = HTML_ATTRS[String(name).toLowerCase()] || name;
    return val ? `（${zh} 为 ${val}）` : `（含 ${zh} 属性）`;
  });

  // 先保护 class / id 名称，避免被当作标签翻译
  const parts = [];
  s = s.replace(/([.#])([\w-]+)/g, (all, sig, name) => {
    parts.push({ sig, name });
    return `${sig}@@${parts.length - 1}@@`;
  });

  s = s.replace(/\b([a-zA-Z][\w-]*)\b/g, (tag) => {
    const low = tag.toLowerCase();
    return HTML_TAGS[low] ? HTML_TAGS[low] : tag;
  });

  s = s.replace(/([.#])@@(\d+)@@/g, (all, sig, idx, offset, whole) => {
    const p = parts[Number(idx)];
    const zh = sig === '.' ? `类名为 ${p.name} 的元素` : `id 为 ${p.name} 的元素`;
    const prev = offset > 0 ? whole[offset - 1] : '';
    return prev && prev !== ' ' ? ` ${zh}` : zh;
  });

  return s.replace(/\s+/g, ' ').trim();
}

function translateSelector(selector) {
  return String(selector)
    .split(',')
    .map((one) => {
      const tokens = one
        .replace(/\s*>\s*/g, ' > ')
        .replace(/\s*\+\s*/g, ' + ')
        .replace(/\s*~\s*/g, ' ~ ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ');
      let out = '';
      for (const tok of tokens) {
        if (tok === '>') out += ' 的直接子元素 ';
        else if (tok === '+') out += ' 的相邻兄弟 ';
        else if (tok === '~') out += ' 的兄弟 ';
        else out += (out ? ' 内部的 ' : '') + translateSimpleSelector(tok);
      }
      return out.trim();
    })
    .join('、');
}

function translateCss(line) {
  const t = String(line).trim();
  if (!t) return null;
  if (/^\/\*|^\*|^\/\//.test(t)) return null;
  if (t === '}' || t === '};') return '样式块结束';

  let m = t.match(/^@media\s+([^{]+?)\s*\{?\s*$/i);
  if (m) {
    const cond = m[1].replace(/([-\w]+)\s*:\s*([^)]+)/g, (all, prop, val) => {
      const propZh = CSS_PROPS[prop.toLowerCase()] || prop;
      return `${propZh} ${translateCssValue(val)}`;
    });
    return `媒体查询：${cond.trim()}，满足条件时应用以下样式`;
  }
  m = t.match(/^@keyframes\s+([\w-]+)\s*\{?\s*$/i);
  if (m) return `定义动画 ${m[1]} 的关键帧`;
  m = t.match(/^@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*;?/i);
  if (m) return `导入外部样式表 ${m[1]}`;
  if (/^@font-face\s*\{?\s*$/i.test(t)) return '定义自定义字体';
  if (/^@charset\b/i.test(t)) return '声明字符集';
  if (/^@supports\b/i.test(t)) return '特性支持检测：满足条件时应用以下样式';

  m = t.match(/^(.+?)\s*\{\s*$/);
  if (m) return `选择器「${translateSelector(m[1])}」的样式块`;

  m = t.match(/^([-\w]+)\s*:\s*([^;]+?)\s*;?\s*$/);
  if (m) {
    const prop = m[1].toLowerCase();
    const propZh = CSS_PROPS[prop] || prop;
    return `${propZh}：${translateCssValue(m[2])}`;
  }
  return null;
}

// ---------------------------------------------------- HTML 内嵌 JS / CSS 上下文

function contextLanguages(lines, languageId) {
  const lang = String(languageId || '').toLowerCase();
  const isWeb = ['html', 'htm', 'vue', 'svelte', 'php', 'ejs', 'handlebars'].includes(lang);
  if (!isWeb) return lines.map(() => lang);
  const out = [];
  let state = 'html';
  for (const line of lines) {
    const lower = String(line).toLowerCase();
    if (state === 'html') {
      if (/<script\b/.test(lower)) {
        out.push('html');
        if (!/<\/script>/.test(lower)) state = 'javascript';
        continue;
      }
      if (/<style\b/.test(lower)) {
        out.push('html');
        if (!/<\/style>/.test(lower)) state = 'css';
        continue;
      }
      out.push('html');
    } else if (state === 'javascript') {
      if (/<\/script>/.test(lower)) {
        out.push('html');
        state = 'html';
      } else {
        out.push('javascript');
      }
    } else {
      if (/<\/style>/.test(lower)) {
        out.push('html');
        state = 'html';
      } else {
        out.push('css');
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ 入口

const SQL_LANGS = new Set(['sql', 'mysql', 'pgsql', 'sqlite', 'plsql', 'tsql']);
const PY_LANGS = new Set(['python']);
const C_LANGS = new Set([
  'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'java',
  'c', 'cpp', 'csharp', 'go', 'rust', 'kotlin', 'swift', 'php', 'scala', 'dart'
]);
const HTML_LANGS = new Set(['html', 'htm', 'vue', 'svelte', 'php', 'ejs', 'handlebars', 'xml', 'svg']);
const CSS_LANGS = new Set(['css', 'scss', 'less', 'sass', 'stylus', 'styl']);

/**
 * 翻译一行代码。
 * @param {string} line
 * @param {string} languageId
 * @returns {string|null} 中文说明；无需翻译时返回 null
 */
function translateLine(line, languageId) {
  const lang = String(languageId || '').toLowerCase();
  if (!line || !String(line).trim()) return null;
  if (SQL_LANGS.has(lang)) return translateSql(line);
  if (PY_LANGS.has(lang)) return translatePython(line);
  if (CSS_LANGS.has(lang)) return translateCss(line);
  if (HTML_LANGS.has(lang)) return translateHtml(line);
  if (C_LANGS.has(lang)) return translateCLike(line);
  return translateSql(line) || translatePython(line) || translateCLike(line);
}

/**
 * 翻译多行文本（不会自动识别 HTML 内嵌 JS/CSS）。
 * @returns {Array<{line:string, indent:string, zh:string|null}>}
 */
function translateText(text, languageId) {
  const raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n');
  return raw.map((line) => ({
    line,
    indent: (line.match(/^\s*/) || [''])[0],
    zh: translateLine(line, languageId)
  }));
}

/**
 * 翻译整段文档：自动识别 HTML 中的 <script> / <style> 区域。
 * @returns {Array<{line:string, indent:string, zh:string|null, lang:string, style:{prefix:string,suffix:string}}>}
 */
function translateDocument(text, languageId) {
  const lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n');
  const ctx = contextLanguages(lines, languageId);
  return lines.map((line, i) => {
    const lang = ctx[i] || String(languageId || '').toLowerCase();
    return {
      line,
      indent: (line.match(/^\s*/) || [''])[0],
      zh: translateLine(line, lang),
      lang,
      style: commentStyle(lang)
    };
  });
}

module.exports = {
  MARKER,
  commentPrefix,
  commentStyle,
  contextLanguages,
  translateLine,
  translateText,
  translateDocument,
  glossIdentifier,
  glossExpression,
  translateCondition,
  hasCJK
};
