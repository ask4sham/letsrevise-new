# LetsRevise Production Health Check
# Pings the backend /api/health endpoint and reports success/failure.

$url = "https://letsrevise-new.onrender.com/api/health"

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 60
    if ($response.StatusCode -eq 200) {
        Write-Host "SUCCESS: Backend is healthy (HTTP 200)" -ForegroundColor Green
        Write-Host $response.Content
        exit 0
    } else {
        Write-Host "FAILURE: Unexpected status $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "FAILURE: Could not reach backend" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
