$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de30-quan-ly-doi-xe -- sh scripts/backup.sh
if ($LASTEXITCODE -ne 0) { throw 'Sao luu that bai.' }
