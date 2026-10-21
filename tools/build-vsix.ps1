# 打包并安装 VS Code 扩展（读取 package.json 版本，生成 .vsix 后用 code CLI 安装）
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'vscode-extension'
$pkg = Get-Content (Join-Path $src 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $pkg.version
$stage = Join-Path $root 'build\vsix'
$out = Join-Path $root ('dist\code-zh-translator-' + $version + '.vsix')

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage 'extension') -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $out) -Force | Out-Null

Copy-Item (Join-Path $src '*') (Join-Path $stage 'extension') -Recurse -Force

$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
  <Default Extension=".xml" ContentType="text/xml"/>
  <Default Extension=".txt" ContentType="text/plain"/>
</Types>
'@
Set-Content -LiteralPath (Join-Path $stage '[Content_Types].xml') -Value $contentTypes -Encoding UTF8

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="code-zh-translator" Version="$version" Publisher="codezh" />
    <DisplayName>代码中文翻译</DisplayName>
    <Description xml:space="preserve">在代码的下一行插入中文注释，或侧边预览整段代码的中文说明（离线，支持 HTML / CSS / JS / SQL / Python 等）。</Description>
    <Tags>中文,翻译,注释,HTML,CSS,JavaScript,SQL,python</Tags>
    <Categories>Programming Languages,Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.70.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
"@
Set-Content -LiteralPath (Join-Path $stage 'extension.vsixmanifest') -Value $manifest -Encoding UTF8

if (Test-Path $out) { Remove-Item $out -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $out, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Write-Output "VSIX=$out"
Write-Output ("SIZE=" + (Get-Item $out).Length)

$codeCli = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'
& $codeCli --install-extension $out --force
Write-Output "EXIT=$LASTEXITCODE"
