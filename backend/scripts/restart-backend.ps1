# Restart backend - kills process on port 5000
# Then run manually in a NEW terminal: cd backend && npm start
#
# Run: powershell -ExecutionPolicy Bypass -File backend\scripts\restart-backend.ps1

$port = 5000
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $pid = $conn.OwningProcess
  Write-Host "Stopping backend (PID $pid) on port $port..."
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Write-Host "Done. Now run in a NEW terminal: cd backend && npm start"
} else {
  Write-Host "No process on port $port. Start backend with: cd backend && npm start"
}
