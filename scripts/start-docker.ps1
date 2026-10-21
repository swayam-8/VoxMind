# VoxMind — Docker Compose Orchestration Startup (PowerShell)
param (
    [switch]$Build,
    [switch]$Down
)

$ErrorActionPreference = "Stop"

if ($Down) {
    Write-Host "[VoxMind] Stopping and removing containers..." -ForegroundColor Yellow
    docker compose down
    exit 0
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  VoxMind — Local-First Voice Intelligence Platform" -ForegroundColor Cyan
Write-Host "  Starting Containerized Services..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if .env exists, if not copy from .env.example
if (-not (Test-Path ".env")) {
    Write-Host "[VoxMind] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

$cmd = "docker compose up -d"
if ($Build) {
    $cmd = "docker compose up -d --build"
}

Write-Host "[VoxMind] Executing: $cmd" -ForegroundColor Green
Invoke-Expression $cmd

Write-Host "[VoxMind] Waiting for services to become healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
docker compose ps
Write-Host "`n[VoxMind] Application URLs:" -ForegroundColor Green
Write-Host "  * Frontend UI:   http://localhost:5173" -ForegroundColor White
Write-Host "  * REST API:      http://localhost:5000/api/v1" -ForegroundColor White
Write-Host "  * AI Service:    http://localhost:8000" -ForegroundColor White
Write-Host "  * Health Check:  http://localhost:5000/health" -ForegroundColor White
