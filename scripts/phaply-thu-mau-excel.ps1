# Mở từng mẫu bằng Excel thật, điền dữ liệu giả có đánh dấu "§<ô>" vào ThôngTin!B1:B40, tính lại,
# rồi kiểm (1) các ô đã trỏ lại lấy đúng ô, (2) số ô lỗi (#REF!, #NAME?, #VALUE!…) toàn file. Không lưu file.
$ThuMuc = 'D:\savitax-app\templates\phaply\excel-mau'
$kiem = @{
  'GT_1TV.xlsx'          = @(@('CV_hoanthanhNVT','C13','§B19'), @('CV_hoanthanhNVT','I14','§B22'), @('CamKêt chưa mở TKNH','A17','§B19'), @('CamKêt chưa mở TKNH','B20','§B23'), @('CamKêt chưa mở TKNH','F26','§B10'), @('CamKêt-XNK (trong)','F21','§B10'))
  'GT_2TV.xlsx'          = @(@('CV_hoanthanhNVT','C12','§B19'), @('CV_hoanthanhNVT','C14','§B23'), @('Biên bản họp ','C37','§B27'))
  'GT_VPDD_2TV.xlsx'     = @(@('QĐ','B23','§B8'), @('QĐ','A16','§B29'), @('GGT','F18','§B9'), @('Mẫu 24-VBĐN Chấm dứt MST','F15','§B29'))
  'CAPLAI_GPKD_1TV.xlsx' = @(,@('Mẫu số 27','A9','§B18'))
  'KP_MST_1TV.xlsx'      = @(@('UQ(cct)','B11','§B11'), @('UQ(cct)','F25','§B11'))
  'GT_VPDD_CP.xlsx'      = @()
}
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
try {
  foreach ($f in Get-ChildItem $ThuMuc -Filter *.xlsx) {
    try { $wb = $xl.Workbooks.Open($f.FullName, 0, $false) } catch { "{0,-22} KHONG MO DUOC" -f $f.Name; continue }
    $tt = $wb.Worksheets.Item('ThôngTin')
    for ($r = 1; $r -le 40; $r++) { $o = $tt.Range("B$r"); if (-not $o.HasFormula) { $o.Value2 = "§B$r" } }
    $xl.CalculateFull()
    $loi = 0; $viDu = @()
    foreach ($ws in $wb.Worksheets) {
      try { $e = $ws.UsedRange.SpecialCells(-4123, 16); $loi += $e.Count; if ($viDu.Count -lt 3) { $viDu += $ws.Name + '!' + $e.Cells.Item(1).Address(0,0) } } catch { }
    }
    $sai = @()
    foreach ($k in $kiem[$f.Name]) {
      # tên sheet có thể lưu dạng chữ tổ hợp khác — so sau khi chuẩn hoá
      $ws = $null; foreach ($w in $wb.Worksheets) { if ($w.Name.Normalize() -eq $k[0].Normalize()) { $ws = $w } }
      if ($null -eq $ws) { $sai += "khong thay sheet $($k[0])"; continue }
      $v = [string]$ws.Range($k[1]).Text; if ($v -notlike "*$($k[2])*") { $sai += "$($k[0])!$($k[1])='$v' (can $($k[2]))" }
    }
    "{0,-22} mo duoc | o loi: {1} {2} | tro lai dung: {3}/{4} {5}" -f $f.Name, $loi, ($viDu -join ','), ($kiem[$f.Name].Count - $sai.Count), $kiem[$f.Name].Count, ($sai -join '; ')
    $wb.Close($false)
  }
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
