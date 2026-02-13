# Phase 7 — Step 4 verify (positive allowlist + rollout included => COMPLETED)
# PowerShell 5.1-safe, cleans port 3100, uses stub server, validates result + telemetry schemas.

$ErrorActionPreference = "Stop"

# 0) Repo root
Set-Location "C:\Users\ask4s\OneDrive\Desktop\letsrevise-new"

# 1) Free port 3100 (avoid EADDRINUSE)
$stubPort = 3100
try {
  $pids = @()

  # Prefer Get-NetTCPConnection if available
  $conns = Get-NetTCPConnection -LocalPort $stubPort -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    $pids += $conns | Select-Object -ExpandProperty OwningProcess
  } else {
    # Fallback: netstat parse
    $lines = netstat -aon | Select-String "[:]\b$stubPort\b" | Select-String "LISTENING"
    foreach ($l in $lines) {
      $parts = ($l.ToString() -split "\s+") | Where-Object { $_ -ne "" }
      if ($parts.Count -ge 5) { $pids += $parts[-1] }
    }
  }

  $pids = $pids | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique
  foreach ($pid in $pids) {
    try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch {}
    try { taskkill /PID $pid /F *> $null } catch {}
  }

  Start-Sleep -Milliseconds 500
} catch {
  # best-effort; don't fail if cmdlets are missing
}

# 2) Write a temp allowlist that MATCHES our job (schema-correct keys)
$tmpAllowlistPath = Join-Path $env:TEMP "slotgen-allowlist-phase7-step4.json"
$allowlist = @{
  version = "allowlist.v1"
  enabled = $true
  mode    = "deny_by_default"
  rules   = @(
    @{
      id            = "phase7-step4-allow"
      enabled       = $true
      appliesTo     = @{
        subject      = @("Biology")
        level        = @("GCSE")
        board        = @("AQA")
        specVersion  = @("v1")
      }
      kinds         = @("explanatory")
      slotIds       = @("S1")
      maxJobsPerRun = 10
    }
  )
}

# Write UTF-8 WITHOUT BOM (PowerShell 5.1 safe)
[System.IO.File]::WriteAllText(
  $tmpAllowlistPath,
  ($allowlist | ConvertTo-Json -Depth 20),
  (New-Object System.Text.UTF8Encoding($false))
)

# 3) Start the stub OpenAI server (returns JSON-only assistant content)
$serverPath = "scripts/stub-openai-server.js"
$server = Start-Process -FilePath "node" -ArgumentList $serverPath -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 500

try {
  # 4) Prepare a schema-valid job that should be allowlisted
  $job = @{
    version   = "v1"
    appliesTo = @{
      subject     = "Biology"
      level       = "GCSE"
      board       = "AQA"
      specVersion = "v1"
    }
    jobs = @(
      @{
        jobId   = "J1"
        slotId  = "S1"
        kind    = "explanatory"
        mode    = "generate"
        input   = @{}
        output  = @{ field = "content"; type = "text" }
        sources = @()
        required = $true
      }
    )
    metadata = @{
      requiresReview = $false
      allowAI        = $true
    }
  }

  $jobJson = ($job | ConvertTo-Json -Depth 20)

  # 5) Run executor with: feature on, kill-switch off, allowlist path override,
  #    rollout=100 to force inclusion, and base URL to stub server.
  $jobPath = Join-Path $env:TEMP "slotgen-step4-job.json"
  $outPath = Join-Path $env:TEMP "slotgen-step4-stdout.json"
  $errPath = Join-Path $env:TEMP "slotgen-step4-stderr.log"

  [System.IO.File]::WriteAllText($jobPath, $jobJson, (New-Object System.Text.UTF8Encoding($false)))

  $env:FEATURE_SLOTGEN_AI = "true"
  $env:SLOTGEN_AI_KILL = "false"
  $env:SLOTGEN_ALLOWLIST_PATH = $tmpAllowlistPath
  $env:SLOTGEN_AI_ROLLOUT_PERCENT = "100"
  $env:OPENAI_API_KEY = "test-key"
  $env:OPENAI_BASE_URL = "http://127.0.0.1:3100"

  # Use cmd redirection so PowerShell doesn't treat stderr as terminating error; pipe job via file (echo + multi-line JSON breaks on Windows)
  cmd /c "type `"$jobPath`" | node scripts/run-slot-generation-openai.js > `"$outPath`" 2> `"$errPath`""
  try { Remove-Item $jobPath -Force -ErrorAction SilentlyContinue } catch {}

  # 6) Assert we got COMPLETED
  $outText = Get-Content $outPath -Raw
  if (-not $outText) { throw "No stdout JSON produced (expected COMPLETED result JSON)." }

  # 7) Validate result schema (expects file path)
  node scripts/validate-json.js $outPath docs/curriculum/engine/slot-generation-result.v1.schema.json | Out-Null

  if ($outText -notmatch '"status"\s*:\s*"COMPLETED"') {
    throw "Executor did not return COMPLETED. Stdout was:`n$outText"
  }

  # 8) Extract telemetry = last JSON-looking line from stderr, validate schema
  $errLines = Get-Content $errPath
  $telemetry = ($errLines | Where-Object { $_.TrimStart().StartsWith("{") -and $_.TrimEnd().EndsWith("}") } | Select-Object -Last 1)
  if (-not $telemetry) {
    throw "No telemetry JSON line found in stderr log."
  }

  # Write telemetry to temp file (validate-json.js wants a file path)
  $telemetryPath = Join-Path $env:TEMP "slotgen-step4-telemetry.json"
  [System.IO.File]::WriteAllText($telemetryPath, $telemetry, (New-Object System.Text.UTF8Encoding($false)))

  node scripts/validate-json.js $telemetryPath docs/curriculum/engine/slot-generation-telemetry.v1.schema.json | Out-Null

  if ($telemetry -notmatch '"path"\s*:\s*"openai"') {
    throw "Telemetry path was not openai. Telemetry was:`n$telemetry"
  }
  if ($telemetry -notmatch '"status"\s*:\s*"COMPLETED"') {
    throw "Telemetry status was not COMPLETED. Telemetry was:`n$telemetry"
  }

  Write-Host "✅ VALID (result schema)"
  Write-Host "✅ VALID (telemetry schema)"
  Write-Host "OK: Phase 7 Step 4 passed (COMPLETED via stubbed OpenAI, allowlist+rollout included)."
}
finally {
  # Cleanup: server + temp files
  try { if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force } } catch {}
  try { Remove-Item $tmpAllowlistPath -Force -ErrorAction SilentlyContinue } catch {}
}
