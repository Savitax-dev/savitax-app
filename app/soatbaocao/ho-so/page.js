'use client'
// Soát xét báo cáo — màn "Hồ sơ dữ liệu" (mockup docs/mockup-phan-tich/soat-1-ho-so-du-lieu.html).
//
// App đọc thẳng thư mục công ty trên máy nhân viên (Drive cho máy tính), CHỈ ĐỌC, không gửi file hay số
// liệu nào lên máy chủ. Từ cây thư mục + nội dung tờ khai XML → bảng "có gì / thiếu gì" từng năm và lưới
// "Đủ kỳ chưa". Mặc định soát từ năm 2026; năm cũ nhân viên tự trỏ thêm ("Thêm dữ liệu năm cũ").
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { TabSoat, OTongSinhDong, ChipMau, NhanDuoi, KieuBang, coChu, ngaySua } from '@/components/phanTich/phanTichUI'
import { useHoSoCty } from '@/components/phanTich/useHoSoCty'
import ThanhCongTy, { Bao } from '@/components/phanTich/ThanhCongTy'
import { kiemKeNam, gomCay, TRANG_THAI } from '@/lib/phanTich/kiemKe'
import { NAM_BAT_DAU } from '@/lib/phanTich/thuMuc'

// Ô lưới "Đủ kỳ chưa" — màu luôn kèm chữ trong title
const O_LUOI = {
  co: { lop: 'bg-green-50 text-green-700 border-green-300', nhan: 'Đã có' },
  thieu: { lop: 'bg-red-50 text-red-700 border-red-300 font-bold', nhan: 'Thiếu' },
  cho: { lop: 'bg-amber-50 text-amber-700 border-amber-300 border-dashed', nhan: 'Chưa tới hạn nộp' },
  chua_toi: { lop: 'bg-white text-gray-300 border-gray-200', nhan: 'Kỳ chưa kết thúc' },
  ngoai_hd: { lop: 'bg-gray-50 text-gray-300 border-gray-200 line-through', nhan: 'Ngoài thời gian hợp đồng' },
  mot_phan: { lop: 'bg-orange-50 text-orange-700 border-orange-300 font-bold', nhan: 'Thiếu một phần' },
  kps: { lop: 'bg-slate-50 text-slate-500 border-slate-300', nhan: 'Không phát sinh' },
}

export default function TrangHoSo() {
  return <Suspense fallback={null}><HoSoDuLieu /></Suspense>
}

function HoSoDuLieu() {
  const params = useSearchParams()
  const ctyId = params.get('cty') || ''
  const hs = useHoSoCty(ctyId)
  const { cty, quet, nam, qn, doc, namCu } = hs
  const [moDong, setMoDong] = useState(null)

  const kk = useMemo(() => {
    if (!qn || !doc || !cty) return null
    return kiemKeNam(qn, doc.toKhai, {
      kyKhai: cty.kyKhai, laHkd: cty.laHkd, batDau: cty.batDau, ngungTu: cty.ngungTu, loiDoc: doc.loi.length, bangKe: doc.bangKe,
    })
  }, [qn, doc, cty])

  return (
    <AppShell>
      <KieuBang />
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔎</span>
          <h1 className="text-xl font-bold text-gray-800">Soát xét báo cáo</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">🔒 Chỉ đọc thư mục — không ghi gì vào Drive</span>
        </div>
        <TabSoat giuCty={ctyId} />
        <ThanhCongTy hs={hs} duongDan="/soatbaocao/ho-so" onDoiNam={() => setMoDong(null)} />

        {kk && (
          <>
            {[...(quet?.canhBao || []), ...kk.canhBao].map((c, i) => <Bao key={i} mau="amber">⚠ {c}</Bao>)}
            {quet?.namBoQua?.some(n => !quet.nam[n]) && (
              <p className="mb-3 text-xs text-gray-500">ℹ Thư mục có năm {quet.namBoQua.filter(n => !quet.nam[n]).sort().join(', ')} — app bỏ qua vì chỉ soát từ năm {NAM_BAT_DAU}. Cần năm cũ thì bấm “Thêm dữ liệu năm cũ” và trỏ thẳng vào thư mục năm đó.</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
              <OTongSinhDong so={kk.oTong.thuMuc} nhan={`Thư mục trong Năm ${nam}`} mau="xanhDuong" phu={qn?.tuNamCu ? `Thư mục năm trỏ riêng “${qn.tuNamCu}”` : `Thư mục “${qn?.ten}”`} />
              <OTongSinhDong so={kk.oTong.daCo} nhan="Đã có" mau="xanhLa" phu={kk.toKhaiTom.length ? 'Tờ khai: ' + kk.toKhaiTom.join(' · ') : 'Chưa đọc được tờ khai XML nào'} />
              <OTongSinhDong so={kk.oTong.thieuKy} nhan="Thiếu kỳ / chưa có" mau="do" phu={kk.oTong.thieuO.slice(0, 4).join(' · ') + (kk.oTong.thieuO.length > 4 ? ` · +${kk.oTong.thieuO.length - 4}` : '')} />
              <OTongSinhDong so={kk.oTong.kps} nhan="Không phát sinh (kps)" mau="xam" phu={kk.dong.filter(d => d.trangThai === 'kps').map(d => d.ten).join(' · ')} />
              <OTongSinhDong so={kk.oTong.canXem} nhan="File cần xem" mau="hoPhach" phu={[doc?.scan?.length ? `${doc.scan.length} PDF ảnh scan chưa đọc được` : '', doc?.tuDem ? `${doc.tuDem} file lấy lại từ bộ nhớ đệm` : ''].filter(Boolean).join(' · ') || 'File nén, chưa tải về máy, đọc lỗi'} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
              <BangThuMuc kk={kk} tenNam={qn?.ten} loiDoc={doc?.loi || []} moDong={moDong} setMoDong={setMoDong} />
              <div className="space-y-4">
                <LuoiDuKy kk={kk} />
                {namCu.length > 0 && (
                  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <p className="pt-khung-tieu-de px-4 py-2.5 text-sm font-bold text-gray-800">Thư mục năm trỏ riêng</p>
                    <ul className="px-4 py-3 space-y-1.5 text-xs">
                      {namCu.map(x => (
                        <li key={x.ten} className="flex items-center gap-2">
                          <span className="font-mono truncate flex-1" title={x.ten}>📁 {x.ten}</span>
                          {!x.coQuyen && <ChipMau nhan="Cần cho phép" mau="hoPhach" />}
                          <button type="button" onClick={() => hs.boNamCu(x.ten)} className="text-gray-400 hover:text-red-600" title="Bỏ khỏi app (không xoá gì trong Drive)">Bỏ</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 text-xs text-gray-600 space-y-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">Cách app nhận thư mục</p>
                  <p>• So theo <b>số thứ tự + từ khoá</b>, không so nguyên tên (tên mỗi năm mỗi khác).</p>
                  <p>• Thư mục đuôi <b>(kps)</b> = không phát sinh: không báo thiếu.</p>
                  <p>• Kỳ lấy theo <b>nội dung tờ khai XML</b> khi đọc được, không tin tên file.</p>
                  <p>• Kỳ đã hết nhưng chưa tới hạn nộp thì chỉ “chờ”, chưa báo thiếu.</p>
                  <p>• <b>Bán ra</b>: chỉ cần bảng kê chi tiết tải từ cổng HĐĐT. <b>Mua vào</b>: bảng kê cổng + file hóa đơn XML theo tháng.</p>
                  <p>• Bảng kê cổng: app tự nhận mua vào / bán ra theo MST công ty, tháng theo ngày lập hóa đơn.</p>
                  <p>• App <b>chỉ đọc</b>: không tạo, đổi tên hay xoá gì trong Drive. Sửa file gốc rồi bấm “Đọc lại”.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function BangThuMuc({ kk, tenNam, loiDoc, moDong, setMoDong }) {
  const loiTheoTep = new Map(loiDoc.map(l => [l.tep, l.loi]))
  // Đường dẫn hiện từ dưới thư mục loại (bỏ công ty \ hồ sơ \ năm \ thư mục loại)
  const sauNam = dd => { const i = dd.lastIndexOf(tenNam); return i >= 0 ? dd.slice(i + 2) : dd }
  // Nhóm đang THU GỌN (mặc định mở hết để thấy ngay dòng con nào thiếu)
  const [thuGon, setThuGon] = useState(() => new Set())
  const doiNhom = ten => setThuGon(s => { const m = new Set(s); m.has(ten) ? m.delete(ten) : m.add(ten); return m })
  const cay = gomCay(kk.dong)

  const oTrangThai = trangThai => { const tt = TRANG_THAI[trangThai] || TRANG_THAI.ghi_nhan; return <ChipMau nhan={tt.nhan} mau={tt.mau} /> }
  const oSoFile = n => (n == null ? <span className="text-gray-300">—</span> : n)

  // Một dòng thư mục (đơn hoặc con trong nhóm) + phần danh sách file khi bấm mở
  const dongThuMuc = (d, i, soc, viTriCon) => {
    const moDuoc = d.tep?.length > 0
    const dangMo = moDong === i
    const tepLoi = (d.tep || []).filter(t => loiTheoTep.has(t)).length
    return [
      <tr key={i} className={`pt-n${soc} ` + (moDuoc ? 'cursor-pointer ' : '') + (dangMo ? 'pt-mo' : '')} onClick={() => moDuoc && setMoDong(dangMo ? null : i)}>
        <td className="min-w-[240px] max-w-[380px]">
          <p className={'text-[13px] leading-snug flex items-start ' + (viTriCon ? 'pl-5 ' : 'font-medium ') + (d.coThuMuc ? 'text-gray-800' : 'text-gray-400')}>
            {viTriCon && <span className="text-gray-300 w-4 flex-shrink-0 font-mono">{viTriCon === 'cuoi' ? '└' : '├'}</span>}
            <span className="inline-block w-3 flex-shrink-0 text-gray-400">{moDuoc ? (dangMo ? '▾' : '▸') : ''}</span>
            <span>{viTriCon ? '📂' : '📁'} {viTriCon ? d.tenCon : d.ten}</span>
          </p>
        </td>
        <td className="whitespace-nowrap">{oTrangThai(d.trangThai)}</td>
        <td className="text-xs text-gray-600 max-w-[300px]">
          {d.moTa}
          {(d.canXem > 0 || tepLoi > 0) && <span className="block text-amber-700">{[d.canXem ? `${d.canXem} file cần xem` : '', tepLoi ? `${tepLoi} XML đọc lỗi` : ''].filter(Boolean).join(' · ')}</span>}
        </td>
        <td><NhanDuoi dinhDang={d.dinhDang} /></td>
        <td className="text-right tabular-nums font-semibold text-gray-700">{oSoFile(d.soFile)}</td>
      </tr>,
      dangMo && (
        <tr key={i + '-mo'} className="pt-con">
          <td colSpan={5}>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs" style={{ borderSpacing: 0 }}>
                <tbody>
                  {d.tep.map((t, j) => {
                    const canXem = loiTheoTep.get(t) || (['rar', 'zip', '7z'].includes(t.duoi) ? 'File nén — app không mở được, giải nén ra thư mục' : t.co == null ? 'Chưa tải về máy / không mở được' : '')
                    const o = { background: 'transparent', border: 0 }
                    return (
                      <tr key={j}>
                        <td className="font-mono text-gray-700 py-1 pr-3" style={o}>
                          <span className="text-gray-400">{sauNam(t.duongDan).map(x => x + ' \\ ')}</span>{t.ten}
                        </td>
                        <td className="text-amber-700 py-1 pr-3" style={o}>{canXem}</td>
                        <td className="text-right tabular-nums text-gray-500 py-1 pr-3 whitespace-nowrap" style={o}>{coChu(t.co)}</td>
                        <td className="text-right tabular-nums text-gray-400 py-1 whitespace-nowrap" style={o}>{ngaySua(t.sua)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ),
    ]
  }

  return (
    <div className="pt-bang overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr><th>Thư mục (đúng cây chuẩn Savitax)</th><th>Trạng thái</th><th>App thấy gì</th><th>Định dạng</th><th className="text-right">File</th></tr>
        </thead>
        <tbody>
          {cay.map((n, k) => {
            const soc = k % 2   // xen kẽ tông nền theo THƯ MỤC CẤP 1; dòng con cùng tông với dòng cha
            if (n.loai === 'don') return dongThuMuc(n.d, n.i, soc, null)
            const gon = thuGon.has(n.ten)
            return [
              <tr key={'nhom-' + n.ten} className={`pt-n${soc} cursor-pointer`} onClick={() => doiNhom(n.ten)}>
                <td className="min-w-[240px] max-w-[380px]">
                  <p className="text-[13px] font-semibold leading-snug flex items-start text-gray-800">
                    <span className="inline-block w-3 flex-shrink-0 text-gray-500">{gon ? '▸' : '▾'}</span>
                    <span>📁 {n.ten}</span>
                  </p>
                </td>
                <td className="whitespace-nowrap">{oTrangThai(n.trangThai)}</td>
                <td className="text-xs text-gray-500">
                  {n.moTa && <span className="block text-gray-600">{n.moTa}</span>}
                  <span className={n.moTa ? 'text-gray-400' : ''}>{n.con.length} thư mục con{gon ? ' — bấm để mở' : ''}</span>
                  {n.canXem > 0 && <span className="block text-amber-700">{n.canXem} file cần xem</span>}
                </td>
                <td><NhanDuoi dinhDang={n.dinhDang} /></td>
                <td className="text-right tabular-nums font-bold text-gray-800">{oSoFile(n.soFile)}</td>
              </tr>,
              ...(gon ? [] : n.con.flatMap((c, j) => dongThuMuc(c.d, c.i, soc, j === n.con.length - 1 ? 'cuoi' : 'giua'))),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

function LuoiDuKy({ kk }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <p className="pt-khung-tieu-de px-4 py-2.5 text-sm font-bold text-gray-800">Đủ kỳ chưa — Năm {kk.nam}</p>
      <div className="px-4 py-3 space-y-3">
        {kk.luoi.map(l => (
          <div key={l.nhan}>
            <p className="text-xs text-gray-600 mb-1">{l.nhan}</p>
            <div className="flex flex-wrap gap-1.5">
              {l.o.map(x => {
                const m = O_LUOI[x.tt] || O_LUOI.chua_toi
                return (
                  <span key={x.ma} title={`${x.ma}: ${m.nhan}${x.ghiChu ? ' — ' + x.ghiChu : ''}`}
                    className={`inline-flex items-center justify-center min-w-[40px] px-1.5 py-1 rounded-lg border text-[11px] font-semibold tabular-nums ${m.lop}`}>
                    {x.ma.replace(/^T0/, 'T')}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          {['co', 'mot_phan', 'thieu', 'cho', 'chua_toi', 'kps', 'ngoai_hd'].map(k => (
            <span key={k} className="inline-flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded border ${O_LUOI[k].lop}`} />{O_LUOI[k].nhan}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
