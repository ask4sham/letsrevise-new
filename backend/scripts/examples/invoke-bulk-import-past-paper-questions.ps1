# PR-BULK-INGEST-4: Bulk import past paper questions (DRY RUN by default)
# Requires an existing pastPaperId (create via past-papers import first)

$baseUrl = "http://localhost:3000"
$token = "YOUR_JWT_HERE"

$body = @{
  specKey = "aqa-gcse-biology"
  dryRun  = $true
  items   = @(
    @{
      pastPaperId   = "PASTE_PAST_PAPER_ID_HERE"
      topicKey      = "cell-structure"
      questionNumber = "1(a)"
      marks         = 2
      question      = "Describe the function of the nucleus."
      markScheme    = "Award 1 mark for control of cell activities.`nAward 1 mark for contains genetic material."
      assets        = @(
        @{
          type   = "diagram"
          mediaId = $null
          url    = $null
          alt    = "Cell diagram"
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$baseUrl/api/admin/bulk-import/past-paper-questions" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
