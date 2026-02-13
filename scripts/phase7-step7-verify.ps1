# Phase 7 — Step 7 verify (allowlist matches + rollout < 100, jobId outside bucket => STUB, ROLLOUT_EXCLUDED)
# Deterministic: same jobId always same outcome. No OpenAI call; stub server running but not used.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Stop-ListeningPort($port) {
  try {
    $pids = @()
    try {
      $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
      if ($conns) { $pids += $conns.OwningProcess }
    } catch {}

    if (-not $pids -or $pids.Count -eq 0) {
      $lines = netstat -aon | Select-String (":$port\s+LISTENING")
      foreach ($l in $lines) {
        $parts = ($l.ToString() -split "\s+")
        if ($parts.Length -ge 5) { $pids += $parts[-1] }
      }
    }

    $pids = $pids | Where-Object { $_ -match "^\d+$" } | Select-Object -Unique
    foreach ($pid in $pids) {
      try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch {}
      try { taskkill /PID $pid /F *> $null } catch {}
    }
    Start-Sleep -Milliseconds 500
  } catch {}
}

function Write-Utf8NoBom($path, $text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

$stubPort = 3100
Stop-ListeningPort $stubPort

$server = Start-Process -FilePath "node" -ArgumentList @("scripts/stub-openai-server.js") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $tnc = Test-NetConnection -ComputerName "127.0.0.1" -Port $stubPort -WarningAction SilentlyContinue
    if ($tnc.TcpTestSucceeded) { $ready = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $ready) {
  try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}
  throw "Stub server did not start listening on port $stubPort"
}

# Allowlist that MATCHES the job (Biology, GCSE, AQA, v1, explanatory)
$tmpAllowlistPath = Join-Path $env:TEMP "slotgen-allowlist-step7-7.json"
$allowlistJson = @"
{
  "version": "allowlist.v1",
  "enabled": true,
  "mode": "deny_by_default",
  "rules": [
    {
      "id": "step7-7-allow",
      "enabled": true,
      "appliesTo": {
        "subject": ["Biology"],
        "level": ["GCSE"],
        "board": ["AQA"],
        "specVersion": ["v1"]
      },
      "kinds": ["explanatory"],
      "slotIds": ["S1"],
      "maxJobsPerRun": 10
    }
  ]
}
"@
Write-Utf8NoBom $tmpAllowlistPath $allowlistJson

# Job with jobId J1: deterministic bucket 43 (31*h+char). Rollout 30 => bucket 43 >= 30 => ROLLOUT_EXCLUDED
$jobJson = @"
{
  "version":"v1",
  "appliesTo":{"subject":"Biology","level":"GCSE","board":"AQA","specVersion":"v1"},
  "jobs":[{"jobId":"J1","slotId":"S1","kind":"explanatory","mode":"generate","input":{},"output":{"field":"content","type":"text"},"sources":[],"required":true}],
  "metadata":{"requiresReview":false,"allowAI":true}
}
"@

$outPath = Join-Path $env:TEMP "slotgen-step7-7-stdout.json"
$errPath = Join-Path $env:TEMP "slotgen-step7-7-stderr.log"
$jobFile = Join-Path $env:TEMP "slotgen-step7-7-job.json"

$env:FEATURE_SLOTGEN_AI = "true"
$env:SLOTGEN_AI_KILL = "false"
$env:SLOTGEN_AI_ROLLOUT_PERCENT = "30"
$env:SLOTGEN_ALLOWLIST_PATH = $tmpAllowlistPath
$env:OPENAI_API_KEY = "test-key"
$env:OPENAI_BASE_URL = "http://127.0.0.1:$stubPort"

Write-Utf8NoBom $jobFile $jobJson
cmd /c "node scripts/run-slot-generation-openai.js < `"$jobFile`" > `"$outPath`" 2> `"$errPath`""
$exit = $LASTEXITCODE
try { Remove-Item $jobFile -Force -ErrorAction SilentlyContinue } catch {}
if ($exit -ne 0) { throw "Executor exited non-zero ($exit). See: $errPath" }

node scripts/validate-json.js $outPath docs/curriculum/engine/slot-generation-result.v1.schema.json

$result = Get-Content $outPath -Raw | ConvertFrom-Json
if ($result.status -ne "STUB") { throw "Expected stdout status STUB, got: $($result.status)" }
if ($result.jobId -ne "J1") { throw "Expected stdout jobId J1, got: $($result.jobId)" }

$stderrLines = Get-Content $errPath
if (-not $stderrLines) { throw "Expected telemetry on stderr, but stderr is empty." }
$telemetryLine = ($stderrLines | Where-Object { $_.Trim() -match '^\{' } | Select-Object -Last 1)
if (-not $telemetryLine) { throw "No telemetry JSON line found on stderr." }
$telemetryLine = $telemetryLine.Trim() -replace '\r+$', ''

$tmpTelemetryPath = Join-Path $env:TEMP "slotgen-step7-7-telemetry.json"
Write-Utf8NoBom $tmpTelemetryPath $telemetryLine

node scripts/validate-json.js $tmpTelemetryPath docs/curriculum/engine/slot-generation-telemetry.v1.schema.json

$telemetry = Get-Content $tmpTelemetryPath -Raw | ConvertFrom-Json
if ($telemetry.path -ne "stub") { throw "Expected telemetry.path stub, got: $($telemetry.path)" }
if ($telemetry.status -ne "STUB") { throw "Expected telemetry.status STUB, got: $($telemetry.status)" }
if ($telemetry.errorCode -ne "ROLLOUT_EXCLUDED") { throw "Expected telemetry.errorCode ROLLOUT_EXCLUDED, got: $($telemetry.errorCode)" }

try { if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } } catch {}
try { Remove-Item $tmpAllowlistPath -Force -ErrorAction SilentlyContinue } catch {}
try { Remove-Item $tmpTelemetryPath -Force -ErrorAction SilentlyContinue } catch {}

Write-Host "VALID (result schema)"
Write-Host "VALID (telemetry schema)"
Write-Host "OK: Phase 7 Step 7 passed (rollout exclusion enforced deterministically)."
