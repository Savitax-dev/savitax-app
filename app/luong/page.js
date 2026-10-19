'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { goi, HopThongBao } from '@/components/luong/chung'
import ChamCongCuaToi from '@/components/luong/ChamCongCuaToi'
import ChamCongPhong from '@/components/luong/ChamCongPhong'
import CapBacNgayLe from '@/components/luong/CapBacNgayLe'
import ThuongDvk from '@/components/luong/ThuongDvk'
import BangLuong from '@/components/luong/BangLuong'

// Chấm công & Lương (/luong) — bước 1 của phân hệ Tiền lương.
//   Tab "Chấm công của tôi": mọi nhân viên tự khai ngày công, bấm xác nhận là khoá.
//   Tab "Chấm công phòng": trưởng phòng xem + sửa (bắt buộc lý do) công của phòng mình làm trưởng;
//                          ban lãnh đạo / kế toán nội bộ (view_payroll) xem cả công ty.
//   Tab "Cấp bậc & ngày lễ": người có manage_payroll thiết lập bảng cấp bậc và ngày nghỉ lễ.
// Lương từng nhân viên đặt ở trang Quản lý nhân viên (cột "Cấp bậc · Lương").

export default function LuongPage() {
  const router = useRouter()
  const [quyen, setQuyen] = useState(null)
  const [tab, setTab] = useState('cua_toi')
  const [loiChung, setLoiChung] = useState(null)

  useEffect(() => {
    (async () => {
      const q = await goi('/api/admin/luong?viec=quyen')
      if (q.error) { if (/đăng nhập/i.test(q.error)) router.push('/login'); else setLoiChung(q.error); return }
      setQuyen(q)
    })()
  }, [router])

  if (loiChung) return <AppShell><div className="px-4 md:px-8 py-6"><HopThongBao msg={{ loai: 'loi', text: loiChung }} /></div></AppShell>
  if (!quyen) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>

  const tabs = [
    quyen.cham_cong && ['cua_toi', 'Chấm công của tôi', '🗓️'],
    (quyen.view || quyen.phongTruong?.length > 0) && ['phong', quyen.view ? 'Chấm công toàn công ty' : 'Chấm công phòng', '👥'],
    quyen.cham_cong && ['dvk', 'Thưởng dịch vụ khác', '🧾'],
    quyen.view && ['bang_luong', 'Bảng lương', '💰'],
    quyen.manage && ['thiet_lap', 'Cấp bậc & ngày lễ', '⚙️'],
  ].filter(Boolean)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5 w-full">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-rose-500 flex items-center justify-center text-white text-xl shadow-sm">🗓️</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chấm công & Lương</h1>
            <p className="text-sm text-gray-500">Ngày công chuẩn = số ngày của tháng trừ chủ nhật và ngày lễ · thứ Bảy tính đủ một công</p>
          </div>
        </div>

        {/* Các tab là những KHỐI tách rời, chia đều hết bề ngang: quản trị 5 khối, nhân viên 2 khối thì
            mỗi khối tự giãn ra cho đều (flex-1), màn hẹp thì tự xuống dòng. */}
        {/* Một khung chung bao các khối — vẫn tách từng khối nhưng nhìn thành một thanh. */}
        <div className="flex flex-wrap gap-2 mb-5 w-full p-2 rounded-2xl bg-white border border-gray-200 shadow-sm">
          {tabs.map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)}
              className={'flex-1 min-w-[170px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-all ' + (tab === k
                ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white font-semibold shadow-md'
                : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-[#8B1A1A]/30 hover:bg-rose-50 hover:text-[#8B1A1A]')}>
              <span className="text-lg leading-none">{ic}</span>{l}
            </button>
          ))}
        </div>

        {tab === 'cua_toi' && quyen.cham_cong && <ChamCongCuaToi thangDuocKhai={quyen.thangDuocKhai} />}
        {tab === 'phong' && <ChamCongPhong quyen={quyen} />}
        {tab === 'dvk' && quyen.cham_cong && <ThuongDvk quyen={quyen} />}
        {tab === 'bang_luong' && quyen.view && <BangLuong quyen={quyen} />}
        {tab === 'thiet_lap' && quyen.manage && <CapBacNgayLe />}
        {!tabs.length && <p className="text-sm text-gray-500">Tài khoản chưa được cấp quyền chấm công.</p>}
      </div>
    </AppShell>
  )
}
