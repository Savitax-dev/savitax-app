// Rủi ro thuế "lũy kế đến kỳ — tạm tính" (màn Soát kỳ): cắt hồ sơ về đúng phần đã có tới hết một kỳ trong năm.

// Giữ tờ khai năm `nam` có tháng cuối ≤ thangCuoi; bỏ quyết toán + BCTC đầy đủ của năm `nam` khi chưa hết năm
export function catDenKy(client, nam, thangCuoi) {
  const c = structuredClone(client)
  const thangCuoiCua = d => (d.kieuKy === 'Q' ? 3 * d.ky : d.ky)
  c.decls = c.decls.filter(d => +d.nam !== nam || thangCuoiCua(d) <= thangCuoi)
  if (thangCuoi < 12) {
    c.tndnList = c.tndnList.filter(t => +t.nam !== nam)
    c.bctcList = c.bctcList.filter(b => +b.nam !== nam || (b.parts?.cdtk && !b.parts?.kqkd && !b.parts?.bcdkt))
    c.tmList = (c.tmList || []).filter(t => +t.nam !== nam)
  }
  return c
}
