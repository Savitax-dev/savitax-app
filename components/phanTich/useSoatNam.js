'use client'
// Đọc hồ sơ Soát xét báo cáo năm của một công ty từ thư mục đã quét (useHoSoCty với chiQuet) và tính kết quả năm đang xem.
// CHỈ ĐỌC, KHÔNG LƯU. Bộ máy (~300 KB) nạp động. Đọc MỘT lần mọi năm có thư mục; đổi năm / loại hình chỉ tính lại.
import { useEffect, useMemo, useState } from 'react'
import { DEM } from '@/components/phanTich/useHoSoCty'

// Năm mặc định: năm mới nhất đã có BCTC (soát năm cần BCTC); chưa có thì năm mới nhất có dữ liệu
function namMacDinh(X, cacNam) {
  const S = X.getS()
  const coBctc = cacNam.filter(n => { const v = (S.years?.[n]?.v) || (+S.meta.nam === n ? S.v : null); return v && (v.TONG_TS || v.DThu) })
  return coBctc[0] ?? cacNam[0] ?? null
}

// Kết quả đọc giữ theo đúng lượt quét thư mục (useHoSoCty giữ `quet` khi chuyển tab) → quay lại tab không đọc lại.
// Bấm "Tải lại thư mục" là ra `quet` mới → tự đọc lại. Giữ cả năm / loại hình đang xem.
const NHO_SOAT = new WeakMap()   // quet → { kq, nam, loai }

export function useSoatNam(hs) {
  const { quet, cty } = hs
  const [bm, setBm] = useState(null)
  const [hoSo, setHoSo] = useState(null)
  const [buoc, setBuoc] = useState('')
  const [loi, setLoi] = useState('')
  const [nam, setNam] = useState(null)
  const [loai, setLoai] = useState('tm')

  useEffect(() => { import('@/lib/soatbaocao/docThuMuc').then(setBm).catch(e => setLoi('Không nạp được bộ máy soát xét: ' + e.message)) }, [])

  useEffect(() => {
    setHoSo(null); setLoi('')
    if (!bm || !quet || !Object.keys(quet.nam).length) return
    const san = NHO_SOAT.get(quet)
    if (san) { setHoSo(san.kq); setNam(san.nam ?? namMacDinh(san.kq.X, san.kq.cacNam)); setLoai(san.loai); return }
    let huy = false
    ;(async () => {
      setBuoc('Đang đọc BCTC, tờ khai, sổ sách trong thư mục…')
      try {
        const kq = await bm.docHoSoSoat({ quetTheoNam: quet.nam, meta: { ten: cty?.ten || '', mst: cty?.mst || '' }, dem: DEM, tienDo: (x, n) => !huy && setBuoc(`Đang đọc file ${x}/${n}…`) })
        if (huy) return
        NHO_SOAT.set(quet, { kq, nam: null, loai: 'tm' })   // năm / loại hình do effect bên dưới ghi sau khi hiện
        setHoSo(kq)
        setNam(n => (n && kq.cacNam.includes(n) ? n : namMacDinh(kq.X, kq.cacNam)))
      } catch (e) {
        if (!huy) setLoi('Không đọc được hồ sơ: ' + e.message)
      } finally {
        if (!huy) setBuoc('')
      }
    })()
    return () => { huy = true }
  }, [bm, quet, cty?.ten, cty?.mst])

  // Nhớ năm / loại hình đang xem (chỉ khi hồ sơ trên màn hình đúng là của lượt quét này)
  useEffect(() => {
    const c = quet && NHO_SOAT.get(quet)
    if (c && hoSo === c.kq) { if (nam) c.nam = nam; c.loai = loai }
  }, [quet, hoSo, nam, loai])

  // Bộ máy giữ trạng thái (năm đang mở) — mỗi lần đổi năm / loại hình thì đặt lại rồi tính
  const C = useMemo(() => {
    if (!bm || !hoSo || !nam) return null
    const S = hoSo.X.getS(); S.meta.loai = loai; S.meta.ky = 'nam'
    return bm.tinhNamSoat(hoSo.X, nam)
  }, [bm, hoSo, nam, loai])
  const S = C ? hoSo.X.getS() : null
  const MODELS = hoSo ? hoSo.X.MODELS : null

  return { bm, hoSo, buoc, loi, nam, setNam, loai, setLoai, C, S, MODELS }
}
