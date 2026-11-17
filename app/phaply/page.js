'use client'
// Phân hệ Pháp lý — TẤT CẢ hồ sơ (mọi thủ tục). Mỗi nhóm thủ tục có trang riêng (anh yêu cầu 17/11/2026): /phaply/thanh-lap,
// /thay-doi, /tam-ngung, /giai-the, /khac — cùng khuôn app/phaply/_danhSach.js.
import { Suspense } from 'react'
import TrangDanhSach from './_danhSach'

export default function PhapLyPage() {
  return <Suspense><TrangDanhSach nhom={null} /></Suspense>
}
