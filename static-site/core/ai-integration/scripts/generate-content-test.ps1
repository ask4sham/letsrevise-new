param(
    [string]$Subject,
    [string]$Topic,
    [string]$Level = "gcse",
    [string]$Type = "revision_notes",
    [string]$ExamBoard = ""
)

# Load API keys
$apiKeysPath = Join-Path $PSScriptRoot "..\config\api-keys.json"
if (Test-Path $apiKeysPath) {
    $apiKeys = Get-Content $apiKeysPath | ConvertFrom-Json
    $openaiKey = $apiKeys.openai
    $anthropicKey = $apiKeys.anthropic
} else {
    Write-Host "ERROR: api-keys.json not found!" -ForegroundColor Red
    Write-Host "Please create src\core\ai-integration\config\api-keys.json" -ForegroundColor Yellow
    Write-Host "With format: {\"openai\": \"your-key\", \"anthropic\": \"your-key\"}" -ForegroundColor Yellow
    exit 1
}

# Check if keys are still placeholders
if ($openaiKey -match "your-actual" -or $anthropicKey -match "your-actual") {
    Write-Host "ERROR: Please replace placeholder API keys with actual keys!" -ForegroundColor Red
    Write-Host "Edit: src\core\ai-integration\config\api-keys.json" -ForegroundColor Yellow
    exit 1
}

# Load AI configuration
$aiConfigPath = Join-Path $PSScriptRoot "..\config\ai-config.json"
$aiConfig = Get-Content $aiConfigPath | ConvertFrom-Json

# Load prompt template
$promptPath = Join-Path $PSScriptRoot "..\prompts\revision-notes.txt"
$promptTemplate = Get-Content $promptPath -Raw

# Replace placeholders
$prompt = $promptTemplate -replace "{subject}", $Subject
$prompt = $prompt -replace "{topic}", $Topic
$prompt = $prompt -replace "{level}", $Level
$prompt = $prompt -replace "{exam_board}", $ExamBoard

Write-Host "Generating $Type for:" -ForegroundColor Cyan
Write-Host "  Subject: $Subject" -ForegroundColor White
Write-Host "  Topic: $Topic" -ForegroundColor White
Write-Host "  Level: $Level" -ForegroundColor White
if ($ExamBoard) { Write-Host "  Exam Board: $ExamBoard" -ForegroundColor White }

# Here's where you would make the actual API call
Write-Host "`nAPI Keys detected:" -ForegroundColor Green
Write-Host "  OpenAI: $($openaiKey.Substring(0, 10))..." -ForegroundColor Gray
Write-Host "  Anthropic: $($anthropicKey.Substring(0, 10))..." -ForegroundColor Gray

# Example API call (uncomment and modify when ready)
# $headers = @{
#     "Authorization" = "Bearer $openaiKey"
#     "Content-Type" = "application/json"
# }
# 
# $body = @{
#     model = "gpt-4"
#     messages = @(
#         @{role = "system"; content = "You are an expert educational content creator."}
#         @{role = "user"; content = $prompt}
#     )
#     temperature = 0.7
#     max_tokens = 2000
# } | ConvertTo-Json
# 
# try {
#     $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" `
#                                   -Method Post `
#                                   -Headers $headers `
#                                   -Body $body
#     
#     $content = $response.choices[0].message.content
#     
#     # Save the content
#     $outputPath = "src\content\$Level\$Subject\topics\$Topic"
#     New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
#     $content | Out-File -FilePath "$outputPath\revision-notes.md" -Encoding UTF8
#     
#     Write-Host "Content generated successfully!" -ForegroundColor Green
# } catch {
#     Write-Host "API Error: $_" -ForegroundColor Red
# }

# For now, create a placeholder
Write-Host "`nNOTE: API integration not yet implemented." -ForegroundColor Yellow
Write-Host "To implement:" -ForegroundColor Yellow
Write-Host "1. Uncomment the API call section in the script" -ForegroundColor Gray
Write-Host "2. Test with a small request first" -ForegroundColor Gray
Write-Host "3. Add error handling" -ForegroundColor Gray

# Create output directory structure
$outputPath = "src\content"
if ($Level -eq "a-level") { $outputPath = "$outputPath\a-level\$Subject\topics\$Topic" }
elseif ($Level -eq "gcse") { 
    if ($ExamBoard) { $outputPath = "$outputPath\gcse\$ExamBoard\$Subject\topics\$Topic" }
    else { $outputPath = "$outputPath\gcse\AQA\$Subject\topics\$Topic" }
}
elseif ($Level -eq "ks3") { $outputPath = "$outputPath\ks3\year7\$Subject\topics\$Topic" }
elseif ($Level -eq "ks2") { $outputPath = "$outputPath\ks2\year6\$Subject\topics\$Topic" }

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

# Create placeholder file
$placeholder = @"
# $Subject - $Topic
## Level: $Level
## Exam Board: $ExamBoard
## Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Prompt Used:
$prompt

## To generate actual AI content:
1. Uncomment the API call section in generate-content.ps1
2. Ensure your API keys are valid
3. Run the script again

## Suggested Structure:
1. Overview
2. Key Concepts
3. Examples
4. Practice Questions
5. Common Mistakes
"@

$placeholder | Out-File -FilePath "$outputPath\placeholder.md" -Encoding UTF8
Write-Host "`nPlaceholder created at: $outputPath\placeholder.md" -ForegroundColor Green
