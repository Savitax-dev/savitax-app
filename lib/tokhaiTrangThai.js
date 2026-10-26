// Trạng thái của một NGHĨA VỤ (kỳ cần nộp) suy từ MỌI hồ sơ đã gắn vào nó — Phân hệ Tờ khai.
//
// Lỗi 26/10/2026 (ca 127HOME, 01/GTGT Q3.2026): nộp 19/10 bị "Không chấp nhận", nộp lại 20/10 "Đã chấp nhận".
// Cổng trả danh sách MỚI NHẤT TRƯỚC, mã cũ lấy trạng thái của hồ sơ duyệt SAU CÙNG → hồ sơ cũ bị từ chối
// đè lên hồ sơ mới đã chấp nhận, đồng bộ lại bao nhiêu lần kỳ vẫn "Không chấp nhận".
//
// Luật: kỳ lấy trạng thái TỐT NHẤT trong các hồ sơ của nó, không phụ thuộc thứ tự:
//   có hồ sơ được chấp nhận → 'accepted' (đã làm xong nghĩa vụ, lần nộp hỏng trước đó không còn ý nghĩa)
//   không có, mà có hồ sơ đang chờ / mới tiếp nhận → 'received'
//   chỉ toàn hồ sơ bị từ chối → 'rejected'
// Nghĩa vụ đã đánh "Không phát sinh" thì KHÔNG đụng tới (người đã quyết).

const HANG = { accepted: 3, received: 2, rejected: 1 }

// Hàm thuần — có bộ kiểm scripts/test-tokhai-trang-thai.mjs.
export function trangThaiTotNhat(dsTrangThai) {
  let tot = null
  for (const s of dsTrangThai || []) if (HANG[s] && (!tot || HANG[s] > HANG[tot])) tot = s
  return tot
}

// Tính lại và ghi trạng thái cho các nghĩa vụ vừa có hồ sơ gắn vào. Trả số nghĩa vụ đổi trạng thái.
export async function tinhLaiTrangThaiNghiaVu(supabase, obligationIds) {
  const ids = [...new Set((obligationIds || []).filter(Boolean))]
  if (!ids.length) return 0
  const [{ data: nv, error: e1 }, { data: hs, error: e2 }] = await Promise.all([
    supabase.from('tax_obligations').select('id, state').in('id', ids),
    supabase.from('tax_filings').select('obligation_id, state').in('obligation_id', ids),
  ])
  if (e1 || e2) throw new Error('Không đọc được hồ sơ / nghĩa vụ: ' + (e1 || e2).message)
  let doi = 0
  for (const o of nv || []) {
    if (o.state === 'no_activity') continue
    const moi = trangThaiTotNhat((hs || []).filter(h => h.obligation_id === o.id).map(h => h.state))
    if (!moi || moi === o.state) continue
    const { error } = await supabase.from('tax_obligations')
      .update({ state: moi, state_changed_at: new Date().toISOString() }).eq('id', o.id)
    if (error) throw new Error('Không ghi được trạng thái nghĩa vụ: ' + error.message)
    doi++
  }
  return doi
}
