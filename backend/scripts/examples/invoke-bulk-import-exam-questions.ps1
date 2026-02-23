# PR-BULK-INGEST-2: Example PowerShell call to POST /api/admin/bulk-import/exam-questions
# Run with backend server up (e.g. npm run dev). Default: dryRun = true.
# Usage: .\scripts\examples\invoke-bulk-import-exam-questions.ps1

$body = @{
  specKey = "aqa-gcse-biology"
  dryRun  = $true
  items   = @(
    @{
      topicKey   = "cell-structure"
      question   = "Explain one function of the nucleus."
      markScheme = "Award 1 mark for stating it controls cell activities; accept references to genetic information."
      marks      = 2
      source     = "original"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/admin/bulk-import/exam-questions" -Method POST -ContentType "application/json" -Body $body
