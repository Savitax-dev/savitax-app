'use client'
// Rủi ro thuế — màn "Công ty của tôi" (component dùng chung với Soát xét báo cáo).
import CongTyCuaToi from '@/components/phanTich/CongTyCuaToi'
import { TabRuiRo } from '@/components/phanTich/phanTichUI'

export default function TrangRuiRoThue() {
  return <CongTyCuaToi tieuDe="Rủi ro thuế" bieuTuong="⚖️" tab={<TabRuiRo />}
    nutMo={c => ({ href: `/ruirothue/phan-tich?cty=${c.id}&xem=bang`, nhan: 'Rủi ro thuế →' })} />
}
