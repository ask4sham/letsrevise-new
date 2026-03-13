# Kill all Node processes, then start the backend fresh
Write-Host "Stopping all Node processes..."
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Starting backend..."
Set-Location $PSScriptRoot
node server.js
