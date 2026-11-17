'use client'
// Phân hệ Pháp lý — trang nhóm: Thủ tục khác (cấp lại GCN, khôi phục MST, rút hồ sơ…). Khuôn chung app/phaply/_danhSach.js, nhóm định nghĩa ở lib/phaply/nhom.js.
import { Suspense } from 'react'
import TrangDanhSach from '../_danhSach'

export default function Trang() {
  return <Suspense><TrangDanhSach nhom="khac" /></Suspense>
}
