#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day TIEU DE mail "bo bao cao thue" nhan vien gui khach len app.savitax.vn, de app tu tick viec
"Gui mail bo bao cao thue ..." trong Checklist cong viec.

Chay DOC LAP voi acb_zalo.py / tcb_zalo.py / app_sync.py: chi doc Gmail o che do READONLY, file
chong trung rieng (mail_scanned_uids.json), log rieng. Hong script nay thi ngan hang van chay.

  python3 mail_sync.py          # cron 30 phut/lan
  python3 mail_sync.py --dry    # xem truoc se gui gi, KHONG gui, KHONG ghi file
  python3 mail_sync.py --days 30  # mo rong cua so quet (mac dinh 7 ngay)

CHI DOC PHAN DAU THU (header), khong tai noi dung, khong tai file dinh kem. Mot lan quet vai tram
thu chi ton vai chuc KB — day la ly do script nay chay duoc moi 30 phut ma khong nang hop thu.

KHONG CO FILE "da gui": app chong trung bang Message-ID cua thu (bang mail_evidence, sql/30), gui
lai bao nhieu lan cung chi mot dong. File UID chi de khoi FETCH lai nhung thu da doc.

Cau hinh: mail_sync.json canh file nay
  {"app_url": "https://app.savitax.vn", "secret": "<MAIL_WEBHOOK_SECRET tren Vercel>", "days": 7}
Gmail dung chung config.json cua acb_zalo.py (chi doc).
"""
import email
import imaplib
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from email.header import decode_header, make_header

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from acb_zalo import (  # noqa: E402 — dung CHINH ham cua ban dang chay tren VPS
    load_json, save_json, CONFIG_PATH, BASE_DIR, VN_TZ,
)

APP_CFG_PATH = os.path.join(BASE_DIR, "mail_sync.json")
SCAN_PATH = os.path.join(BASE_DIR, "mail_scanned_uids.json")
LOG_PATH = os.path.join(BASE_DIR, "mail_sync.log")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
BATCH = 100
NEO = "BAO CAO"   # tieu de phai chua cum nay (da bo dau) thi moi gui len app


def log(msg):
    line = "[%s] %s" % (datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def bo_dau(s):
    """Bo dau tieng Viet de loc tieu de — PHAI khop cach lam cua lib/mailBaoCao.js (ham boDau)."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D").upper()


def imap_since(days):
    d = datetime.now(VN_TZ) - timedelta(days=days)
    return "%02d-%s-%d" % (d.day, MONTHS[d.month - 1], d.year)


def open_imap(cfg):
    try:
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], timeout=60)
    except TypeError:  # Python < 3.9 khong co tham so timeout
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"])
    imap.login(cfg["email_account"], cfg["email_app_password"])
    imap.select("INBOX", readonly=True)
    return imap


def load_scan(imap):
    """Nho UID da doc de BO QUA TRUOC KHI FETCH — cung ly do nhu app_sync.py: hop thu lon dan thi
    vong lap FETCH se vuot timeout cua cron ngay truoc buoc gui, khong loi khong log."""
    try:
        uidv = str(imap.response("UIDVALIDITY")[1][0])
    except Exception:
        uidv = ""
    scan = load_json(SCAN_PATH, {})
    if not isinstance(scan, dict) or scan.get("uidvalidity") != uidv or not isinstance(scan.get("uids"), list):
        scan = {"uidvalidity": uidv, "uids": []}
    return scan, set(scan["uids"])


def giai_ma(raw):
    """Tieu de thu thuong duoc ma hoa MIME (=?UTF-8?B?...?=). Giai ma hong thi tra nguyen van."""
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return str(raw)


def doc_header(imap, uid):
    """Chi lay 4 truong can dung. BODY.PEEK = khong danh dau thu la da doc."""
    st, data = imap.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE MESSAGE-ID)])")
    if st != "OK" or not data or not isinstance(data[0], tuple):
        return None
    msg = email.message_from_bytes(data[0][1])
    tu = giai_ma(msg.get("From"))
    # "Luong Tan Duc <ltduc@savitax.vn>" -> "ltduc@savitax.vn"
    if "<" in tu and ">" in tu:
        tu = tu[tu.rfind("<") + 1:tu.rfind(">")]
    ngay = msg.get("Date")
    try:
        ngay_iso = email.utils.parsedate_to_datetime(ngay).isoformat() if ngay else None
    except Exception:
        ngay_iso = None
    return {
        "message_id": (msg.get("Message-ID") or "").strip(),
        "subject": giai_ma(msg.get("Subject")),
        "from_email": tu.strip().lower(),
        "sent_at": ngay_iso,
    }


def post_to_app(app_cfg, items):
    url = app_cfg["app_url"].rstrip("/") + "/api/mail/incoming"
    for i in range(0, len(items), BATCH):
        chunk = items[i:i + BATCH]
        body = json.dumps({"mails": chunk}, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app_cfg["secret"],
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                res = json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            log("LOI app tra %s: %s" % (e.code, e.read()[:300]))
            return False
        except Exception as e:
            log("LOI gui len app: %s" % e)
            return False
        if not res.get("ok"):
            log("LOI app: %s" % res)
            return False
        log("Da gui %d thu — khop %s, tick %s, chua khop %s, trung %s" % (
            len(chunk), res.get("khop"), res.get("tick"), res.get("khongKhop"), res.get("trungLap")))
    return True


def main():
    dry = "--dry" in sys.argv
    days = 7
    if "--days" in sys.argv:
        try:
            days = int(sys.argv[sys.argv.index("--days") + 1])
        except Exception:
            pass

    cfg = load_json(CONFIG_PATH, {})
    app_cfg = load_json(APP_CFG_PATH, {})
    if not app_cfg.get("app_url") or not app_cfg.get("secret"):
        log("Thieu mail_sync.json (app_url / secret). Dung.")
        return 1
    days = int(app_cfg.get("days") or days)

    imap = open_imap(cfg)
    scan, da_doc = load_scan(imap)

    st, data = imap.uid("SEARCH", None, '(SINCE "%s")' % imap_since(days))
    if st != "OK":
        log("SEARCH that bai")
        imap.logout()
        return 1
    uids = [u.decode() for u in (data[0] or b"").split()]
    moi = [u for u in uids if u not in da_doc]
    log("Cua so %d ngay: %d thu, %d thu chua doc" % (days, len(uids), len(moi)))

    items, uid_moi = [], []
    for uid in moi:
        try:
            h = doc_header(imap, uid)
        except Exception as e:
            log("Khong doc duoc UID %s: %s" % (uid, e))
            continue
        uid_moi.append(uid)
        if not h or not h["message_id"] or not h["sent_at"]:
            continue
        # Loc ngay tai day cho nhe: thu khong co cum "BAO CAO" thi khong lien quan.
        if NEO not in bo_dau(h["subject"]):
            continue
        items.append(h)

    imap.logout()
    log("Co %d thu co cum '%s'" % (len(items), NEO))

    if dry:
        for h in items[:30]:
            log("  [dry] %s | %s | %s" % (h["sent_at"][:16], h["from_email"], h["subject"][:70]))
        log("(dry: khong gui, khong ghi file)")
        return 0

    if items and not post_to_app(app_cfg, items):
        # Gui that bai -> KHONG danh dau UID da doc, lan sau tu thu lai.
        return 1

    if uid_moi:
        da_doc.update(uid_moi)
        scan["uids"] = sorted(da_doc, key=lambda x: int(x) if x.isdigit() else 0)[-5000:]
        save_json(SCAN_PATH, scan)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log("LOI khong luong truoc: %s" % e)
        sys.exit(1)
