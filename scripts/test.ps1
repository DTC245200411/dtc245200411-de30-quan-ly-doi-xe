$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de30-quan-ly-doi-xe -- sh scripts/test.sh
if ($LASTEXITCODE -ne 0) { throw 'Kiem thu that bai; xem ket qua trong .local/test-results.' }
