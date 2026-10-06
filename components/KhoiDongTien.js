'use client'

// KHỐI DÒNG TIỀN CÔNG NỢ — 5 thẻ + các bảng chi tiết bấm ra. Dùng CHUNG cho trang Phòng (cả phòng)
// và trang Quản lý công nợ (từng nhân viên) để hai nơi luôn cùng một cách hiển thị (anh yêu cầu
// 06/10/2026). Mọi con số do máy chủ tính sẵn (lib/dongTienPhong.js) — ở đây KHÔNG cộng lại.
//
// Props: dongTien (kết quả tinhDongTienPhong) · hcnsOn · open / setOpen (thẻ nào đang mở bảng:
// 'ton' | 'hcns' | 'khac' | 'chuyen' | null — trang cha giữ, vì trang Phòng còn bảng HCNS riêng)
// · staffNameOf(id) · selMonth / selYear.

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500' : v >= 70 ? 'bg-yellow-400' : 'bg-red-400'
const zebra = (i) => i % 2 === 0 ? 'bg-white' : 'bg-gray-50'

export default function KhoiDongTien({ dongTien, hcnsOn, open, setOpen, staffNameOf = () => '—', selMonth, selYear }) {
  const toggle = (k) => setOpen(open === k ? null : k)
  if (!dongTien) return null
  return (
    <>
                  {/* ===== KHỐI DÒNG TIỀN CÔNG NỢ PHÒNG =====
                      Tồn đầu kỳ + phí phát sinh trong kỳ − đã thu = còn phải thu chuyển kỳ sau.
                      Mọi con số do MÁY CHỦ tính (lib/dongTienPhong.js) — trang KHÔNG tự cộng lại,
                      vì mỗi trang tự cộng là lại ra số khác nhau (ca %-công nợ 01/10/2026).
                      Thẻ đầu/cuối tách 3 dòng đúng 3 loại thu: kế toán · HCNS · dịch vụ khác. */}
                  {dongTien && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <button onClick={() => toggle('ton')}
                      className={'text-left bg-white border border-t-4 border-t-orange-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (open === 'ton' ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">📦 Tồn đầu kỳ chuyển sang</p>
                      <p className={'text-lg font-bold ' + (dongTien.tonDau.total > 0 ? 'text-orange-500' : 'text-green-600')}>{fmt(dongTien.tonDau.total)}đ</p>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-200 space-y-0.5">
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Kế toán</span><span className="font-semibold text-gray-700">{fmt(dongTien.tonDau.ketoan)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">HCNS</span>
                          {dongTien.tonDau.hcnsCoSoLieu
                            ? <span className="font-semibold text-violet-600">{fmt(dongTien.tonDau.hcns)}đ</span>
                            : <span className="text-gray-400 italic">chưa tách riêng</span>}
                        </div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Dịch vụ khác</span><span className="font-semibold text-teal-600">{fmt(dongTien.tonDau.dvk)}đ</span></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.tonDau.soCty} công ty
                        {dongTien.tonDau.daThuTrongKy > 0 && <span className="text-green-600"> · kỳ này đã thu {fmt(dongTien.tonDau.daThuTrongKy)}đ</span>}
                        {dongTien.tonDau.daXoaTrongKy > 0 && <span className="text-gray-500"> · đã xoá nợ {fmt(dongTien.tonDau.daXoaTrongKy)}đ</span>}
                      </p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.tonDau.soCty === 0 ? '—' : (open === 'ton' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>

                    <div className="bg-white border border-gray-100 border-t-4 border-t-green-500 rounded-2xl px-4 py-3 flex flex-col">
                      <p className="text-xs text-gray-400 mb-1">📋 Phí kế toán trong kỳ</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(dongTien.phiKetoan.phi)}đ</p>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-600 font-medium">Đã thu: {fmt(dongTien.phiKetoan.daThu)}đ</span>
                        <span className={pctClr(dongTien.phiKetoan.pct) + ' font-bold'}>{dongTien.phiKetoan.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                        <div className={'h-full rounded-full ' + barClr(dongTien.phiKetoan.pct)} style={{ width: dongTien.phiKetoan.pct + '%' }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.phiKetoan.soCty} công ty đến hạn
                        {/* Công ty đã ngưng dịch vụ vẫn có phí ở các kỳ họ còn là khách — nói rõ để
                            không ai thắc mắc vì sao thẻ nhỉnh hơn tổng danh sách nhân viên bên dưới. */}
                        {dongTien.phiKetoan.ctyNgung > 0 && (
                          <span className="text-amber-600"> · gồm {fmt(dongTien.phiKetoan.phiNgung)}đ của {dongTien.phiKetoan.ctyNgung} cty đã ngưng DV</span>
                        )}
                      </p>
                    </div>

                    {/* Tím cho HCNS. Thẻ tự ẩn ở bản clone (không có bảng hcns_*). */}
                    {hcnsOn && (
                      <button onClick={() => toggle('hcns')}
                        className={'text-left bg-white border border-t-4 border-t-violet-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                          (open === 'hcns' ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-100')}>
                        <p className="text-xs text-gray-400 mb-1">🏢 Phí HCNS trong kỳ</p>
                        <p className={'text-lg font-bold ' + (dongTien.phiHcns.phi > 0 ? 'text-violet-600' : 'text-gray-300')}>{fmt(dongTien.phiHcns.phi)}đ</p>
                        {dongTien.phiHcns.phi > 0 ? (<>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-violet-600 font-medium">Đã thu: {fmt(dongTien.phiHcns.daThu)}đ</span>
                            <span className="text-violet-600 font-bold">{dongTien.phiHcns.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: dongTien.phiHcns.pct + '%' }} />
                          </div>
                        </>) : <p className="text-xs text-gray-400 mt-1">Chưa công ty nào dùng DV HCNS</p>}
                        <p className="text-xs text-gray-400 mt-1.5">{dongTien.phiHcns.soCty} công ty dùng DV HCNS</p>
                        <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.phiHcns.phi === 0 ? '—' : (open === 'hcns' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                      </button>
                    )}

                    <button onClick={() => toggle('khac')}
                      className={'text-left bg-white border border-t-4 border-t-teal-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (open === 'khac' ? 'border-teal-300 ring-1 ring-teal-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">🗂 Phí thu khác trong kỳ</p>
                      <p className={'text-lg font-bold ' + (dongTien.thuKhac.phaiThu > 0 ? 'text-teal-600' : 'text-gray-300')}>{fmt(dongTien.thuKhac.phaiThu)}đ</p>
                      {dongTien.thuKhac.phaiThu > 0 ? (<>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-teal-600 font-medium">Đã thu: {fmt(dongTien.thuKhac.daThu)}đ</span>
                          <span className="text-teal-600 font-bold">{dongTien.thuKhac.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: dongTien.thuKhac.pct + '%' }} />
                        </div>
                      </>) : <p className="text-xs text-gray-400 mt-1">Kỳ này không phát sinh</p>}
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dongTien.thuKhac.soCty} công ty
                        {dongTien.thuKhac.soHoSo > 0 && <span> · {dongTien.thuKhac.soHoSo} hồ sơ Dịch vụ khác</span>}
                      </p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.thuKhac.hoSo.length === 0 ? '—' : (open === 'khac' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>

                    <button onClick={() => toggle('chuyen')}
                      className={'text-left bg-white border border-t-4 border-t-red-500 rounded-2xl px-4 py-3 flex flex-col transition-colors hover:bg-gray-50 ' +
                        (open === 'chuyen' ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100')}>
                      <p className="text-xs text-gray-400 mb-1">💰 Còn phải thu chuyển kỳ sau</p>
                      <p className={'text-lg font-bold ' + (dongTien.chuyenKySau.total > 0 ? 'text-red-500' : 'text-green-600')}>{fmt(dongTien.chuyenKySau.total)}đ</p>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-200 space-y-0.5">
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Kế toán</span><span className="font-semibold text-gray-700">{fmt(dongTien.chuyenKySau.ketoan)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">HCNS</span><span className="font-semibold text-violet-600">{fmt(dongTien.chuyenKySau.hcns)}đ</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Dịch vụ khác</span><span className="font-semibold text-teal-600">{fmt(dongTien.chuyenKySau.dvk)}đ</span></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">{dongTien.chuyenKySau.soCty} công ty</p>
                      <p className="text-xs text-blue-600 mt-auto pt-1">{dongTien.chuyenKySau.soCty === 0 ? '—' : (open === 'chuyen' ? '▴ Đang mở' : '▾ Xem danh sách')}</p>
                    </button>
                  </div>
                  )}

                  {/* Bảng của thẻ Phí HCNS — công ty có phí HCNS trong kỳ, nhóm theo nhân viên. */}
                  {/* Thẻ đang mở mà chưa có danh sách (trang còn giữ dữ liệu nạp từ trước) thì NÓI RÕ, đừng để
                      thẻ ghi "Đang mở" mà bên dưới trống trơn. */}
                  {open === 'hcns' && (dongTien.phiHcns.theoCty || []).length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-500">
                      {dongTien.phiHcns.phi > 0 ? 'Chưa nạp được danh sách công ty — bấm “Tải lại” để lấy dữ liệu mới.' : 'Kỳ này không công ty nào có phí HCNS.'}
                    </div>
                  )}
                  {open === 'hcns' && (dongTien.phiHcns.theoCty || []).length > 0 && (() => {
                    const nhom = []
                    for (const x of dongTien.phiHcns.theoCty) {
                      let g = nhom.find(n => n.id === x.staffId)
                      if (!g) { g = { id: x.staffId, name: staffNameOf(x.staffId), items: [], fee: 0, paid: 0 }; nhom.push(g) }
                      g.items.push(x); g.fee += x.fee; g.paid += x.paid
                    }
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100 bg-violet-50 flex items-center justify-between">
                          <p className="text-xs font-semibold text-violet-800">🏢 Phí HCNS T{selMonth}/{selYear} — {dongTien.phiHcns.soCty} công ty · đã thu {fmt(dongTien.phiHcns.daThu)} / {fmt(dongTien.phiHcns.phi)}đ</p>
                          <button onClick={() => setOpen(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                        </div>
                        {nhom.map(g => (
                          <div key={g.id || 'khong-ro'}>
                            <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-700">{g.name}</p>
                              <p className="text-xs font-semibold text-violet-700">{g.items.length} cty · {fmt(g.paid)} / {fmt(g.fee)}đ</p>
                            </div>
                            {g.items.map((c, i) => (
                              <div key={c.clientId} className={'px-4 py-2 pl-7 flex items-center justify-between gap-3 border-b border-gray-50 ' + zebra(i)}>
                                <p className="text-xs text-gray-700 truncate">{c.name}</p>
                                <p className="text-xs whitespace-nowrap flex-shrink-0">
                                  <span className="text-gray-400">{fmt(c.paid)} / </span>
                                  <span className="font-semibold text-gray-800">{fmt(c.fee)}đ</span>
                                  <span className={'ml-2 text-white px-2 py-0.5 rounded-full ' +
                                    (c.remain === 0 ? 'bg-green-600' : c.paid > 0 ? 'bg-yellow-500' : 'bg-red-500')}>
                                    {c.remain === 0 ? 'Đã thu đủ' : c.paid > 0 ? 'Thu một phần' : 'Chưa thu'}
                                  </span>
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                        <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                          Phí HCNS có dòng riêng trong “Tồn đầu kỳ” và “Còn phải thu chuyển kỳ sau”, nhưng KHÔNG tính vào %-KPI thu hồi công nợ.
                        </p>
                      </div>
                    )
                  })()}

                  {/* Bảng chi tiết: nhóm theo nhân viên, 3 cột đúng 3 loại thu của thẻ.
                      Dùng THẲNG dongTien.*.theoCty do máy chủ trả — không lọc/cộng lại ở đây. */}
                  {(open === 'ton' || open === 'chuyen') && dongTien && (() => {
                    const k = open === 'ton' ? dongTien.tonDau : dongTien.chuyenKySau
                    const nhom = []
                    for (const x of k.theoCty) {
                      let g = nhom.find(n => n.id === x.staffId)
                      if (!g) { g = { id: x.staffId, name: staffNameOf(x.staffId), items: [], total: 0 }; nhom.push(g) }
                      g.items.push(x); g.total += x.total
                    }
                    nhom.sort((a, b) => b.total - a.total)
                    const ton = open === 'ton'
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className={'px-4 py-2.5 border-b border-gray-100 flex items-center justify-between ' + (ton ? 'bg-orange-50' : 'bg-red-50')}>
                          <p className={'text-xs font-semibold ' + (ton ? 'text-orange-800' : 'text-red-800')}>
                            {ton ? '📦 Tồn đầu kỳ chuyển sang' : '💰 Còn phải thu chuyển kỳ sau'} — {k.soCty} công ty · {fmt(k.total)}đ
                          </p>
                          <button onClick={() => setOpen(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_96px_96px_96px_104px] gap-2 text-xs text-gray-400">
                          <span>Công ty</span><span className="text-right">Kế toán</span><span className="text-right">HCNS</span>
                          <span className="text-right">DV khác</span><span className="text-right">Tổng</span>
                        </div>
                        {k.theoCty.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-gray-400">{ton ? 'Đầu kỳ không công ty nào còn nợ 🎉' : 'Tất cả đã thu đủ, không có gì chuyển kỳ sau 🎉'}</p>
                        ) : nhom.map(g => (
                          <div key={g.id || 'khong-ro'}>
                            <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-700">{g.name}</p>
                              <p className={'text-xs font-semibold ' + (ton ? 'text-orange-600' : 'text-red-600')}>{g.items.length} cty · {fmt(g.total)}đ</p>
                            </div>
                            {g.items.map((x, i) => (
                              <div key={x.clientId} className={'px-4 py-2 pl-7 border-b border-gray-50 grid grid-cols-[1fr_96px_96px_96px_104px] gap-2 items-center text-xs ' + zebra(i)}>
                                <span className="text-gray-700 truncate">
                                  {x.name}
                                  {x.ngung && <span className="ml-1.5 text-[10px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Ngưng DV</span>}
                                </span>
                                <span className="text-right text-gray-700">{x.ketoan > 0 ? fmt(x.ketoan) : '—'}</span>
                                <span className="text-right text-violet-600">{x.hcns > 0 ? fmt(x.hcns) : '—'}</span>
                                <span className="text-right text-teal-600">{x.dvk > 0 ? fmt(x.dvk) : '—'}</span>
                                <span className="text-right font-semibold text-gray-900">{fmt(x.total)}đ</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {ton && !dongTien.tonDau.hcnsCoSoLieu && (
                          <p className="px-4 py-2.5 text-xs text-gray-500 bg-amber-50 border-t border-amber-100">
                            Cột HCNS trống vì phí HCNS mới tách riêng từ T9/2026 — các kỳ trước đó không có số HCNS để chuyển sang.
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {open === 'khac' && dongTien && (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-teal-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-teal-800">
                          🗂 Phí thu khác T{selMonth}/{selYear} — phải thu {fmt(dongTien.thuKhac.phaiThu)}đ · đã thu {fmt(dongTien.thuKhac.daThu)}đ
                        </p>
                        <button onClick={() => setOpen(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Đóng</button>
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_104px_104px_104px_90px] gap-2 text-xs text-gray-400">
                        <span>Công ty / hồ sơ</span><span className="text-right">Phải thu</span><span className="text-right">Đã thu</span>
                        <span className="text-right">Còn lại</span><span className="text-right">Trạng thái</span>
                      </div>
                      {dongTien.thuKhac.hoSo.length === 0 ? (
                        <p className="px-4 py-4 text-xs text-gray-400">Kỳ này không có khoản thu khác nào.</p>
                      ) : dongTien.thuKhac.hoSo.map((h, i) => (
                        <div key={h.id} className={'px-4 py-2.5 border-b border-gray-50 grid grid-cols-[1fr_104px_104px_104px_90px] gap-2 items-center text-xs ' + zebra(i)}>
                          <span className="min-w-0">
                            <span className="text-gray-800 block truncate">{h.clientName}</span>
                            <span className="text-gray-400 block truncate">
                              {h.name}
                              {h.le ? ' · thu khác lẻ' : (h.moTrongKy ? ' · hồ sơ mở kỳ này' : ' · hồ sơ kỳ trước, kỳ này có thu')}
                            </span>
                          </span>
                          <span className="text-right text-gray-700">{fmt(h.phaiThu)}</span>
                          <span className="text-right text-green-600 font-medium">{fmt(h.daThu)}</span>
                          <span className={'text-right font-medium ' + (h.conLai > 0 ? 'text-red-500' : 'text-gray-300')}>{h.conLai > 0 ? fmt(h.conLai) : '0'}</span>
                          <span className={'text-right ' + (h.status === 'done' ? 'text-green-600' : 'text-orange-500')}>{h.status === 'done' ? 'Đã đóng' : 'Đang mở'}</span>
                        </div>
                      ))}
                      <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                        Hồ sơ chưa thu đủ thì phần còn lại tự chảy vào thẻ “Còn phải thu chuyển kỳ sau”, dòng Dịch vụ khác.
                      </p>
                    </div>
                  )}

    </>
  )
}
