param([switch]$BaseOnly)
$ErrorActionPreference = 'Stop'
$linuxProject = '/home/hai/projects/de30-quan-ly-doi-xe'
$pidFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.local/wsl-keepalive.pid'
$keepAliveProcess = $null
if (Test-Path -LiteralPath $pidFile) {
    $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    $keepAliveProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid" | Where-Object { $_.Name -eq 'wsl.exe' -and $_.CommandLine -like '*de30-quan-ly-doi-xe*sleep*14400*' }
}
if (-not $keepAliveProcess) {
    $keepAliveProcess = Start-Process -FilePath 'wsl.exe' -ArgumentList @('-d','Ubuntu-24.04','-u','hai','--cd',$linuxProject,'--','sleep','14400') -WindowStyle Hidden -PassThru
    New-Item -ItemType Directory -Force (Split-Path $pidFile -Parent) | Out-Null
    [IO.File]::WriteAllText($pidFile, [string]$keepAliveProcess.Id)
}
if ($BaseOnly) {
    wsl -d Ubuntu-24.04 -u hai --cd $linuxProject -- env BASE_ONLY=1 sh scripts/start.sh
} else {
    wsl -d Ubuntu-24.04 -u hai --cd $linuxProject -- sh scripts/start.sh
}
if ($LASTEXITCODE -ne 0) { throw 'Khoi dong trong Ubuntu WSL2 that bai.' }
