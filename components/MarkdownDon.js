// Hiển thị một tài liệu Markdown ĐƠN GIẢN (tài liệu nội bộ trong docs/) thành giao diện app — không cần thư viện ngoài.
// Hỗ trợ đúng những gì tài liệu Savitax dùng: tiêu đề #/##/###, đoạn văn, danh sách "- " và "1. ", bảng "| … |",
// khối mã ``` (cây thư mục), trích dẫn "> ", đường kẻ "---", chữ đậm **…**, mã `…`, liên kết [chữ](địa chỉ) — cả liên
// kết nội bộ "#mục" —, ảnh riêng một dòng ![chú thích](img/x.png) (đường ảnh = anhGoc + tên file).
// Chạy được cả ở máy chủ (trang tĩnh) lẫn trình duyệt.

export const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Chữ trong một dòng: `mã`, **đậm**, [liên kết](url)
function NoiDong({ chu }) {
  const phan = String(chu).split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return phan.map((p, i) => {
    if (!p) return null
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1.5 py-0.5 rounded-md bg-red-50 text-[#8B1A1A] text-[0.92em] font-mono break-words">{p.slice(1, -1)}</code>
    if (p.startsWith('**') && p.endsWith('**')) return <b key={i} className="font-bold text-gray-900"><NoiDong chu={p.slice(2, -2)} /></b>
    const lk = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (lk && /^https?:/.test(lk[2])) return <a key={i} href={lk[2]} target="_blank" rel="noreferrer" className="text-blue-700 underline">{lk[1]}</a>
    if (lk && lk[2].startsWith('#')) return <a key={i} href={'#' + slug(decodeURIComponent(lk[2].slice(1)))} className="text-blue-700 underline">{lk[1]}</a>
    if (lk) return <span key={i}>{lk[1]}</span>
    return <span key={i}>{p}</span>
  })
}

// Tách tài liệu thành các khối
export function tachKhoi(md) {
  const dong = String(md || '').replace(/\r\n?/g, '\n').split('\n')
  const khoi = []
  for (let i = 0; i < dong.length;) {
    const d = dong[i]
    if (!d.trim()) { i++; continue }
    if (d.startsWith('```')) {
      const ma = []; i++
      while (i < dong.length && !dong[i].startsWith('```')) ma.push(dong[i++])
      i++; khoi.push({ loai: 'ma', noiDung: ma.join('\n') }); continue
    }
    const anh = d.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (anh) { khoi.push({ loai: 'anh', chu: anh[1], src: anh[2] }); i++; continue }
    const td = d.match(/^(#{1,4})\s+(.*)$/)
    if (td) { khoi.push({ loai: 'tieuDe', cap: td[1].length, chu: td[2].trim() }); i++; continue }
    if (/^-{3,}\s*$/.test(d)) { khoi.push({ loai: 'ke' }); i++; continue }
    if (d.startsWith('>')) {
      const tr = []
      while (i < dong.length && dong[i].startsWith('>')) tr.push(dong[i++].replace(/^>\s?/, ''))
      khoi.push({ loai: 'trich', chu: tr.join(' ') }); continue
    }
    if (d.trim().startsWith('|')) {
      const hang = []
      while (i < dong.length && dong[i].trim().startsWith('|')) hang.push(dong[i++].trim())
      const o = h => h.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'))
      const than = hang.filter((h, j) => !(j === 1 && /^\|?\s*:?-{2,}/.test(h)))
      khoi.push({ loai: 'bang', dau: o(than[0]), dong: than.slice(1).map(o) }); continue
    }
    const ds = d.match(/^(\s*)(-|\d+\.)\s+(.*)$/)
    if (ds) {
      const muc = [], coSo = /\d/.test(ds[2])
      while (i < dong.length) {
        const m = dong[i].match(/^(\s*)(-|\d+\.)\s+(.*)$/)
        if (m && m[1].length < 2) { muc.push(m[3]); i++; continue }
        if (dong[i].trim() && /^\s{2,}/.test(dong[i]) && muc.length) { muc[muc.length - 1] += ' ' + dong[i].trim(); i++; continue }
        break
      }
      khoi.push({ loai: 'ds', coSo, muc }); continue
    }
    const doan = []
    while (i < dong.length && dong[i].trim() && !/^(#{1,4}\s|```|>|\||!\[|-{3,}\s*$|\s*(-|\d+\.)\s)/.test(dong[i])) doan.push(dong[i++].trim())
    if (!doan.length) { i++; continue }
    khoi.push({ loai: 'doan', chu: doan.join(' ') })
  }
  return khoi
}

// anhGoc: đường dẫn phục vụ ảnh tài liệu (vd '/api/admin/tai-lieu/anh/'), ghép với TÊN FILE của ảnh
export default function MarkdownDon({ md, boTieuDeChinh = false, anhGoc = '' }) {
  const khoi = tachKhoi(md)
  return (
    <div className="text-[15px] leading-relaxed text-gray-700">
      {khoi.map((k, i) => {
        if (k.loai === 'tieuDe') {
          if (k.cap === 1) return boTieuDeChinh ? null : <h1 key={i} className="text-2xl font-bold text-[#8B1A1A] mb-3">{k.chu}</h1>
          if (k.cap === 2) return <h2 key={i} id={slug(k.chu)} className="scroll-mt-24 mt-8 mb-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B1A1A] to-[#B23A3A] text-white text-lg font-bold shadow-sm"><NoiDong chu={k.chu} /></h2>
          return <h3 key={i} id={slug(k.chu)} className="scroll-mt-24 mt-6 mb-2 pl-3 border-l-4 border-amber-500 text-base font-bold text-gray-900"><NoiDong chu={k.chu} /></h3>
        }
        if (k.loai === 'ma') return <pre key={i} className="my-3 p-4 rounded-xl bg-slate-900 text-emerald-100 text-[13px] leading-snug font-mono overflow-x-auto whitespace-pre">{k.noiDung}</pre>
        if (k.loai === 'anh') return (
          <figure key={i} className="my-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tài liệu nội bộ, đi qua route cần đăng nhập */}
            <img src={anhGoc + k.src.split('/').pop()} alt={k.chu} loading="lazy" className="w-full max-w-5xl rounded-xl border border-gray-200 shadow-sm" />
            {k.chu && <figcaption className="mt-1.5 text-xs text-gray-500 italic">▲ {k.chu}</figcaption>}
          </figure>
        )
        if (k.loai === 'ke') return <hr key={i} className="my-6 border-gray-200" />
        if (k.loai === 'trich') return <div key={i} className="my-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">💡 <NoiDong chu={k.chu} /></div>
        if (k.loai === 'bang') return (
          <div key={i} className="my-3 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead><tr>{k.dau.map((o, j) => <th key={j} className="px-3 py-2 text-left font-semibold text-white bg-[#8B1A1A] border-r border-white/20 last:border-r-0 whitespace-nowrap"><NoiDong chu={o} /></th>)}</tr></thead>
              <tbody>{k.dong.map((h, j) => (
                <tr key={j} className={j % 2 ? 'bg-rose-50/40' : 'bg-white'}>
                  {h.map((o, x) => <td key={x} className="px-3 py-2 align-top border-t border-r border-gray-100 last:border-r-0"><NoiDong chu={o} /></td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
        if (k.loai === 'ds') {
          const The = k.coSo ? 'ol' : 'ul'
          return <The key={i} className={'my-2 pl-6 space-y-1.5 ' + (k.coSo ? 'list-decimal' : 'list-disc marker:text-[#8B1A1A]')}>{k.muc.map((m, j) => <li key={j}><NoiDong chu={m} /></li>)}</The>
        }
        return <p key={i} className="my-2"><NoiDong chu={k.chu} /></p>
      })}
    </div>
  )
}
