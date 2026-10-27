// DOMParser cho NODE (bộ kiểm / script chạy trên thư mục thật) — bộ đọc XML của Soát xét năm (lib/soatbaocao/boMay.js parseXML)
// dùng DOMParser của trình duyệt. Trên app thật KHÔNG cần file này.
// Dựa trên @xmldom/xmldom (có sẵn, đi kèm docxtemplater), bổ sung phần xmldom thiếu: Element.children, Document.querySelector.
import { DOMParser as XmlDomParser } from '@xmldom/xmldom'

export function caiDomParser() {
  if (globalThis.DOMParser) return
  let daVa = false
  globalThis.DOMParser = class {
    parseFromString(text, type) {
      let loi = false, doc
      // File.text() của trình duyệt tự bỏ BOM đầu file; fs.readFileSync thì không → bỏ ở đây cho giống
      try { doc = new XmlDomParser({ onError: (muc) => { if (muc === 'error' || muc === 'fatalError') loi = true } }).parseFromString(String(text).replace(/^﻿/, ''), type) }
      catch { loi = true; doc = new XmlDomParser().parseFromString('<loi/>', 'application/xml') }
      if (!daVa && doc.documentElement) {
        const El = Object.getPrototypeOf(doc.documentElement)
        if (!('children' in El)) Object.defineProperty(El, 'children', { get() { return Array.from(this.childNodes || []).filter(n => n.nodeType === 1) } })
        daVa = true
      }
      // bản gốc kiểm lỗi cấu trúc bằng querySelector("parsererror")
      doc.querySelector = sel => (sel === 'parsererror' && (loi || !doc.documentElement) ? {} : null)
      return doc
    }
  }
}
