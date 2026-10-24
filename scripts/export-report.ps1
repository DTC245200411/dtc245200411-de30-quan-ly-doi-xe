param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference='Stop'
$source=Join-Path $ProjectRoot 'docs/Bao_Cao_De30_Nguyen_Thi_Lam.docx'
$pdf=Join-Path $ProjectRoot 'docs/Bao_Cao_De30_Nguyen_Thi_Lam.pdf'
$exportDir=Join-Path $env:TEMP ('lam-fleet-report-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $exportDir | Out-Null
$localDoc=Join-Path $exportDir 'Bao_Cao_De30_Nguyen_Thi_Lam.docx'
$localPdf=Join-Path $exportDir 'Bao_Cao_De30_Nguyen_Thi_Lam.pdf'
Copy-Item -LiteralPath $source -Destination $localDoc
$word=$null
$report=$null
try {
    $word=New-Object -ComObject Word.Application
    $word.Visible=$false
    $word.DisplayAlerts=0
    $report=$word.Documents.Open($localDoc,$false,$true)
    $report.Repaginate()
    $pages=$report.ComputeStatistics(2)
    $report.ExportAsFixedFormat($localPdf,17)
    Copy-Item -LiteralPath $localPdf -Destination $pdf -Force
    Write-Output "Microsoft Word PDF exported: $pages pages."
} finally {
    if($null -ne $report){$report.Close(0);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($report)}
    if($null -ne $word){$word.Quit(0);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)}
}
