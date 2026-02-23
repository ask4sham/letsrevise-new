# PR-BULK-INGEST-2: Example PowerShell call to POST /api/admin/bulk-import/exam-questions
# Run with backend server up (e.g. npm run dev). Default: dryRun = true.
# Usage: .\scripts\examples\invoke-bulk-import-exam-questions.ps1

$body = @{
  specKey = "aqa-gcse-biology"
  dryRun  = $true
  items   = @(
    @{
      topicKey = "cell-structure"
      question = "What is the nucleus?"
      answer   = "Controls the cell"
      marks    = 1
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/admin/bulk-import/exam-questions" -Method POST -ContentType "application/json" -Body $body
