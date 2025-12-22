# Check OpenAI account
$keysPath = "src\core\ai-integration\config\api-keys.json"
$keys = Get-Content $keysPath | ConvertFrom-Json
$openaiKey = $keys.openai.Trim()

Write-Host "🔍 Checking OpenAI Account Status" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Key type: $($openaiKey.Substring(0, [Math]::Min($openaiKey.Length, 10)))..." -ForegroundColor Gray

# Note: sk-proj- keys are for ChatGPT Plus/Team, not API
if ($openaiKey -match "^sk-proj-") {
    Write-Host "⚠️ WARNING: This appears to be a ChatGPT Plus/Team key" -ForegroundColor Yellow
    Write-Host "   You may need a regular API key from:" -ForegroundColor Yellow
    Write-Host "   https://platform.openai.com/api-keys" -ForegroundColor Cyan
}

# Try to get usage (this requires a valid API key)
try {
    $headers = @{"Authorization" = "Bearer $openaiKey"}
    $usage = Invoke-RestMethod -Uri "https://api.openai.com/v1/usage" `
                               -Method Get `
                               -Headers $headers `
                               -TimeoutSec 30
    
    Write-Host "✅ Account is active!" -ForegroundColor Green
    Write-Host "Usage data available" -ForegroundColor Gray
    
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "❌ Invalid API key" -ForegroundColor Red
        Write-Host "Get a new key from: https://platform.openai.com/api-keys" -ForegroundColor Cyan
    } elseif ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "⚠️ This endpoint requires different permissions" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ Could not check account: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. If key is invalid, get a new one: https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host "2. Check billing: https://platform.openai.com/account/billing/overview" -ForegroundColor Gray
Write-Host "3. Test with $5 credit first" -ForegroundColor Gray
