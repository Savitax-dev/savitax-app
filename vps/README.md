# Cài `app_sync.py` lên VPS (Đối soát ngân hàng)

Script này đẩy giao dịch **tiền vào** từ hộp thư `congnosavitax@gmail.com` lên app
(`/api/bank/incoming`). Nó chạy **độc lập** với `acb_zalo.py` / `tcb_zalo.py`: chỉ đọc Gmail ở chế độ
readonly, dùng file chống trùng riêng, không đụng token Zalo. Hỏng script này thì tin Zalo vẫn chạy.

## 1. Chép file lên VPS

```bash
scp vps/app_sync.py root@103.126.161.187:/root/acb_zalo/
```

Đặt CẠNH `acb_zalo.py` (script import hàm dùng chung từ đó). Không sửa gì trong các file cũ.

## 2. Tạo `/root/acb_zalo/app_sync.json`

```json
{
  "app_url": "https://app.savitax.vn",
  "secret": "<đúng giá trị BANK_WEBHOOK_SECRET đã đặt trên Vercel>",
  "acb_days": 3
}
```

```bash
chmod 600 /root/acb_zalo/app_sync.json
```

## 3. Chạy lần đầu — CHỈ đánh dấu, KHÔNG gửi

```bash
cd /root/acb_zalo
python3 app_sync.py            # ACB: tự seed, ghi app_posted.json
python3 app_sync.py --tcb      # Techcombank: tự seed phần sao kê
```

Mỗi nguồn seed riêng. Sau bước này, mọi giao dịch CŨ đã bị đánh dấu "đã xử lý" nên **không bao giờ
được gửi lên app**. Kiểm tra bằng `--dry` (chỉ in ra, không gửi, không ghi file):

```bash
python3 app_sync.py --dry
python3 app_sync.py --tcb --dry
```

## 4. Cron

```cron
*/2 * * * *   /usr/bin/flock -n /tmp/app_sync.lock     /usr/bin/timeout 300 /usr/bin/python3 /root/acb_zalo/app_sync.py       >> /root/acb_zalo/app_sync.cron.log 2>&1
25 2 * * *    /usr/bin/flock -n /tmp/app_sync_tcb.lock /usr/bin/timeout 900 /usr/bin/python3 /root/acb_zalo/app_sync.py --tcb >> /root/acb_zalo/app_sync.cron.log 2>&1
40 9 * * *    /usr/bin/flock -n /tmp/app_sync_tcb.lock /usr/bin/timeout 900 /usr/bin/python3 /root/acb_zalo/app_sync.py --tcb >> /root/acb_zalo/app_sync.cron.log 2>&1
```

ACB 2 phút/lần là đủ (Zalo vẫn 1 phút/lần, không đổi). Hai mốc TCB chạy SAU `tcb_zalo.py` để sao kê
đã về hộp thư.

## 5. File script tự sinh ra

| File | Vai trò | Mất file thì sao |
|---|---|---|
| `app_posted.json` | Giao dịch đã đẩy lên app (theo từng nguồn) | Lần chạy sau tự seed lại — KHÔNG gửi lại giao dịch cũ |
| `app_scanned_uids.json` | UID email đã đọc, để khỏi tải lại | Chỉ chậm hơn một lần chạy |
| `app_sync.log` | Nhật ký | — |

App chống trùng lần hai bằng `ext_id`: gửi lại bao nhiêu lần cũng chỉ lưu một dòng.

## 6. Xử lý sự cố

| Hiện tượng | Xử lý |
|---|---|
| Log `LOI app tra 401` | Sai `secret` — so lại với biến `BANK_WEBHOOK_SECRET` trên Vercel |
| Log `LOI gui len app` | Mạng/app lỗi. Giao dịch KHÔNG bị đánh dấu, lần chạy sau tự gửi lại |
| App không thấy giao dịch mới | `python3 app_sync.py --dry` xem có bắt được email không |
| Muốn bỏ qua hẳn một giai đoạn | Đặt thêm biến `BANK_SYNC_FROM` (ISO) trên Vercel — app bỏ mọi giao dịch cũ hơn mốc đó |
