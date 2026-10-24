$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de30-quan-ly-doi-xe -- sh scripts/prepare.sh
if ($LASTEXITCODE -ne 0) { throw 'Chuan bi secrets trong Ubuntu WSL2 that bai.' }
