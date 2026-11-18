#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gan nhan "Da gui Zalo" (Đã gửi Zalo) cho mail bao co trong hop congnosavitax@gmail.com.

Chay DOC LAP voi acb_zalo.py / tcb_zalo.py / app_sync.py / mail_sync.py — KHONG sua, KHONG ghi
file nao cua chung. Chi DOC so chong trung cua luong Zalo de biet mail nao da gui that:
  - ACB : mail "Ghi co" co dau van tay (make_fingerprint) nam trong processed_msgids.json.
          (Mail "Ghi no" cung nam trong so do nhung KHONG gui Zalo -> khong gan nhan.)
  - TCB : mail kem sao ke .xlsx co it nhat mot sheet CO tien vao va khoa "tai khoan|ngay"
          nam trong tcb_processed.json. (Sao ke khong co tien vao: bo qua, khong gan.)
Gui Zalo loi thi so chong trung khong co dau van tay -> mail CHUA gan, lan sau kiem lai.

Chi them nhan (STORE +X-GM-LABELS), doc thu bang BODY.PEEK nen KHONG doi trang thai da doc,
KHONG chuyen thu muc, KHONG xoa gi.

  python3 zalo_label.py                    # chay thuong (cron), quet 3 ngay gan nhat
  python3 zalo_label.py --dry              # xem truoc, KHONG gan nhan, KHONG ghi file
  python3 zalo_label.py --tu 2026-09-01    # gan bu cho mail cu tu ngay nay
"""
import base64
import email
import imaplib
import os
import re
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from acb_zalo import (  # noqa: E402 — dung CHINH ham cua ban dang chay tren VPS
    load_json, save_json, get_email_text, parse_transaction, make_fingerprint,
    CONFIG_PATH, BASE_DIR, VN_TZ,
)
from tcb_zalo import parse_statement, decode_filename  # noqa: E402

NHAN = "Đã gửi Zalo"
ACB_PROCESSED_PATH = os.path.join(BASE_DIR, "processed_msgids.json")
TCB_PROCESSED_PATH = os.path.join(BASE_DIR, "tcb_processed.json")
STATE_PATH = os.path.join(BASE_DIR, "zalo_label_state.json")
LOG_PATH = os.path.join(BASE_DIR, "zalo_label.log")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def log(msg):
    line = "[%s] %s" % (datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def imap_utf7(s):
    """Ten nhan co dau phai ma hoa 'modified UTF-7' (RFC 3501) khi noi chuyen voi IMAP."""
    out, buf = [], []

    def flush():
        if buf:
            b64 = base64.b64encode("".join(buf).encode("utf-16-be")).decode().rstrip("=")
            out.append("&" + b64.replace("/", ",") + "-")
            buf.clear()

    for ch in s:
        if 0x20 <= ord(ch) <= 0x7E:
            flush()
            out.append("&-" if ch == "&" else ch)
        else:
            buf.append(ch)
    flush()
    return "".join(out)


def imap_date(d):
    return "%02d-%s-%d" % (d.day, MONTHS[d.month - 1], d.year)


def doc_tham_so():
    dry = "--dry" in sys.argv
    tu = None
    if "--tu" in sys.argv:
        i = sys.argv.index("--tu")
        tu = datetime.strptime(sys.argv[i + 1], "%Y-%m-%d")
    if tu is None:
        tu = datetime.now(VN_TZ) - timedelta(days=3)
    return dry, tu


def fetch(imap, uid, phan):
    st, md = imap.uid("FETCH", uid, "(%s)" % phan)
    if st != "OK" or not md or md[0] is None:
        return None, b""
    meta, raw = (md[0][0], md[0][1]) if isinstance(md[0], tuple) else (md[0], b"")
    return meta, raw


def co_nhan(meta, nhan_ma):
    m = meta.decode("utf-8", "ignore") if isinstance(meta, bytes) else str(meta or "")
    return nhan_ma in m or NHAN in m


def xet_acb(msg, acb_done):
    """Tra 'gan' | 'bo' (khong bao gio gan) | 'cho' (chua gui, kiem lai lan sau)."""
    tx = parse_transaction(get_email_text(msg))
    if not tx or tx["kind"] != "credit":
        return "bo"
    return "gan" if make_fingerprint(msg, tx) in acb_done else "cho"


def xet_tcb(msg, tcb_done):
    co_sao_ke, cho = False, False
    for part in msg.walk():
        fn = decode_filename(part.get_filename())
        if not fn.lower().endswith((".xlsx", ".xls")):
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        try:
            sheets = parse_statement(payload)
        except Exception:
            continue
        for sh in sheets:
            if not sh["items"]:
                continue
            if "%s|%s" % (sh["account"], sh["stmt_date"]) in tcb_done:
                co_sao_ke = True
            else:
                cho = True
    if co_sao_ke:
        return "gan"
    return "cho" if cho else "bo"


def main():
    dry, tu = doc_tham_so()
    cfg = load_json(CONFIG_PATH, None)
    if not cfg:
        log("LOI: khong doc duoc config.json")
        sys.exit(1)
    acb_done = set(load_json(ACB_PROCESSED_PATH, []))
    tcb_done = set(load_json(TCB_PROCESSED_PATH, []))
    nhan_ma = imap_utf7(NHAN)

    try:
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], timeout=60)
    except TypeError:
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"])
    imap.login(cfg["email_account"], cfg["email_app_password"])
    # Ghi nhan can che do doc-ghi; doc thu luon bang BODY.PEEK nen khong danh dau "da doc".
    imap.select("INBOX", readonly=dry)

    try:
        uidv = str(imap.response("UIDVALIDITY")[1][0])
    except Exception:
        uidv = ""
    state = load_json(STATE_PATH, {})
    if not isinstance(state, dict) or state.get("uidvalidity") != uidv:
        state = {"uidvalidity": uidv, "done": []}
    done = set(state.get("done", []))

    def tim(*dk):
        st, data = imap.uid("SEARCH", None, *dk)
        if st != "OK":
            imap.logout()
            log("LOI IMAP SEARCH: %s" % data)
            sys.exit(1)
        return [u.decode() for u in data[0].split() if u.decode() not in done]

    since = imap_date(tu)
    # ACB: mail bien dong so du. TCB: chi mail kem file Excel (Gmail tu loc) — hop thu con nhan ca
    # mail bo bao cao CC ve, quet tung thu se rat cham.
    acb_uids = tim("FROM", '"%s"' % cfg["acb_sender"], "SINCE", since)
    tcb_uids = [u for u in tim("X-GM-RAW", '"filename:xlsx OR filename:xls"', "SINCE", since)
                if u not in set(acb_uids)]

    dem = {"gan": 0, "da_co": 0, "cho": 0, "bo": 0}
    gan_uids, mau = [], []

    def xu_ly(uid, meta, raw, ham, so):
        if co_nhan(meta, nhan_ma):
            dem["da_co"] += 1
            done.add(uid)
            return
        msg = email.message_from_bytes(raw)
        kq = ham(msg, so)
        dem[kq] += 1
        if kq == "gan":
            gan_uids.append(uid)
            if len(mau) < 15:
                mau.append("%s | %s" % ((msg.get("Date") or "")[:25], (msg.get("Subject") or "")[:70]))
        elif kq == "bo":
            done.add(uid)
        # 'cho': de lai, lan sau kiem lai (Zalo chua gui / gui loi)

    # ACB: thu nho, tai theo lo 50 thu mot lenh
    for i in range(0, len(acb_uids), 50):
        lo = acb_uids[i:i + 50]
        st, md = imap.uid("FETCH", ",".join(lo), "(UID X-GM-LABELS BODY.PEEK[])")
        if st != "OK":
            continue
        for it in md:
            if not isinstance(it, tuple):
                continue
            m = re.search(rb"UID (\d+)", it[0])
            if m:
                xu_ly(m.group(1).decode(), it[0], it[1], xet_acb, acb_done)

    for uid in tcb_uids:
        meta, raw = fetch(imap, uid, "X-GM-LABELS BODY.PEEK[]")
        if meta is not None and raw:
            xu_ly(uid, meta, raw, xet_tcb, tcb_done)

    loi = 0
    if not dry and gan_uids:
        try:
            imap.create('"%s"' % nhan_ma)  # da co thi Gmail bao loi — bo qua
        except Exception:
            pass
        for uid in gan_uids:
            st3, r = imap.uid("STORE", uid, "+X-GM-LABELS", '("%s")' % nhan_ma)
            if st3 == "OK":
                done.add(uid)
            else:
                loi += 1
                log("LOI gan nhan uid %s: %s" % (uid, r))
    imap.logout()

    if dry:
        print("=== XEM TRUOC (khong gan, khong ghi file) tu %s ===" % tu.strftime("%d/%m/%Y"))
        print("Se gan nhan: %d | da co nhan: %d | chua gui Zalo (cho): %d | khong lien quan: %d"
              % (dem["gan"], dem["da_co"], dem["cho"], dem["bo"]))
        for x in mau:
            print("  " + x)
        return

    state["done"] = sorted(done, key=lambda x: int(x) if x.isdigit() else 0)[-8000:]
    save_json(STATE_PATH, state)
    if gan_uids or loi:
        log("Gan nhan '%s': %d thu (loi %d, cho %d)" % (NHAN, len(gan_uids) - loi, loi, dem["cho"]))


if __name__ == "__main__":
    main()
