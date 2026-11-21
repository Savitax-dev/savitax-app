# Cài tiện ích "Savitax — Cầu nối cổng thuế"

Tiện ích này chỉ làm một việc: **gọi cổng Dịch vụ công thuế thay cho máy chủ**. Máy chủ Savitax đặt
ở Singapore, cổng thuế chặn theo vùng nên máy chủ không gọi tới được — nhân viên ở Việt Nam thì gọi
bình thường. Tiện ích không tự chạy nền, không thu thập gì, chỉ chuyển tiếp yêu cầu khi trang
Savitax nhờ.

## Cài trên máy nhân viên (5 phút, làm một lần)

1. Chép cả thư mục `chrome-extension` về máy. Đặt ở đâu cũng được — **đường dẫn không còn quan
   trọng** (xem mục "Vì sao mã tiện ích cố định" bên dưới). Nhưng đừng để trong Downloads hay Temp
   vì dễ bị xoá; gợi ý `C:\Savitax\chrome-extension`.
2. Mở Chrome, vào `chrome://extensions`.
3. Bật **Chế độ dành cho nhà phát triển** (Developer mode) — công tắc góc trên bên phải.
4. Nhấn **Tải tiện ích đã giải nén** (Load unpacked) → chọn thư mục vừa chép.
5. Đối chiếu mã tiện ích hiện ra dưới tên. **Phải đúng chuỗi này:**

   ```
   affcgkipcpdjoiednghajbahjanhlnnn
   ```

   Khác một ký tự là sai thư mục hoặc `manifest.json` đã bị sửa — dừng lại, đừng dùng.
6. Xong. Vào màn hình Tờ khai trên app, nút kết nối sẽ nhận ra tiện ích.

## Vì sao mã tiện ích cố định trên mọi máy

Bình thường Chrome sinh mã cho tiện ích "tải đã giải nén" bằng cách **băm đường dẫn thư mục**, nên
mỗi máy một mã khác nhau. Web app lại chỉ giữ được **một** mã duy nhất (biến
`NEXT_PUBLIC_TOKHAI_EXT_ID` nướng vào lúc build), nên kiểu đó sẽ chỉ chạy đúng trên một máy.

Cách chữa: `manifest.json` có trường `key` chứa **khóa công khai** do mình tự sinh. Có trường này thì
Chrome lấy mã từ khóa chứ không từ đường dẫn → mã giống nhau trên mọi máy, và đổi chỗ thư mục cũng
không đổi mã.

- Khóa riêng đi cùng: `C:\Users\win\.savitax-keys\tokhai-extension-private.pem` — **nằm ngoài git,
  cố ý**. Mất nó thì mã tiện ích vẫn giữ nguyên (mã chỉ phụ thuộc khóa công khai trong manifest),
  chỉ mất khả năng tự đóng gói `.crx` ký tên sau này. Nên cất thêm một bản ở nơi an toàn.
- **Đừng sửa trường `key`.** Sửa là đổi mã, là mọi máy mất kết nối cùng lúc cho tới khi build lại
  web app với mã mới.

Kiểm lại mã bất cứ lúc nào, không cần Chrome:

```bash
node -e "const c=require('crypto'),f=require('fs');const k=JSON.parse(f.readFileSync('chrome-extension/manifest.json','utf8')).key;console.log([...c.createHash('sha256').update(Buffer.from(k,'base64')).digest().subarray(0,16)].map(b=>b.toString(16).padStart(2,'0')).join('').replace(/[0-9a-f]/g,x=>String.fromCharCode(97+parseInt(x,16))))"
```

## Cập nhật lên bản mới

Chép đè thư mục rồi vào `chrome://extensions` nhấn nút **Tải lại** (mũi tên vòng) ở ô tiện ích. Mã
không đổi nên web app không cần build lại.

Nhược điểm của cách này: không tự cập nhật, mỗi bản mới phải chép tay lên từng máy. Khi nào số máy
nhiều tới mức khó chịu thì đưa lên **Chrome Web Store dạng không công khai** (unlisted) — nhân viên
cài một cú nhấp và tự cập nhật. Lưu ý lúc đó: Store cấp mã riêng của nó, nên phải thay `key` trong
manifest bằng khóa công khai Store cấp **và** cập nhật `NEXT_PUBLIC_TOKHAI_EXT_ID` một lần nữa.

## Cần đặt trên Vercel trước khi đẩy production

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_TOKHAI_EXT_ID` | `affcgkipcpdjoiednghajbahjanhlnnn` |

Đặt cho cả ba môi trường (Production / Preview / Development). Vì là `NEXT_PUBLIC_*`, **phải build
lại** sau khi đặt — sửa biến không thôi thì bản đang chạy vẫn giữ giá trị cũ.
