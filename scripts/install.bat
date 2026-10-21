@echo off
chcp 65001 >nul
setlocal
set "VSIX=%~dp0code-zh-translator-0.2.0.vsix"

if not exist "%VSIX%" (
  echo [错误] 找不到安装包：%VSIX%
  pause
  exit /b 1
)

where code >nul 2>nul
if errorlevel 1 (
  echo 未找到 VS Code 的 code 命令。
  echo 请打开 VS Code，进入扩展面板，点击右上角 "..." 选择“从 VSIX 安装”，
  echo 然后选择：%VSIX%
  pause
  exit /b 1
)

echo 正在安装 代码中文翻译（Code Chinese Translator）...
code --install-extension "%VSIX%" --force
if errorlevel 1 (
  echo 安装失败，请改用 VS Code 扩展面板的“从 VSIX 安装”。
  pause
  exit /b 1
)

echo.
echo 安装完成！
echo 请在 VS Code 中按 Ctrl+Shift+P，执行 “Reload Window” 重新加载窗口。
echo 之后打开代码文件，按 Ctrl+Alt+T 插入中文注释，Ctrl+Alt+P 侧边预览。
pause
