param(
    [string]$LogPath = "C:\Logs\fluent-bit.log",
    [string]$ArchiveDir = "C:\Logs\archive",
    [int]$MaxSizeMB = 100,
    [int]$RetainDays = 7,
    [int]$MaxArchiveFiles = 7,
    [string]$ServiceName = "MySLT-Fluent-Bit",
    [switch]$EnableServiceFallback = $true,
    [int]$ServiceStopTimeoutSec = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $ArchiveDir)) {
    New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
}

if (-not (Test-Path -Path $LogPath)) {
    New-Item -ItemType File -Path $LogPath -Force | Out-Null
    exit 0
}

$logFile = Get-Item -Path $LogPath
$maxBytes = $MaxSizeMB * 1MB

if ($logFile.Length -ge $maxBytes) {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $archiveName = "fluent-bit-$timestamp.log"
    $archivePath = Join-Path $ArchiveDir $archiveName

    $rotated = $false

    try {
        Move-Item -Path $LogPath -Destination $archivePath -Force
        New-Item -ItemType File -Path $LogPath -Force | Out-Null
        $rotated = $true
    }
    catch {
        Copy-Item -Path $LogPath -Destination $archivePath -Force

        try {
            $stream = [System.IO.File]::Open($LogPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
            $stream.SetLength(0)
            $stream.Close()
            $rotated = $true
        }
        catch {
            try {
                Clear-Content -Path $LogPath -Force
                $rotated = $true
            }
            catch {
                if (-not $EnableServiceFallback) {
                    throw "Unable to rotate/truncate '$LogPath'. File appears exclusively locked by Fluent Bit or another process."
                }

                $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
                if (-not $service) {
                    throw "Unable to rotate/truncate '$LogPath' and service '$ServiceName' was not found for fallback."
                }

                $wasRunning = $service.Status -eq 'Running'

                try {
                    if ($wasRunning) {
                        Stop-Service -Name $ServiceName -Force -ErrorAction Stop

                        $deadline = (Get-Date).AddSeconds($ServiceStopTimeoutSec)
                        do {
                            Start-Sleep -Milliseconds 500
                            $service = Get-Service -Name $ServiceName -ErrorAction Stop
                            if ($service.Status -eq 'Stopped') { break }
                        } while ((Get-Date) -lt $deadline)

                        if ($service.Status -ne 'Stopped') {
                            throw "Service '$ServiceName' did not stop within $ServiceStopTimeoutSec seconds."
                        }
                    }

                    Move-Item -Path $LogPath -Destination $archivePath -Force
                    New-Item -ItemType File -Path $LogPath -Force | Out-Null
                    $rotated = $true
                }
                finally {
                    if ($wasRunning) {
                        Start-Service -Name $ServiceName -ErrorAction Stop
                    }
                }
            }
        }
    }
}

$pattern = "fluent-bit-*.log"
$archives = Get-ChildItem -Path $ArchiveDir -Filter $pattern -File | Sort-Object LastWriteTime -Descending

$cutoff = (Get-Date).AddDays(-$RetainDays)
$olderThanRetention = $archives | Where-Object { $_.LastWriteTime -lt $cutoff }
if ($olderThanRetention) {
    $olderThanRetention | Remove-Item -Force
}

$archivesAfterRetention = Get-ChildItem -Path $ArchiveDir -Filter $pattern -File | Sort-Object LastWriteTime -Descending
if ($archivesAfterRetention.Count -gt $MaxArchiveFiles) {
    $toRemove = $archivesAfterRetention | Select-Object -Skip $MaxArchiveFiles
    $toRemove | Remove-Item -Force
}
