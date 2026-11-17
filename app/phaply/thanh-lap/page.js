'use client'
// Phân hệ Pháp lý — trang nhóm: Thành lập mới. Khuôn chung app/phaply/_danhSach.js, nhóm định nghĩa ở lib/phaply/nhom.js.
import { Suspense } from 'react'
import TrangDanhSach from '../_danhSach'

export default function Trang() {
  return <Suspense><TrangDanhSach nhom="thanh_lap" /></Suspense>
}
