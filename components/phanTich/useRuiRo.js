'use client'
// Đọc hồ sơ rủi ro thuế của một công ty từ thư mục đã quét (useHoSoCty với chiQuet) và chấm 39 tiêu chí.
// CHỈ ĐỌC, KHÔNG LƯU: số tự tìm + số nhân viên sửa tạm chỉ nằm trong bộ nhớ tab.
//
// Đọc MỘT lần mọi năm có thư mục (bộ nhớ đệm trên máy giữ kết quả từng file) → đổi năm / xem nhiều năm không đọc lại.
// Bộ máy (~600 KB) nạp động khi mở trang.
import { useEffect, useMemo, useState } from 'react'
import { DEM } from '@/components/phanTich/useHoSoCty'

async function napBoMay() {
  const [{ default: Risk }, { default: R39 }, tuTim, docThuMuc] = await Promise.all([
    import('@/lib/ruiro/risk'), import('@/lib/ruiro/r39'), import('@/lib/ruiro/tuTim'), import('@/lib/ruiro/docThuMuc'),
  ])
  return { Risk, R39, ...tuTim, ...docThuMuc }
}

// Năm mặc định: năm mới nhất đã có quyết toán hoặc BCTC (39 tiêu chí cần cả năm); chưa có thì năm mới nhất có tờ khai.
function namMacDinh(items, cacNam) {
  const coNam = cacNam.filter(n => items.some(i => +i.year === n && (i.kind === 'TNDN' || i.kind === 'BCTC')))
  return coNam[0] ?? cacNam[0] ?? null
}

export function useRuiRo(hs) {
  const { quet, mstCty, ctyId } = hs
  const [bm, setBm] = useState(null)
  const [hoSo, setHoSo] = useState(null)           // kết quả docHoSoRuiRo (mọi năm)
  const [buoc, setBuoc] = useState('')
  const [loi, setLoi] = useState('')
  const [namSoat, setNamSoat] = useState(null)
  const [docHoaDon, setDocHoaDon] = useState(false)
  const [suaTay, setSuaTay] = useState({})          // { [nam]: { khoa: giá trị } } — không lưu

  // Đổi công ty: bỏ số sửa tay + lựa chọn đọc hóa đơn của công ty trước (trước đây mang nguyên sang công ty sau)
  useEffect(() => { setSuaTay({}); setDocHoaDon(false); setNamSoat(null) }, [ctyId])

  useEffect(() => { napBoMay().then(setBm).catch(e => setLoi('Không nạp được bộ máy rủi ro thuế: ' + e.message)) }, [])

  // Hóa đơn chỉ đọc cho năm đang soát, và chỉ khi người dùng bấm (một năm có thể vài nghìn file)
  const namHoaDon = docHoaDon ? namSoat : null
  useEffect(() => {
    setHoSo(null); setLoi('')
    if (!bm || !quet || !Object.keys(quet.nam).length) return
    let huy = false
    ;(async () => {
      setBuoc('Đang tìm tờ khai, quyết toán, BCTC trong thư mục…')
      try {
        const cacNam = Object.keys(quet.nam).map(Number)
        const kq = await bm.docHoSoRuiRo({
          nam: namHoaDon ?? Math.max(...cacNam), quetTheoNam: quet.nam, mst: mstCty, dem: DEM, tatCaNam: true, docHoaDon: namHoaDon != null,
          tienDo: (x, n) => !huy && setBuoc(`Đang đọc file ${x}/${n}…`),
        })
        if (huy) return
        if (!kq.client.mst) kq.client.mst = kq.client.decls[0]?.mst || ''
        kq.hoaDonNam = namHoaDon
        setHoSo(kq)
        setNamSoat(n => (n && kq.cacNamCoDuLieu.includes(n) ? n : namMacDinh(kq.items, kq.cacNamCoDuLieu)))
      } catch (e) {
        if (!huy) setLoi('Không đọc được hồ sơ: ' + e.message)
      } finally {
        if (!huy) setBuoc('')
      }
    })()
    return () => { huy = true }
  }, [bm, quet, mstCty, namHoaDon])

  const tuTim = useMemo(() => (bm && hoSo && namSoat ? bm.tuTimSoLieu(hoSo.client, namSoat, { hoaDon: hoSo.hoaDonNam === namSoat ? hoSo.hoaDon : null }) : null), [bm, hoSo, namSoat])
  const suaNam = useMemo(() => suaTay[namSoat] || {}, [suaTay, namSoat])

  const danhGia = useMemo(() => {
    if (!bm || !hoSo || !namSoat || !tuTim) return null
    const ev = bm.Risk.evaluateYear(bm.ganSoLieu(hoSo.client, namSoat, tuTim.inputs, suaNam), namSoat)
    const coTruoc = hoSo.cacNamCoDuLieu.includes(namSoat - 1)
    const evTruoc = coTruoc ? bm.Risk.evaluateYear(bm.ganSoLieu(hoSo.client, namSoat - 1, bm.tuTimSoLieu(hoSo.client, namSoat - 1).inputs), namSoat - 1) : null
    return { ev, evTruoc }
  }, [bm, hoSo, namSoat, tuTim, suaNam])

  // Nhiều năm: chấm từng năm có dữ liệu (số tự tìm của từng năm, không kèm số sửa tạm)
  const nhieuNam = useMemo(() => {
    if (!bm || !hoSo) return null
    return [...hoSo.cacNamCoDuLieu].sort((a, b) => a - b).map(n => {
      const t = bm.tuTimSoLieu(hoSo.client, n, { hoaDon: n === hoSo.hoaDonNam ? hoSo.hoaDon : null })
      return { nam: n, ev: bm.Risk.evaluateYear(bm.ganSoLieu(hoSo.client, n, t.inputs, suaTay[n] || {}), n) }
    })
  }, [bm, hoSo, suaTay])

  const datSua = (khoa, giaTri) => setSuaTay(p => {
    const nam = { ...(p[namSoat] || {}) }
    if (giaTri === '' || giaTri == null) delete nam[khoa]; else nam[khoa] = giaTri
    return { ...p, [namSoat]: nam }
  })

  return { bm, hoSo, buoc, loi, namSoat, setNamSoat, tuTim, suaNam, datSua, danhGia, nhieuNam, docHoaDon, setDocHoaDon }
}
