'use client'
// Soát xét báo cáo — màn "Công ty của tôi" (component dùng chung với Rủi ro thuế: components/phanTich/CongTyCuaToi.js).
import CongTyCuaToi from '@/components/phanTich/CongTyCuaToi'
import { TabSoat } from '@/components/phanTich/phanTichUI'

export default function TrangCongTyCuaToi() {
  return <CongTyCuaToi tieuDe="Soát xét báo cáo" bieuTuong="🔎" tab={<TabSoat />}
    nutMo={c => ({ href: `/soatbaocao/ho-so?cty=${c.id}`, nhan: 'Hồ sơ dữ liệu →' })} />
}
