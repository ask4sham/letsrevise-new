# Improved AI Content Generator with better subject matching
param(
    [string]$Subject = "Maths",
    [string]$Topic = "Algebra",
    [string]$Level = "gcse",
    [string]$ExamBoard = "AQA",
    [string]$ContentType = "revision_notes"
)

# Set project root
$projectRoot = "C:\Users\ask4s\OneDrive\Desktop\Letsrevise.com"

# Function to find the correct subject folder
function Get-SubjectFolder {
    param(
        [string]$RequestedSubject,
        [string]$Level,
        [string]$Year = "year7"
    )
    
    $basePath = Join-Path $projectRoot "src\content"
    
    if ($Level -eq "ks3") {
        $yearPath = Join-Path (Join-Path $basePath "ks3") $Year
        if (Test-Path $yearPath) {
            # Get all subject folders in this year
            $existingSubjects = Get-ChildItem -Path $yearPath -Directory | Select-Object -ExpandProperty Name
            
            # Try to match (case-insensitive)
            $matchedSubject = $existingSubjects | Where-Object { $_ -eq $RequestedSubject -or $_ -eq $RequestedSubject.ToLower() -or $_ -eq $RequestedSubject.ToUpper() }
            
            if ($matchedSubject) {
                return $matchedSubject
            } else {
                Write-Host "⚠️ Subject '$RequestedSubject' not found in $yearPath" -ForegroundColor Yellow
                Write-Host "   Available subjects: $($existingSubjects -join ', ')" -ForegroundColor Gray
                # Use the first match or requested subject
                return $RequestedSubject.ToLower()
            }
        }
    }
    
    # For other levels, just return as-is
    return $RequestedSubject
}

# Get correct subject name for KS3
$actualSubject = $Subject
if ($Level -eq "ks3") {
    $actualSubject = Get-SubjectFolder -RequestedSubject $Subject -Level $Level
    Write-Host "📚 Using subject folder: $actualSubject" -ForegroundColor Gray
}

# Rest of the script would continue here...
# [The rest of your existing generate-content-final.ps1 script]
