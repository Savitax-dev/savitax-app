'use client'
// Nạp hồ sơ một công ty từ thư mục trên máy — dùng chung cho các màn của Soát xét báo cáo (Hồ sơ dữ liệu, Soát kỳ…).
//
// Danh sách công ty (máy chủ lọc phạm vi) → tay cầm thư mục đã nhớ → quét cây → đọc tờ khai + bảng kê (tóm tắt) của
// năm đang xem, có bộ nhớ đệm trên máy. CHỈ ĐỌC. Tách ra từ màn Hồ sơ dữ liệu để các màn khác khỏi viết lặp.
//   docNamTruoc: đọc thêm tờ khai NĂM TRƯỚC (Soát kỳ cần cho chuỗi [22] kỳ đầu năm và ngưỡng 50 tỷ).
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  coHoTro, chonThuMucChinh, layThuMucChinh, dsThuMucNamCu, themThuMucNamCu, boThuMucNamCu, quyenDoc,
  khoaDem, layDem, ghiDem,
} from '@/lib/phanTich/khoMay'
import { quetCongTy, gopNamTroRieng } from '@/lib/phanTich/thuMuc'
import { docToKhaiCuaNam, docBangKeCuaNam, docBangLuongCuaNam, docC12CuaNam, docSaoKeCuaNam, docSoTienCuaNam } from '@/lib/phanTich/docHoSo'

export const DEM = { khoa: khoaDem, lay: layDem, ghi: ghiDem }

// Thư viện nặng (SheetJS, pdfjs) chỉ nạp khi thật sự có file cần đọc
export async function docExcelBuf(buf) {
  const { docExcel } = await import('@/lib/phanTich/doc/excel')
  return docExcel(buf)
}
export async function docC12(buf) {
  const [{ layDongPdf }, { docC12PdfChu }] = await Promise.all([import('@/lib/phanTich/doc/pdfChu'), import('@/lib/phanTich/doc/bangLuong')])
  return docC12PdfChu(await layDongPdf(buf))
}
export async function docPdf(buf) {
  const [{ layDongPdf }, { docToKhaiPdfChu }] = await Promise.all([import('@/lib/phanTich/doc/pdfChu'), import('@/lib/phanTich/doc/toKhaiPdf')])
  return docToKhaiPdfChu(await layDongPdf(buf))
}

//   docLuong: đọc thêm bảng lương + C12 + sao kê (số tiền) + sổ quỹ / sổ tiền gửi của năm (Soát kỳ: TNCN, bảo hiểm, ngân hàng).
//   chiQuet: chỉ quét cây, KHÔNG đọc tờ khai / bảng kê (Rủi ro thuế tự đọc theo cách của nó).
export function useHoSoCty(ctyId, { docNamTruoc = false, docLuong = false, chiQuet = false } = {}) {
  const router = useRouter()
  const [dsCty, setDsCty] = useState([])
  const [dsDaTai, setDsDaTai] = useState(false)
  const [loi, setLoi] = useState('')             // lỗi quét / đọc của công ty đang xem
  const [loiDs, setLoiDs] = useState('')         // lỗi tải danh sách công ty (không bị xoá khi đổi công ty)
  const [hoTro, setHoTro] = useState(true)
  const [thuMuc, setThuMuc] = useState(null)       // { tay, trangThai, ten }
  const [namCu, setNamCu] = useState([])            // [{ tay, ten, coQuyen }] — thư mục năm trỏ riêng
  const [quet, setQuet] = useState(null)            // { nam: { 2026: quetNam }, namBoQua, canhBao }
  const [nam, setNam] = useState(null)
  const [doc, setDoc] = useState(null)              // { toKhai, bangKe, loi, scan, tuDem } của năm đang xem
  const [docTruoc, setDocTruoc] = useState(null)    // { toKhai } của năm trước (nếu có thư mục)
  const [buoc, setBuoc] = useState('')              // chữ tiến độ
  const [lanDoc, setLanDoc] = useState(0)
  const [daChuyen, setDaChuyen] = useState('')      // thư mục năm vừa gỡ khỏi chỗ dùng chung với Tờ khai

  const cty = dsCty.find(c => String(c.id) === String(ctyId)) || null
  const mstCty = cty?.mst || ''

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
    setHoTro(coHoTro())
    fetch('/api/admin/phantich/cong-ty').then(r => r.json())
      .then(j => { if (j.error) setLoiDs(j.error); else setDsCty(j.congTy || []) })
      .catch(e => setLoiDs(e.message))
      .finally(() => setDsDaTai(true))
  }, [router])

  // Đổi công ty / bấm Đọc lại → đọc lại tay cầm đã nhớ (không mở hộp thoại)
  useEffect(() => {
    setThuMuc(null); setNamCu([]); setQuet(null); setDoc(null); setDocTruoc(null); setLoi('')   // lỗi của công ty trước không được ở lại
    if (!ctyId || !coHoTro()) return
    let huy = false
    ;(async () => {
      const tm = await layThuMucChinh(ctyId)
      const cu = await dsThuMucNamCu(ctyId)
      const dsCu = []
      for (const tay of cu) dsCu.push({ tay, ten: tay.name, coQuyen: await quyenDoc(tay) })
      if (!huy) { setThuMuc(tm); setNamCu(dsCu); setDaChuyen(tm.daChuyen || '') }
    })()
    return () => { huy = true }
  }, [ctyId, lanDoc])

  // Quét cây thư mục khi đã có quyền đọc
  useEffect(() => {
    if (!thuMuc) return
    const coChinh = thuMuc.trangThai === 'san_sang'
    const cuDuocDoc = namCu.filter(x => x.coQuyen)
    if (!coChinh && !cuDuocDoc.length) return
    let huy = false
    ;(async () => {
      setBuoc('Đang quét cây thư mục…'); setLoi('')
      try {
        const gop = { nam: {}, namBoQua: [], canhBao: [], nhac: [], tang: null }   // nhac: nhắc cấp thư mục, hiện ở thanh công ty mọi màn
        let loiChinh = ''
        if (coChinh) {
          try {
            const kq = await quetCongTy(thuMuc.tay)
            Object.assign(gop.nam, kq.nam); gop.namBoQua = kq.namBoQua; gop.canhBao.push(...kq.canhBao); gop.tang = kq.tang
            if (kq.tang === 'bo_bao_cao') loiChinh = `Thư mục đang trỏ là "${thuMuc.tay.name}" (tầng bộ báo cáo, đủ cho Tờ khai). Soát xét và Rủi ro thuế cần đọc cả hóa đơn, sổ sách — bấm "Trỏ lại" và chọn thư mục CÔNG TY (thư mục chứa "2. HỒ SƠ KẾ TOÁN"). Tờ khai vẫn chạy bình thường với thư mục công ty.`
          } catch (e) {
            loiChinh = e?.name === 'NotFoundError'
              ? `Thư mục đã trỏ ("${thuMuc.tay.name}") không còn ở chỗ cũ — có thể đã bị đổi tên, di chuyển hoặc xóa trên Drive. Bấm "Trỏ lại" và chọn thư mục CÔNG TY.`
              : 'Không quét được thư mục: ' + (e?.message || e)
          }
        }
        for (const x of cuDuocDoc) {
          let kq
          try { kq = await quetCongTy(x.tay, { tuNam: 0 }) }
          catch (e) { gop.nhac.push(`Không mở được thư mục năm cũ "${x.ten}"${e?.name === 'NotFoundError' ? ' (đã bị đổi tên, di chuyển hoặc xóa) — bỏ ra rồi thêm lại' : ': ' + (e?.message || e)}`); continue }
          gopNamTroRieng(gop, kq, x.ten)
          if (!Object.keys(kq.nam).length) gop.canhBao.push(`Thư mục "${x.ten}" không phải thư mục năm app nhận ra được`)
        }
        if (huy) return
        // Thư mục chính trỏ "7. BỘ BÁO CÁO" nhưng đã có thư mục năm trỏ riêng cung cấp dữ liệu → chỉ nhắc nhẹ, không báo đỏ
        if (loiChinh && gop.tang === 'bo_bao_cao' && Object.keys(gop.nam).length) {
          gop.nhac.unshift(`Thư mục chính đang trỏ "${thuMuc.tay.name}" — app đang đọc năm ${Object.keys(gop.nam).sort().join(', ')} từ thư mục năm trỏ riêng. Muốn app tự thấy mọi năm thì bấm "Trỏ lại" và chọn thư mục CÔNG TY.`)
          loiChinh = ''
        }
        if (loiChinh) setLoi(loiChinh)
        setQuet(gop)
        const cacNam = Object.keys(gop.nam).map(Number).sort((a, b) => b - a)
        const namNay = new Date().getFullYear()
        setNam(n => (n && gop.nam[n] ? n : cacNam.includes(namNay) ? namNay : cacNam[0] ?? null))
      } catch (e) {
        if (!huy) setLoi('Không quét được thư mục: ' + e.message)
      } finally {
        if (!huy) setBuoc('')
      }
    })()
    return () => { huy = true }
  }, [thuMuc, namCu])

  // Đọc tờ khai + bảng kê của năm đang xem (+ tờ khai năm trước nếu cần)
  useEffect(() => {
    const qn = quet?.nam?.[nam]
    if (!qn || chiQuet) { setDoc(null); setDocTruoc(null); return }
    let huy = false
    ;(async () => {
      try {
      setBuoc('Đang đọc tờ khai…')
      const kq = await docToKhaiCuaNam(qn, { dem: DEM, docPdf, tienDo: (x, n) => !huy && setBuoc(`Đang đọc tờ khai ${x}/${n}…`) })
      if (huy) return
      // Bảng kê: chiều mua vào / bán ra của file cổng theo MST công ty (hồ sơ công ty, thiếu thì MST trên tờ khai)
      const bk = await docBangKeCuaNam(qn, { dem: DEM, docExcelBuf, mstCty: mstCty || kq.toKhai[0]?.mst || '', tienDo: (x, n) => !huy && setBuoc(`Đang đọc bảng kê ${x}/${n}…`) })
      if (huy) return
      let luong = null
      if (docLuong) {
        setBuoc('Đang đọc bảng lương, C12, sổ phụ, sổ quỹ / sổ tiền gửi…')
        const [bl, c, sk, st] = await Promise.all([docBangLuongCuaNam(qn, { dem: DEM, docExcelBuf }), docC12CuaNam(qn, { dem: DEM, docC12 }),
          docSaoKeCuaNam(qn, { dem: DEM, docExcelBuf }), docSoTienCuaNam(qn, { dem: DEM, docExcelBuf })])
        if (huy) return
        luong = { bangLuong: bl.bangLuong, c12: c.c12, saoKeTien: sk.tien || [], soTien: st.dong, loi: [...bl.loi, ...c.loi, ...sk.loi, ...st.loi] }
      }
      let truoc = null
      const qTruoc = quet?.nam?.[nam - 1]
      if (docNamTruoc && qTruoc) {
        setBuoc(`Đang đọc tờ khai năm ${nam - 1}…`)
        truoc = await docToKhaiCuaNam(qTruoc, { dem: DEM, docPdf })
      }
      if (!huy) {
        setDoc({ ...kq, bangKe: bk.bangKe, bangLuong: luong?.bangLuong || [], c12: luong?.c12 || [], saoKeTien: luong?.saoKeTien || [], soTien: luong?.soTien || [], loi: [...kq.loi, ...bk.loi, ...(luong?.loi || [])], tuDem: kq.tuDem + bk.tuDem })
        setDocTruoc(truoc)
        setBuoc('')
      }
      } catch (e) {
        // Lỗi IndexedDB / file hỏng giữa chừng: báo, và KHÔNG để chữ tiến độ treo (nút Đọc lại bị khoá)
        if (!huy) { setLoi('Không đọc được tờ khai / bảng kê: ' + (e?.message || e)); setBuoc('') }
      }
    })()
    return () => { huy = true }
  }, [quet, nam, mstCty, docNamTruoc, docLuong, chiQuet])

  const docLai = useCallback(() => setLanDoc(n => n + 1), [])
  const troThuMuc = useCallback(async () => {
    try { await chonThuMucChinh(ctyId); setLanDoc(n => n + 1) } catch (e) { if (e?.name !== 'AbortError') setLoi(e.message) }
  }, [ctyId])
  const choPhepLai = useCallback(async () => {
    const tm = await layThuMucChinh(ctyId, { xinQuyen: true })
    const dsCu = []
    for (const x of namCu) dsCu.push({ ...x, coQuyen: await quyenDoc(x.tay, { xinQuyen: true }) })
    setThuMuc(tm); setNamCu(dsCu)
  }, [ctyId, namCu])
  const themNamCu = useCallback(async () => {
    try { await themThuMucNamCu(ctyId); setLanDoc(n => n + 1) } catch (e) { if (e?.name !== 'AbortError') setLoi(e.message) }
  }, [ctyId])
  const boNamCu = useCallback(async ten => { await boThuMucNamCu(ctyId, ten); setLanDoc(n => n + 1) }, [ctyId])

  const cacNam = quet ? Object.keys(quet.nam).map(Number).sort((a, b) => b - a) : []
  const qn = quet?.nam?.[nam] || null
  const canCho = (thuMuc && ['can_xin_lai', 'bi_tu_choi'].includes(thuMuc.trangThai)) || namCu.some(x => !x.coQuyen)

  return {
    ctyId, dsCty, dsDaTai, cty, mstCty, loi: loiDs || loi, setLoi, lanDoc, hoTro, thuMuc, namCu, quet, nam, setNam, cacNam, qn,
    doc, docTruoc, buoc, daChuyen, canCho, docLai, troThuMuc, choPhepLai, themNamCu, boNamCu,
  }
}
