# Compatibility wrapper; npm start is the recommended cross-platform command.
param ([switch]$Build, [switch]$Down)
$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "..")
try {
    if ($Down) { node scripts/start.mjs stop }
    else { node scripts/start.mjs }
    $result = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $result
