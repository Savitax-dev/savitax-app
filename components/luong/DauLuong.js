'use client'
// Đầu trang Chấm công & Lương (tiêu đề + thanh tab) cho các trang phụ như /luong/huong-dan — tự nạp quyền để thanh tab
// hiện đúng các tab người đó được dùng.
import { useEffect, useState } from 'react'
import { layQuyenLuong } from '@/lib/khoiDong'
import ThanhTabLuong from './ThanhTabLuong'

export default function DauLuong({ tab }) {
  const [quyen, setQuyen] = useState(null)
  useEffect(() => { layQuyenLuong().then(q => { if (!q?.error) setQuyen(q) }) }, [])
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-rose-500 flex items-center justify-center text-white text-lg shadow-sm">🗓️</div>
        <h1 className="text-xl font-bold text-gray-900">Chấm công & Lương</h1>
      </div>
      <ThanhTabLuong quyen={quyen} tab={tab} />
    </>
  )
}
