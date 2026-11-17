# Doi file Word -> PDF bang Microsoft Word tren may (chi dung de KIEM mau, khong dung tren may chu).
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/phaply-word-sang-pdf.ps1 <thu muc co .docx> [<thu muc ra>]
# In ra moi file: "OK <ten>.pdf <so trang>" hoac "LOI <ten> <thong bao>" (Word bao file hong cung la LOI).
param([string]$Vao, [string]$Ra)
if (-not $Ra) { $Ra = $Vao }
New-Item -ItemType Directory -Force $Ra | Out-Null
# Moi lan chi MOT phien Word (nhieu tien trinh cung goi thi xep hang) - Quit() cua phien nay khong dong file phien khac
$khoa = New-Object System.Threading.Mutex($false, 'Global\SavitaxWordSangPdf')
[void]$khoa.WaitOne(600000)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  Get-ChildItem -Path $Vao -Filter *.docx | Where-Object { -not $_.Name.StartsWith('~$') } | ForEach-Object {
    $pdf = Join-Path (Resolve-Path $Ra) ($_.BaseName + '.pdf')
    try {
      # OpenAndRepair = false, ReadOnly = true: file hong thi Open nem loi thay vi tu sua
      $d = $w.Documents.Open($_.FullName, $false, $true, $false)
      $n = $d.ComputeStatistics(2)
      $d.ExportAsFixedFormat([string]$pdf, 17)
      $d.Close([ref]0)
      Write-Output ("OK " + $_.BaseName + ".pdf " + $n)
    } catch { Write-Output ("LOI " + $_.Exception.Message) }
  }
} finally { $w.Quit(); $khoa.ReleaseMutex() }
