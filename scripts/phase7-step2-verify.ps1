# Phase 7 Step 2: Prove enabled OpenAI path works via local stub server (no real network).
# Requires: correct allowlist shape, file-path validation, BOM-free files, stub server ready before executor.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$allowlistPath = Join-Path $env:TEMP "slotgen-allowlist-enabled.json"
$jobPath       = Join-Path $env:TEMP "slotgen-job.json"
$outPath       = Join-Path $env:TEMP "slotgen-openai-stdout.json"
$errPath       = Join-Path $env:TEMP "slotgen-openai-stderr.log"
$telePath      = Join-Path $env:TEMP "slotgen-openai-telemetry.json"

# 1) ENABLED allowlist (UTF-8 no BOM) — singular appliesTo keys accepted by executor
$allowlistJson = @'
{
  "version": "allowlist.v1",
  "enabled": true,
  "mode": "deny_by_default",
  "rules": [
    {
      "id": "local-openai-stub-smoke",
      "enabled": true,
      "appliesTo": { "subject": ["Biology"], "level": ["GCSE"], "board": ["AQA"], "specVersion": ["v1"] },
      "kinds": ["explanatory"],
      "slotIds": [],
      "maxJobsPerRun": 10
    }
  ]
}
'@
[System.IO.File]::WriteAllText($allowlistPath, $allowlistJson, (New-Object System.Text.UTF8Encoding($false)))

# 2) Schema-valid job with metadata.allowAI=true
$jobJson = @'
{
  "version": "v1",
  "appliesTo": { "subject": "Biology", "level": "GCSE", "board": "AQA", "specVersion": "v1" },
  "jobs": [
    {
      "jobId": "J1",
      "slotId": "S1",
      "kind": "explanatory",
      "mode": "generate",
      "input": {},
      "output": { "field": "content", "type": "text" },
      "sources": [],
      "required": true
    }
  ],
  "metadata": { "requiresReview": false, "allowAI": true }
}
'@
[System.IO.File]::WriteAllText($jobPath, $jobJson, (New-Object System.Text.UTF8Encoding($false)))

# 2b) Free port 3100 so the stub server can bind (avoid EADDRINUSE from previous runs)
$stubPort = 3100
try {
  $conn = Get-NetTCPConnection -LocalPort $stubPort -ErrorAction SilentlyContinue
  if ($conn) {
    $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
  }
} catch {
  # Ignore if Get-NetTCPConnection not available or port free
}

# 3) Start stub server (OpenAI-style /chat/completions)
$env:SLOTGEN_STUB_PORT = "3100"
$server = Start-Process -PassThru -NoNewWindow -FilePath "node" -ArgumentList "scripts/stub-openai-server.js" -WorkingDirectory (Get-Location).Path

# 4) Wait for stub server to be reachable (avoid "fetch failed")
Start-Sleep -Seconds 1
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect("127.0.0.1", 3100)
    $client.Close()
    break
  } catch {
    $attempt++
    if ($attempt -ge $maxAttempts) {
      try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}
      throw "Stub server did not become reachable on 127.0.0.1:3100 after $maxAttempts attempts."
    }
  }
  Start-Sleep -Milliseconds 200
}

# 5) Run enabled OpenAI path (FEATURE on, rollout 100, allowlist match, kill-switch OFF)
$env:FEATURE_SLOTGEN_AI = "true"
$env:SLOTGEN_AI_ROLLOUT_PERCENT = "100"
$env:SLOTGEN_AI_KILL = "false"
$env:SLOTGEN_ALLOWLIST_PATH = $allowlistPath
$env:OPENAI_API_KEY = "test-key"
$env:OPENAI_BASE_URL = "http://127.0.0.1:3100"

cmd /c "type `"$jobPath`" | node scripts/run-slot-generation-openai.js > `"$outPath`" 2> `"$errPath`""
if ($LASTEXITCODE -ne 0) { throw "Executor exited with code $LASTEXITCODE" }

# 6) Validate result schema (file path)
node scripts/validate-json.js $outPath docs/curriculum/engine/slot-generation-result.v1.schema.json
if ($LASTEXITCODE -ne 0) { throw "Result schema validation failed" }

# 7) Last stderr line = telemetry JSON; validate via temp file
$telemetryLine = (Get-Content $errPath | Select-Object -Last 1)
[System.IO.File]::WriteAllText($telePath, $telemetryLine, (New-Object System.Text.UTF8Encoding($false)))
node scripts/validate-json.js $telePath docs/curriculum/engine/slot-generation-telemetry.v1.schema.json
if ($LASTEXITCODE -ne 0) { throw "Telemetry schema validation failed" }

# 8) Assert COMPLETED and path=openai
$outContent = Get-Content $outPath -Raw
$errContent = Get-Content $errPath -Raw
if ($outContent -notmatch '"status"\s*:\s*"COMPLETED"') { throw "Expected status COMPLETED in stdout" }
if ($errContent -notmatch '"path"\s*:\s*"openai"') { throw "Expected path openai in telemetry" }

# 9) Cleanup
try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}

Write-Host "OK: Phase 7 Step 2 passed (COMPLETED via stubbed OpenAI, schemas valid, telemetry path=openai)."
