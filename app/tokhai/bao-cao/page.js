'use client'
// Báo cáo tờ khai — Phân hệ Tờ khai.
//
// Ba cấp SỔ XUỐNG ngay tại chỗ, không nhảy trang: phòng → nhân viên → công ty.
// Trưởng phòng bung phòng mình ra là thấy ngay ai còn tồn, bung tiếp nhân viên là thấy công ty
// nào chưa nộp — không mất ngữ cảnh, không phải bấm quay lại.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import NhacHanNop from '@/components/NhacHanNop'
import TabToKhai from '@/components/TabToKhai'
import { OTong, ThanhPhanTram, soHoacGach, gioVN } from '@/components/tokhaiUI'

export default function TrangBaoCao() {
  const router = useRouter()
  const [dl, setDl] = useState(null)
  const [ky, setKy] = useState('')
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [bung, setBung] = useState({})       // khoá cấp dưới → dữ liệu đã tải
  const [dangBung, setDangBung] = useState({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
  }, [router])

  useEffect(() => {
    setDangTai(true); setLoi(''); setBung({})
    fetch('/api/admin/tokhai/tong-quan' + (ky ? '?ky=' + encodeURIComponent(ky) : ''))
      .then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else setDl(j) })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [ky])

  const kyDangXem = ky || dl?.ky || ''

  // Bung một dòng: tải dữ liệu cấp dưới rồi nhớ lại, bấm lần nữa là thu vào.
  async function doiBung(khoa, thamSo) {
    if (bung[khoa]) { setBung(p => ({ ...p, [khoa]: null })); return }
    setDangBung(p => ({ ...p, [khoa]: true }))
    const q = new URLSearchParams({ ...thamSo })
    if (kyDangXem) q.set('ky', kyDangXem)
    try {
      const j = await fetch('/api/admin/tokhai/tong-quan?' + q).then(r => r.json())
      setBung(p => ({ ...p, [khoa]: j.error ? { ds: [], loi: j.error } : j }))
    } finally {
      setDangBung(p => ({ ...p, [khoa]: false }))
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-900">Báo cáo tờ khai</h1>
          <select value={kyDangXem} onChange={e => setKy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm font-medium">
            {(dl?.cacKy || []).map(k => <option key={k.ma} value={k.ma}>{k.nhan}</option>)}
          </select>
          <span className="text-xs text-gray-400">Bấm vào tên phòng để xem nhân viên, bấm nhân viên để xem công ty</span>
        </div>

        {loi && <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {dangTai && <p className="text-sm text-gray-400 py-10 text-center">Đang tải…</p>}

        {!dangTai && dl?.tong && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <OTong mau="xanhDuong" so={dl.tong.phaiNop} nhan="Phải nộp trong kỳ" />
            <OTong mau="xanhLa"    so={dl.tong.chapNhan} nhan="Chấp nhận" />
            <OTong mau="hoPhach"   so={dl.tong.choKetQua} nhan="Chờ kết quả" />
            <OTong mau="xam"       so={dl.tong.chuaNop} nhan="Chưa nộp" />
            <OTong mau="do"        so={dl.tong.quaHan} nhan="Quá hạn" />
            <OTong mau="tim"       so={`${dl.tong.daNoiTaiKhoan}/${dl.tong.soCongTy}`} nhan="Đã nối tài khoản" />
          </div>
        )}

        {!dangTai && dl && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 text-gray-500">
                    <th className="text-left px-3 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Phòng / Nhân viên / Công ty</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Cty</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Đã nối</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Phải nộp</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Chấp nhận</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Chờ KQ</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Chưa nộp</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Quá hạn</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Hoàn thành</th>
                    <th className="text-right px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Đúng hạn</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Đồng bộ</th>
                  </tr>
                </thead>
                <tbody>
                  {dl.ds.map(phong => (
                    <Nhom key={phong.id} o={phong} cap={0}
                      moDuoc={!phong.id.startsWith('chua-')}
                      dangBung={!!dangBung['p:' + phong.id]}
                      duLieu={bung['p:' + phong.id]}
                      onBung={() => doiBung('p:' + phong.id, { roomId: phong.id })}
                      capDuoi={(nv) => (
                        <Nhom key={nv.id} o={nv} cap={1}
                          moDuoc={!nv.id.startsWith('chua-')}
                          dangBung={!!dangBung['nv:' + nv.id]}
                          duLieu={bung['nv:' + nv.id]}
                          onBung={() => doiBung('nv:' + nv.id, { roomId: phong.id, staffId: nv.id })}
                          capDuoi={(cty) => <Nhom key={cty.id} o={cty} cap={2} moDuoc={false} />}
                        />
                      )}
                    />
                  ))}

                  {dl.tong && (
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                      <td className="px-3 py-2.5 text-gray-800">Tổng cộng</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{dl.tong.soCongTy}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{dl.tong.daNoiTaiKhoan}/{dl.tong.soCongTy}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{dl.tong.phaiNop}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-green-700">{soHoacGach(dl.tong.chapNhan)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-amber-700">{soHoacGach(dl.tong.choKetQua)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{soHoacGach(dl.tong.chuaNop)}</td>
                      <td className={'px-2 py-2.5 text-right tabular-nums ' + (dl.tong.quaHan ? 'text-red-700' : 'text-gray-300')}>
                        {soHoacGach(dl.tong.quaHan)}
                      </td>
                      <td className="px-2 py-2.5"><ThanhPhanTram v={dl.tong.phanTramHoanThanh} /></td>
                      <td className="px-2 py-2.5 text-right"><ThanhPhanTram v={dl.tong.phanTramDungHan} chiSo /></td>
                      <td className="px-2 py-2.5" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          <b className="text-gray-500">Hoàn thành</b> = (chấp nhận + chờ kết quả + không phát sinh) / phải nộp.{' '}
          <b className="text-gray-500">Đúng hạn</b> = số tờ khai có ngày tiếp nhận ≤ hạn nộp, tính trên
          số tờ đã có ngày tiếp nhận — tờ chưa nộp thì chưa kết luận được.
        </p>
      </div>
    </AppShell>
  )
}

// Một dòng trong bảng, kèm phần bung ra bên dưới. Dùng lại cho cả 3 cấp để bảng luôn thẳng cột.
function Nhom({ o, cap, moDuoc, dangBung, duLieu, onBung, capDuoi }) {
  const nen = ['bg-white', 'bg-slate-50/70', 'bg-slate-100/60'][cap]
  const thut = ['pl-3', 'pl-9', 'pl-16'][cap]
  const co = !!duLieu

  return (
    <>
      <tr className={nen + ' border-b border-gray-100 hover:bg-red-50/30 transition-colors'}>
        <td className={'py-2.5 pr-3 ' + thut}>
          {moDuoc ? (
            <button onClick={onBung} className="flex items-center gap-1.5 text-left group">
              <span className={'text-[10px] text-gray-400 transition-transform ' + (co ? 'rotate-90' : '')}>▶</span>
              <span className={(cap === 0 ? 'font-semibold text-gray-900' : 'text-gray-700') + ' group-hover:text-[#8B1A1A]'}>
                {o.ten}
              </span>
              {dangBung && <span className="text-[10px] text-gray-400">đang tải…</span>}
            </button>
          ) : (
            <span className={'flex items-center gap-1.5 ' + (cap === 2 ? 'text-gray-600' : 'text-gray-700')}>
              <span className="text-gray-200 text-[10px]">•</span>{o.ten}
            </span>
          )}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-gray-600">{o.soCongTy}</td>
        <td className="px-2 py-2.5 text-right tabular-nums">
          <span className={o.daNoiTaiKhoan === o.soCongTy ? 'text-green-700 font-medium' : 'text-purple-700'}>
            {o.daNoiTaiKhoan}/{o.soCongTy}
          </span>
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums font-medium text-gray-800">{o.phaiNop}</td>
        <td className="px-2 py-2.5 text-right tabular-nums text-green-700">{soHoacGach(o.chapNhan)}</td>
        <td className="px-2 py-2.5 text-right tabular-nums text-amber-700">{soHoacGach(o.choKetQua)}</td>
        <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{soHoacGach(o.chuaNop)}</td>
        <td className={'px-2 py-2.5 text-right tabular-nums font-semibold ' + (o.quaHan ? 'text-red-700' : 'text-gray-300')}>
          {soHoacGach(o.quaHan)}
        </td>
        <td className="px-2 py-2.5"><ThanhPhanTram v={o.phanTramHoanThanh} /></td>
        <td className="px-2 py-2.5 text-right">
          <ThanhPhanTram v={o.phanTramDungHan} chiSo />
          {o.coNgayTiepNhan > 0 && (
            <span className="block text-[10px] text-gray-400">{o.dungHan}/{o.coNgayTiepNhan} tờ</span>
          )}
        </td>
        <td className="px-2 py-2.5 text-xs text-gray-500 whitespace-nowrap">{gioVN(o.dongBoGanNhat)}</td>
      </tr>

      {co && duLieu.loi && (
        <tr><td colSpan={11} className="px-3 py-2 text-xs text-red-600 bg-red-50">{duLieu.loi}</td></tr>
      )}
      {co && !duLieu.loi && !duLieu.ds?.length && (
        <tr><td colSpan={11} className={'py-2 text-xs text-gray-400 ' + ['pl-9', 'pl-16', 'pl-20'][cap]}>
          Không có dữ liệu ở cấp dưới.
        </td></tr>
      )}
      {co && duLieu.ds?.map(con => capDuoi(con))}
    </>
  )
}
