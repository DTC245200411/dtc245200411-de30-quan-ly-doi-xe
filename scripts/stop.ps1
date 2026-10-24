$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de30-quan-ly-doi-xe -- sh scripts/stop.sh
if ($LASTEXITCODE -ne 0) { throw 'Dung dich vu trong Ubuntu WSL2 that bai.' }
$pidFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.local/wsl-keepalive.pid'
if (Test-Path -LiteralPath $pidFile) {
    $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    $keepAliveProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid" | Where-Object { $_.Name -eq 'wsl.exe' -and $_.CommandLine -like '*de30-quan-ly-doi-xe*sleep*infinity*' }
    if ($keepAliveProcess) { Stop-Process -Id $savedPid }
    Remove-Item -LiteralPath $pidFile
}
