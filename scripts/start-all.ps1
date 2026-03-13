$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$dockerFile = Join-Path $repo "docker\\docker-compose.yml"

if (-not $env:BACKUP_DIR) { $env:BACKUP_DIR = "/backups" }
if (-not $env:BACKUP_KEEP_DAYS) { $env:BACKUP_KEEP_DAYS = "7" }

Write-Host "Starting database services..." -ForegroundColor Cyan
docker compose -f $dockerFile up -d

Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan
Set-Location $repo
npm run dev
