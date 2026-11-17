// Bản rời — tab "🧭 Hướng dẫn" của Soát xét báo cáo và Rủi ro thuế (anh duyệt nội dung ở demo docs/mockup-ban-roi, 08/11/2026).
// Quy tắc đặt tên file từng mục KHÔNG chép lại ở đây — trỏ sang tab "Quy ước lưu hồ sơ" (docs/quy-uoc-luu-ho-so.md, một nguồn).
import { useState } from 'react'
import AppShell from './AppShell'
import { TabSoat, TabRuiRo } from '@/components/phanTich/phanTichUI'
import { XemCayThuMuc, taiCayThuMuc, SO_THU_MUC } from './CayThuMuc'

const KY = '7. BỘ BÁO CÁO\\1. BỘ BCT QUÝ_THÁNG\\BCT-Qn'
const the = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'

function Buoc({ so, tieuDe, children }) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 border-b border-dashed border-gray-200 py-2.5 last:border-0">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B1A1A] text-sm font-bold text-white">{so}</span>
      <div className="text-sm text-gray-700"><p className="font-semibold text-gray-800">{tieuDe}</p>{children}</div>
    </div>
  )
}
const Ds = ({ children }) => <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">{children}</ul>
const M = ({ children }) => <code className="rounded border border-gray-200 bg-gray-50 px-1 text-[12px]">{children}</code>
function Bang({ dau, dong }) {
  return (
    <div className="overflow-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead><tr className="bg-[#8B1A1A] text-left text-white">{dau.map(t => <th key={t} className="px-3 py-2 font-semibold">{t}</th>)}</tr></thead>
        <tbody>{dong.map((d, i) => <tr key={i} className={(i % 2 ? 'bg-gray-50' : 'bg-white') + ' border-t border-gray-100'}>{d.map((o, j) => <td key={j} className={'px-3 py-2 align-top ' + (j === 1 ? 'text-xs text-gray-600' : '')}>{o}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
function Dau({ ic, ten, tab }) {
  return (
    <>
      <div className="mb-3 flex items-center gap-3"><span className="text-2xl">{ic}</span><h1 className="text-xl font-bold text-gray-800">{ten}</h1></div>
      {tab}
    </>
  )
}

export function HuongDanSoat() {
  const [bao, setBao] = useState('')
  const tai = async () => { try { const n = await taiCayThuMuc(); setBao(`Đã tải cây thư mục mẫu (${n} thư mục) về thư mục Downloads. Giải nén rồi đổi tên theo bước 2.`) } catch (e) { setBao('Không tải được: ' + (e?.message || e)) } }
  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <Dau ic="🔎" ten="Soát xét báo cáo" tab={<TabSoat />} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Phân hệ này làm gì</h2>
              <p className="text-sm text-gray-700">Đọc thư mục hồ sơ của từng công ty trên máy / ổ chung — <b>chỉ đọc, không ghi gì</b> — rồi cho biết: thư mục còn thiếu gì
                (<b>Hồ sơ dữ liệu</b>), tờ khai từng kỳ có khớp bảng kê và hóa đơn không (<b>Soát kỳ</b>), số liệu cả năm BCTC ↔ sổ sách ↔ quyết toán có khớp không (<b>Soát xét năm</b>).</p>
              <p className="mt-2 text-xs text-gray-500">App chỉ đọc đúng khi hồ sơ xếp theo <b>cây thư mục mẫu SVT.MB09</b> — tải ở khung bên phải.</p>
            </div>
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Các bước</h2>
              <Buoc so={1} tieuDe="Tải cây thư mục mẫu, giải nén vào ổ chung">
                <Ds><li>Bấm <b>⬇ Tải cây thư mục mẫu (.zip)</b> ở bên phải → giải nén vào thư mục khách hàng.</li><li>Công ty đã có thư mục: chỉ bổ sung thư mục còn thiếu cho đúng cây, không cần làm lại.</li></Ds>
              </Buoc>
              <Buoc so={2} tieuDe="Đổi tên cho đúng công ty, đúng năm">
                <Ds>
                  <li>Thư mục gốc → <M>&lt;Mã KH&gt; - &lt;Tên công ty&gt;</M>.</li>
                  <li>Trong <M>2. HỒ SƠ KẾ TOÁN</M>: <M>NĂM TÀI CHÍNH</M> → <M>Năm 2026</M> (để nguyên thì app không nhận ra năm). Năm sau: sao chép thư mục năm rỗng rồi đổi thành <M>Năm 2027</M>.</li>
                  <li>Công ty khai tháng: <M>QUÝ 1…4</M> ở mục 2 → <M>THÁNG 01…12</M>; <M>BCT-Q1…Q4</M> ở mục 7 → <M>BCT-T01…T12</M>.</li>
                  <li>Loại hồ sơ không phát sinh: thêm <M>(kps)</M> vào cuối tên thư mục, ví dụ <M>4. TỜ KHAI HẢI QUAN (kps)</M>.</li>
                </Ds>
              </Buoc>
              <Buoc so={3} tieuDe="Lưu file đúng chỗ, đặt tên đúng quy tắc">
                <p className="text-sm">Quy tắc chung + từng mục 1–11: tab <a className="font-semibold text-[#8B1A1A] underline" href="#/soatbaocao/quy-uoc">Quy ước lưu hồ sơ</a>. Giữ file gốc XML / Excel; PDF chỉ là bản xem kèm; file nén phải giải nén.</p>
              </Buoc>
              <Buoc so={4} tieuDe="Thêm công ty vào app">
                <p className="text-sm">Mục <a className="font-semibold text-[#8B1A1A] underline" href="#/cong-ty">Danh sách công ty</a> → ＋ Thêm công ty (gõ MST rồi 🔍) hoặc nhập Excel theo file mẫu.</p>
              </Buoc>
              <Buoc so={5} tieuDe="Trỏ thư mục">
                <Ds>
                  <li>Bấm <b>Trỏ thư mục</b> → chọn đúng thư mục GỐC của công ty (thư mục có <M>2. HỒ SƠ KẾ TOÁN</M>) → Chrome hỏi <i>"Cho phép xem tệp?"</i> → <b>Xem tệp</b>.</li>
                  <li>Trỏ một lần là Rủi ro thuế dùng chung. Lần mở app sau Chrome có thể hỏi lại một lần — bấm Cho phép.</li>
                </Ds>
              </Buoc>
              <Buoc so={6} tieuDe="Xem kết quả">
                <Ds>
                  <li><b>Hồ sơ dữ liệu</b>: thư mục nào có, thiếu kỳ nào, file nào cần xem lại — làm đủ trước khi soát.</li>
                  <li><b>Soát kỳ</b> → <b>Soát xét năm</b>. Hạn nộp tự tính theo lịch thuế + ngày nghỉ lễ ở <a className="underline" href="#/cai-dat">Cài đặt</a>.</li>
                  <li>Vừa bỏ thêm file vào thư mục → bấm <b>↻ Tải lại thư mục</b>. Năm 2025 trở về trước → <b>＋ Năm cũ</b>, trỏ riêng thư mục năm đó.</li>
                </Ds>
              </Buoc>
            </div>
            <div className={the}>
              <h2 className="mb-2 font-bold text-gray-800">App đọc số liệu ở đâu <span className="text-xs font-normal text-gray-500">(dưới <M>Năm 2026</M>)</span></h2>
              <Bang dau={['Hồ sơ', 'Để trong', 'Dạng file app đọc']} dong={[
                ['Tờ khai 01/GTGT, 05/KK-TNCN đã nộp', `${KY}\\TỜ KHAI THUẾ\\01GTGT · \\05KK TNCN`, 'XML tải từ cổng thuế (+ PDF xem)'],
                ['Bảng kê kèm tờ khai đã nộp', `${KY}\\BẢNG KÊ`, 'Excel, sheet mua vào + bán ra'],
                ['Bảng kê "Chi tiết" cổng hóa đơn điện tử', '2. HÓA ĐƠN MUA VÀO_BÁN RA\\QUÝ n\\HĐ MUA VÀO · \\HĐ BÁN RA', 'Excel tải từ cổng — giữ nguyên tên file'],
                ['Hóa đơn mua vào từng tờ', '2. HÓA ĐƠN MUA VÀO_BÁN RA\\QUÝ n\\HĐ MUA VÀO', 'XML (bắt buộc)'],
                ['Thông báo đóng BHXH (C12)', '5. BẢO HIỂM XÃ HỘI\\1. C12', 'PDF có chữ tải từ cổng BHXH'],
                ['Bảng lương, chấm công', '6. LƯƠNG\\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG', 'Excel cả năm, mỗi tháng 1 sheet'],
                ['BCTC, quyết toán năm', '7. BỘ BÁO CÁO\\2. BỘ BCTC NĂM\\TỜ KHAI\\…', 'XML đã nộp + BCTC Excel — để trong năm của số liệu'],
                ['Bảng cân đối phát sinh cả năm', '8. SỔ SÁCH KẾ TOÁN\\3. BẢNG CÂN ĐỐI TÀI KHOẢN…', 'Excel lũy kế đến 31/12'],
              ]} />
            </div>
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Lỗi hay gặp</h2>
              <Ds>
                <li><b>Không thấy thư mục năm</b>: chưa đổi <M>NĂM TÀI CHÍNH</M> thành <M>Năm 2026</M>.</li>
                <li><b>Trỏ nhầm vào <M>7. BỘ BÁO CÁO</M></b> hoặc thư mục năm: app nhắc trỏ lại thư mục gốc của công ty.</li>
                <li><b>Kỳ có file mà vẫn báo thiếu</b>: file để thẳng ở <M>7. BỘ BÁO CÁO</M> thay vì trong <M>BCT-Qn</M>, hoặc chỉ có PDF scan (app chưa đọc ảnh scan).</li>
                <li><b>Không có nút trỏ thư mục</b>: đang mở bằng Firefox / Cốc Cốc cũ — dùng Chrome hoặc Edge trên máy tính.</li>
              </Ds>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#8B1A1A] to-[#6B1212] p-4 text-white shadow-sm">
              <h2 className="font-bold">📦 Cây thư mục mẫu SVT.MB09</h2>
              <p className="mb-3 mt-1 text-xs text-red-100">{SO_THU_MUC} thư mục rỗng theo quy định Savitax + file "ĐỌC TRƯỚC". Tải về, giải nén, đổi tên theo bước 2.</p>
              <button type="button" onClick={tai} className="rounded-xl bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95">⬇ Tải cây thư mục mẫu (.zip)</button>
              {bao && <p className="mt-2 rounded-lg bg-white/15 px-2 py-1 text-xs">{bao}</p>}
            </div>
            <div className={the}>
              <h2 className="font-bold text-gray-800">Xem trước cây thư mục</h2>
              <p className="mb-2 text-xs text-gray-500">Bấm vào thư mục để mở / gập. <span className="rounded bg-emerald-50 px-1 font-bold text-emerald-700">app đọc</span> = app lấy số liệu ở đây.</p>
              <XemCayThuMuc />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export function HuongDanRuiRo() {
  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <Dau ic="⚖️" ten="Rủi ro thuế" tab={<TabRuiRo xem="__huong_dan" />} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Phân hệ này làm gì</h2>
              <p className="text-sm text-gray-700">So số liệu cùng một chỉ tiêu ở nhiều nguồn — tờ khai GTGT, quyết toán TNDN / TNCN, BCTC, bảng cân đối phát sinh — theo 39 tiêu chí cơ quan thuế
                hay xem khi đánh giá rủi ro. Mỗi tiêu chí hiện <b>số liệu, chênh lệch, tỷ lệ</b>, nguyên nhân thường gặp và hồ sơ nên chuẩn bị.</p>
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">App <b>chưa chấm điểm, chưa xếp mức rủi ro</b>. Chênh lệch là để kế toán xem lại và chuẩn bị giải trình — không phải kết luận sai phạm.</p>
            </div>
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Các bước</h2>
              <Buoc so={1} tieuDe="Xếp đủ hồ sơ năm vào thư mục"><p className="text-sm">Theo cây thư mục mẫu — xem tab Hướng dẫn của <a className="underline" href="#/soatbaocao/huong-dan">Soát xét báo cáo</a>. Bảng hồ sơ cần có ở bên dưới.</p></Buoc>
              <Buoc so={2} tieuDe="Chọn công ty"><p className="text-sm">Thư mục dùng chung với Soát xét báo cáo — đã trỏ ở đó thì ở đây dùng luôn.</p></Buoc>
              <Buoc so={3} tieuDe="Chọn năm, xem Hồ sơ đã đọc"><p className="text-sm">Kiểm app đã tìm thấy đủ tờ khai, quyết toán, BCTC chưa. Thiếu file nào thì tiêu chí dùng file đó báo thiếu số liệu. Năm cũ (≤ 2025) trỏ bằng <b>＋ Năm cũ</b>.</p></Buoc>
              <Buoc so={4} tieuDe="Xem Bảng 39 tiêu chí"><p className="text-sm">Dòng có chênh lệch lên trước. Bấm mã tiêu chí để mở <b>Chi tiết tiêu chí</b>: nguồn của từng số, nguyên nhân thường gặp, hồ sơ nên chuẩn bị, căn cứ.</p></Buoc>
              <Buoc so={5} tieuDe="So nhiều năm, tải Excel"><p className="text-sm"><b>Nhiều năm</b> cần thư mục của từng năm. <b>⬇ Tải Excel</b> để lưu hồ sơ làm việc.</p></Buoc>
            </div>
            <div className={the}>
              <h2 className="mb-2 font-bold text-gray-800">Hồ sơ cần có cho một năm</h2>
              <Bang dau={['Hồ sơ', 'Để trong', 'Dạng file']} dong={[
                ['Tờ khai 01/GTGT cả năm (4 quý / 12 tháng)', `${KY}\\TỜ KHAI THUẾ\\01GTGT`, 'XML'],
                ['Tờ khai 05/KK-TNCN', `${KY}\\TỜ KHAI THUẾ\\05KK TNCN`, 'XML'],
                ['Quyết toán TNDN 03/TNDN', '7. BỘ BÁO CÁO\\2. BỘ BCTC NĂM\\TỜ KHAI\\03TNDN QTT TNDN', 'XML'],
                ['Quyết toán TNCN 05/QTT', '7. BỘ BÁO CÁO\\2. BỘ BCTC NĂM\\TỜ KHAI\\05QTT QTT TNCN', 'XML'],
                ['Báo cáo tài chính', '7. BỘ BÁO CÁO\\2. BỘ BCTC NĂM\\TỜ KHAI\\BCTC', 'XML đã nộp (+ Excel)'],
                ['Bảng cân đối phát sinh', '8. SỔ SÁCH KẾ TOÁN\\3. BẢNG CÂN ĐỐI TÀI KHOẢN…', 'Excel lũy kế đến 31/12'],
              ]} />
              <p className="mt-2 text-xs text-gray-500">Hồ sơ năm nào để trong thư mục <b>năm của số liệu</b>: BCTC 2025 nộp tháng 3/2026 vẫn để trong <M>Năm 2025</M>.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Đọc kết quả</h2>
              <Ds>
                <li><b>Chênh lệch = 0</b>: hai nguồn khớp.</li>
                <li><b>Có chênh lệch</b>: hai nguồn khác nhau — mở Chi tiết, đối chiếu nguyên nhân thường gặp, chuẩn bị hồ sơ giải trình.</li>
                <li><b>Thiếu dữ liệu</b>: thiếu file nguồn, hoặc file chỉ có bản PDF scan.</li>
              </Ds>
            </div>
            <div className={the}>
              <h2 className="mb-1 font-bold text-gray-800">Lưu ý</h2>
              <Ds>
                <li>Chỉ đọc thư mục, không ghi gì vào thư mục / Drive.</li>
                <li>BCTC chỉ có bản PDF: đọc được nếu PDF có lớp chữ (xuất từ phần mềm), không đọc ảnh scan.</li>
                <li>Nộp bổ sung: để tờ khai bổ sung trong <M>BCT-Qn_BSL1</M>, app lấy lần nộp sau cùng.</li>
              </Ds>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
