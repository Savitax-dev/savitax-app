// Bản rời — thay khung "Hạn nộp và trạng thái nộp" (components/phanTich/HanNopKy) của màn Soát kỳ.
// App lấy trạng thái nộp từ phân hệ Tờ khai (hồ sơ đồng bộ từ cổng thuế); bản rời không có phân hệ đó, nên chỉ hiện HẠN NỘP
// từng tờ khai (lịch tự sinh tại máy — banRoi/apiMay.js, đẩy qua ngày nghỉ ở Cài đặt). Đã nộp hay chưa: dải kỳ phía trên, đọc
// từ tờ khai trong thư mục. useHanNop / hanTheoLich dùng nguyên của app.
import { useHanNop, hanTheoLich } from '../../components/phanTich/HanNopKy.js'
import { ChipMau } from '@/components/phanTich/phanTichUI'
import { maKyPhu, ngayVN } from '@/lib/phanTich/hanNop'

export { useHanNop, hanTheoLich }

const homNayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const soNgay = (tu, den) => Math.round((Date.parse(den) - Date.parse(tu)) / 864e5)

export default function HanNopKy({ data, k, nam }) {
  if (!k || !nam) return null
  if (data.dangTai) return <p className="text-xs text-gray-500 mb-4">Đang tính hạn nộp…</p>
  if (data.loi) return <p className="text-xs text-gray-500 mb-4">Không tính được hạn nộp: {data.loi}</p>
  const phu = new Set(maKyPhu(k, nam))
  const ds = data.nghiaVu.filter(x => phu.has(x.ky))
  if (!ds.length) return <p className="text-xs text-gray-500 mb-4">Kỳ này không có tờ khai định kỳ theo kỳ khai của công ty (xem Danh sách công ty → kỳ khai, hộ kinh doanh, ngày bắt đầu hợp đồng).</p>
  const homNay = homNayVN()
  return (
    <div className="mb-4">
      <p className="text-[11px] text-gray-500 mb-1.5">
        Hạn nộp các tờ khai của kỳ — app tự tính theo luật thuế; rơi vào thứ Bảy, Chủ nhật hoặc ngày nghỉ lễ ở <a className="underline" href="#/cai-dat">Cài đặt</a> thì
        đẩy sang ngày làm việc kế tiếp. Đã nộp hay chưa: xem dải kỳ phía trên (đọc từ tờ khai trong thư mục).
      </p>
      <div className="flex flex-wrap gap-2">
        {ds.map(x => {
          const con = x.han ? soNgay(homNay, x.han) : null
          const tt = con == null ? { nhan: 'Không có hạn', mau: 'xam' }
            : con < 0 ? { nhan: 'Đã qua hạn', mau: 'xam' }
              : con === 0 ? { nhan: 'Hạn là HÔM NAY', mau: 'do' }
                : { nhan: `Còn ${con} ngày`, mau: con <= 5 ? 'hoPhach' : 'xanhLa' }
          return (
            <div key={x.ky + x.ma} className="rounded-xl border border-gray-200 bg-white px-3 py-2 min-w-[230px] shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-gray-800">{x.ma} <span className="font-normal text-gray-500">· {x.ky.replace('.', '/')}</span></span>
                <span className="text-[11px] text-gray-500">Hạn {x.han ? ngayVN(x.han) : '—'}</span>
              </div>
              <div className="mt-1"><ChipMau nhan={tt.nhan} mau={tt.mau} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
