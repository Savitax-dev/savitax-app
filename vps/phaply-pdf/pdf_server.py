#!/usr/bin/env python3
# Dịch vụ đổi Word → PDF cho phân hệ Pháp lý (app.savitax.vn), chạy trên VPS Savitax cạnh cron ngân hàng (anh chọn dùng chung VPS, 17/11/2026).
#   POST /doi   Authorization: Bearer <PDF_SECRET>   body = .zip chứa các .docx  →  .zip chứa các .pdf cùng tên
#   GET  /suc-khoe → "ok"
# HTTPS chứng chỉ TỰ KÝ (app ghim đúng chứng chỉ này: PHAPLY_PDF_CA) — dữ liệu khách không đi chữ rõ trên mạng.
# Mỗi kết nối một luồng + hạn 60 giây (25/11/2026: bản một luồng bắt tay TLS ngay lúc accept, không hạn giờ → MỘT kết nối mở rồi im
# (máy quét mạng) làm đứng cả dịch vụ từ 18/11). Đổi TỪNG gói một (khoá `KHOA_LO`, LibreOffice dùng chung một hồ sơ) bằng MỘT lần chạy cho cả gói; systemd giới hạn RAM / CPU / ưu tiên thấp để cron
# ngân hàng luôn được ưu tiên (vps/phaply-pdf/phaply-pdf.service). KHÔNG ghi tên file / nội dung vào log — chỉ số file + thời gian.
import json, os, re, shutil, ssl, subprocess, sys, tempfile, threading, time, zipfile, io, hmac
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

SECRET = os.environ.get('PDF_SECRET', '')
PORT = int(os.environ.get('PORT', '8443'))
CERT, KEY = os.environ.get('CERT', '/etc/phaply-pdf/cert.pem'), os.environ.get('KEY', '/etc/phaply-pdf/key.pem')
PROFILE = os.environ.get('LO_PROFILE', '/var/lib/phaply-pdf/profile')
TOI_DA_BODY = 20 * 1024 * 1024          # gói gửi lên
TOI_DA_GIAI_NEN = 60 * 1024 * 1024      # chống zip bomb
TOI_DA_FILE = 40
HET_GIO = 150                            # giây cho cả gói
HAN_KET_NOI = 60                         # giây mỗi lượt đọc / ghi trên một kết nối (gồm cả bắt tay TLS)
KHOA_LO = threading.Lock()               # LibreOffice: mỗi lúc một gói
TEN_HOP_LE = re.compile(r'^[^/\\\x00]{1,180}\.docx$', re.I)

if len(SECRET) < 32:
    sys.exit('Thiếu PDF_SECRET (>= 32 ký tự)')


def ghi_log(*a):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), *a, flush=True)


class XuLy(BaseHTTPRequestHandler):
    server_version = 'phaply-pdf'
    timeout = HAN_KET_NOI          # StreamRequestHandler đặt hạn cho socket của kết nối — kết nối im quá hạn tự đóng
    sys_version = ''

    def log_message(self, *a):   # tắt log mặc định (có đường dẫn) — tự ghi log gọn
        pass

    def tra(self, ma, body, kieu='application/json'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(ma)
        self.send_header('Content-Type', kieu)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/suc-khoe':
            return self.tra(200, b'ok', 'text/plain')
        self.tra(404, {'loi': 'không có'})

    def do_POST(self):
        t0 = time.time()
        if self.path != '/doi':
            return self.tra(404, {'loi': 'không có'})
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + SECRET):
            ghi_log('từ chối: sai khoá')
            return self.tra(401, {'loi': 'sai khoá'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > TOI_DA_BODY:
            return self.tra(413, {'loi': 'gói rỗng hoặc quá 20 MB'})
        data = self.rfile.read(n)
        tmp = tempfile.mkdtemp(prefix='doi-')
        try:
            try:
                z = zipfile.ZipFile(io.BytesIO(data))
            except zipfile.BadZipFile:
                return self.tra(400, {'loi': 'không phải .zip'})
            ds = [i for i in z.infolist() if not i.is_dir()]
            if not ds or len(ds) > TOI_DA_FILE:
                return self.tra(400, {'loi': f'gói phải có 1–{TOI_DA_FILE} file'})
            if sum(i.file_size for i in ds) > TOI_DA_GIAI_NEN:
                return self.tra(400, {'loi': 'gói giải nén quá lớn'})
            vao = os.path.join(tmp, 'vao'); ra = os.path.join(tmp, 'ra')
            os.makedirs(vao); os.makedirs(ra)
            ten = []
            for i, it in enumerate(ds):
                goc = os.path.basename(it.filename)
                if not TEN_HOP_LE.match(goc):
                    return self.tra(400, {'loi': 'chỉ nhận file .docx'})
                # đặt tên tạm theo số thứ tự: tên tiếng Việt / dấu cách không làm LibreOffice vấp, trả về lại đúng tên gốc
                p = os.path.join(vao, f'{i:03d}.docx')
                with open(p, 'wb') as f:
                    f.write(z.read(it))
                ten.append((p, goc))
            try:
              with KHOA_LO:
                r = subprocess.run(['soffice', f'-env:UserInstallation=file://{PROFILE}', '--headless', '--norestore', '--nologo',
                                    '--convert-to', 'pdf', '--outdir', ra] + [p for p, _ in ten],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=HET_GIO)
            except subprocess.TimeoutExpired:
                subprocess.run(['pkill', '-f', f'UserInstallation=file://{PROFILE}'])
                ghi_log(f'hết giờ: {len(ten)} file')
                return self.tra(504, {'loi': 'đổi PDF quá lâu'})
            buf = io.BytesIO()
            thieu = 0
            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
                for p, goc in ten:
                    pdf = os.path.join(ra, os.path.basename(p)[:-5] + '.pdf')
                    if os.path.exists(pdf):
                        out.write(pdf, goc[:-5] + '.pdf')
                    else:
                        thieu += 1
            if thieu:
                ghi_log(f'lỗi: thiếu {thieu}/{len(ten)} PDF, mã {r.returncode}')
                return self.tra(500, {'loi': f'không đổi được {thieu} file'})
            ghi_log(f'ok: {len(ten)} file, {time.time() - t0:.1f}s')
            self.tra(200, buf.getvalue(), 'application/zip')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    os.makedirs(PROFILE, exist_ok=True)
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), XuLy)
    srv.daemon_threads = True
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(CERT, KEY)
    # bắt tay TLS ở luồng của kết nối (lần đọc đầu, có hạn HAN_KET_NOI) — KHÔNG ở accept() của luồng chính
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True, do_handshake_on_connect=False)
    ghi_log(f'phaply-pdf nghe cổng {PORT}')
    srv.serve_forever()
