#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day giao dich TIEN VAO len app.savitax.vn (trang Doi soat ngan hang).

Chay DOC LAP voi acb_zalo.py / tcb_zalo.py: chi doc Gmail o che do readonly, co file chong trung
rieng (app_posted.json), KHONG dung toi processed_msgids.json / tcb_processed.json / token Zalo.
Hong script nay thi tin Zalo van chay binh thuong.

  python3 app_sync.py            # ACB: email bien dong so du (cron moi phut)
  python3 app_sync.py --tcb      # Techcombank: file sao ke .xlsx (cron sau tcb_zalo.py)
  python3 app_sync.py --dry      # xem truoc se gui gi, KHONG gui, KHONG ghi file
  python3 app_sync.py --seed     # danh dau moi giao dich hien co la da gui (khong gui)

Lan chay DAU TIEN (chua co app_posted.json) tu vao che do seed: giao dich cu KHONG bao gio duoc
gui len app — dung cam ket "chi ap dung tu luc duyet, khong gui lai giao dich cu".

Cau hinh: app_sync.json canh file nay
  {"app_url": "https://app.savitax.vn", "secret": "<BANK_WEBHOOK_SECRET>", "acb_days": 3}
Gmail dung chung config.json cua acb_zalo.py (chi doc).
"""
import email
import fcntl
import hashlib
import imaplib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from acb_zalo import (  # noqa: E402 — dung CHINH ham cua ban dang chay tren VPS
    load_json, save_json, get_email_text, parse_transaction, make_fingerprint,
    CONFIG_PATH, BASE_DIR, VN_TZ,
)

APP_CFG_PATH = os.path.join(BASE_DIR, "app_sync.json")
POSTED_PATH = os.path.join(BASE_DIR, "app_posted.json")
SCAN_PATH = os.path.join(BASE_DIR, "app_scanned_uids.json")
LOG_PATH = os.path.join(BASE_DIR, "app_sync.log")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
BATCH = 200


def log(msg):
    line = "[%s] %s" % (datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def imap_since(days):
    from datetime import timedelta
    d = datetime.now(VN_TZ) - timedelta(days=days)
    return "%02d-%s-%d" % (d.day, MONTHS[d.month - 1], d.year)


def post_to_app(app_cfg, items):
    """Gui len app. Tra True neu app da nhan (ke ca giao dich trung — app tu bo qua)."""
    url = app_cfg["app_url"].rstrip("/") + "/api/bank/incoming"
    for i in range(0, len(items), BATCH):
        chunk = items[i:i + BATCH]
        body = json.dumps({"transactions": chunk}, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app_cfg["secret"],
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
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
        log("Da gui %d giao dich (moi %s, trung %s, loai %s)" % (
            len(chunk), res.get("inserted"), res.get("duplicates"), len(res.get("rejected") or [])))
    return True


def open_imap(cfg):
    try:
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], timeout=60)
    except TypeError:  # Python < 3.9 khong co tham so timeout
        imap = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"])
    imap.login(cfg["email_account"], cfg["email_app_password"])
    imap.select("INBOX", readonly=True)
    return imap


# ── Bo nho UID da doc ────────────────────────────────────────────────────────────────────────
# Su co 4 cua luong Zalo: vong lap FETCH toan bo noi dung TOI email, roi moi kiem tra da xu ly
# chua -> hop thu lon dan, thoi gian chay tang dan, den luc vuot `timeout` cua cron thi bi cat
# NGAY TRUOC BUOC GUI, khong loi khong log. Nho UID da doc de BO QUA TRUOC KHI FETCH.
# Tach theo tung nguon (acb / tcb) vi hai luong quet hai pham vi khac nhau.
def load_scan(imap, key):
    try:
        uidv = str(imap.response("UIDVALIDITY")[1][0])
    except Exception:
        uidv = ""
    scan = load_json(SCAN_PATH, {})
    if not isinstance(scan, dict) or scan.get("uidvalidity") != uidv or not isinstance(scan.get("uids"), dict):
        scan = {"uidvalidity": uidv, "uids": {}}
    scan["uids"].setdefault(key, [])
    return scan, set(scan["uids"][key])


def make_marker(scan, scanned, key, dry):
    def mark_scanned(new_uids):
        if dry or not new_uids:
            return
        scanned.update(new_uids)
        scan["uids"][key] = sorted(scanned, key=lambda x: int(x) if x.isdigit() else 0)[-3000:]
        save_json(SCAN_PATH, scan)
    return mark_scanned


# ── ACB ──────────────────────────────────────────────────────────────────────────────────────
def collect_acb(cfg, app_cfg, posted, dry):
    imap = open_imap(cfg)
    # 7 ngay (Zalo dung 3): FETCH da duoc bo qua theo UID nen cua so rong hau nhu khong ton them
    # thoi gian, doi lai neu VPS/app chet vai ngay thi chay lai van gui bu duoc.
    days = int(app_cfg.get("acb_days", 7))
    st, data = imap.uid("SEARCH", None, '(FROM "%s" SINCE "%s")' % (cfg["acb_sender"], imap_since(days)))
    if st != "OK":
        imap.logout()
        raise RuntimeError("IMAP SEARCH loi: %s" % data)
    uids = data[0].split()

    scan, scanned = load_scan(imap, "acb")
    items, done_uids = [], []
    for uid in uids:
        u = uid.decode() if isinstance(uid, bytes) else str(uid)
        if u in scanned:
            continue
        st, md = imap.uid("FETCH", uid, "(RFC822)")
        if st != "OK" or not md or md[0] is None:
            continue
        msg = email.message_from_bytes(md[0][1])
        tx = parse_transaction(get_email_text(msg))
        if not tx or tx["kind"] != "credit":
            done_uids.append(u)
            continue
        fp = make_fingerprint(msg, tx)
        if fp in posted:
            done_uids.append(u)
            continue
        try:
            t = parsedate_to_datetime(msg.get("Date")).astimezone(VN_TZ).isoformat()
        except Exception:
            t = datetime.now(VN_TZ).isoformat()
        items.append({"_uid": u, "source": "acb", "ext_id": fp, "tx_time": t,
                      "amount": tx["amount"], "memo": tx["content"]})
    imap.logout()
    return items, done_uids, make_marker(scan, scanned, "acb", dry)


# ── Techcombank ──────────────────────────────────────────────────────────────────────────────
def tcb_time(date_str):
    s = (date_str or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:10], fmt).replace(tzinfo=VN_TZ).isoformat()
        except ValueError:
            pass
    return datetime.now(VN_TZ).isoformat()


def collect_tcb(cfg, posted, dry):
    from tcb_zalo import parse_statement, decode_filename  # can openpyxl — chi nap khi chay --tcb
    imap = open_imap(cfg)
    days = int(cfg.get("tcb_days", 14))
    # KHONG loc theo nguoi gui: sao ke hay duoc chuyen tiep tay (dung y tcb_zalo.py), nen phai quet
    # ca hop thu trong N ngay. Bu lai bang bo nho UID de moi email chi tai ve MOT lan.
    st, data = imap.uid("SEARCH", None, '(SINCE "%s")' % imap_since(days))
    if st != "OK":
        imap.logout()
        raise RuntimeError("IMAP SEARCH loi: %s" % data)
    scan, scanned = load_scan(imap, "tcb")
    items, seen, done_uids = [], set(), []
    for uid in data[0].split():
        u = uid.decode() if isinstance(uid, bytes) else str(uid)
        if u in scanned:
            continue
        st, md = imap.uid("FETCH", uid, "(RFC822)")
        if st != "OK" or not md or md[0] is None:
            continue
        had_new = False
        msg = email.message_from_bytes(md[0][1])
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
                for i, it in enumerate(sh["items"]):
                    if it["ref"]:
                        ext = "stmt:%s|%s" % (sh["account"], it["ref"])
                    else:
                        raw = "%s|%s|%s|%s|%d" % (sh["account"], it["date"], it["amount"], it["desc"], i)
                        ext = "stmt:%s|h%s" % (sh["account"], hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20])
                    if ext in posted or ext in seen:
                        continue
                    seen.add(ext)
                    had_new = True
                    items.append({"_uid": u, "source": "tcb", "ext_id": ext, "tx_time": tcb_time(it["date"]),
                                  "amount": int(round(it["amount"])), "memo": it["desc"],
                                  "account": sh["account"]})
        # Email khong con giao dich nao can gui -> nho lai de lan sau khoi tai ve. Email CON giao
        # dich chua gui thi de nguyen, chi danh dau SAU KHI gui thanh cong (bai hoc su co 5).
        if not had_new:
            done_uids.append(u)
    imap.logout()
    return items, done_uids, make_marker(scan, scanned, "tcb", dry)


def main():
    dry = "--dry" in sys.argv
    tcb = "--tcb" in sys.argv
    lock = open(os.path.join(BASE_DIR, "app_sync%s.lock" % ("_tcb" if tcb else "")), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("Bo qua: lan chay truoc chua ket thuc")
        return

    cfg = load_json(CONFIG_PATH, None)
    app_cfg = load_json(APP_CFG_PATH, None)
    if not cfg or not app_cfg or not app_cfg.get("secret") or not app_cfg.get("app_url"):
        log("LOI: thieu config.json hoac app_sync.json (app_url, secret)")
        sys.exit(1)

    state = load_json(POSTED_PATH, None)
    if not isinstance(state, dict):
        state = {}
    key = "tcb" if tcb else "acb"
    # Seed RIENG tung nguon: lan dau chay ACB khong duoc lam lan dau chay --tcb gui lai sao ke cu.
    seed = "--seed" in sys.argv or key not in state
    posted = set(state.get(key, []))

    try:
        if tcb:
            items, done_uids, mark_scanned = collect_tcb(cfg, posted, dry)
        else:
            items, done_uids, mark_scanned = collect_acb(cfg, app_cfg, posted, dry)
    except Exception as e:
        log("LOI doc Gmail (%s): %s" % (key, e))
        sys.exit(1)

    def save_posted(new_ids):
        posted.update(new_ids)
        state[key] = sorted(posted)[-20000:]
        save_json(POSTED_PATH, state)

    if seed:
        if dry:
            print("[dry] Seed se danh dau %d giao dich %s la da gui." % (len(items), key.upper()))
            return
        save_posted([x["ext_id"] for x in items])
        mark_scanned(done_uids + [x["_uid"] for x in items if "_uid" in x])
        log("Khoi tao chong trung %s: danh dau %d giao dich cu (KHONG gui len app)" % (key.upper(), len(items)))
        return

    if dry:
        print("[dry] %d giao dich %s se duoc gui:" % (len(items), key.upper()))
        for x in items:
            print("  %s  %14s  %s" % (x["tx_time"][:16], x["amount"], x["memo"][:90]))
        return

    mark_scanned(done_uids)
    if not items:
        return
    payload = [{k: v for k, v in x.items() if k != "_uid"} for x in items]
    if post_to_app(app_cfg, payload):
        save_posted([x["ext_id"] for x in items])
        mark_scanned([x["_uid"] for x in items if "_uid" in x])
    else:
        sys.exit(1)  # giu nguyen, lan chay sau gui lai (app tu chong trung theo ext_id)


if __name__ == "__main__":
    main()
