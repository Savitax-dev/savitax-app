'use client'
// Phân hệ Pháp lý — trang nhóm: Tạm ngừng / Hoạt động lại (theo dõi thời hạn tạm ngừng để nhắc khách). Khuôn chung app/phaply/_danhSach.js, nhóm định nghĩa ở lib/phaply/nhom.js.
import { Suspense } from 'react'
import TrangDanhSach from '../_danhSach'

export default function Trang() {
  return <Suspense><TrangDanhSach nhom="tam_ngung" /></Suspense>
}
