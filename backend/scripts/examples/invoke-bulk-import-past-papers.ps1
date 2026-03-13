# PR-BULK-INGEST-4: Bulk import past papers (DRY RUN by default)
# Prereq: backend running (npm run dev), get a JWT token via login

$baseUrl = "http://localhost:3000"
$token = "YOUR_JWT_HERE"

$body = @{
  specKey = "aqa-gcse-biology"
  dryRun  = $true
  items   = @(
    @{
      examBoard = "AQA"
      level     = "GCSE"
      year      = "2024"
      series    = "June"
      paperCode = "Paper 1"
      tier      = "higher"
      title     = "AQA GCSE Biology June 2024 Paper 1 (Higher)"
      pdf       = @{
        mediaId  = $null
        url      = $null
        mimeType = "application/pdf"
      }
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$baseUrl/api/admin/bulk-import/past-papers" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
