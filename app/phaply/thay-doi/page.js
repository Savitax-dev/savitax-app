'use client'
// Phân hệ Pháp lý — trang nhóm: Thay đổi đăng ký. Khuôn chung app/phaply/_danhSach.js, nhóm định nghĩa ở lib/phaply/nhom.js.
import { Suspense } from 'react'
import TrangDanhSach from '../_danhSach'

export default function Trang() {
  return <Suspense><TrangDanhSach nhom="thay_doi" /></Suspense>
}
