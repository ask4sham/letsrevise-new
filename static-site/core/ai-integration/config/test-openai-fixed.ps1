# Test OpenAI API with corrected keys
$projectRoot = "C:\Users\ask4s\OneDrive\Desktop\Letsrevise.com"
$keysPath = Join-Path $projectRoot "src\core\ai-integration\config\api-keys.json"

if (-not (Test-Path $keysPath)) {
    Write-Host "❌ Keys file not found!" -ForegroundColor Red
    exit 1
}

$keys = Get-Content $keysPath | ConvertFrom-Json
$openaiKey = $keys.openai.Trim()

Write-Host "🔑 Testing OpenAI Key..." -ForegroundColor Cyan
Write-Host "Key starts with: $($openaiKey.Substring(0, [Math]::Min($openaiKey.Length, 15)))..." -ForegroundColor Gray

# Make a simple API call
$headers = @{
    "Authorization" = "Bearer $openaiKey"
    "Content-Type" = "application/json"
}

$body = @{
    model = "gpt-3.5-turbo"
    messages = @(
        @{role = "user"; content = "Say 'Hello' in one word."}
    )
    max_tokens = 10
    temperature = 0.5
} | ConvertTo-Json

try {
    Write-Host "🌐 Calling OpenAI API..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" `
                                  -Method Post `
                                  -Headers $headers `
                                  -Body $body `
                                  -TimeoutSec 30
    
    Write-Host "✅ API Success!" -ForegroundColor Green
    Write-Host "Response: $($response.choices[0].message.content)" -ForegroundColor White
    
} catch {
    Write-Host "❌ API Error" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    
    # Get more error details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details: $errorBody" -ForegroundColor Red
    }
}
