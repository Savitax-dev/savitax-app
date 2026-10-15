# Cài `mail_sync.py` lên VPS (tự tick việc "Gửi mail bộ báo cáo thuế")

Script đọc **phần đầu thư** trong hộp `congnosavitax@gmail.com` (hộp đang dùng cho Đối soát ngân
hàng — nhân viên đã CC 100%), lọc thư có cụm "BÁO CÁO" trong tiêu đề, rồi đẩy lên
`/api/mail/incoming`. App đối chiếu tên công ty + kỳ rồi **tự tick** việc tương ứng trong Checklist.

Chạy **độc lập** với `acb_zalo.py` / `tcb_zalo.py` / `app_sync.py`: chỉ đọc Gmail ở chế độ readonly,
file chống trùng riêng, log riêng. Hỏng script này thì luồng ngân hàng vẫn chạy.

**Không tải nội dung thư, không tải file đính kèm** — chỉ 4 trường `Subject / From / Date /
Message-ID`. Một lượt quét vài trăm thư tốn vài chục KB.

## 0. Trước khi cài — hai thứ phải có sẵn

1. **Chạy `sql/30_mail_bao_cao.sql`** trên Supabase. Chưa chạy thì app trả 503 và **không tick gì
   cả** (cố ý: tick mà không ghi được bằng chứng là lỗi câm).
2. **Đặt biến `MAIL_WEBHOOK_SECRET`** trên Vercel (Settings → Environment Variables, loại
   *Sensitive*), tối thiểu 24 ký tự. Sinh bằng:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Đặt xong phải **Redeploy** thì biến mới có hiệu lực.

## 1. Chép file lên VPS

```bash
scp vps/mail_sync.py root@103.126.161.187:/root/acb_zalo/
```

Đặt **cạnh** `acb_zalo.py` (script import hàm dùng chung từ đó). Không sửa gì trong các file cũ.

## 2. Tạo `/root/acb_zalo/mail_sync.json`

```json
{
  "app_url": "https://app.savitax.vn",
  "secret": "<đúng giá trị MAIL_WEBHOOK_SECRET đã đặt trên Vercel>",
  "days": 7
}
```

```bash
chmod 600 /root/acb_zalo/mail_sync.json
```

Gmail dùng chung `config.json` của `acb_zalo.py`, **không khai lại** host/mật khẩu ở đây.

## 3. Chạy thử — KHÔNG gửi gì

```bash
cd /root/acb_zalo
python3 mail_sync.py --dry
```

In ra tối đa 30 thư bắt được kèm tiêu đề. **Nhìn kỹ bước này**: nếu không bắt được thư nào thì
hoặc hộp thư chưa nhận được bản CC, hoặc tiêu đề không có cụm "BÁO CÁO".

Muốn quét rộng hơn một lần:

```bash
python3 mail_sync.py --dry --days 60
```

## 4. Chạy thật lần đầu

```bash
python3 mail_sync.py
```

Log sẽ ghi `Da gui N thu — khop X, tick Y, chua khop Z, trung W`.

**Mở app kiểm ngay vài công ty** trong số đó trước khi bật cron: việc "Gửi mail bộ báo cáo thuế…"
phải có dấu tick, và giờ hoàn thành bằng **giờ gửi mail**, không phải giờ chạy script.

## 5. Cron

```cron
*/30 * * * *  /usr/bin/flock -n /tmp/mail_sync.lock /usr/bin/timeout 600 /usr/bin/python3 /root/acb_zalo/mail_sync.py >> /root/acb_zalo/mail_sync.cron.log 2>&1
```

30 phút/lần là đủ — đây là việc cuối tháng, không phải tiền vào theo phút như ngân hàng.

## 6. File script tự sinh ra

| File | Vai trò | Mất file thì sao |
|---|---|---|
| `mail_scanned_uids.json` | UID thư đã đọc, để khỏi tải lại | Chỉ chậm hơn một lần chạy — app vẫn chống trùng theo Message-ID |
| `mail_sync.log` | Nhật ký | — |

**Không có file "đã gửi"**: app chống trùng bằng `Message-ID` của thư (bảng `mail_evidence`), gửi
lại bao nhiêu lần cũng chỉ một dòng và không tick lại.

## 7. Xử lý sự cố

| Hiện tượng | Xử lý |
|---|---|
| `LOI app tra 401` | Sai `secret` — so lại với `MAIL_WEBHOOK_SECRET` trên Vercel, nhớ Redeploy sau khi đặt |
| `LOI app tra 503` | Chưa chạy `sql/30`. App cố ý không tick khi chưa ghi được bằng chứng |
| Bắt được thư nhưng `khop 0` | Tiêu đề không khớp công ty/kỳ. Xem bảng `mail_evidence`, cột `reason` nói rõ từng thư |
| Không bắt được thư nào | `python3 mail_sync.py --dry --days 60`. Vẫn trống thì hộp thư chưa nhận bản CC |
| Việc đã tick tay rồi | App **giữ nguyên** dấu cũ, chỉ lưu thêm bằng chứng — không ghi đè giờ hoàn thành |

## 8. Xem thư nào chưa khớp

```sql
select sent_at, from_email, subject, reason
from mail_evidence
where not matched
order by sent_at desc
limit 50;
```

Đây là danh sách cần nhìn hằng tháng: mỗi dòng là một lá mail đã gửi khách mà app không tự tick
được, phải tick tay.
