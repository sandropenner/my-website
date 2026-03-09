$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
  param([string]$Message)
  $script:failures.Add($Message)
}

function Assert-FileExists {
  param([string]$RelativePath)
  $path = Join-Path $repoRoot $RelativePath
  if (-not (Test-Path $path -PathType Leaf)) {
    Add-Failure "Missing required file: $RelativePath"
  }
}

function Get-ContentRaw {
  param([string]$RelativePath)
  $path = Join-Path $repoRoot $RelativePath
  if (-not (Test-Path $path -PathType Leaf)) {
    Add-Failure "Cannot read missing file: $RelativePath"
    return ""
  }
  return Get-Content -Path $path -Raw
}

function Assert-Contains {
  param(
    [string]$RelativePath,
    [string]$Pattern,
    [string]$Message
  )
  $content = Get-ContentRaw $RelativePath
  if (-not ($content -match $Pattern)) {
    Add-Failure "${RelativePath}: $Message"
  }
}

function Assert-NotContains {
  param(
    [string]$RelativePath,
    [string]$Pattern,
    [string]$Message
  )
  $content = Get-ContentRaw $RelativePath
  if ($content -match $Pattern) {
    Add-Failure "${RelativePath}: $Message"
  }
}

$requiredFiles = @(
  "index.html",
  "projects/index.html",
  "contact/index.html",
  "snek/index.html",
  "contact.html",
  "projects.html",
  "snek.html",
  "css/base.css",
  "css/site.css",
  "css/snek.css",
  "js/core.js",
  "js/starfield.js",
  "js/rotating-text.js",
  "js/snek.js"
)

foreach ($file in $requiredFiles) {
  Assert-FileExists $file
}

$sharedPages = @("index.html", "projects/index.html", "contact/index.html")
foreach ($page in $sharedPages) {
  Assert-Contains $page '<link rel="stylesheet" href="/css/base\.css">' "missing base.css include"
  Assert-Contains $page '<link rel="stylesheet" href="/css/site\.css">' "missing site.css include"
  Assert-Contains $page '<script src="/js/starfield\.js" defer></script>' "missing starfield.js include"
  Assert-Contains $page '<script src="/js/rotating-text\.js" defer></script>' "missing rotating-text.js include"
  Assert-Contains $page '<script src="/js/core\.js" defer></script>' "missing core.js include"
  Assert-NotContains $page '<script src="/js/snek\.js" defer></script>' "should not include snek.js"
}

Assert-Contains "snek/index.html" '<link rel="stylesheet" href="/css/base\.css">' "missing base.css include"
Assert-Contains "snek/index.html" '<link rel="stylesheet" href="/css/site\.css">' "missing site.css include"
Assert-Contains "snek/index.html" '<link rel="stylesheet" href="/css/snek\.css">' "missing snek.css include"
Assert-Contains "snek/index.html" '<script src="/js/starfield\.js" defer></script>' "missing starfield.js include"
Assert-Contains "snek/index.html" '<script src="/js/rotating-text\.js" defer></script>' "missing rotating-text.js include"
Assert-Contains "snek/index.html" '<script src="/js/snek\.js" defer></script>' "missing snek.js include"
Assert-Contains "snek/index.html" '<script src="/js/core\.js" defer></script>' "missing core.js include"

Assert-Contains "contact.html" 'url=/contact/' "redirect target should be /contact/"
Assert-Contains "contact.html" 'location\.replace\("/contact/"\);' "redirect script should target /contact/"
Assert-Contains "projects.html" 'url=/projects/' "redirect target should be /projects/"
Assert-Contains "projects.html" 'location\.replace\("/projects/"\);' "redirect script should target /projects/"
Assert-Contains "snek.html" 'url=/snek/' "redirect target should be /snek/"
Assert-Contains "snek.html" 'location\.replace\("/snek/"\);' "redirect script should target /snek/"

if ($failures.Count -gt 0) {
  Write-Host "Smoke check failed:"
  foreach ($failure in $failures) {
    Write-Host " - $failure"
  }
  exit 1
}

Write-Host "Smoke check passed."
