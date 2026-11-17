'use client'
// Phân hệ Pháp lý — trang nhóm: Giải thể / Chấm dứt. Khuôn chung app/phaply/_danhSach.js, nhóm định nghĩa ở lib/phaply/nhom.js.
import { Suspense } from 'react'
import TrangDanhSach from '../_danhSach'

export default function Trang() {
  return <Suspense><TrangDanhSach nhom="giai_the" /></Suspense>
}
