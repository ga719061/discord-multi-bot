Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $scriptDir

    $envFile = Join-Path $scriptDir 'BOT.env'
    if (-not (Test-Path $envFile)) {
        throw "Missing BOT.env at $envFile"
    }

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw 'Node.js is not installed or not available in PATH.'
    }

    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }

        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) {
            return
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1)
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }

    $env:PORT = '3001'

    Write-Host 'Starting Discord bot on PORT=3001...'
    & $nodeCommand.Source 'src/bot.js'
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Bot process exited with code $exitCode"
    }
}
catch {
    Write-Host ''
    Write-Host 'Launcher failed:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
