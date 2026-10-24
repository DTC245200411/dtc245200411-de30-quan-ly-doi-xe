param([Parameter(Mandatory=$true)][string]$BackupFile, [switch]$Apply, [switch]$CompareCurrent)
$ErrorActionPreference = 'Stop'
$restoreMode = '--verify'
if ($CompareCurrent) { $restoreMode = '--verify-current' }
if ($Apply) { $restoreMode = '--apply' }
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de30-quan-ly-doi-xe -- sh scripts/restore.sh $restoreMode $BackupFile
if ($LASTEXITCODE -ne 0) { throw 'Phuc hoi/kiem tra that bai.' }
