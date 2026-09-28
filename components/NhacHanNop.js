'use client'
// Dải nhắc hạn nộp tờ khai — đầu các trang của Phân hệ Tờ khai.
//
// Mốc nhắc (anh chốt 28/09/2026): còn 10, 5, 3, 2, 1 ngày và đúng ngày hạn. Ngoài các mốc đó thì
// KHÔNG hiện gì — nhắc mỗi ngày thì người ta quen mắt rồi bỏ qua luôn. Kỳ đã quá hạn thì ngày
// nào cũng nhắc.
//
// Mức 3, 2, 1 ngày và quá hạn: chữ ĐỎ ĐẬM. Màu luôn đi kèm chữ, không bao giờ chỉ dùng màu.
import { useEffect, useState } from 'react'

const MUC = {
  qua_han: { nen: 'bg-red-50 border-red-200',       chu: 'text-red-700 font-bold',    cham: 'bg-red-600' },
  gap:     { nen: 'bg-red-50 border-red-200',       chu: 'text-red-700 font-bold',    cham: 'bg-red-600' },
  sap_toi: { nen: 'bg-blue-50 border-blue-200',     chu: 'text-blue-800',             cham: 'bg-blue-500' },
}

export default function NhacHanNop() {
  const [ds, setDs] = useState(null)

  useEffect(() => {
    fetch('/api/admin/tokhai/nhac-han')
      .then(r => r.json())
      .then(j => setDs(j.error ? [] : (j.nhac || [])))
      .catch(() => setDs([]))
  }, [])

  if (!ds || !ds.length) return null

  // Mức gấp nhất quyết định nền cả dải — để cái quá hạn không chìm giữa đống tin bình thường.
  const mucNang = ds.some(n => n.muc === 'qua_han') ? 'qua_han'
    : ds.some(n => n.muc === 'gap') ? 'gap' : 'sap_toi'
  const nen = MUC[mucNang].nen

  // Tên tờ khai và kỳ in ĐẬM để mắt bắt ngay "cái gì, kỳ nào" giữa dòng chữ dài.
  const ngayVN = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
  const noiDung = n => {
    // Dấu cách phải viết tường minh bằng {' '}: JSX cắt bỏ khoảng trắng ở đầu/cuối mỗi dòng nên
    // xuống dòng giữa chữ và thẻ <b> là dính liền thành "Còn22ngày".
    const ten = <b className="font-bold">{n.loai} {n.ky}</b>
    if (n.conLai < 0) {
      return <>QUÁ HẠN {Math.abs(n.conLai)} ngày:{' '}{ten}{' '}(hạn {ngayVN(n.hanNop)}) — còn <b>{n.soCongTy}</b>{' '}công ty chưa nộp</>
    }
    if (n.conLai === 0) {
      return <>HÔM NAY là hạn nộp{' '}{ten}{' '}— còn <b>{n.soCongTy}</b>{' '}công ty chưa nộp</>
    }
    return <>Còn <b>{n.conLai}</b>{' '}ngày tới hạn{' '}{ten}{' '}({ngayVN(n.hanNop)}) — <b>{n.soCongTy}</b>{' '}công ty chưa nộp</>
  }

  const mot = (khoa) => (
    <span key={khoa} className="inline-flex items-center">
      {ds.map((n, i) => {
        const k = MUC[n.muc] || MUC.sap_toi
        return (
          <span key={i} className={'inline-flex items-center mr-10 ' + k.chu}>
            <span className={'w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0 ' + k.cham} />
            {noiDung(n)}
          </span>
        )
      })}
    </span>
  )

  // Ít tin thì hiện đứng yên. Trước đây lúc nào cũng nhân đôi nội dung cho vòng chạy liền mạch,
  // nhưng với 2 tin thì bản sao nằm ngay cạnh, nhìn như app in trùng dòng.
  const itTin = ds.length <= 3

  return (
    <div className={'mb-3 rounded-xl border px-3 py-2 overflow-hidden ' + nen}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold whitespace-nowrap flex-shrink-0">⏰ Hạn nộp:</span>
        <div className="overflow-hidden flex-1">
          {itTin
            ? <div className="text-xs flex flex-wrap gap-y-1">{mot('a')}</div>
            : <div className="chay-ngang text-xs">{mot('a')}{mot('b')}</div>}
        </div>
      </div>
    </div>
  )
}
