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
import PhieuLuongCuaToi from '@/components/luong/PhieuLuongCuaToi'
import BangLuongCtv from '@/components/luong/BangLuongCtv'
import PhieuCtvCuaToi from '@/components/luong/PhieuCtvCuaToi'
import { layQuyenLuong } from '@/lib/khoiDong'
import ThanhTabLuong, { dsTabLuong } from '@/components/luong/ThanhTabLuong'

// Chấm công & Lương (/luong) — bước 1 của phân hệ Tiền lương.
//   Tab "Chấm công của tôi": mọi nhân viên tự khai ngày công, bấm xác nhận là khoá.
//   Tab "Chấm công phòng": trưởng phòng xem + sửa (bắt buộc lý do) công của phòng mình làm trưởng;
//                          ban lãnh đạo / kế toán nội bộ (view_payroll) xem cả công ty; người có cham_cong_toan_cty
//                          (sql/42, HCNS phụ trách chấm công) xem + nhập file máy + sửa công cả công ty, KHÔNG thấy lương.
//   Tab "Cấp bậc & ngày lễ": người có manage_payroll thiết lập bảng cấp bậc và ngày nghỉ lễ.
// Lương từng nhân viên đặt ở trang Quản lý nhân viên (cột "Cấp bậc · Lương").

export default function LuongPage() {
  const router = useRouter()
  const [quyen, setQuyen] = useState(null)
  const [tab, setTab] = useState('cua_toi')
  const [loiChung, setLoiChung] = useState(null)

  useEffect(() => {
    (async () => {
      const q = await layQuyenLuong()   // gộp trong /api/admin/khoi-dong, nhớ 5 phút trong phiên
      if (q.error) { if (/đăng nhập/i.test(q.error)) router.push('/login'); else setLoiChung(q.error); return }
      // Mở đúng tab khi quay về từ trang Hướng dẫn dùng (/luong?tab=…); tab không được phép thì giữ mặc định
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t && dsTabLuong(q).some(([k]) => k === t)) setTab(t)
      else if (q.laCtv) setTab('phieu')   // người phòng remote / CTV không chấm công
      setQuyen(q)
    })()
  }, [router])

  if (loiChung) return <AppShell><div className="px-4 md:px-8 py-6"><HopThongBao msg={{ loai: 'loi', text: loiChung }} /></div></AppShell>
  if (!quyen) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>

  const tabs = dsTabLuong(quyen)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5 w-full">
        {/* Tiêu đề bên trái, bỏ dòng ghi chú (anh yêu cầu 23/10/2026) — cách tính công chuẩn đã ghi ở tab chấm công. */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-rose-500 flex items-center justify-center text-white text-lg shadow-sm">🗓️</div>
          <h1 className="text-xl font-bold text-gray-900">Chấm công & Lương</h1>
        </div>

        {/* Các tab là những KHỐI tách rời, chia đều hết bề ngang, một khung chung — components/luong/ThanhTabLuong.js
            (dùng chung với trang Hướng dẫn dùng). Chữ không xuống dòng (anh báo 23/10). */}
        <ThanhTabLuong quyen={quyen} tab={tab} onChon={setTab} />

        {tab === 'cua_toi' && quyen.cham_cong && <ChamCongCuaToi thangDuocKhai={quyen.thangDuocKhai} />}
        {tab === 'phong' && <ChamCongPhong quyen={quyen} />}
        {tab === 'dvk' && quyen.cham_cong && <ThuongDvk quyen={quyen} />}
        {tab === 'phieu' && quyen.laCtv && <PhieuCtvCuaToi />}
        {tab === 'phieu' && !quyen.laCtv && quyen.cham_cong && <PhieuLuongCuaToi />}
        {tab === 'bang_luong' && quyen.view && <BangLuong quyen={quyen} />}
        {tab === 'luong_ctv' && quyen.view && <BangLuongCtv quyen={quyen} />}
        {tab === 'thiet_lap' && quyen.manage && <CapBacNgayLe />}
        {!tabs.length && <p className="text-sm text-gray-500">Tài khoản chưa được cấp quyền chấm công.</p>}
      </div>
    </AppShell>
  )
}
