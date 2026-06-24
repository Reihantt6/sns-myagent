#!/usr/bin/env pwsh
# SNS MyAgent Installer (Windows PowerShell)
# Usage: irm raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
#
# Mirrors install.sh style on Windows. Uses Node.js (npm) as the default path
# because npm's `postinstall` script (scripts/fetch-binary.mjs) downloads the
# prebuilt `snscoder` binary. Bun path is offered as a fallback for users who
# already have it installed.

[CmdletBinding()]
param(
    [switch]$UseBun
)

$ErrorActionPreference = "Stop"

# --- Pretty logging (matches install.sh style) ------------------------------

function Write-Banner {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "     SNS MyAgent Installer (Windows)    " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function info($msg)  { Write-Host "[info]  $msg" -ForegroundColor Green }
function warn($msg)  { Write-Host "[warn]  $msg" -ForegroundColor Yellow }
function error_exit($msg) {
    Write-Host "[error] $msg" -ForegroundColor Red
    exit 1
}

# --- Helpers ----------------------------------------------------------------

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Get-NodeMajor {
    try {
        $v = (& node --version) 2>$null
        if ($v -match 'v(\d+)') { return [int]$Matches[1] }
    } catch {}
    return 0
}

function Get-BunVersion {
    try {
        $v = (& bun --version) 2>$null
        if ($v) { return $v.Trim() }
    } catch {}
    return $null
}

# --- Bun (optional, contributor path) ---------------------------------------

function Install-Bun {
    if (-not (Test-Command "bun")) {
        info "Bun not found. Installing via bun.sh installer..."
        try {
            irm bun.sh/install.ps1 | iex
        } catch {
            error_exit "Bun installation failed. Install manually: https://bun.sh"
        }
    }
    if (-not (Test-Command "bun")) {
        error_exit "Bun still not found on PATH after install. Open a fresh terminal and retry."
    }
    info "Bun $(& bun --version) ready."
}

# --- Node.js (required for npm path) ----------------------------------------

function Ensure-Node {
    if (-not (Test-Command "node")) {
        error_exit "Node.js not found. Install Node.js >= 18 from https://nodejs.org/ then retry."
    }
    if (-not (Test-Command "npm")) {
        error_exit "npm not found (it ships with Node.js). Install Node.js >= 18 from https://nodejs.org/ then retry."
    }
    $nodeMajor = Get-NodeMajor
    if ($nodeMajor -lt 18) {
        error_exit "Node.js v$nodeMajor found but >= 18 required. Update from https://nodejs.org/."
    }
    info "Node.js $(& node --version) + npm $(& npm --version) ready."
}

# --- snscoder install -------------------------------------------------------

function Install-WithNpm {
    info "Installing snscoder globally via npm (postinstall fetches the prebuilt binary)..."
    npm install -g @sns-myagent/cli
    if ($LASTEXITCODE -ne 0) {
        error_exit "npm install failed (exit $LASTEXITCODE). See messages above."
    }
}

function Install-WithBun {
    info "Installing snscoder globally via Bun..."
    bun add -g @sns-myagent/cli
    if ($LASTEXITCODE -ne 0) {
        error_exit "bun add -g failed (exit $LASTEXITCODE). See messages above."
    }
}

function Verify-Install {
    if (-not (Test-Command "snscoder")) {
        warn "snscoder command not found on PATH."
        warn "Open a NEW PowerShell window so PATH updates apply, then run 'snscoder --version'."
        return
    }
    try {
        $version = (& snscoder --version) 2>$null
        if ($LASTEXITCODE -eq 0) {
            info "snscoder $version installed."
        } else {
            warn "snscoder found but 'snscoder --version' exited $LASTEXITCODE. Try a fresh terminal."
        }
    } catch {
        warn "snscoder --version failed: $_"
    }
}

# --- Main -------------------------------------------------------------------

try {
    Write-Banner

    if ($UseBun) {
        Install-Bun
        Install-WithBun
        Verify-Install
    }
    else {
        # Default path: npm (Node.js). Bun is only needed if the user opts in
        # via -UseBun — keeping the installer lean for the common case.
        Ensure-Node
        Install-WithNpm
        Verify-Install
    }

    Write-Host ""
    info "Run 'snscoder' to start."
    info "If 'snscoder' is not recognized, open a NEW PowerShell window so the PATH update applies."
    Write-Host ""
}
catch {
    error_exit $_.Exception.Message
}
