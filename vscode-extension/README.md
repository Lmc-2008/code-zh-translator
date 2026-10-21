# 代码中文翻译（Code Chinese Translator）

> 给英文代码自动加上中文注释：HTML / CSS / JavaScript / TypeScript / SQL / Python / Java / C / C++ / Go / Rust 等。
> 完全离线，本地词库 + 规则模板，不联网、不上传代码。

## 功能

- **插入中文注释**：在每行代码的下一行插入一条 `-- 译文：…`（SQL）、`# 译文：…`（Python）、`// 译文：…`（JS/Java）、`<!-- 译文：… -->`（HTML）、`/* 译文：… */`（CSS）。
- **侧边预览**：右边打开对照面板，左边原文、右边中文，可一键插入 / 移除注释。
- **自动识别 HTML 内嵌代码**：`<script>` 里用 JS 注释、`<style>` 里用 CSS 注释，不会把 `<!-- -->` 塞进脚本里。
- **重复执行不叠加**：旧的「译文」行会被自动替换。
- **一键移除**：删掉所有由本扩展插入的注释。

## 快捷键

| 命令 | 快捷键 |
| --- | --- |
| 插入中文注释（下一行） | `Ctrl+Alt+T` |
| 侧边预览中文说明 | `Ctrl+Alt+P` |

也可以右键菜单，或在命令面板搜索「代码中文翻译」。

## 效果示例

SQL：

```sql
SELECT id, name FROM users WHERE age > 18 ORDER BY id DESC;
-- 译文：从「用户」中查询：编号、姓名；条件：年龄 大于 18；排序：编号 降序
```

HTML：

```html
<div class="container" id="app">
<!-- 译文：HTML 元素 div（区块容器），属性 类名 为 container、属性 标识 为 app -->
  <a href="/login" target="_blank">登录</a>
<!-- 译文：HTML 元素 a（超链接），属性 链接地址 为 /login、属性 打开方式 为 _blank，内容：登录 -->
</div>
```

CSS：

```css
.btn {
/* 译文：选择器「类名为 btn 的元素」的样式块 */
  display: flex;
/* 译文：显示方式：flex（弹性布局） */
  margin: 0 auto;
/* 译文：外边距：0 auto（自动） */
}
```

JavaScript：

```js
const add = (a, b) => a + b;
// 译文：定义箭头函数 add，参数：a、b，返回 a 加 b
document.querySelector(".btn").addEventListener("click", handle);
// 译文：为 查找页面元素：选择器「.btn」 添加事件监听：click
```

## 支持范围

| 语言 | 说明 |
| --- | --- |
| HTML / Vue / Svelte | 标签、属性、自闭合元素、内嵌 script/style 上下文 |
| CSS / SCSS / Less | 选择器、属性声明、媒体查询、关键帧、值翻译 |
| JavaScript / TypeScript | 变量、函数、箭头函数、DOM 查询、事件、数组方法、async/await |
| SQL | SELECT / INSERT / UPDATE / DELETE / JOIN / WHERE / GROUP BY / ORDER BY / LIMIT / 事务等 |
| Python | def / class / if / for / while / import / print / with / try-except |
| Java / C / C++ / C# / Go / Rust 等 | 函数、变量、条件、循环、调用 |

## 安装

### 方式一：VSIX（推荐，离线）

```bash
code --install-extension code-zh-translator-0.2.0.vsix
```

或在 VS Code 里：扩展面板右上角 `...` → **从 VSIX 安装**。

### 方式二：源码目录

把 `vscode-extension` 文件夹复制到 `%USERPROFILE%\.vscode\extensions\codezh.code-zh-translator-0.2.0`，重启 VS Code。

安装后按 `Ctrl+Shift+P` → `Reload Window` 重新加载。

## 设置

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `codeZhTranslator.marker` | `译文：` | 注释标记，用于识别和替换本扩展生成的行 |
| `codeZhTranslator.showStatusBar` | `true` | 状态栏是否显示「译」按钮 |

## 自定义词库

编辑扩展目录下的 `glossary.json`，可以补词、改译法（如把 `users` 改成「使用者」）。改完重新加载窗口生效。

- `keywords`：语句关键字
- `words`：标识符常用词
- `html.tags` / `html.attrs`：HTML 标签与属性
- `css.props` / `css.values` / `css.colors`：CSS 属性、取值、颜色

## 卸载

```bash
code --uninstall-extension codezh.code-zh-translator
```

## 说明

- 翻译是**词库 + 规则**的离线实现，帮助理解代码结构，不保证逐字精准；复杂表达式会保留原文。
- 代码不会离开本机，扩展不发起任何网络请求。

## License

MIT
