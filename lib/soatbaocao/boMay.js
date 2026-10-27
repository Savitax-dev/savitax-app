// Bộ máy Soát xét báo cáo năm — phần TÍNH TOÁN chuyển nguyên từ bản offline Check BCTC V3 (kế hoạch GĐ 3).
// Thân hàm GIỮ NGUYÊN bản gốc để đối chiếu mốc từng số. Chỗ Savitax sửa lỗi nằm ngay trong mã, mỗi chỗ có công tắc
// __SUA.Bx (tìm "__SUA."), hàm trợ giúp ở cuối; danh sách + lý do ở lib/soatbaocao/suaLoi.js. Bộ kiểm: node scripts/test-soatbaocao-mau.mjs
//
// taoBoMay({ homNay, ngauNhien }) → một bộ máy có trạng thái riêng (hồ sơ S nhiều năm + bộ nhớ đệm CACHE):
//   homNay: ngày hệ thống cố định (chuỗi ISO / số ms) — để kết quả lặp lại được; mặc định giờ máy.
//   ngauNhien: hàm số ngẫu nhiên — chỉ bộ sinh dữ liệu mẫu (demoYears) dùng.
// suaLoi: true (mặc định) = bật mọi chỗ Savitax sửa lỗi; false = tắt hết (chạy y bản offline — để so mốc);
//         hoặc { B1: false, … } tắt riêng từng chỗ. Danh sách + lý do: lib/soatbaocao/suaLoi.js
export function taoBoMay({ homNay = null, ngauNhien = Math.random, suaLoi = true } = {}) {
  const __SUA = Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18'].map(m => [m, suaLoi === true ? true : suaLoi === false ? false : suaLoi[m] !== false]))
  const __now = () => (homNay == null ? Date.now() : +new Date(homNay))
  const __rnd = () => ngauNhien()
const uid=()=>__rnd().toString(36).slice(2,10)+__now().toString(36).slice(-4);
const BOOKS={luong:"Bảng lương / thu nhập cá nhân",nkc:"Sổ nhật ký chung",sct:"Sổ chi tiết tài khoản",quy:"Sổ quỹ tiền mặt",tgnh:"Sổ tiền gửi ngân hàng",cn131:"Tổng hợp công nợ phải thu",cn331:"Tổng hợp công nợ phải trả",nxt:"Tổng hợp nhập – xuất – tồn",gt:"Tổng hợp giá thành",hdr:"Bảng kê hóa đơn đầu ra",hdv:"Bảng kê hóa đơn đầu vào"};
function emptyBooks(){return Object.fromEntries(Object.keys(BOOKS).map(k=>[k,[]]))}
function blank(){return{id:uid(),meta:{ten:"",maKH:"",mst:"",loai:"tm",cheDo:"tt200",ky:"nam",nam:2025,quy:4,donVi:"đồng",nguoi:"",ngay:new Date(__now()).toISOString().slice(0,10),ykien:"chua",ktv:"",vd:false,khoaSo:""},v:{},ck:{},tb:[],tk:[],dk:[],bk:emptyBooks(),files:[],notes:{kl:"",ai:""},years:{},hsck:{},updated:0}}
function normCase(c){const b=blank();const o={...b,...c,meta:{...b.meta,...(c.meta||{})},notes:{...b.notes,...(c.notes||{})},bk:{...emptyBooks(),...(c.bk||{})},tb:c.tb||[],tk:c.tk||[],dk:c.dk||[],files:c.files||[],v:c.v||{},ck:c.ck||{}};
 const Y={};for(const[y,d]of Object.entries(c.years||{})){if(!d)continue;Y[+y]={v:d.v||{},tb:d.tb||[],tk:d.tk||[],dk:d.dk||[],bk:{...emptyBooks(),...(d.bk||{})},files:d.files||[],cheDo:d.cheDo||(+y>=2026&&o.meta.cheDo!=="tt133"?"tt99":o.meta.cheDo),ky:d.ky||"nam",quy:d.quy||4,skBal:d.skBal||{},skMap:d.skMap||{},ck:d.ck||{},notes:{kl:"",ai:"",...(d.notes||{})}}}
 const y=+o.meta.nam;const d=Y[y];
 if(d){Object.assign(o,{v:d.v,tb:d.tb,tk:d.tk,dk:d.dk,bk:d.bk,files:d.files,ck:d.ck,notes:d.notes});Object.assign(o.meta,{cheDo:d.cheDo,ky:d.ky,quy:d.quy,skBal:d.skBal,skMap:d.skMap})}
 Y[y]={v:o.v,tb:o.tb,tk:o.tk,dk:o.dk,bk:o.bk,files:o.files,cheDo:o.meta.cheDo,ky:o.meta.ky,quy:o.meta.quy,skBal:o.meta.skBal||{},skMap:o.meta.skMap||{},ck:o.ck,notes:o.notes};o.years=Y;return o}
let S=blank(), tab="tq", dirty=false, store=null, sample=null, downloads=null, listCache=[];
function pn(s){
 if(s==null)return null;if(typeof s==="number")return isFinite(s)?s:null;
 s=String(s).trim().replace(/ /g,"").replace(/\s+/g,"");if(!s||s==="-"||s==="—")return null;
 let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}
 if(/^[-−–]/.test(s)){neg=!neg;s=s.slice(1)}
 const hasD=s.includes("."),hasC=s.includes(",");
 if(hasD&&hasC){if(s.lastIndexOf(",")>s.lastIndexOf(".")){s=s.replace(/\./g,"").replace(",",".")}else s=s.replace(/,/g,"")}
 else if(hasD){if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"")}
 else if(hasC){if(/^\d{1,3}(,\d{3})+$/.test(s))s=s.replace(/,/g,"");else s=s.replace(",",".")}
 const n=Number(s);if(!isFinite(n))return null;return neg?-n:n;
}
const NF=new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0});
const fm=v=>v==null||!isFinite(v)?"":NF.format(Math.round(v)).replace("-","−");
function fx(v,d=1){return v==null||!isFinite(v)?"":new Intl.NumberFormat("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v).replace("-","−")}
function compact(v){if(v==null||!isFinite(v))return"—";const u=S.meta.donVi==="nghìn đồng"?1e3:S.meta.donVi==="triệu đồng"?1e6:1;const x=v*u,a=Math.abs(x);
 if(a>=1e9)return fx(x/1e9,2)+" tỷ";if(a>=1e6)return fx(x/1e6,1)+" tr";return fm(x)+" đ"}
const derived=new Set();
function raw(k,s){const o=S.v[k];if(!o)return null;const x=o[s==="T"?"t":"p"];return x==null||x===""?null:x}
function sum(ks,s){let t=0,any=false;for(const k of ks){const x=val(k,s);if(x!=null){t+=x;any=true}}return any?t:null}
function val(k,s){
 const r=raw(k,s);if(r!=null)return r;
 let d=null;
 switch(k){
  case"DThu":{const a=raw("DT_BH",s);if(a!=null)d=a-(raw("GTDT",s)||0);break}
  case"LNG":{const a=val("DThu",s),b=raw("GVHB",s);if(a!=null&&b!=null)d=a-b;break}
  case"LNST":{const a=raw("LNTT",s),b=raw("THUE",s);if(a!=null)d=a-(b||0);break}
  case"TSNH":{const c=["TIEN","DTNH","PTHU","HTK","TSNH_KHAC"];if(c.some(x=>raw(x,s)!=null)){d=c.reduce((t,x)=>t+(raw(x,s)||0),0);if(S.meta.cheDo!=="tt133"&&raw("TONG_TS",s)!=null&&raw("TSDH",s)!=null)d=raw("TONG_TS",s)-raw("TSDH",s)}break}
  case"TSDH":{const a=raw("TONG_TS",s),b=raw("TSNH",s);if(a!=null&&b!=null)d=a-b;else if(a!=null&&S.meta.cheDo==="tt133"){const n=val("TSNH",s);if(n!=null)d=a-n}break}
  case"TONG_TS":{const a=raw("TSNH",s),b=raw("TSDH",s);if(a!=null&&b!=null)d=a+b;break}
  case"NO_NH":{const a=raw("TONG_NO",s);if(a!=null){d=a-(raw("NO_DH",s)||0)}break}
  case"NO_DH":{const a=raw("TONG_NO",s),b=raw("NO_NH",s);if(a!=null&&b!=null)d=a-b;else if(a!=null&&S.meta.cheDo==="tt133")d=raw("VAY_DH",s)||0;break}
  case"TONG_NO":{const a=raw("NO_NH",s),b=raw("NO_DH",s);if(a!=null&&b!=null)d=a+b;break}
  case"VCSH":{const a=raw("TONG_NV",s)??raw("TONG_TS",s),b=raw("TONG_NO",s);if(a!=null&&b!=null)d=a-b;break}
  case"TONG_NV":{const a=raw("TONG_NO",s),b=raw("VCSH",s);if(a!=null&&b!=null)d=a+b;break}
  case"LAI_VAY":{d=raw("LAI_VAY_KD",s);break}
  case"TIEN_CUOI":{d=raw("TIEN",s);break}
  case"CF_NET":{const a=raw("CFO",s),b=raw("CFI",s),c=raw("CFF",s);if(a!=null&&b!=null&&c!=null)d=a+b+c;break}
 }
 if(d!=null)derived.add(k+s);return d;
}
const N=()=>KY[S.meta.ky].d, AN=()=>365/N();
const avg=k=>{const t=val(k,"T"),p=val(k,"P");if(t==null)return null;return p==null?t:(t+p)/2};
const dv=(a,b)=>a==null||b==null||b===0?null:a/b;
function pd(x){ // → "YYYY-MM-DD" hoặc null
 if(x==null||x==="")return null;
 if(x instanceof Date&&!isNaN(x)){const y=new Date(x.getTime()+12e5);return`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`}// SheetJS trả ngày lệch vài giây theo múi giờ lịch sử → cộng 20 phút
 if(typeof x==="number"){if(x>20000&&x<80000){const d=new Date(Date.UTC(1899,11,30)+x*864e5);return d.toISOString().slice(0,10)}return null}
 const s=String(x).trim();let m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);if(m)return`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
 m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
 return null}
const fd=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const mon=d=>d?+d.slice(5,7):0;
function norm(s){return String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()}
const tkOf=x=>{const s=String(x??"").replace(/[\s._]/g,"");return /^\d{3,}[0-9A-Za-z]*$/.test(s)?s:""};
const sumBy=(arr,f)=>arr.reduce((t,x)=>t+(f(x)||0),0);
const MODELS={
 tm:{n:"Thương mại",d:"Mua bán hàng hóa, phân phối, bán lẻ",gt:false},
 dv:{n:"Dịch vụ",d:"Tư vấn, phần mềm, dịch vụ chuyên môn",gt:true},
 sx:{n:"Sản xuất – tính giá thành",d:"Tập hợp 621/622/627, giá thành thành phẩm",gt:true},
 xd:{n:"Xây dựng",d:"Giá thành công trình, nghiệm thu, dở dang 154",gt:true},
 nh:{n:"Nhà hàng",d:"Ăn uống, định mức nguyên liệu, HĐ máy tính tiền",gt:true},
 ks:{n:"Khách sạn",d:"Lưu trú, công suất phòng, khấu hao lớn",gt:false},
 vt:{n:"Vận tải",d:"Vận tải hàng hóa, hành khách, logistics",gt:true},
 dl:{n:"Du lịch – lữ hành",d:"Tour, đặt dịch vụ, tiền khách trả trước",gt:true}
};
const KY={nam:{n:"Năm",d:365},"9t":{n:"9 tháng",d:273},"6t":{n:"6 tháng",d:182},q:{n:"Quý",d:91}};
const F=[
 ["DT_BH","Doanh thu bán hàng và cung cấp dịch vụ",["01","01"],"kd"],
 ["GTDT","Các khoản giảm trừ doanh thu",["02","02"],"kd"],
 ["DThu","Doanh thu thuần",["10","10"],"kd",1],
 ["GVHB","Giá vốn hàng bán",["11","11"],"kd"],
 ["LNG","Lợi nhuận gộp",["20","20"],"kd",1],
 ["DTTC","Doanh thu hoạt động tài chính",["21","21"],"kd"],
 ["CPTC","Chi phí tài chính",["22","22"],"kd"],
 ["LAI_VAY_KD","– Trong đó: chi phí lãi vay",["23","23"],"kd"],
 ["CPBH","Chi phí bán hàng (TT133: CP quản lý kinh doanh)",["25","24"],"kd"],
 ["CPQL","Chi phí quản lý doanh nghiệp",["26","—"],"kd"],
 ["LNHDKD","Lợi nhuận thuần từ HĐKD",["30","30"],"kd",1],
 ["TN_KHAC","Thu nhập khác",["31","31"],"kd"],
 ["CP_KHAC","Chi phí khác",["32","32"],"kd"],
 ["LNKHAC","Lợi nhuận khác",["40","40"],"kd",1],
 ["LNTT","Tổng lợi nhuận kế toán trước thuế",["50","50"],"kd",1],
 ["THUE","Chi phí thuế TNDN (hiện hành + hoãn lại)",["51+52","51"],"kd"],
 ["LNST","Lợi nhuận sau thuế TNDN",["60","60"],"kd",1],

 ["TIEN","Tiền và các khoản tương đương tiền",["110","110"],"cd"],
 ["DTNH","Đầu tư tài chính ngắn hạn",["120","120"],"cd"],
 ["PTHU","Các khoản phải thu ngắn hạn",["130","130"],"cd"],
 ["PTKH","– Phải thu ngắn hạn của khách hàng",["131","131"],"cd"],
 ["TTNB","– Trả trước cho người bán ngắn hạn",["132","132"],"cd"],
 ["HTK","Hàng tồn kho",["140","140"],"cd"],
 ["TSNH_KHAC","Tài sản ngắn hạn khác",["150","180"],"cd"],
 ["TSNH","TỔNG TÀI SẢN NGẮN HẠN",["100","—"],"cd",1],
 ["TSCD","Tài sản cố định",["220","150"],"cd"],
 ["TSDD","Tài sản dở dang dài hạn / XDCB dở dang",["240","170"],"cd"],
 ["TSDH","TỔNG TÀI SẢN DÀI HẠN",["200","—"],"cd",1],
 ["TONG_TS","TỔNG CỘNG TÀI SẢN",["270","200"],"cd",1],
 ["PTNB","Phải trả người bán ngắn hạn",["311","311"],"cd"],
 ["NMTT","Người mua trả tiền trước ngắn hạn",["312","312"],"cd"],
 ["THUE_PN","Thuế và các khoản phải nộp Nhà nước",["313","313"],"cd"],
 ["PTNLD","Phải trả người lao động",["314","314"],"cd"],
 ["VAY_NH","Vay và nợ thuê tài chính ngắn hạn",["320","316"],"cd"],
 ["NO_NH","Nợ ngắn hạn",["310","—"],"cd",1],
 ["VAY_DH","Vay và nợ thuê tài chính dài hạn",["338","—"],"cd"],
 ["NO_DH","Nợ dài hạn",["330","—"],"cd",1],
 ["TONG_NO","NỢ PHẢI TRẢ",["300","300"],"cd",1],
 ["VON_GOP","Vốn góp của chủ sở hữu",["411","411"],"cd"],
 ["LNCPP","Lợi nhuận sau thuế chưa phân phối",["421","417"],"cd"],
 ["VCSH","VỐN CHỦ SỞ HỮU",["400","400"],"cd",1],
 ["TONG_NV","TỔNG CỘNG NGUỒN VỐN",["440","500"],"cd",1],

 ["KHAU_HAO","Khấu hao TSCĐ và BĐSĐT",["02","02"],"lc"],
 ["LAI_VAY","Chi phí lãi vay (LCTT gián tiếp)",["06","06"],"lc"],
 ["CFO","Lưu chuyển tiền thuần từ HĐKD",["20","20"],"lc",1],
 ["CAPEX","Tiền chi mua sắm, xây dựng TSCĐ (nhập số dương)",["21","21"],"lc"],
 ["CFI","Lưu chuyển tiền thuần từ HĐ đầu tư",["30","30"],"lc",1],
 ["CFF","Lưu chuyển tiền thuần từ HĐ tài chính",["40","40"],"lc",1],
 ["CF_NET","Lưu chuyển tiền thuần trong kỳ",["50","50"],"lc",1],
 ["TIEN_DAU","Tiền và tương đương tiền đầu kỳ",["60","60"],"lc"],
 ["TIEN_CUOI","Tiền và tương đương tiền cuối kỳ",["70","70"],"lc",1],

 ["TIEN_MAT","Số dư tiền mặt tại quỹ (TK 111)",["TK111","TK111"],"bs"],
 ["DP_PT","Dự phòng phải thu khó đòi (số dương)",["137","—"],"bs"],
 ["DT_GTGT","Tổng doanh thu trên tờ khai GTGT trong kỳ (CT [34])",["[34]","[34]"],"bs"],
 ["CT43","Thuế GTGT còn được khấu trừ cuối kỳ (CT [43])",["[43]","[43]"],"bs"],
 ["THUE_QT","Thuế TNDN phải nộp theo tờ khai quyết toán 03/TNDN",["03/TNDN","03/TNDN"],"bs"],
 ["QUY_LUONG","Tổng chi phí tiền lương, tiền công trong kỳ",["TK334","TK334"],"bs"],
 ["SO_LD","Số lao động bình quân (người)",["",""],"bs",0,null,"n"],
 ["QL_BH","Quỹ lương đóng BHXH trong kỳ (theo C12)",["C12","C12"],"bs"],
 ["VDL","Vốn điều lệ theo ĐKKD",["ĐKKD","ĐKKD"],"bs"],
 ["CT22_DAU","Tờ khai GTGT kỳ đầu năm – CT [22]",["[22]","[22]"],"bs"],
 ["CT24_SUM","Tổng thuế GTGT mua vào các kỳ – Σ CT [24]",["Σ[24]","Σ[24]"],"bs"],
 ["CT_RA_SUM","Tổng thuế GTGT đầu ra các kỳ – Σ CT [28]/[35]",["Σ[35]","Σ[35]"],"bs"],
 ["CT40_CUOI","Thuế GTGT còn phải nộp kỳ cuối – CT [40]",["[40]","[40]"],"bs"],
 ["TNCN_TK","Tổng thuế TNCN đã khấu trừ trên tờ khai các kỳ",["05/KK","05/KK"],"bs"],

 ["HH","Hàng hóa (TK 156)",["TK156","TK156"],"dt",0,["tm","nh","dl"]],
 ["HGB","Hàng gửi đi bán (TK 157)",["TK157","TK157"],"dt",0,["tm","sx"]],
 ["NVL","Nguyên liệu, vật liệu (TK 152)",["TK152","TK152"],"dt",0,["sx","xd","nh","ks","vt"]],
 ["CPDD","Chi phí SXKD dở dang (TK 154)",["TK154","TK154"],"dt",0,["sx","xd","dv","vt","dl"]],
 ["TP","Thành phẩm (TK 155)",["TK155","TK155"],"dt",0,["sx"]],
 ["CP621","Chi phí NVL trực tiếp phát sinh (621)",["TK621","TK621"],"dt",0,["sx","xd","vt"]],
 ["CP622","Chi phí nhân công trực tiếp phát sinh (622)",["TK622","TK622"],"dt",0,["sx","xd","dv","vt","dl"]],
 ["CP623","Chi phí sử dụng máy thi công (623)",["TK623","TK623"],"dt",0,["xd"]],
 ["CP627","Chi phí sản xuất chung phát sinh (627)",["TK627","TK627"],"dt",0,["sx","xd","dv","vt","dl"]],
 ["Z_HT","Tổng giá thành sản phẩm/công trình hoàn thành",["",""],"dt",0,["sx","xd"]],
 ["GT_HD","Tổng giá trị hợp đồng xây dựng đang thực hiện",["",""],"dt",0,["xd"]],
 ["DT_AU","Doanh thu ăn uống",["",""],"dt",0,["nh","ks"]],
 ["CP_NL","Chi phí nguyên liệu thực phẩm, đồ uống",["",""],"dt",0,["nh","ks"]],
 ["SO_CHO","Số chỗ ngồi (nhà hàng)",["",""],"dt",0,["nh"],"n"],
 ["SO_PHONG","Số phòng kinh doanh",["",""],"dt",0,["ks"],"n"],
 ["DEM_BAN","Số đêm phòng bán được trong kỳ",["",""],"dt",0,["ks"],"n"],
 ["DT_PHONG","Doanh thu phòng",["",""],"dt",0,["ks"]],
 ["CP_NHIENLIEU","Chi phí nhiên liệu",["",""],"dt",0,["vt"]],
 ["SO_XE","Số phương tiện bình quân",["",""],"dt",0,["vt"],"n"]
].map(a=>({k:a[0],l:a[1],c:a[2],g:a[3],sub:!!a[4],m:a[5]||null,u:a[6]||"money"}));
const FK=Object.fromEntries(F.map(f=>[f.k,f]));
let POLICY={
 /* ---------- Thuế GTGT ---------- */
 vat_law:[
  {from:"2009-01-01",to:"2025-06-30",v:"Luật GTGT 13/2008",doc:"Luật GTGT 13/2008/QH12 (sđ 31/2013, 71/2014, 106/2016); NĐ 209/2013/NĐ-CP; TT 219/2013/TT-BTC",lv:"XM"},
  {from:"2025-07-01",to:null,v:"Luật GTGT 48/2024",doc:"Luật GTGT 48/2024/QH15 (sđ Luật 90/2025, 149/2025, 09/2026); NĐ 181/2025/NĐ-CP; TT 69/2025/TT-BTC; sđ NĐ 359/2025 (từ 01/01/2026), NĐ 144/2026 (từ 20/06/2026)",lv:"XM"}],
 vat_rates:[
  {from:"2009-01-01",to:"2025-06-30",v:"0% · 5% · 10%",doc:"Luật GTGT 13/2008/QH12 Đ8; TT 219/2013/TT-BTC Đ9–11",lv:"XM"},
  {from:"2025-07-01",to:null,v:"0% · 5% · 10%",doc:"Luật GTGT 48/2024/QH15 Đ9 (phân bón, máy móc chuyên dùng nông nghiệp chuyển sang 5%)",lv:"TC"}],
 vat8:[
  {from:"2021-01-01",to:"2022-01-31",v:false,doc:"Không giảm 2%. Riêng 01/11–31/12/2021 giảm 30% mức thuế suất cho vận tải, lưu trú, ăn uống, du lịch… (NQ 406/2021/UBTVQH15; NĐ 92/2021/NĐ-CP Đ1)",lv:"TC"},
  {from:"2022-02-01",to:"2022-12-31",v:true,doc:"NQ 43/2022/QH15; NĐ 15/2022/NĐ-CP Đ1",lv:"TC"},
  {from:"2023-01-01",to:"2023-06-30",v:false,doc:"Không giảm – thuế suất 10%",lv:"TC"},
  {from:"2023-07-01",to:"2023-12-31",v:true,doc:"NQ 101/2023/QH15; NĐ 44/2023/NĐ-CP",lv:"TC"},
  {from:"2024-01-01",to:"2024-06-30",v:true,doc:"NQ 110/2023/QH15; NĐ 94/2023/NĐ-CP",lv:"TC"},
  {from:"2024-07-01",to:"2024-12-31",v:true,doc:"NQ 142/2024/QH15; NĐ 72/2024/NĐ-CP",lv:"TC"},
  {from:"2025-01-01",to:"2025-06-30",v:true,doc:"NQ 174/2024/QH15; NĐ 180/2024/NĐ-CP",lv:"TC"},
  {from:"2025-07-01",to:"2026-12-31",v:true,doc:"NQ 204/2025/QH15; NĐ 174/2025/NĐ-CP (mở rộng diện được giảm)",lv:"XM"},
  {from:"2027-01-01",to:null,v:false,doc:"Hết hạn giảm – chưa có nghị quyết gia hạn",lv:"CXM"}],
 vat_cash:[
  {from:"2014-01-01",to:"2025-06-30",v:20e6,doc:"TT 219/2013/TT-BTC Đ15 (HĐ từ 20 triệu, giá đã có thuế)",lv:"XM"},
  {from:"2025-07-01",to:null,v:5e6,doc:"Luật GTGT 48/2024/QH15 Đ14; NĐ 181/2025/NĐ-CP Đ26 (HĐ từ 5 triệu, giá đã có thuế)",lv:"XM"}],
 vat_decl_period:[
  {from:"2020-12-05",to:"2026-06-30",v:"Quý nếu doanh thu năm trước ≤ 50 tỷ; còn lại khai tháng",doc:"NĐ 126/2020/NĐ-CP Đ8, Đ9",lv:"TC"},
  {from:"2026-07-01",to:null,v:"Quý nếu doanh thu năm trước ≤ 50 tỷ; còn lại khai tháng",doc:"Luật QLT 108/2025/QH15; NĐ 252/2026/NĐ-CP; TT 89/2026/TT-BTC Đ19.1",lv:"TC"}],

 /* ---------- Thuế TNDN ---------- */
 cit_rate:[
  {from:"2016-01-01",to:"2024-12-31",v:"20%",doc:"Luật TNDN 14/2008/QH12 Đ10 sđ Luật 32/2013/QH13",lv:"XM"},
  {from:"2025-01-01",to:"2025-12-31",v:"15% (DT năm trước ≤ 3 tỷ) · 17% (3–50 tỷ) · 20%",doc:"Luật TNDN 67/2025/QH15 Đ10; NĐ 320/2025/NĐ-CP Đ11 (áp dụng từ kỳ tính thuế 2025)",lv:"XM"},
  {from:"2026-01-01",to:null,v:"Miễn thuế (DT năm trước ≤ 1 tỷ) · 15% (≤ 3 tỷ) · 17% (3–50 tỷ) · 20%",doc:"Luật 67/2025/QH15; Luật 09/2026/QH16; NĐ 141/2026/NĐ-CP",lv:"TC"}],
 cit_exempt:[
  {from:"2020-01-01",to:"2020-12-31",v:"Giảm 30% thuế TNDN kỳ 2020 (DT năm ≤ 200 tỷ)",doc:"NQ 116/2020/QH14; NĐ 114/2020/NĐ-CP",lv:"TC"},
  {from:"2021-01-01",to:"2021-12-31",v:"Giảm 30% thuế TNDN kỳ 2021 (DT 2021 ≤ 200 tỷ và giảm so với 2019)",doc:"NQ 406/2021/UBTVQH15; NĐ 92/2021/NĐ-CP Đ3",lv:"TC"},
  {from:"2022-01-01",to:"2025-05-16",v:"Không có miễn, giảm chung",doc:"Chỉ ưu đãi theo ngành, địa bàn (Luật TNDN 14/2008/QH12 Đ13, Đ14)",lv:"TC"},
  {from:"2025-05-17",to:"2025-12-31",v:"Miễn 3 năm cho DNNVV thành lập mới",doc:"NQ 198/2025/QH15 Đ10",lv:"TC"},
  {from:"2026-01-01",to:null,v:"Miễn cho DN có DT năm trước ≤ 1 tỷ; miễn 3 năm cho DNNVV thành lập mới",doc:"Luật 09/2026/QH16 (khoản 14a Đ4 Luật 67/2025); NĐ 141/2026/NĐ-CP; NQ 198/2025/QH15 Đ10",lv:"TC"}],
 cit_cash:[
  {from:"2015-01-01",to:"2025-12-14",v:20e6,doc:"TT 96/2015/TT-BTC Đ4 (sđ Đ6 TT 78/2014); NĐ 320/2025/NĐ-CP Đ24 (ngưỡng 20 triệu áp dụng đến 14/12/2025)",lv:"XM"},
  {from:"2025-12-15",to:null,v:5e6,doc:"Luật TNDN 67/2025/QH15; NĐ 320/2025/NĐ-CP Đ9.1.c (từ 5 triệu, cộng dồn cùng người bán cùng ngày)",lv:"XM"}],
 cit_prepay:[
  {from:"2020-12-05",to:"2020-12-31",v:0.75,doc:"NĐ 126/2020/NĐ-CP Đ8.6 (3 quý đầu ≥ 75% số thuế quyết toán)",lv:"TC"},
  {from:"2021-01-01",to:"2026-06-30",v:0.8,doc:"NĐ 126/2020/NĐ-CP Đ8.6 sđ NĐ 91/2022/NĐ-CP (hiệu lực 30/10/2022, áp dụng từ kỳ tính thuế 2021): 4 quý ≥ 80%",lv:"TC"},
  {from:"2026-07-01",to:null,v:0.8,doc:"NĐ 252/2026/NĐ-CP Đ24.2 (4 quý ≥ 80%)",lv:"TC"}],
 loss_carry:[
  {from:"2009-01-01",to:"2024-12-31",v:"Tối đa 5 năm liên tục",doc:"Luật TNDN 14/2008/QH12 Đ16; TT 78/2014/TT-BTC Đ9",lv:"TC"},
  {from:"2025-01-01",to:null,v:"Tối đa 5 năm liên tục",doc:"Luật TNDN 67/2025/QH15 Đ7; NĐ 320/2025/NĐ-CP",lv:"TC"}],
 int_cap:[
  {from:"2019-01-01",to:"2023-12-31",v:0.3,doc:"NĐ 132/2020/NĐ-CP Đ16.3 (NĐ 68/2020 áp dụng từ kỳ 2019): lãi vay thuần ≤ 30% EBITDA",lv:"TC"},
  {from:"2024-01-01",to:null,v:0.3,doc:"NĐ 132/2020/NĐ-CP Đ16.3 sđ NĐ 20/2025/NĐ-CP (áp dụng từ kỳ 2024; loại trừ vay TCTD, ODA…)",lv:"TC"}],
 int_150:[
  {from:"2014-01-01",to:"2024-12-31",v:"Phần lãi vượt 150% lãi suất cơ bản NHNN không được trừ",doc:"TT 96/2015/TT-BTC Đ4 (vay của đối tượng không phải TCTD, tổ chức kinh tế)",lv:"TC"},
  {from:"2025-01-01",to:null,v:"Phần lãi vượt 150% lãi suất cơ bản NHNN không được trừ",doc:"NĐ 320/2025/NĐ-CP Đ10 (chưa đối chiếu điều khoản)",lv:"CXM"}],
 cit_welfare:[
  {from:"2015-01-01",to:"2024-12-31",v:"Không vượt 1 tháng lương bình quân thực hiện",doc:"TT 96/2015/TT-BTC Đ4",lv:"TC"},
  {from:"2025-01-01",to:null,v:"Không vượt 1 tháng lương bình quân thực hiện",doc:"NĐ 320/2025/NĐ-CP Đ10",lv:"TC"}],
 cit_pension:[
  {from:"2015-01-01",to:"2024-12-31",v:3e6,doc:"TT 96/2015/TT-BTC Đ4 (BHHT tự nguyện, BHNT cho NLĐ ≤ 3 triệu/tháng/người)",lv:"TC"},
  {from:"2025-01-01",to:null,v:5e6,doc:"NĐ 320/2025/NĐ-CP Đ10 (≤ 5 triệu/tháng/người; DN chọn mốc áp dụng theo Đ24)",lv:"TC"}],
 cit_uniform:[
  {from:"2015-01-01",to:"2024-12-31",v:5e6,doc:"TT 96/2015/TT-BTC Đ4 (trang phục bằng tiền ≤ 5 triệu/người/năm)",lv:"TC"},
  {from:"2025-01-01",to:null,v:5e6,doc:"NĐ 320/2025/NĐ-CP Đ10",lv:"TC"}],
 cit_car:[
  {from:"2014-01-01",to:"2024-12-31",v:1.6e9,doc:"TT 96/2015/TT-BTC Đ4; TT 45/2013/TT-BTC Đ9 (ô tô ≤ 9 chỗ: phần nguyên giá vượt 1,6 tỷ)",lv:"TC"},
  {from:"2025-01-01",to:null,v:1.6e9,doc:"NĐ 320/2025/NĐ-CP Đ10",lv:"TC"}],

 /* ---------- Thuế TNCN ---------- */
 pit_self:[
  {from:"2020-07-01",to:"2025-12-31",v:11e6,doc:"NQ 954/2020/UBTVQH14",lv:"XM"},
  {from:"2026-01-01",to:null,v:15.5e6,doc:"NQ 110/2025/UBTVQH15 (áp dụng từ kỳ tính thuế 2026)",lv:"XM"}],
 pit_dep:[
  {from:"2020-07-01",to:"2025-12-31",v:4.4e6,doc:"NQ 954/2020/UBTVQH14",lv:"XM"},
  {from:"2026-01-01",to:null,v:6.2e6,doc:"NQ 110/2025/UBTVQH15",lv:"XM"}],
 pit_dep_inc:[
  {from:"2013-07-01",to:"2025-12-31",v:1e6,doc:"TT 111/2013/TT-BTC Đ9 khoản 1 (người phụ thuộc có thu nhập bình quân tháng ≤ 1 triệu)",lv:"TC"},
  {from:"2026-01-01",to:null,v:"Chưa thống nhất (1 hoặc 3 triệu/tháng)",doc:"NĐ 253/2026/NĐ-CP Đ47–48 – nguồn mâu thuẫn",lv:"CXM"}],
 pit_br:[
  {from:"2009-01-01",to:"2025-12-31",v:[[5e6,.05],[10e6,.10],[18e6,.15],[32e6,.20],[52e6,.25],[80e6,.30],[Infinity,.35]],doc:"Luật Thuế TNCN 04/2007/QH12 Đ22 sđ Luật 26/2012/QH13 (biểu 7 bậc)",lv:"XM"},
  {from:"2026-01-01",to:null,v:[[10e6,.05],[30e6,.10],[60e6,.20],[100e6,.30],[Infinity,.35]],doc:"Luật Thuế TNCN 109/2025/QH15 Đ9, Đ29.2 (biểu 5 bậc, áp dụng cả năm 2026)",lv:"XM"}],
 pit_nonres:[
  {from:"2009-01-01",to:"2026-06-30",v:0.2,doc:"Luật Thuế TNCN 04/2007/QH12 Đ26; TT 111/2013/TT-BTC Đ18",lv:"TC"},
  {from:"2026-07-01",to:null,v:0.2,doc:"Luật Thuế TNCN 109/2025/QH15 (cá nhân không cư trú áp dụng từ 01/07/2026)",lv:"TC"}],
 pit_casual:[
  {from:"2015-01-01",to:"2026-06-30",v:2e6,doc:"TT 111/2013/TT-BTC Đ25.1.i (khấu trừ 10% với khoản chi từ 2 triệu/lần)",lv:"XM"},
  {from:"2026-07-01",to:null,v:5e6,doc:"NĐ 253/2026/NĐ-CP Đ50.2 (từ 5 triệu/lần)",lv:"TC"}],
 pit_meal:[
  {from:"2016-01-01",to:"2025-06-14",v:730e3,doc:"TT 111/2013/TT-BTC Đ2.2.g.5; TT 26/2016/TT-BLĐTBXH Đ22.4 (730 nghìn/tháng)",lv:"TC"},
  {from:"2025-06-15",to:"2026-06-30",v:"Theo quy chế DN",doc:"Vùng xám – TT 003/2025/TT-BNV bãi bỏ mức 730 nghìn, chưa có mức mới",lv:"CXM"},
  {from:"2026-07-01",to:null,v:1.2e6,doc:"NĐ 253/2026/NĐ-CP Đ8 (1,2 triệu/tháng)",lv:"TC"}],
 pit_ot:[
  {from:"2009-01-01",to:"2025-12-31",v:"Miễn phần trả cao hơn giờ làm việc bình thường",doc:"Luật Thuế TNCN 04/2007/QH12 Đ4; TT 111/2013/TT-BTC Đ3.1.i",lv:"XM"},
  {from:"2026-01-01",to:null,v:"Miễn toàn bộ tiền lương làm thêm, làm đêm trong giới hạn luật",doc:"Luật Thuế TNCN 109/2025/QH15 Đ4.8; NĐ 253/2026/NĐ-CP (cư trú từ 01/01/2026)",lv:"XM"}],
 pit_pension_ded:[
  {from:"2015-01-01",to:"2025-12-31",v:1e6,doc:"TT 111/2013/TT-BTC Đ9 khoản 2 sđ TT 92/2015/TT-BTC (BHHT, quỹ hưu trí tự nguyện ≤ 1 triệu/tháng)",lv:"TC"},
  {from:"2026-01-01",to:null,v:3e6,doc:"NĐ 253/2026/NĐ-CP (≤ 3 triệu/tháng; ngày áp dụng cần đối chiếu)",lv:"TC"}],
 pit_period:[
  {from:"2020-12-05",to:"2021-12-31",v:"Tháng hoặc quý",doc:"NĐ 126/2020/NĐ-CP Đ8, Đ9; mẫu tờ khai TT 156/2013/TT-BTC",lv:"TC"},
  {from:"2022-01-01",to:"2026-06-30",v:"Tháng hoặc quý",doc:"TT 80/2021/TT-BTC – khai 05/KK-TNCN theo tháng/quý",lv:"XM"},
  {from:"2026-07-01",to:null,v:"Chỉ khai theo quý",doc:"TT 89/2026/TT-BTC Đ22.1.a; NĐ 252/2026/NĐ-CP Đ9–10",lv:"TC"}],
 pit_rent:[
  {from:"2015-01-01",to:"2021-07-31",v:100e6,doc:"TT 92/2015/TT-BTC (cho thuê tài sản DT năm ≤ 100 triệu không phải nộp GTGT, TNCN)",lv:"TC"},
  {from:"2021-08-01",to:"2025-12-31",v:100e6,doc:"TT 40/2021/TT-BTC Đ4",lv:"XM"},
  {from:"2026-01-01",to:null,v:1e9,doc:"NĐ 68/2026/NĐ-CP (500 triệu) sđ NĐ 141/2026/NĐ-CP (1 tỷ, hồi tố 01/01/2026) – cần đối chiếu riêng cho cho thuê tài sản",lv:"CXM"}],
 hkd_threshold:[
  {from:"2015-01-01",to:"2021-07-31",v:100e6,doc:"TT 92/2015/TT-BTC (DT năm ≤ 100 triệu không phải nộp GTGT, TNCN)",lv:"TC"},
  {from:"2021-08-01",to:"2025-12-31",v:100e6,doc:"TT 40/2021/TT-BTC Đ4",lv:"XM"},
  {from:"2026-01-01",to:null,v:1e9,doc:"Luật 09/2026/QH16; NĐ 141/2026/NĐ-CP sđ NĐ 68/2026 (hồi tố 01/01/2026; thay mức 200 triệu, 500 triệu)",lv:"TC"}],

 /* ---------- Bảo hiểm, tiền lương ---------- */
 bh_law:[
  {from:"2016-01-01",to:"2025-06-30",v:"Luật BHXH 58/2014",doc:"Luật BHXH 58/2014/QH13",lv:"XM"},
  {from:"2025-07-01",to:null,v:"Luật BHXH 41/2024",doc:"Luật BHXH 41/2024/QH15 – tỷ lệ DN 21,5%, NLĐ 10,5%, KPCĐ 2%",lv:"XM"}],
 min_wage1:[
  {from:"2020-01-01",to:"2022-06-30",v:4.42e6,doc:"NĐ 90/2019/NĐ-CP",lv:"TC"},
  {from:"2022-07-01",to:"2024-06-30",v:4.68e6,doc:"NĐ 38/2022/NĐ-CP",lv:"XM"},
  {from:"2024-07-01",to:"2025-12-31",v:4.96e6,doc:"NĐ 74/2024/NĐ-CP",lv:"XM"},
  {from:"2026-01-01",to:null,v:5.31e6,doc:"NĐ 293/2025/NĐ-CP (vùng I/II/III/IV: 5,31/4,73/4,14/3,70 triệu)",lv:"XM"}],
 min_wage:[
  {from:"2020-01-01",to:"2022-06-30",v:[4.42e6,3.92e6,3.43e6,3.07e6],doc:"NĐ 90/2019/NĐ-CP Đ3",lv:"TC"},
  {from:"2022-07-01",to:"2024-06-30",v:[4.68e6,4.16e6,3.64e6,3.25e6],doc:"NĐ 38/2022/NĐ-CP Đ3",lv:"XM"},
  {from:"2024-07-01",to:"2025-12-31",v:[4.96e6,4.41e6,3.86e6,3.45e6],doc:"NĐ 74/2024/NĐ-CP Đ3",lv:"XM"},
  {from:"2026-01-01",to:null,v:[5.31e6,4.73e6,4.14e6,3.70e6],doc:"NĐ 293/2025/NĐ-CP Đ3 (địa bàn theo đơn vị hành chính mới)",lv:"XM"}],
 base_wage:[
  {from:"2019-07-01",to:"2023-06-30",v:1.49e6,doc:"NĐ 38/2019/NĐ-CP (trần đóng BHXH 29,8 triệu)",lv:"TC"},
  {from:"2023-07-01",to:"2024-06-30",v:1.8e6,doc:"NĐ 24/2023/NĐ-CP (trần đóng BHXH 36 triệu)",lv:"XM"},
  {from:"2024-07-01",to:"2026-06-30",v:2.34e6,doc:"NĐ 73/2024/NĐ-CP (trần đóng BHXH 46,8 triệu)",lv:"XM"},
  {from:"2026-07-01",to:null,v:2.53e6,doc:"NĐ 161/2026/NĐ-CP (trần đóng BHXH 50,6 triệu)",lv:"TC"}],
 bh_cap:[
  {from:"2019-07-01",to:"2023-06-30",v:29.8e6,doc:"Luật BHXH 58/2014/QH13 Đ89 (20 × lương cơ sở 1,49 triệu)",lv:"TC"},
  {from:"2023-07-01",to:"2024-06-30",v:36e6,doc:"Luật BHXH 58/2014/QH13 Đ89 (20 × 1,8 triệu)",lv:"XM"},
  {from:"2024-07-01",to:"2025-06-30",v:46.8e6,doc:"Luật BHXH 58/2014/QH13 Đ89 (20 × 2,34 triệu)",lv:"XM"},
  {from:"2025-07-01",to:"2026-06-30",v:46.8e6,doc:"Luật BHXH 41/2024/QH15 Đ31 (20 × mức tham chiếu = lương cơ sở 2,34 triệu)",lv:"XM"},
  {from:"2026-07-01",to:null,v:50.6e6,doc:"Luật BHXH 41/2024/QH15 Đ31; NĐ 161/2026/NĐ-CP (20 × 2,53 triệu)",lv:"TC"}],
 bhtn_cap:[
  {from:"2020-01-01",to:"2022-06-30",v:[88.4e6,78.4e6,68.6e6,61.4e6],doc:"Luật Việc làm 38/2013/QH13 Đ58 (20 × lương tối thiểu vùng NĐ 90/2019)",lv:"TC"},
  {from:"2022-07-01",to:"2024-06-30",v:[93.6e6,83.2e6,72.8e6,65e6],doc:"Luật Việc làm 38/2013/QH13 Đ58 (20 × NĐ 38/2022)",lv:"TC"},
  {from:"2024-07-01",to:"2025-12-31",v:[99.2e6,88.2e6,77.2e6,69e6],doc:"Luật Việc làm 38/2013/QH13 Đ58 (20 × NĐ 74/2024)",lv:"TC"},
  {from:"2026-01-01",to:null,v:[106.2e6,94.6e6,82.8e6,74e6],doc:"Luật Việc làm 74/2025/QH15 – chưa xác minh cách xác định trần (tạm tính 20 × NĐ 293/2025)",lv:"CXM"}],
 bh_rate_er:[
  {from:"2020-07-15",to:"2021-06-30",v:{bhxh:.17,bhyt:.03,bhtn:.01,tnld:.005,kpcd:.02},doc:"Luật BHXH 58/2014 Đ86; NĐ 58/2020/NĐ-CP Đ4 (TNLĐ 0,5%); NĐ 191/2013/NĐ-CP Đ5 (KPCĐ 2%) – tổng 23,5%",lv:"TC"},
  {from:"2021-07-01",to:"2021-09-30",v:{bhxh:.17,bhyt:.03,bhtn:.01,tnld:0,kpcd:.02},doc:"NQ 68/2021/NQ-CP; QĐ 23/2021/QĐ-TTg (TNLĐ-BNN 0% từ 01/07/2021 đến 30/06/2022) – tổng 23%",lv:"TC"},
  {from:"2021-10-01",to:"2022-06-30",v:{bhxh:.17,bhyt:.03,bhtn:0,tnld:0,kpcd:.02},doc:"NQ 116/2021/NQ-CP (BHTN phần DN 0% từ 01/10/2021 đến 30/09/2022); QĐ 23/2021/QĐ-TTg – tổng 22%",lv:"TC"},
  {from:"2022-07-01",to:"2022-09-30",v:{bhxh:.17,bhyt:.03,bhtn:0,tnld:.005,kpcd:.02},doc:"NQ 116/2021/NQ-CP (BHTN 0% đến 30/09/2022) – tổng 22,5%",lv:"TC"},
  {from:"2022-10-01",to:"2025-06-30",v:{bhxh:.17,bhyt:.03,bhtn:.01,tnld:.005,kpcd:.02},doc:"Luật BHXH 58/2014 Đ86; NĐ 58/2020 Đ4; Luật Việc làm 38/2013 Đ57; NĐ 191/2013 Đ5 – tổng 23,5%",lv:"TC"},
  {from:"2025-07-01",to:null,v:{bhxh:.17,bhyt:.03,bhtn:.01,tnld:.005,kpcd:.02},doc:"Luật BHXH 41/2024/QH15 Đ33–34; NĐ 58/2020 Đ4; Luật Việc làm 74/2025 (từ 01/01/2026); Luật Công đoàn 50/2024/QH15 – tổng 23,5%",lv:"TC"}],
 bh_rate_ee:[
  {from:"2018-01-01",to:"2025-06-30",v:{bhxh:.08,bhyt:.015,bhtn:.01},doc:"Luật BHXH 58/2014 Đ85; Luật BHYT; Luật Việc làm 38/2013 Đ57 – tổng 10,5%",lv:"TC"},
  {from:"2025-07-01",to:null,v:{bhxh:.08,bhyt:.015,bhtn:.01},doc:"Luật BHXH 41/2024/QH15 Đ33; Luật BHYT; Luật Việc làm 74/2025/QH15 – tổng 10,5%",lv:"TC"}],

 /* ---------- Quản lý thuế, hóa đơn ---------- */
 qlt_law:[
  {from:"2020-07-01",to:"2026-06-30",v:"Luật QLT 38/2019",doc:"Luật QLT 38/2019/QH14; NĐ 126/2020/NĐ-CP; TT 80/2021/TT-BTC (từ 01/01/2022)",lv:"XM"},
  {from:"2026-07-01",to:null,v:"Luật QLT 108/2025",doc:"Luật QLT 108/2025/QH15; NĐ 252/2026/NĐ-CP; TT 89/2026/TT-BTC (khai bổ sung trong 5 năm)",lv:"XM"}],
 late_rate:[
  {from:"2016-07-01",to:null,v:0.0003,doc:"0,03%/ngày – Luật QLT 38/2019/QH14 Đ59; Luật QLT 108/2025/QH15 Đ16.2",lv:"XM"}],
 amend_limit:[
  {from:"2020-07-01",to:"2026-06-30",v:"10 năm kể từ hết hạn nộp hồ sơ, trước khi CQT công bố quyết định thanh tra, kiểm tra",doc:"Luật QLT 38/2019/QH14 Đ47",lv:"XM"},
  {from:"2026-07-01",to:null,v:"5 năm kể từ hết hạn nộp hồ sơ; sau 5 năm chỉ giải trình",doc:"Luật QLT 108/2025/QH15 Đ12.5; NĐ 252/2026/NĐ-CP",lv:"XM"}],
 late_filing_fine:[
  {from:"2020-12-05",to:"2026-01-15",v:"Tổ chức: 1–30 ngày 2–5 triệu; 31–60 ngày 5–8 triệu; 61–90 ngày 8–15 triệu; trên 90 ngày 15–25 triệu; hộ, cá nhân bằng 1/2",doc:"NĐ 125/2020/NĐ-CP Đ13, Đ5.5 (sđ NĐ 102/2021 từ 01/01/2022)",lv:"TC"},
  {from:"2026-01-16",to:null,v:"Tổ chức: 1–30 ngày 2–5 triệu; 31–60 ngày 5–8 triệu; 61–90 ngày 8–15 triệu; trên 90 ngày 15–25 triệu; hộ, cá nhân bằng 1/2",doc:"NĐ 125/2020/NĐ-CP Đ13 sđ NĐ 310/2025/NĐ-CP – chưa đối chiếu mức sau sửa đổi",lv:"CXM"}],
 underdecl_fine:[
  {from:"2020-12-05",to:"2026-01-15",v:0.2,doc:"NĐ 125/2020/NĐ-CP Đ16.1 (20% số thuế khai thiếu)",lv:"TC"},
  {from:"2026-01-16",to:null,v:0.2,doc:"NĐ 125/2020/NĐ-CP Đ16.1 sđ NĐ 310/2025/NĐ-CP (tự khai bổ sung, nộp đủ trước khi CQT công bố quyết định kiểm tra thì không phạt)",lv:"TC"}],
 inv_rule:[
  {from:"2018-11-01",to:"2022-06-30",v:"NĐ 51/2010, NĐ 119/2018 (chuyển tiếp)",doc:"NĐ 51/2010/NĐ-CP, NĐ 04/2014/NĐ-CP, TT 39/2014/TT-BTC; NĐ 119/2018, TT 68/2019; HĐĐT NĐ 123/2020 triển khai theo tỉnh từ 11/2021",lv:"TC"},
  {from:"2022-07-01",to:"2025-05-31",v:"NĐ 123/2020",doc:"NĐ 123/2020/NĐ-CP; TT 78/2021/TT-BTC",lv:"XM"},
  {from:"2025-06-01",to:"2026-06-30",v:"NĐ 123/2020 sđ NĐ 70/2025",doc:"NĐ 70/2025/NĐ-CP; TT 32/2025/TT-BTC",lv:"XM"},
  {from:"2026-07-01",to:null,v:"NĐ 254/2026",doc:"NĐ 254/2026/NĐ-CP thay NĐ 123/2020 và NĐ 70/2025",lv:"TC"}],
 invoice_cash_register:[
  {from:"2018-11-01",to:"2022-06-30",v:"Chưa bắt buộc",doc:"NĐ 119/2018/NĐ-CP (thí điểm)",lv:"TC"},
  {from:"2022-07-01",to:"2025-05-31",v:"Tự nguyện cho DN bán lẻ trực tiếp người tiêu dùng",doc:"NĐ 123/2020/NĐ-CP Đ11; TT 78/2021/TT-BTC Đ8",lv:"TC"},
  {from:"2025-06-01",to:"2026-06-30",v:"Bắt buộc với bán lẻ, ăn uống, khách sạn, vận tải hành khách, giải trí… bán trực tiếp người tiêu dùng",doc:"NĐ 123/2020/NĐ-CP Đ11.1 sđ NĐ 70/2025/NĐ-CP",lv:"XM"},
  {from:"2026-07-01",to:null,v:"Bắt buộc với bán lẻ, ăn uống, khách sạn, vận tải hành khách, giải trí… bán trực tiếp người tiêu dùng",doc:"NĐ 254/2026/NĐ-CP (HKD doanh thu trên 1 tỷ dùng HĐ có mã hoặc máy tính tiền)",lv:"TC"}],
 mon_bai:[
  {from:"2017-01-01",to:"2025-12-31",v:true,doc:"NĐ 139/2016/NĐ-CP (sđ NĐ 22/2020: miễn năm đầu thành lập)",lv:"XM"},
  {from:"2026-01-01",to:null,v:false,doc:"Chấm dứt thu lệ phí môn bài – NQ 198/2025/QH15 Đ10.7",lv:"XM"}],

 /* ---------- Chế độ kế toán ---------- */
 acc_regime:[
  {from:"2015-01-01",to:"2025-12-31",v:"TT200",doc:"TT 200/2014/TT-BTC",lv:"XM"},
  {from:"2026-01-01",to:null,v:"TT99",doc:"TT 99/2025/TT-BTC (năm tài chính bắt đầu từ 01/01/2026); TT 133/2016 vẫn áp dụng cho DNNVV",lv:"XM"}]
};
const POL_NAME={
 vat_law:"Luật thuế GTGT",vat_rates:"Thuế suất GTGT",vat8:"Giảm thuế GTGT 10% → 8%",vat_cash:"Ngưỡng thanh toán không dùng tiền mặt để khấu trừ GTGT",vat_decl_period:"Kỳ khai thuế GTGT",
 cit_rate:"Thuế suất TNDN",cit_exempt:"Miễn, giảm thuế TNDN chung",cit_cash:"Ngưỡng thanh toán không dùng tiền mặt để chi phí được trừ (TNDN)",cit_prepay:"Tạm nộp TNDN 4 quý tối thiểu",loss_carry:"Chuyển lỗ",int_cap:"Trần chi phí lãi vay (giao dịch liên kết)",int_150:"Lãi vay vượt 150% lãi suất cơ bản",cit_welfare:"Trần chi phúc lợi",cit_pension:"Trần chi BHHT tự nguyện, BHNT cho NLĐ",cit_uniform:"Trần chi trang phục bằng tiền",cit_car:"Trần nguyên giá ô tô được khấu hao",
 pit_self:"Giảm trừ bản thân (TNCN)",pit_dep:"Giảm trừ người phụ thuộc (TNCN)",pit_dep_inc:"Thu nhập tối đa của người phụ thuộc",pit_br:"Biểu thuế TNCN lũy tiến",pit_nonres:"Thuế suất TNCN cá nhân không cư trú",pit_casual:"Ngưỡng khấu trừ 10% thu nhập vãng lai",pit_meal:"Tiền ăn giữa ca không tính TNCN",pit_ot:"Miễn thuế tiền lương làm thêm giờ",pit_pension_ded:"Giảm trừ BHHT, hưu trí tự nguyện (TNCN)",pit_period:"Kỳ khai thuế TNCN khấu trừ",pit_rent:"Ngưỡng doanh thu cho thuê tài sản không phải nộp thuế",hkd_threshold:"Ngưỡng doanh thu hộ, cá nhân kinh doanh không phải nộp thuế",
 bh_law:"Luật BHXH",min_wage1:"Lương tối thiểu vùng I",min_wage:"Lương tối thiểu vùng I–IV",base_wage:"Mức lương cơ sở",bh_cap:"Trần lương đóng BHXH, BHYT",bhtn_cap:"Trần lương đóng BHTN theo vùng",bh_rate_er:"Tỷ lệ BH, KPCĐ doanh nghiệp đóng",bh_rate_ee:"Tỷ lệ BH người lao động đóng",
 qlt_law:"Luật Quản lý thuế",late_rate:"Tiền chậm nộp",amend_limit:"Thời hạn khai bổ sung",late_filing_fine:"Phạt chậm nộp hồ sơ khai thuế",underdecl_fine:"Phạt khai sai dẫn đến thiếu thuế",inv_rule:"Quy định hóa đơn",invoice_cash_register:"Hóa đơn khởi tạo từ máy tính tiền",mon_bai:"Lệ phí môn bài",
 acc_regime:"Chế độ kế toán doanh nghiệp"
};
let POLICY_NOTES=[// cảnh báo giao thoa (nghiên cứu văn bản đến 10/2026)
 /* --- 2021 --- */
 {from:"2021-01-01",to:"2021-12-31",sev:"NHO",t:"Thuế TNDN kỳ 2021 có thể được giảm 30%",d:"DN có doanh thu 2021 ≤ 200 tỷ và giảm so với 2019 được giảm 30% số thuế TNDN phải nộp kỳ 2021.",kn:"Đối chiếu [D] sau giảm với chi phí thuế 8211; không coi phần giảm là chênh lệch.",cb:"NQ 406/2021/UBTVQH15; NĐ 92/2021/NĐ-CP Đ3"},
 {from:"2021-07-01",to:"2022-06-30",sev:"TY",t:"Tỷ lệ TNLĐ-BNN DN đóng giảm về 0%",d:"Từ 01/07/2021 đến 30/06/2022 DN đóng 0% vào quỹ TNLĐ-BNN thay cho 0,5%.",kn:"Tính tỷ lệ BH DN đóng theo từng tháng; không coi phần thiếu 0,5% là sai.",cb:"NQ 68/2021/NQ-CP; QĐ 23/2021/QĐ-TTg"},
 {from:"2021-10-01",to:"2022-09-30",sev:"TY",t:"BHTN phần DN đóng giảm về 0%",d:"Từ 01/10/2021 đến 30/09/2022 DN đóng BHTN 0%; NLĐ vẫn đóng 1%. Không áp dụng cho cơ quan nhà nước, đơn vị sự nghiệp do NSNN bảo đảm chi.",kn:"Đối chiếu PS Có 3386 với 1% (chỉ phần NLĐ) trong các tháng này.",cb:"NQ 116/2021/NQ-CP"},
 {from:"2021-11-01",to:"2021-12-31",sev:"NHO",t:"Giảm 30% thuế suất GTGT một số ngành",d:"Vận tải, lưu trú, ăn uống, du lịch, xuất bản, chiếu phim… được giảm 30% mức thuế suất (10% còn 7%). HKD giảm 30% tỷ lệ % trên doanh thu.",kn:"Đối chiếu thuế suất trên hóa đơn 11–12/2021 với danh mục phụ lục NĐ 92/2021.",cb:"NQ 406/2021/UBTVQH15; NĐ 92/2021/NĐ-CP Đ1"},
 {from:"2021-11-01",to:"2022-06-30",sev:"NHO",t:"Chuyển đổi hóa đơn điện tử theo NĐ 123/2020 theo từng tỉnh",d:"Đợt 1 từ 11/2021 tại 6 tỉnh, thành; đợt 2 từ 04/2022; bắt buộc toàn quốc từ 01/07/2022. Cùng kỳ có thể có cả hóa đơn cũ và mới.",kn:"Kiểm tra thông báo chuyển đổi của DN và người bán; hóa đơn cũ sau ngày chuyển đổi không hợp lệ.",cb:"NĐ 123/2020/NĐ-CP Đ59–60; TT 78/2021/TT-BTC"},
 /* --- 2022 --- */
 {from:"2022-01-01",to:"2022-01-31",sev:"NHO",t:"Mẫu tờ khai mới theo TT 80/2021",d:"Từ 01/01/2022 tờ khai GTGT, TNCN, TNDN dùng mẫu TT 80/2021 thay TT 156/2013. Số chỉ tiêu khác mẫu cũ.",kn:"Khi so tờ khai 2021 với 2022 phải ánh xạ lại chỉ tiêu.",cb:"TT 80/2021/TT-BTC"},
 {from:"2022-02-01",to:"2022-02-28",sev:"TY",t:"Bắt đầu giảm thuế GTGT 8% đợt 1",d:"HĐ lập từ 01/02/2022 được áp 8% cho hàng hóa, dịch vụ đang 10%, trừ phụ lục loại trừ. HĐ tháng 01/2022 vẫn 10%.",kn:"Đối chiếu thuế suất theo ngày lập hóa đơn và danh mục loại trừ (viễn thông, ngân hàng, bất động sản, kim loại…).",cb:"NQ 43/2022/QH15; NĐ 15/2022/NĐ-CP"},
 {from:"2022-07-01",to:"2022-07-31",sev:"TY",t:"Lương tối thiểu vùng tăng giữa năm 2022",d:"Từ 01/07/2022 vùng I 4,68 triệu (trước đó 4,42 triệu). Lương đóng BH không được thấp hơn mức mới.",kn:"Rà lương đóng BH từ tháng 7/2022; tách hai mức trong năm.",cb:"NĐ 38/2022/NĐ-CP"},
 {from:"2022-07-01",to:"2022-07-31",sev:"NHO",t:"Bắt buộc hóa đơn điện tử toàn quốc",d:"Từ 01/07/2022 NĐ 51/2010, NĐ 04/2014 hết hiệu lực; mọi DN dùng HĐĐT theo NĐ 123/2020.",kn:"Hóa đơn giấy lập từ 01/07/2022 không hợp lệ để khấu trừ, tính chi phí.",cb:"NĐ 123/2020/NĐ-CP Đ59; TT 78/2021/TT-BTC"},
 {from:"2022-10-30",to:"2022-12-31",sev:"NHO",t:"Tạm nộp TNDN 4 quý ≥ 80% áp dụng hồi tố từ kỳ 2021",d:"NĐ 91/2022 hiệu lực 30/10/2022 thay quy định 3 quý ≥ 75% bằng 4 quý ≥ 80%, áp dụng từ kỳ tính thuế 2021.",kn:"Kiểm tra tổng tạm nộp 4 quý so với quyết toán; tính chậm nộp phần thiếu.",cb:"NĐ 91/2022/NĐ-CP sđ NĐ 126/2020 Đ8.6"},
 /* --- 2023 --- */
 {from:"2023-01-01",to:"2023-06-30",sev:"TY",t:"Khoảng trống không giảm thuế GTGT nửa đầu 2023",d:"HĐ lập từ 01/01 đến 30/06/2023 phải ghi 10%. Ghi 8% là khai thiếu thuế đầu ra.",kn:"Lọc hóa đơn bán ra 01–06/2023 có thuế suất 8%; lập hóa đơn điều chỉnh và khai bổ sung.",cb:"NQ 43/2022/QH15 (hết hạn 31/12/2022); NQ 101/2023/QH15 (từ 01/07/2023)"},
 {from:"2023-07-01",to:"2023-07-31",sev:"TY",t:"Giảm thuế GTGT 8% trở lại từ 01/07/2023",d:"HĐ lập từ 01/07/2023 lại được áp 8%. Hóa đơn tháng 6 và tháng 7 khác thuế suất.",kn:"Đối chiếu thuế suất theo ngày lập hóa đơn quanh mốc 01/07/2023.",cb:"NQ 101/2023/QH15; NĐ 44/2023/NĐ-CP"},
 {from:"2023-07-01",to:"2023-07-31",sev:"TY",t:"Lương cơ sở tăng lên 1,8 triệu",d:"Từ 01/07/2023 trần đóng BHXH, BHYT là 36 triệu (trước đó 29,8 triệu).",kn:"Rà NLĐ lương cao: tháng 1–6/2023 đóng tới 29,8 triệu, từ tháng 7 tới 36 triệu.",cb:"NĐ 24/2023/NĐ-CP"},
 /* --- 2024 --- */
 {from:"2024-01-01",to:"2024-12-31",sev:"NHO",t:"Sửa đổi quy định chi phí lãi vay áp dụng từ kỳ 2024",d:"NĐ 20/2025 sửa NĐ 132/2020 (loại trừ một số khoản vay khỏi trần 30% EBITDA), áp dụng từ kỳ tính thuế 2024.",kn:"DN có giao dịch liên kết kiểm tra lại phụ lục 01 NĐ 132 kỳ 2024.",cb:"NĐ 20/2025/NĐ-CP"},
 {from:"2024-07-01",to:"2024-07-31",sev:"TY",t:"Lương tối thiểu vùng và lương cơ sở cùng tăng từ 01/07/2024",d:"Vùng I 4,96 triệu; lương cơ sở 2,34 triệu, trần BHXH, BHYT 46,8 triệu.",kn:"Tách hai mức trong năm 2024 khi kiểm tra lương đóng BH và trần đóng.",cb:"NĐ 74/2024/NĐ-CP; NĐ 73/2024/NĐ-CP"},
 /* --- 2025 --- */
 {from:"2025-06-01",to:"2025-06-30",sev:"TY",t:"Sửa đổi hóa đơn theo NĐ 70/2025 từ 01/06/2025",d:"Thời điểm lập HĐ dịch vụ là khi hoàn thành, không phụ thuộc đã thu tiền. Điều chỉnh, thay thế cần văn bản thỏa thuận. Bắt buộc HĐ máy tính tiền với bán lẻ, ăn uống.",kn:"Rà HĐ dịch vụ hoàn thành trong kỳ nhưng lập sau; kiểm tra hồ sơ điều chỉnh hóa đơn.",cb:"NĐ 70/2025/NĐ-CP; TT 32/2025/TT-BTC"},
 {from:"2025-06-01",to:"2025-07-31",sev:"TY",t:"Hóa đơn mua vào từ 5 đến dưới 20 triệu quanh mốc 01/07/2025",d:"GTGT: HĐ đến 30/06/2025 dùng ngưỡng 20 triệu, từ 01/07/2025 ngưỡng 5 triệu. Chưa có văn bản nói rõ căn cứ ngày hóa đơn hay ngày thanh toán.",kn:"Rà HĐ lập trước 01/07 nhưng trả tiền mặt sau 01/07; ưu tiên chuyển khoản.",cb:"NĐ 181/2025 Đ26"},
 {from:"2025-07-01",to:"2025-07-31",sev:"NHO",t:"Luật BHXH 41/2024 có hiệu lực",d:"Mở rộng đối tượng đóng bắt buộc (chủ hộ kinh doanh, người quản lý DN không hưởng lương…); trần đóng tính theo mức tham chiếu.",kn:"Rà danh sách người quản lý, NLĐ không trích BH từ tháng 7/2025.",cb:"Luật BHXH 41/2024/QH15 Đ2, Đ31"},
 {from:"2025-07-01",to:"2025-12-31",sev:"NHO",t:"Giảm thuế GTGT 8% đợt 6 mở rộng diện",d:"Từ 01/07/2025 thêm một số nhóm được giảm (dịch vụ CNTT, sản phẩm kim loại đúc sẵn, than…).",kn:"Đối chiếu danh mục loại trừ mới; hàng trước đây 10% nay có thể 8%.",cb:"NQ 204/2025/QH15; NĐ 174/2025/NĐ-CP"},
 {from:"2025-12-01",to:"2025-12-31",sev:"TY",t:"Năm 2025 có hai ngưỡng chi phí tiền mặt TNDN",d:"Chi phí được trừ: 20 triệu đến 14/12/2025, 5 triệu từ 15/12/2025 – khác mốc 01/07/2025 của GTGT.",kn:"Tách chứng từ chi tiền mặt từ 5 triệu phát sinh từ 15/12/2025 để loại khỏi chi phí được trừ.",cb:"NĐ 320/2025 Đ9, Đ24"},
 {from:"2025-01-01",to:"2025-12-31",sev:"NHO",t:"Thuế suất TNDN 15%/17% theo doanh thu năm trước từ kỳ 2025",d:"Xét theo doanh thu năm 2024 (gồm doanh thu tài chính, thu nhập khác); loại trừ DN có quan hệ công ty con/liên kết không đủ điều kiện.",kn:"Kiểm tra điều kiện doanh thu năm trước trước khi áp thuế suất trên tờ khai 03/TNDN.",cb:"Luật 67/2025 Đ10; NĐ 320/2025 Đ11"},
 /* --- 2026 --- */
 {from:"2026-01-01",to:"2026-01-31",sev:"TY",t:"Nhiều quy định đổi từ 01/01/2026",d:"Lương tối thiểu vùng I 5,31 triệu; bỏ lệ phí môn bài; bỏ thuế khoán HKD; TT 99/2025 thay TT 200; NĐ 359/2025 sửa NĐ 181/2025.",kn:"Kiểm tra chuyển số dư sang TT 99, lương đóng BH theo vùng mới, không hạch toán môn bài.",cb:"NĐ 293/2025/NĐ-CP; NQ 198/2025/QH15 Đ10; TT 99/2025/TT-BTC; NĐ 359/2025/NĐ-CP"},
 {from:"2026-01-16",to:"2026-02-28",sev:"NHO",t:"Sửa đổi xử phạt vi phạm thuế, hóa đơn theo NĐ 310/2025",d:"Từ 16/01/2026 tự khai bổ sung, nộp đủ trước khi CQT công bố quyết định kiểm tra thì không phạt khai sai; khung phạt hóa đơn sai thời điểm đổi.",kn:"Ưu tiên tự khai bổ sung sớm các sai sót phát hiện được.",cb:"NĐ 310/2025/NĐ-CP sđ NĐ 125/2020/NĐ-CP"},
 {from:"2026-01-01",to:"2026-06-30",sev:"NHO",t:"Thuế TNCN tháng 1–6/2026 có thể đã khấu trừ theo cách cũ",d:"Luật 109/2025 áp dụng biểu 5 bậc và giảm trừ 15,5/6,2 triệu cho cả năm 2026; số đã khấu trừ theo biểu cũ không phải khai lại, bù trừ khi quyết toán.",kn:"Không coi là sai khi tờ khai tháng/quý 1–6/2026 tính theo cách cũ; tính lại khi quyết toán năm 2026.",cb:"Luật 109/2025 Đ29.2; NĐ 253/2026 Đ70"},
 {from:"2026-06-20",to:"2026-07-31",sev:"NHO",t:"Được khấu trừ lại thuế GTGT khi có chứng từ không dùng tiền mặt",d:"Từ 20/06/2026 HĐ đã điều chỉnh giảm do quá hạn thanh toán được khai khấu trừ lại tại kỳ có chứng từ thanh toán không dùng tiền mặt.",kn:"Theo dõi HĐ mua chậm trả từ 5 triệu; khai khấu trừ lại đúng kỳ có chứng từ.",cb:"NĐ 144/2026/NĐ-CP Đ1.4 sđ NĐ 181/2025 Đ26"},
 {from:"2026-07-01",to:"2026-07-31",sev:"TY",t:"Nhiều quy định đổi cùng lúc từ 01/07/2026",d:"Khai TNCN chỉ theo quý; khấu trừ 10% vãng lai từ 5 triệu/lần; ăn giữa ca 1,2 triệu; khai bổ sung 5 năm; NĐ 252, NĐ 254, TT 89 thay văn bản cũ; hóa đơn đặt in hết giá trị; lương cơ sở 2,53 triệu, trần BHXH 50,6 triệu.",kn:"Tách kỳ trước/sau 01/07/2026 khi kiểm tra lương, BH, hóa đơn.",cb:"Luật QLT 108/2025; NĐ 252, 253, 254/2026; NĐ 161/2026"},
 {from:"2026-01-01",to:"2026-12-31",sev:"NHO",t:"Ngưỡng hộ kinh doanh năm 2026 đổi nhiều lần (hồi tố 01/01/2026)",d:"200 triệu → 500 triệu → 1 tỷ (Luật 09/2026, NĐ 141/2026). Khoản thuê nhà, mua hàng của hộ/cá nhân cần đối chiếu lại nghĩa vụ khấu trừ.",kn:"Rà hợp đồng thuê tài sản cá nhân, khấu trừ thay theo ngưỡng mới.",cb:"Luật 09/2026/QH16; NĐ 141/2026"}
];
const CITE={
 DU_BAT_THUONG:{cb:"Luật Kế toán 88/2015/QH13 Đ6; TT 200/2014/TT-BTC hoặc TT 133/2016/TT-BTC (đến năm TC 2025), TT 99/2025/TT-BTC (từ năm TC 2026) – nội dung, kết cấu tài khoản",why:"Hạch toán sai bản chất làm sai chi phí, giá vốn và chỉ tiêu trên BCTC, tờ khai TNDN.",fix:"Xem chứng từ gốc, xác định bản chất nghiệp vụ và lập bút toán điều chỉnh đúng tài khoản."},
 TM_5TR:{cb:"GTGT: TT 219/2013/TT-BTC Đ15 (từ 20 triệu, đến 30/06/2025); Luật GTGT 48/2024/QH15 Đ14, NĐ 181/2025/NĐ-CP Đ26 (từ 5 triệu, từ 01/07/2025). TNDN: TT 96/2015/TT-BTC Đ4 (20 triệu, đến 14/12/2025); NĐ 320/2025/NĐ-CP Đ9.1.c (5 triệu, từ 15/12/2025)",why:"Thiếu chứng từ thanh toán không dùng tiền mặt thì không được khấu trừ thuế GTGT đầu vào và không được tính chi phí được trừ.",fix:"Chuyển sang thanh toán qua ngân hàng; nếu đã trả tiền mặt thì điều chỉnh giảm thuế đầu vào và loại chi phí tương ứng."},
 TU_KHOA:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15, NĐ 320/2025/NĐ-CP Đ10 (từ kỳ 2025) – tiền phạt vi phạm hành chính, tiền chậm nộp không được trừ",why:"Khoản phạt hành chính, tiền chậm nộp ghi vào chi phí làm giảm thu nhập tính thuế.",fix:"Đưa vào chỉ tiêu B4 tờ khai 03/TNDN; phạt vi phạm hợp đồng kinh tế vẫn được trừ."},
 QUY_AM:{cb:"Luật Kế toán 88/2015/QH13 Đ16–19 (chứng từ); TT 200/2014/TT-BTC Đ12 (TK 111) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Tồn quỹ tiền mặt không thể âm; quỹ âm cho thấy phiếu thu, chi ghi sai ngày hoặc thiếu chứng từ.",fix:"Rà phiếu thu ghi thiếu, chậm và phiếu chi ghi trước ngày thực chi; ghi bổ sung đúng ngày."},
 NXT_AM:{cb:"VAS 02 Hàng tồn kho (QĐ 149/2001/QĐ-BTC); TT 200/2014/TT-BTC, TT 133/2016/TT-BTC (đến năm TC 2025), TT 99/2025/TT-BTC (từ năm TC 2026) – nguyên tắc kế toán hàng tồn kho",why:"Xuất kho vượt tồn cho thấy hàng mua không có hóa đơn hoặc ghi sai mã, sai kỳ.",fix:"Kiểm tra hóa đơn mua chưa nhập, phiếu xuất sai mã; điều chỉnh để tồn kho không âm tại mọi thời điểm."},
 HDR_CHUA_GHI:{cb:"Thời điểm xác định thuế GTGT: TT 219/2013/TT-BTC Đ8 (đến 30/06/2025), Luật GTGT 48/2024/QH15, NĐ 181/2025/NĐ-CP (từ 01/07/2025); khai bổ sung: Luật QLT 38/2019/QH14 Đ47 (đến 30/06/2026), Luật QLT 108/2025/QH15 Đ12 (từ 01/07/2026)",why:"Hóa đơn đã lập nhưng không ghi sổ là bỏ sót doanh thu, thuế đầu ra, có thể bị phạt 20% số thuế thiếu.",fix:"Ghi sổ bổ sung đúng kỳ hóa đơn; khai bổ sung tờ khai nếu chưa kê khai."},
 SO_KHONG_CO_SK:{cb:"TT 200/2014/TT-BTC Đ13 (TK 112 – đối chiếu với giấy báo, sao kê ngân hàng) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Bút toán tiền gửi không có trên sao kê là ghi sai tài khoản, sai ngân hàng hoặc ghi khống.",fix:"Xem UNC, giấy báo có; điều chỉnh tài khoản hoặc hủy bút toán."},
 GIAO_THOA:{cb:"Áp dụng văn bản có hiệu lực tại thời điểm phát sinh: Luật Ban hành VBQPPL 80/2015/QH13 Đ156 (đến 31/03/2025); Luật Ban hành VBQPPL 64/2025/QH15 (từ 01/04/2025)",why:"Kỳ kiểm tra có mốc thay đổi chính sách; áp một mức cho cả kỳ sẽ sai một phần giao dịch.",fix:"Tách giao dịch theo ngày phát sinh và áp mức của từng thời kỳ."},
 TRUNG_CT:{cb:"Luật Kế toán 88/2015/QH13 Đ5 (phản ánh đầy đủ, trung thực), Đ6",why:"Ghi trùng làm tăng chi phí, thuế đầu vào hoặc doanh thu không có thật.",fix:"Xóa bút toán trùng; nếu là nhiều mặt hàng cùng giá thì bỏ qua cảnh báo."},
 LUONG_NGOAI_334:{cb:"TT 200/2014/TT-BTC, TT 133/2016/TT-BTC, TT 99/2025/TT-BTC – TK 334; TT 111/2013/TT-BTC Đ2.2, Đ25 (đến 30/06/2026); NĐ 253/2026/NĐ-CP (từ 01/07/2026)",why:"Khoản có tính chất tiền lương không qua 334 dễ bị bỏ sót khi khai, khấu trừ TNCN và đối chiếu BHXH.",fix:"Hạch toán lại qua 334; đưa vào bảng lương và tờ khai 05/KK kỳ phát sinh."},
 THANG_THIEU_KH:{cb:"TT 45/2013/TT-BTC Đ9 (sđ TT 147/2016, TT 28/2017); VAS 03, VAS 04",why:"Khấu hao phải trích đều theo thời gian sử dụng; bỏ tháng làm sai kết quả từng kỳ và chi phí được trừ.",fix:"Trích bổ sung khấu hao tháng thiếu."},
 THANG_THIEU_BH:{cb:"Luật BHXH 58/2014/QH13 Đ86, Đ122 (đến 30/06/2025); Luật BHXH 41/2024/QH15 Đ33–34, Đ38–40 (từ 01/07/2025); NĐ 12/2022/NĐ-CP (xử phạt)",why:"Có trả lương mà không đóng BH là chậm đóng, trốn đóng; bị tính lãi chậm đóng và phạt.",fix:"Đối chiếu C12 từng tháng; trích bổ sung và nộp kèm tiền chậm đóng."},
 RUT_KHONG_NHAP_QUY:{cb:"TT 200/2014/TT-BTC Đ12–13 (TK 111, 112) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026); Luật Kế toán 88/2015/QH13 Đ16",why:"Tiền rút không nhập quỹ che giấu dòng tiền mặt và các khoản chi không chứng từ.",fix:"Lập phiếu thu nhập quỹ (Nợ 111/Có 112) rồi mới hạch toán khoản chi."},
 CK_CA_NHAN:{cb:"Luật Kế toán 88/2015/QH13 Đ16–19; TT 200/2014/TT-BTC (TK 141, 1388); chi phí phải có chứng từ, gắn với SXKD: TT 96/2015/TT-BTC Đ4 (đến kỳ 2024), NĐ 320/2025/NĐ-CP Đ9 (từ kỳ 2025)",why:"Chuyển tiền lớn cho cá nhân không có hồ sơ là dấu hiệu chi khống, cho vay ngầm hoặc dòng tiền quay vòng.",fix:"Kiểm tra hồ sơ tạm ứng, hợp đồng, hoàn ứng; phân loại lại khoản phải thu nếu cần."},
 CN_TREO:{cb:"GTGT mua trả chậm: TT 219/2013/TT-BTC Đ15 (đến 30/06/2025), NĐ 181/2025/NĐ-CP Đ26 (từ 01/07/2025; sđ NĐ 144/2026 từ 20/06/2026); nợ không phải trả ghi thu nhập khác: TT 78/2014/TT-BTC Đ7 (đến kỳ 2024), NĐ 320/2025/NĐ-CP (từ kỳ 2025)",why:"Nợ phải trả treo lâu là dấu hiệu hóa đơn không có giao dịch thật hoặc chưa thanh toán quá hạn.",fix:"Điều chỉnh giảm thuế đầu vào với HĐ quá hạn thanh toán chưa có chứng từ; nợ không phải trả ghi thu nhập khác."},
 TRINH_BAY_LT:{cb:"VAS 21 đoạn 18 (không bù trừ tài sản và nợ phải trả); TT 200/2014/TT-BTC Đ112 (lập B01-DN theo số dư chi tiết) đến năm TC 2025; TT 133/2016/TT-BTC Phụ lục 2; TT 99/2025/TT-BTC Phụ lục IV (từ năm TC 2026)",why:"Bù trừ dư Nợ, dư Có công nợ làm sai chỉ tiêu phải thu, phải trả, trả trước trên BCTC.",fix:"Lấy chỉ tiêu theo tổng dư Nợ, dư Có từng đối tượng chi tiết, không bù trừ."},
 BCTC_CDPS:{cb:"TT 200/2014/TT-BTC Đ112–113 (lập B01-DN, B02-DN) đến năm TC 2025; TT 133/2016/TT-BTC Phụ lục 2; TT 99/2025/TT-BTC Phụ lục IV (từ năm TC 2026)",why:"Chỉ tiêu BCTC phải lấy đúng từ số dư, số phát sinh tài khoản; lệch là lập sai báo cáo.",fix:"Đối chiếu từng chỉ tiêu với bảng cân đối phát sinh; sửa BCTC hoặc sổ cho khớp."},
 DOI_CHIEU:{cb:"VAS 02 Hàng tồn kho; TT 200/2014/TT-BTC (TK 156, 632) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Giá trị xuất kho không vào giá vốn làm sai giá vốn và lợi nhuận.",fix:"Kiểm tra bút toán xuất kho đối ứng khác 632; hạch toán lại đúng bản chất."},
 TK_LECH_KY:{cb:"Kê khai bổ sung thuế đầu vào bỏ sót: TT 219/2013/TT-BTC Đ14.9 (đến 30/06/2025); Luật GTGT 48/2024/QH15 Đ14, NĐ 181/2025/NĐ-CP (từ 01/07/2025); Luật QLT 38/2019/QH14 Đ47",why:"Thuế GTGT trên sổ và tờ khai lệch kỳ làm sai số thuế phải nộp, khấu trừ từng kỳ.",fix:"Xác định chứng từ lệch; khai bổ sung hoặc kê khai vào kỳ phát hiện trước khi CQT công bố quyết định kiểm tra."},
 TNCN_TK_SO:{cb:"Mẫu 05/KK-TNCN: TT 156/2013/TT-BTC (năm 2021), TT 80/2021/TT-BTC (01/01/2022–30/06/2026), TT 89/2026/TT-BTC (từ 01/07/2026); khai bổ sung: Luật QLT 38/2019/QH14 Đ47",why:"Thuế TNCN trên tờ khai khác số đã khấu trừ trên sổ là khai thiếu hoặc thừa.",fix:"Xác định kỳ lệch; khai bổ sung tờ khai kỳ đó."},
 TNCN_TK_BL:{cb:"Mẫu 05/KK-TNCN: TT 156/2013/TT-BTC (năm 2021), TT 80/2021/TT-BTC (01/01/2022–30/06/2026), TT 89/2026/TT-BTC (từ 01/07/2026); TT 111/2013/TT-BTC Đ25",why:"Tờ khai không khớp bảng lương cho thấy khai sai thu nhập chịu thuế hoặc số thuế khấu trừ.",fix:"Đối chiếu từng kỳ với bảng lương; khai bổ sung kỳ sai."},
 TNCN_BL_SO:{cb:"TT 111/2013/TT-BTC Đ25 (đến 30/06/2026); NĐ 253/2026/NĐ-CP (từ 01/07/2026); TT 200/2014/TT-BTC, TT 99/2025/TT-BTC – TK 3335",why:"Thuế khấu trừ trên bảng lương phải ghi Có 3335 cùng tháng; lệch là ghi sổ sai.",fix:"Điều chỉnh bút toán Nợ 334/Có 3335 theo bảng lương từng tháng."},
 TNCN_TK_334:{cb:"Mẫu 05/KK-TNCN TT 80/2021/TT-BTC (đến 30/06/2026), TT 89/2026/TT-BTC (từ 01/07/2026); TT 111/2013/TT-BTC Đ2–3 (thu nhập chịu thuế, miễn thuế)",why:"Thu nhập trên tờ khai nhỏ hơn chi trả qua 334 (sau khi trừ khoản miễn) là khai thiếu thu nhập chịu thuế.",fix:"Rà khoản phụ cấp, thưởng chưa đưa vào tờ khai; khai bổ sung."},
 TNCN_QT_KK:{cb:"Mẫu 05/QTT-TNCN TT 80/2021/TT-BTC (quyết toán 2021–2025), TT 89/2026/TT-BTC (quyết toán 2026); NĐ 126/2020/NĐ-CP Đ8.6",why:"Quyết toán phải bằng tổng tờ khai trong năm; lệch là khai sai một trong hai.",fix:"Khai bổ sung tờ khai kỳ sai trước, sau đó lập lại quyết toán."},
 TNCN_QT_BL:{cb:"Mẫu 05/QTT-TNCN, 05-1/BK-QTT-TNCN TT 80/2021/TT-BTC (quyết toán 2021–2025), TT 89/2026/TT-BTC (quyết toán 2026); TT 111/2013/TT-BTC Đ21",why:"Thu nhập quyết toán khác bảng lương cả năm làm sai số thuế phải nộp, được hoàn.",fix:"Đối chiếu từng cá nhân trên phụ lục 05-1/BK với bảng lương; khai bổ sung quyết toán."},
 TNCN_QT_SO:{cb:"Mẫu 05/QTT-TNCN TT 80/2021/TT-BTC, TT 89/2026/TT-BTC (quyết toán 2026); TT 200/2014/TT-BTC, TT 99/2025/TT-BTC – TK 3335",why:"Thuế đã khấu trừ trên quyết toán phải khớp PS Có 3335 cả năm.",fix:"Rà bút toán 3335 ghi sai kỳ, sai đối tượng; điều chỉnh sổ hoặc quyết toán."},
 TNCN_QT_THIEU_NGUOI:{cb:"Phụ lục 05-1/BK-QTT-TNCN TT 80/2021/TT-BTC (quyết toán 2021–2025), TT 89/2026/TT-BTC (quyết toán 2026); TT 111/2013/TT-BTC Đ25",why:"Thiếu cá nhân trên bảng kê là khai thiếu thu nhập, ảnh hưởng quyền quyết toán của NLĐ.",fix:"Bổ sung cá nhân vào bảng kê; khai bổ sung nếu đã nộp."},
 TNCN_QT:{cb:"NĐ 126/2020/NĐ-CP Đ8.6.d (ủy quyền quyết toán) đến kỳ 2025; TT 111/2013/TT-BTC Đ21; quyết toán 2026: Luật 109/2025/QH15, NĐ 253/2026/NĐ-CP Đ70, TT 89/2026/TT-BTC",why:"Tổ chức trả thu nhập phải quyết toán thay cho cá nhân ủy quyền; số phải nộp, được hoàn phải đúng.",fix:"Lập 05/QTT-TNCN; người có thu nhập nơi khác không được ủy quyền quyết toán."},
 TNCN_TINH_LAI:{cb:"Kỳ 2021–2025: Luật Thuế TNCN 04/2007/QH12 Đ22 sđ Luật 26/2012/QH13, NQ 954/2020/UBTVQH14, TT 111/2013/TT-BTC Đ7, Đ9; kỳ 2026: Luật Thuế TNCN 109/2025/QH15 Đ9, NQ 110/2025/UBTVQH15",why:"Số thuế khấu trừ khác số tính lại theo biểu và giảm trừ của kỳ là khấu trừ sai.",fix:"Điều chỉnh tờ khai kỳ phát sinh; hoàn hoặc truy thu NLĐ khi quyết toán (tháng 1–6/2026 xử lý khi quyết toán)."},
 TNCN_VANG_LAI:{cb:"TT 111/2013/TT-BTC Đ25.1.i (từ 2 triệu/lần, đến 30/06/2026); NĐ 253/2026/NĐ-CP Đ50.2 (từ 5 triệu/lần, từ 01/07/2026)",why:"Không khấu trừ 10% với khoản chi từ ngưỡng là tổ chức chi trả khấu trừ thiếu thuế.",fix:"Khấu trừ 10% và khai vào 05/KK, trừ khi có cam kết 08/CK-TNCN đủ điều kiện."},
 TNCN_KHONG_BH:{cb:"Luật BHXH 58/2014/QH13 Đ2.1 (đến 30/06/2025); Luật BHXH 41/2024/QH15 Đ2 (từ 01/07/2025); BHTN: Luật Việc làm 38/2013/QH13 Đ43 (HĐ từ 3 tháng, đến 31/12/2025), Luật Việc làm 74/2025/QH15 (từ 01/01/2026)",why:"NLĐ có HĐLĐ từ 1 tháng thuộc diện BHXH bắt buộc; không đóng bị truy đóng và phạt.",fix:"Đăng ký tham gia BH, truy đóng từ tháng có HĐLĐ và nộp tiền chậm đóng."},
 BL_THANG_KHONG_BH:{cb:"Luật BHXH 58/2014/QH13 Đ86 (đến 30/06/2025); Luật BHXH 41/2024/QH15 Đ33–34, Đ38–40 (từ 01/07/2025)",why:"Cả tháng không khấu trừ BH cho thấy chưa trích, nộp BH tháng đó.",fix:"Đối chiếu C12, sổ 3383; trích bổ sung và nộp kèm tiền chậm đóng."},
 BH_BL_SO:{cb:"Luật BHXH 58/2014/QH13 Đ85 (đến 30/06/2025), Luật BHXH 41/2024/QH15 Đ33 (từ 01/07/2025): NLĐ 8%; Luật BHYT: 1,5%; Luật Việc làm: 1%",why:"Phần BH khấu trừ NLĐ trên bảng lương phải khớp Nợ 334/Có 338.",fix:"Điều chỉnh bút toán khấu trừ BH theo bảng lương từng tháng."},
 BH_DN:{cb:"Luật BHXH 58/2014/QH13 Đ86 (đến 30/06/2025), Luật BHXH 41/2024/QH15 Đ34 (từ 01/07/2025); NĐ 58/2020/NĐ-CP Đ4 (TNLĐ 0,5%); QĐ 23/2021/QĐ-TTg (TNLĐ 0% 01/07/2021–30/06/2022); NQ 116/2021/NQ-CP (BHTN 0% 01/10/2021–30/09/2022); NĐ 191/2013/NĐ-CP Đ5, Luật Công đoàn 50/2024/QH15 (KPCĐ 2%)",why:"Phần DN đóng lệch tỷ lệ quy định của kỳ là trích thiếu hoặc thừa chi phí BH.",fix:"Tính lại theo tỷ lệ từng tháng (lưu ý kỳ giảm 2021–2022) và điều chỉnh 3382/3383/3384/3386."},
 TNCN_314:{cb:"TT 200/2014/TT-BTC Đ112 (chỉ tiêu 314 lấy dư Có TK 334) đến năm TC 2025; TT 133/2016/TT-BTC Phụ lục 2; TT 99/2025/TT-BTC Phụ lục IV (từ năm TC 2026)",why:"Chỉ tiêu phải trả NLĐ trên BCTC phải bằng dư Có 334.",fix:"Sửa chỉ tiêu BCTC hoặc xử lý dư Nợ 334 (trình bày ở phải thu khác)."},
 TNDN_A1:{cb:"Mẫu 03/TNDN TT 80/2021/TT-BTC (quyết toán 2021–2025), TT 89/2026/TT-BTC (từ 01/07/2026); chỉ tiêu A1 lấy từ mã 50 B02-DN (TT 200, TT 133, TT 99)",why:"Lợi nhuận trước thuế trên tờ khai phải bằng BCTC; lệch là khai sai cơ sở tính thuế.",fix:"Khai bổ sung 03/TNDN hoặc sửa BCTC cho khớp."},
 TNDN_DT:{cb:"Phụ lục 03-1A/TNDN TT 80/2021/TT-BTC; doanh thu tính thuế: TT 78/2014/TT-BTC Đ5 (đến kỳ 2024), NĐ 320/2025/NĐ-CP, TT 20/2026/TT-BTC (từ kỳ 2025)",why:"Doanh thu trên phụ lục khác BCTC làm sai doanh thu xét thuế suất 15%/17% và miễn thuế.",fix:"Đối chiếu doanh thu từng nguồn; khai bổ sung phụ lục 03-1A."},
 TNDN_D:{cb:"Mẫu 03/TNDN TT 80/2021/TT-BTC, TT 89/2026/TT-BTC; VAS 17 (chi phí thuế 8211, 8212); thuế suất: Luật TNDN 14/2008/QH12 Đ10 (đến kỳ 2024), Luật TNDN 67/2025/QH15 Đ10 (từ kỳ 2025)",why:"Thuế TNDN phải nộp trên tờ khai khác chi phí thuế trên BCTC cho thấy sai điều chỉnh hoặc sai thuế suất.",fix:"Rà khoản điều chỉnh tăng, giảm và thuế suất áp dụng; sửa sổ hoặc khai bổ sung."},
 TNDN_3334:{cb:"Mẫu 03/TNDN TT 80/2021/TT-BTC, TT 89/2026/TT-BTC; TT 200/2014/TT-BTC, TT 99/2025/TT-BTC – TK 3334; tạm nộp: NĐ 126/2020/NĐ-CP Đ8.6 sđ NĐ 91/2022/NĐ-CP",why:"Số thuế quyết toán phải khớp nghĩa vụ ghi Có 3334; lệch là ghi sổ sai hoặc chưa ghi số phải nộp thêm.",fix:"Điều chỉnh 3334/8211 theo quyết toán; kiểm tra tạm nộp 4 quý ≥ 80%."},
 TNDN_CHUA_LOAI:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15, NĐ 320/2025/NĐ-CP Đ9–Đ10, TT 20/2026/TT-BTC (từ kỳ 2025)",why:"Chi phí không được trừ chưa đưa vào điều chỉnh tăng làm khai thiếu thuế TNDN.",fix:"Đưa các khoản vào chỉ tiêu B4 và khai bổ sung 03/TNDN."},
 SK_CHUA_GHI:{cb:"TT 200/2014/TT-BTC Đ13 (TK 112) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Giao dịch ngân hàng chưa ghi sổ làm sai số dư tiền gửi, chi phí, doanh thu tài chính.",fix:"Hạch toán bổ sung theo giấy báo, sao kê đúng ngày phát sinh."},
 SK_LECH_KY:{cb:"Luật Kế toán 88/2015/QH13 Đ12 (kỳ kế toán); TT 200/2014/TT-BTC Đ13; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Ghi sổ khác tháng với sao kê làm sai số dư cuối tháng, quý.",fix:"Ghi sổ theo ngày phát sinh trên sao kê, giấy báo."},
 SK_SO_DU:{cb:"TT 200/2014/TT-BTC Đ13 (đối chiếu, xử lý chênh lệch với ngân hàng) đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Số dư sổ khác sao kê là chưa ghi đủ hoặc ghi sai giao dịch.",fix:"Lập bảng đối chiếu số dư ngân hàng; điều chỉnh các khoản chưa ghi."},
 SK_CDPS:{cb:"TT 200/2014/TT-BTC Đ13, Đ112 đến năm TC 2025; TT 133/2016/TT-BTC; TT 99/2025/TT-BTC (từ năm TC 2026)",why:"Tổng số dư sao kê khác dư TK 112 cho thấy thiếu tài khoản ngân hàng hoặc ghi sai.",fix:"Kiểm tra tài khoản chưa có sao kê, tiền gửi có kỳ hạn, giao dịch chưa ghi."},
 NAM_DAU:{cb:"Văn bản có hiệu lực từ đầu năm kiểm tra (xem cột căn cứ của chính sách tương ứng)",why:"Năm đầu áp dụng quy định mới dễ sai mẫu biểu, chỉ tiêu và số liệu chuyển tiếp.",fix:"Kiểm tra số liệu chuyển tiếp từ năm trước và mẫu biểu mới."},
 SO_TRON:{cb:"Chuẩn mực kiểm toán VN số 240 (TT 214/2012/TT-BTC) – bút toán bất thường; Luật Kế toán 88/2015/QH13 Đ5",why:"Bút toán số tròn lớn thường là ước tính, trích trước hoặc điều chỉnh không có chứng từ.",fix:"Kiểm tra căn cứ ước tính, hợp đồng, biên bản nghiệm thu."},
 CHE_DO_SAI:{cb:"TT 99/2025/TT-BTC (áp dụng năm tài chính bắt đầu từ 01/01/2026, thay TT 200/2014); TT 133/2016/TT-BTC Đ2 (DNNVV được lựa chọn)",why:"Lập BCTC sai chế độ kế toán của năm làm sai mẫu biểu và hệ thống tài khoản.",fix:"Chọn đúng chế độ theo năm tài chính; chuyển đổi số dư theo hướng dẫn chuyển tiếp TT 99."}
};
const pct=x=>fx(x*100,x*100%1?1:0).replace(/,0$/,"")+"%";
function polFmt(k,v){if(v===true)return"Có áp dụng";if(v===false)return k==="vat8"?"Không giảm (10%)":"Không áp dụng";if(v==null)return"—";
 if(Array.isArray(v)){if(v.length&&Array.isArray(v[0]))return v.map(([c,r])=>`${pct(r)}${c===Infinity?" phần còn lại":` đến ${fm(c/1e6)} tr`}`).join(" · ");return v.map((x,i)=>`V${["I","II","III","IV"][i]||i+1} ${typeof x==="number"?fx(x/1e6,2).replace(/,?0+$/,"")+" tr":x}`).join(" · ")}
 if(typeof v==="object"){const N={bhxh:"BHXH",bhyt:"BHYT",bhtn:"BHTN",tnld:"TNLĐ",kpcd:"KPCĐ"};const t=Object.values(v).filter(x=>typeof x==="number").reduce((a,b)=>a+b,0);return Object.entries(v).map(([a,b])=>`${N[a]||a} ${typeof b==="number"?pct(b):b}`).join(" · ")+(t?` (tổng ${pct(t)})`:"")}
 if(typeof v==="number"){if(k==="late_rate")return fx(v*100,2)+"%/ngày";if(v<1)return pct(v);if(v>=1e5)return fm(v)+" đ";return fm(v)}return String(v)}
function polAt(key,date){const L=POLICY[key];if(!L)return null;const d=date||`${S.meta.nam}-12-31`;return L.find(p=>p.from<=d&&(!p.to||d<=p.to))||null}
function pol(key,date){const p=polAt(key,date);return p?p.v:null}
function periodRange(){const M=S.meta,y=+M.nam||2025;if(M.ky==="q"){const q=+M.quy||4;return[`${y}-${String(q*3-2).padStart(2,"0")}-01`,`${y}-${String(q*3).padStart(2,"0")}-${[31,30,30,31][q-1]}`]}if(M.ky==="6t")return[`${y}-01-01`,`${y}-06-30`];if(M.ky==="9t")return[`${y}-01-01`,`${y}-09-30`];return[`${y}-01-01`,`${y}-12-31`]}
function policyView(){
 const[a,b]=periodRange();const rows=[],warns=[];
 const vf=polFmt;
 for(const[k,list]of Object.entries(POLICY)){
  const act=[];list.filter(p=>p.from<=b&&(!p.to||p.to>=a)).forEach(p=>{const l=act[act.length-1];if(l&&JSON.stringify(l.v)===JSON.stringify(p.v))act[act.length-1]={...l,to:p.to,doc:l.doc+"; "+p.doc};else act.push(p)});
  if(!act.length){if(k==="vat8")rows.push({k,n:POL_NAME[k],v:"Không áp dụng trong kỳ",doc:"",lv:"",parts:[]});continue}
  rows.push({k,n:POL_NAME[k]||k,parts:act.map(p=>({from:p.from>a?p.from:a,to:p.to&&p.to<b?p.to:b,v:vf(k,p.v),doc:p.doc,lv:p.lv}))});
  if(act.length>1){const chg=act.slice(1).map(p=>fd(p.from));warns.push({sev:["vat_cash","cit_cash","pit_self","pit_dep","pit_br","pit_casual","pit_meal","min_wage1","base_wage","vat8","cit_rate","pit_period"].includes(k)?"TY":"NHO",t:`Giao thoa: ${POL_NAME[k]||k} thay đổi trong kỳ (${chg.join(", ")})`,d:act.map(p=>`${fd(p.from>a?p.from:a)}–${fd(p.to&&p.to<b?p.to:b)}: ${vf(k,p.v)} (${p.doc})`).join("; "),kn:k==="vat_cash"||k==="cit_cash"?"Xác định ngưỡng theo ngày lập hóa đơn của từng giao dịch; app đã tự áp ngưỡng theo ngày.":k==="vat8"?"Đối chiếu thuế suất trên từng hóa đơn với thời điểm lập hóa đơn và danh mục hàng không được giảm.":k==="pit_self"||k==="pit_dep"||k==="pit_br"?"Tính thuế TNCN từng tháng theo mức của tháng chi trả; quyết toán năm theo hướng dẫn của năm đó.":"Áp dụng quy định theo thời điểm phát sinh nghĩa vụ; kiểm tra mẫu biểu, chỉ tiêu theo văn bản mới.",cb:act.map(p=>p.doc).join(" → "),cat:"cs",code:"GIAO_THOA"})}
  else{const p=act[0];if(p.from>a&&p.from<=b)0;else if(p.from.slice(0,4)===String(S.meta.nam)&&p.from.endsWith("-01-01")&&S.meta.ky==="nam"&&p.from>"2025"&&!list.some(q=>q.to&&q.to<p.from&&JSON.stringify(q.v)===JSON.stringify(p.v)&&(new Date(p.from)-new Date(q.to))<=2*864e5))warns.push({sev:"NHO",t:`Năm đầu áp dụng: ${POL_NAME[k]||k}`,d:`${vf(k,p.v)} – ${p.doc}`,kn:"Kiểm tra số liệu chuyển tiếp từ năm trước và mẫu biểu mới.",cb:p.doc,cat:"cs",code:"NAM_DAU"})}
 }
 // chế độ kế toán so với năm
 const y=+S.meta.nam,cd=S.meta.cheDo;
 if(cd==="tt200"&&y>=2026)warns.unshift({sev:"NT",t:"Chọn TT 200 cho năm tài chính từ 2026",d:"TT 99/2025/TT-BTC thay thế TT 200/2014 từ năm tài chính bắt đầu 01/01/2026.",kn:"Chuyển sang TT 99 (hoặc TT 133 nếu đủ điều kiện DN nhỏ và vừa); chuyển đổi số dư tài khoản theo hướng dẫn chuyển tiếp.",cb:"TT 99/2025/TT-BTC",cat:"cs",code:"CHE_DO_SAI"});
 if(cd==="tt99"&&y<2026)warns.unshift({sev:"TY",t:"Chọn TT 99 cho năm tài chính trước 2026",d:"TT 99/2025 áp dụng từ năm tài chính 2026; năm "+y+" lập BCTC theo TT 200 (hoặc TT 133).",kn:"Kiểm tra lại chế độ kế toán đã đăng ký áp dụng.",cb:"TT 99/2025/TT-BTC",cat:"cs",code:"CHE_DO_SAI"});
 if(y===2026&&cd!=="tt133")warns.push({sev:"TY",t:"Năm chuyển đổi TT 200 → TT 99",d:"Số dư đầu năm 2026 phải chuyển từ hệ thống tài khoản TT 200 sang TT 99; mẫu BCTC đổi tên, đổi mã chỉ tiêu.",kn:"Đối chiếu bảng chuyển đổi số dư; kiểm tra số đầu năm trên BCTC 2026 khớp số cuối năm 2025 sau chuyển đổi.",cb:"TT 99/2025/TT-BTC – điều khoản chuyển tiếp",cat:"cs",code:"GIAO_THOA"});
 POLICY_NOTES.filter(n=>n.from<=b&&(!n.to||n.to>=a)).forEach(n=>warns.push({sev:n.sev||"NHO",t:n.t,d:n.d,kn:n.kn||"",cb:n.cb||"",cat:"cs",code:"GIAO_THOA"}));
 return{rows,warns,range:[a,b]};
}
function pitTax(tntt,date){const br=pol("pit_br",date)||POLICY.pit_br[0].v;let t=0,lo=0;for(const[hi,r]of br){if(tntt<=lo)break;t+=(Math.min(tntt,hi)-lo)*r;lo=hi}return Math.round(t)}
const I=1e99;
const TH={
 CS01:[[10,"warn","Thấp"],[30,"ok","Trung bình"],[I,"good","Cao"]],
 CS02:[[0,"bad","Âm"],[5,"warn","Thấp"],[15,"ok","Trung bình"],[I,"good","Cao"]],
 CS03:[[0,"bad","Lỗ"],[3,"warn","Thấp"],[10,"ok","Trung bình"],[I,"good","Cao"]],
 CS04:[[0,"bad","Lỗ"],[2,"warn","Thấp"],[8,"ok","Trung bình"],[I,"good","Cao"]],
 CS05:[[0,"bad","Âm"],[8,"warn","Thấp"],[20,"good","Tốt"],[I,"good","Xuất sắc"]],
 CS06:[[0,"bad","Âm"],[3,"warn","Thấp"],[8,"good","Tốt"],[I,"good","Xuất sắc"]],
 CS07:[[0,"bad","Âm"],[8,"warn","Dưới chi phí vốn"],[I,"good","Tạo giá trị"]],
 CS08:[[60,"good","Tốt"],[80,"ok","Bình thường"],[100,"warn","Cảnh báo"],[I,"bad","Bán dưới giá vốn"]],
 CS09:[[1,"bad","Rủi ro"],[2,"ok","Ổn"],[I,"good","Tốt"]],
 CS10:[[0.5,"bad","Rủi ro"],[1,"ok","Ổn"],[I,"good","Tốt"]],
 CS11:[[0.1,"warn","Thấp"],[0.3,"ok","Ổn"],[I,"good","Tốt"]],
 CS12:[[0,"bad","Âm"],[I,"good","Dương"]],
 CS13:[[I,"info","Tùy ngành"]],
 CS14:[[0,"bad","VCSH âm"],[1,"good","Thấp"],[2,"ok","Trung bình"],[I,"warn","Cao"]],
 CS15:[[0.4,"good","Thấp"],[0.6,"ok","Trung bình"],[1,"warn","Cao"],[I,"bad","Nợ vượt tài sản"]],
 CS16:[[0,"bad","VCSH âm"],[0.5,"good","Thấp"],[1,"ok","Trung bình"],[I,"warn","Cao"]],
 CS17:[[1.5,"bad","Nguy hiểm"],[3,"warn","Cảnh báo"],[5,"ok","Ổn"],[I,"good","Tốt"]],
 CS18:[[I,"info","Tham khảo"]],
 CS19:[[80,"ok","Bình thường"],[I,"warn","Áp lực đáo hạn"]],
 CS20:[[0.5,"warn","Thấp"],[1.5,"ok","Trung bình"],[I,"good","Tốt"]],
 CS21:[[I,"info","Tham khảo"]],
 CS22:[[3,"warn","Chậm"],[8,"ok","Bình thường"],[I,"good","Nhanh"]],
 CS23:[[45,"good","Nhanh"],[90,"ok","Bình thường"],[I,"warn","Chậm"]],
 CS24:[[I,"info","Tham khảo"]],
 CS25:[[30,"good","Nhanh"],[60,"ok","Bình thường"],[I,"warn","Chậm"]],
 CS26:[[I,"info","Tham khảo"]],
 CS27:[[0,"bad","Âm"],[5,"warn","Cảnh báo"],[15,"ok","Bình thường"],[I,"good","Tốt"]],
 CS28:[[0,"bad","Âm"],[10,"warn","Rủi ro"],[30,"ok","Ổn"],[I,"good","Tốt"]],
 CS29:[[0,"warn","Âm"],[I,"good","Dương"]],
 CS30:[[0,"bad","Âm"],[0.5,"warn","Lợi nhuận chưa chuyển thành tiền"],[1.5,"ok","Bình thường"],[I,"good","Mạnh"]],
 CS31:[[1,"info","Thu hẹp"],[2,"info","Duy trì"],[I,"info","Mở rộng"]],
 CS32:[[-20,"warn","Giảm mạnh"],[0,"info","Giảm"],[20,"good","Tăng"],[I,"warn","Tăng đột biến"]],
 CS33:[[-20,"warn","Giảm mạnh"],[0,"info","Giảm"],[20,"good","Tăng"],[I,"info","Tăng mạnh"]],
 CS34:[[-30,"warn","Giảm mạnh"],[0,"info","Giảm"],[30,"good","Tăng"],[I,"info","Tăng mạnh"]],
 CS35:[[-20,"warn","Thu hẹp mạnh"],[0,"info","Giảm"],[30,"good","Tăng"],[I,"info","Tăng mạnh"]]
};
const MTH={
 tm:{CS01:[[5,"bad","Rất thấp"],[8,"warn","Thấp"],[25,"good","Phù hợp ngành"],[I,"warn","Cao bất thường"]],CS20:[[1,"warn","Thấp"],[2,"ok","Trung bình"],[I,"good","Tốt"]],CS23:[[30,"good","Nhanh"],[90,"ok","Bình thường"],[150,"warn","Chậm"],[I,"bad","Ứ đọng"]]},
 dv:{CS01:[[15,"warn","Thấp"],[25,"ok","Trung bình"],[60,"good","Tốt"],[I,"warn","Cao bất thường"]],CS23:[[30,"good","Ít dở dang"],[60,"ok","Cần theo dõi"],[I,"warn","Dở dang lớn"]]},
 sx:{CS01:[[10,"warn","Thấp"],[20,"ok","Trung bình"],[40,"good","Tốt"],[I,"warn","Cao bất thường"]],CS23:[[60,"good","Nhanh"],[120,"ok","Bình thường"],[180,"warn","Chậm"],[I,"bad","Ứ đọng"]],CS20:[[0.6,"warn","Thấp"],[1.2,"ok","Trung bình"],[I,"good","Tốt"]]},
 xd:{CS01:[[5,"bad","Rất thấp"],[10,"warn","Thấp"],[20,"good","Phù hợp ngành"],[I,"warn","Cao bất thường"]],CS23:[[90,"ok","Bình thường"],[180,"warn","Dở dang dài"],[I,"bad","Tồn đọng"]],CS25:[[60,"good","Nhanh"],[120,"ok","Bình thường"],[I,"warn","Chậm"]],CS20:[[0.5,"warn","Thấp"],[1,"ok","Trung bình"],[I,"good","Tốt"]]},
 nh:{CS01:[[30,"warn","Thấp"],[55,"ok","Trung bình"],[75,"good","Tốt"],[I,"warn","Cao bất thường"]],CS23:[[7,"good","Nhanh"],[15,"ok","Bình thường"],[I,"warn","Tồn nguyên liệu lâu"]],CS25:[[7,"good","Nhanh"],[20,"ok","Bình thường"],[I,"warn","Cao bất thường"]]},
 ks:{CS01:[[20,"warn","Thấp"],[40,"ok","Trung bình"],[I,"good","Tốt"]],CS20:[[0.2,"warn","Thấp"],[0.5,"ok","Trung bình"],[I,"good","Tốt"]],CS25:[[15,"good","Nhanh"],[45,"ok","Bình thường"],[I,"warn","Chậm"]],CS23:[[15,"good","Thấp"],[30,"ok","Bình thường"],[I,"warn","Cao"]]},
 vt:{CS01:[[8,"warn","Thấp"],[20,"ok","Trung bình"],[I,"good","Tốt"]],CS23:[[15,"good","Thấp"],[30,"ok","Bình thường"],[I,"warn","Cao"]]},
 dl:{CS01:[[5,"warn","Thấp"],[15,"ok","Trung bình"],[35,"good","Tốt"],[I,"warn","Cao bất thường"]],CS23:[[30,"good","Ít dở dang"],[60,"ok","Theo dõi"],[I,"warn","Dở dang lớn"]]}
};
function th(id){return(MTH[S.meta.loai]||{})[id]||TH[id]}
function rate(id,x){if(x==null||!isFinite(x))return null;const t=th(id);for(const[c,lv,l]of t){if(x<c)return{lv,l}}return null}
const ann=()=>AN();
const EBIT=s=>{const a=val("LNTT",s);if(a==null)return null;return a+(val("LAI_VAY",s)||0)};
const TEFF=s=>{const a=val("LNTT",s),t=val("THUE",s);return a!=null&&a>0&&t!=null?t/a:null};
const gro=k=>{const t=val(k,"T"),p=val(k,"P");if(t==null||p==null||p===0)return null;return(t-p)/Math.abs(p)*100};
const R=[
 ["CS01",0,"Biên lợi nhuận gộp","%",s=>pc(val("LNG",s),val("DThu",s)),0,"{LNG}/{DThu}*100",x=>`Mỗi 100 đồng doanh thu thuần còn lại ${fx(x)} đồng lãi gộp sau giá vốn.`],
 ["CS02",0,"Biên lợi nhuận HĐKD","%",s=>pc(val("LNHDKD",s),val("DThu",s)),0,"{LNHDKD}/{DThu}*100",x=>`Hoạt động kinh doanh chính tạo ${fx(x)} đồng lợi nhuận trên 100 đồng doanh thu.`],
 ["CS03",0,"Biên lợi nhuận trước thuế","%",s=>pc(val("LNTT",s),val("DThu",s)),0,"{LNTT}/{DThu}*100",x=>`Lợi nhuận trước thuế bằng ${fx(x)}% doanh thu thuần.`],
 ["CS04",0,"Biên lợi nhuận ròng","%",s=>pc(val("LNST",s),val("DThu",s)),0,"{LNST}/{DThu}*100",x=>`Sau mọi chi phí và thuế, 100 đồng doanh thu còn ${fx(x)} đồng lợi nhuận.`],
 ["CS05",0,"ROE (năm hóa)","%",s=>s==="P"?null:(val("VCSH","T")!=null&&avg("VCSH")<=0?null:__nhanNam(pc(val("LNST",s),avg("VCSH")))),1,"{LNST}/(({VCSH}+{VCSH_P})/2)*365/{N}*100",x=>`Mỗi 100 đồng vốn chủ bình quân sinh ra ${fx(x)} đồng lợi nhuận mỗi năm.`],
 ["CS06",0,"ROA (năm hóa)","%",s=>s==="P"?null:__nhanNam(pc(val("LNST",s),avg("TONG_TS"))),1,"{LNST}/(({TONG_TS}+{TONG_TS_P})/2)*365/{N}*100",x=>`Mỗi 100 đồng tài sản bình quân tạo ${fx(x)} đồng lợi nhuận mỗi năm.`],
 ["CS07",0,"ROIC (năm hóa)","%",s=>{if(s==="P")return null;const e=EBIT("T");if(e==null)return null;const ic=(avg("VCSH")||0)+(avg("VAY_NH")||0)+(avg("VAY_DH")||0);if(!ic||ic<=0)return null;return e*(1-(TEFF("T")??0.2))/ic*ann()*100},1,"({LNTT}+{LAI_VAY})*(1-IFERROR({THUE}/{LNTT},0.2))/((({VCSH}+{VCSH_P})+({VAY_NH}+{VAY_NH_P})+({VAY_DH}+{VAY_DH_P}))/2)*365/{N}*100",x=>`Vốn đầu tư (vốn chủ + vay) tạo lợi nhuận hoạt động sau thuế ${fx(x)}%/năm.`],
 ["CS08",0,"Hệ số giá vốn","%",s=>pc(val("GVHB",s),val("DThu",s)),0,"{GVHB}/{DThu}*100",x=>`Giá vốn chiếm ${fx(x)}% doanh thu thuần.`],
 ["CS09",1,"Hệ số thanh toán hiện hành","x",s=>dv(val("TSNH",s),val("NO_NH",s)),0,"{TSNH}/{NO_NH}",x=>`Mỗi đồng nợ ngắn hạn được đảm bảo bởi ${fx(x,2)} đồng tài sản ngắn hạn.`],
 ["CS10",1,"Hệ số thanh toán nhanh","x",s=>{const a=val("TSNH",s);return a==null?null:dv(a-(val("HTK",s)||0),val("NO_NH",s))},0,"({TSNH}-{HTK})/{NO_NH}",x=>`Không tính hàng tồn kho, tài sản ngắn hạn bằng ${fx(x,2)} lần nợ ngắn hạn.`],
 ["CS11",1,"Hệ số thanh toán tiền mặt","x",s=>dv(val("TIEN",s),val("NO_NH",s)),0,"{TIEN}/{NO_NH}",x=>`Tiền hiện có trả ngay được ${fx(x*100,0)}% nợ ngắn hạn.`],
 ["CS12",1,"Vốn lưu động ròng","m",s=>{const a=val("TSNH",s),b=val("NO_NH",s);return a==null||b==null?null:a-b},0,"{TSNH}-{NO_NH}",x=>x<0?`Nợ ngắn hạn vượt tài sản ngắn hạn ${compact(-x)}: đang dùng nợ ngắn hạn tài trợ tài sản dài hạn.`:`Tài sản ngắn hạn vượt nợ ngắn hạn ${compact(x)}.`],
 ["CS13",1,"Tiền / Tài sản ngắn hạn","%",s=>pc(val("TIEN",s),val("TSNH",s)),0,"{TIEN}/{TSNH}*100",x=>`Tiền chiếm ${fx(x)}% tài sản ngắn hạn.`],
 ["CS14",2,"Nợ / Vốn chủ (D/E)","x",s=>{const e=val("VCSH",s);if(e!=null&&e<=0)return-1;return dv(val("TONG_NO",s),e)},0,"{TONG_NO}/{VCSH}",x=>x<0?"Vốn chủ sở hữu âm, hệ số không có ý nghĩa.":`Mỗi đồng vốn chủ đang gánh ${fx(x,2)} đồng nợ phải trả.`],
 ["CS15",2,"Nợ / Tổng tài sản","x",s=>dv(val("TONG_NO",s),val("TONG_TS",s)),0,"{TONG_NO}/{TONG_TS}",x=>`${fx(x*100,0)}% tài sản được tài trợ bằng nợ.`],
 ["CS16",2,"Nợ dài hạn / Vốn chủ","x",s=>{const e=val("VCSH",s);if(e!=null&&e<=0)return-1;return dv(val("NO_DH",s),e)},0,"{NO_DH}/{VCSH}",x=>x<0?"Vốn chủ âm.":`Nợ dài hạn bằng ${fx(x,2)} lần vốn chủ.`],
 ["CS17",2,"Khả năng trả lãi vay (ICR)","x",s=>{const l=val("LAI_VAY",s);if(!l)return null;return dv(EBIT(s),l)},0,"({LNTT}+{LAI_VAY})/{LAI_VAY}",x=>`Lợi nhuận trước lãi vay và thuế gấp ${fx(x,2)} lần chi phí lãi vay.`],
 ["CS18",2,"Hệ số nhân vốn chủ","x",s=>{const e=val("VCSH",s);if(e!=null&&e<=0)return null;return dv(val("TONG_TS",s),e)},0,"{TONG_TS}/{VCSH}",x=>`Tổng tài sản gấp ${fx(x,2)} lần vốn chủ.`],
 ["CS19",2,"Nợ ngắn hạn / Tổng nợ","%",s=>pc(val("NO_NH",s),val("TONG_NO",s)),0,"{NO_NH}/{TONG_NO}*100",x=>`${fx(x,0)}% nợ phải trả đến hạn trong 12 tháng.`],
 ["CS20",3,"Vòng quay tổng tài sản","x",s=>s==="P"?null:mul(dv(val("DThu",s),avg("TONG_TS")),ann()),1,"{DThu}/(({TONG_TS}+{TONG_TS_P})/2)*365/{N}",x=>`Mỗi đồng tài sản tạo ${fx(x,2)} đồng doanh thu một năm.`],
 ["CS21",3,"Vòng quay tài sản ngắn hạn","x",s=>s==="P"?null:mul(dv(val("DThu",s),avg("TSNH")),ann()),1,"{DThu}/(({TSNH}+{TSNH_P})/2)*365/{N}",x=>`Tài sản ngắn hạn quay ${fx(x,2)} vòng mỗi năm.`],
 ["CS22",3,"Vòng quay hàng tồn kho","x",s=>s==="P"?null:mul(dv(val("GVHB",s),avg("HTK")),ann()),1,"{GVHB}/(({HTK}+{HTK_P})/2)*365/{N}",x=>`Hàng tồn kho quay ${fx(x,1)} vòng mỗi năm.`],
 ["CS23",3,"Số ngày tồn kho (DIO)","d",s=>{if(s==="P")return null;const g=val("GVHB",s),h=avg("HTK");if(!g||h==null)return null;return N()/(g/h)},1,"(({HTK}+{HTK_P})/2)/{GVHB}*{N}",x=>`Hàng tồn kho bình quân nằm trong kho khoảng ${fx(x,0)} ngày trước khi thành giá vốn.`],
 ["CS24",3,"Vòng quay phải thu","x",s=>s==="P"?null:mul(dv(val("DThu",s),avg("PTHU")),ann()),1,"{DThu}/(({PTHU}+{PTHU_P})/2)*365/{N}",x=>`Phải thu ngắn hạn quay ${fx(x,1)} vòng mỗi năm.`],
 ["CS25",3,"Kỳ thu tiền bình quân (DSO)","d",s=>{if(s==="P")return null;const d=val("DThu",s),h=avg("PTHU");if(!d||h==null)return null;return N()/(d/h)},1,"(({PTHU}+{PTHU_P})/2)/{DThu}*{N}",x=>`Bình quân mất khoảng ${fx(x,0)} ngày để thu tiền bán hàng.`],
 ["CS26",3,"TSCĐ / Tổng tài sản","%",s=>pc(val("TSCD",s),val("TONG_TS",s)),0,"{TSCD}/{TONG_TS}*100",x=>`Tài sản cố định chiếm ${fx(x)}% tổng tài sản.`],
 ["CS27",4,"Dòng tiền HĐKD / Doanh thu","%",s=>pc(val("CFO",s),val("DThu",s)),0,"{CFO}/{DThu}*100",x=>`100 đồng doanh thu mang về ${fx(x)} đồng tiền thuần từ kinh doanh.`],
 ["CS28",4,"Dòng tiền HĐKD / Nợ ngắn hạn","%",s=>pc(val("CFO",s),val("NO_NH",s)),0,"{CFO}/{NO_NH}*100",x=>`Tiền từ kinh doanh trong kỳ trả được ${fx(x,0)}% nợ ngắn hạn.`],
 ["CS29",4,"Dòng tiền tự do (FCF)","m",s=>{const c=val("CFO",s);if(c==null)return null;return c-Math.abs(val("CAPEX",s)||0)},0,"{CFO}-ABS({CAPEX})",x=>x<0?`Sau đầu tư TSCĐ, doanh nghiệp thiếu ${compact(-x)} tiền, phải bù bằng vay hoặc vốn.`:`Sau đầu tư TSCĐ còn dư ${compact(x)} tiền.`],
 ["CS30",4,"Chất lượng lợi nhuận (CFO/LNST)","x",s=>{const l=val("LNST",s);if(l==null||l<=0)return null;return dv(val("CFO",s),l)},0,"{CFO}/{LNST}",x=>`Mỗi đồng lợi nhuận sau thuế đi kèm ${fx(x,2)} đồng tiền thực thu từ kinh doanh.`],
 ["CS31",4,"Chi đầu tư / Khấu hao","x",s=>{const k=val("KHAU_HAO",s);if(!k)return null;return dv(Math.abs(val("CAPEX",s)||0),k)},0,"ABS({CAPEX})/{KHAU_HAO}",x=>`Chi mua sắm TSCĐ bằng ${fx(x,2)} lần khấu hao trong kỳ.`],
 ["CS32",5,"Tăng trưởng doanh thu","%",s=>s==="P"?null:gro("DThu"),1,"({DThu}-{DThu_P})/ABS({DThu_P})*100",x=>`Doanh thu thuần ${x>=0?"tăng":"giảm"} ${fx(Math.abs(x))}% so với cùng kỳ.`],
 ["CS33",5,"Tăng trưởng lợi nhuận gộp","%",s=>s==="P"?null:gro("LNG"),1,"({LNG}-{LNG_P})/ABS({LNG_P})*100",x=>`Lợi nhuận gộp ${x>=0?"tăng":"giảm"} ${fx(Math.abs(x))}%.`],
 ["CS34",5,"Tăng trưởng lợi nhuận sau thuế","%",s=>{if(s==="P")return null;const t=val("LNST","T"),p=val("LNST","P");if(t!=null&&p!=null&&Math.sign(t)!==Math.sign(p)&&p!==0)return null;return gro("LNST")},1,"({LNST}-{LNST_P})/ABS({LNST_P})*100",x=>`Lợi nhuận sau thuế ${x>=0?"tăng":"giảm"} ${fx(Math.abs(x))}%.`],
 ["CS35",5,"Tăng trưởng tổng tài sản","%",s=>s==="P"?null:gro("TONG_TS"),1,"({TONG_TS}-{TONG_TS_P})/ABS({TONG_TS_P})*100",x=>`Tổng tài sản cuối kỳ ${x>=0?"tăng":"giảm"} ${fx(Math.abs(x))}% so với đầu năm.`]
].map(a=>({id:a[0],g:a[1],n:a[2],u:a[3],f:a[4],avg:!!a[5],xf:a[6],m:a[7]}));
function pc(a,b){const x=dv(a,b);return x==null?null:x*100}
function mul(a,b){return a==null?null:a*b}
function naReason(r){
 if(r.id==="CS14"||r.id==="CS16"){if((val("VCSH","T")??1)<=0)return"Vốn chủ âm"}
 if(r.id==="CS05"&&(val("VCSH","T")??1)<=0)return"Vốn chủ âm";
 if(r.id==="CS30"&&(val("LNST","T")??1)<=0)return"LNST ≤ 0";
 if(r.id==="CS17"&&!val("LAI_VAY","T"))return"Không có lãi vay";
 if(r.id==="CS34"){const t=val("LNST","T"),p=val("LNST","P");if(t!=null&&p!=null&&Math.sign(t)!==Math.sign(p))return t>0?"Chuyển chiều: lỗ → lãi":"Chuyển chiều: lãi → lỗ"}
 if(r.id==="CS31"&&!val("KHAU_HAO","T"))return"Thiếu khấu hao (LCTT trực tiếp?)";
 return"Thiếu số liệu";
}
function calcRatios(){
 derived.clear();
 return R.map(r=>{let t=r.f("T");if(t!=null&&!isFinite(t))t=null;if((r.id==="CS14"||r.id==="CS16")&&t===-1)t=null;let p=r.avg?null:r.f("P");if(p===-1||(p!=null&&!isFinite(p)))p=null;
  const rt=rate(r.id,t);return{...r,t,p,rt,na:t==null?naReason(r):null}});
}
function modelKPIs(){
 const L=S.meta.loai,n=N(),out=[];
 const add=(n_,x,u,ev,m)=>{if(x==null||!isFinite(x))return;out.push({n:n_,x,u,ev:ev?ev(x):null,m})};
 const band=(x,cuts)=>{for(const[c,lv,l]of cuts)if(x<c)return{lv,l};return null};
 const dio=(()=>{const g=val("GVHB","T"),h=avg("HTK");return g&&h!=null?h/g*n:null})();
 const dso=(()=>{const d=val("DThu","T"),h=avg("PTHU");return d&&h!=null?h/d*n:null})();
 const dpo=(()=>{const g=val("GVHB","T"),h=avg("PTNB");return g&&h!=null?h/g*n:null})();
 if(dpo!=null)add("Số ngày trả tiền người bán (DPO)",dpo,"d",x=>band(x,[[30,"ok","Trả nhanh"],[90,"good","Bình thường"],[180,"warn","Chiếm dụng lâu"],[I,"bad","Nợ NCC quá dài"]]),"Bình quân số ngày từ khi ghi nhận giá vốn đến khi trả tiền người bán.");
 if(dio!=null&&dso!=null&&dpo!=null)add("Chu kỳ chuyển đổi tiền (CCC)",dio+dso-dpo,"d",x=>band(x,[[0,"good","Được NCC tài trợ"],[60,"good","Ngắn"],[120,"ok","Trung bình"],[I,"warn","Dài – cần vốn lưu động lớn"]]),"DIO + DSO − DPO: số ngày vốn bị chôn trong chu kỳ kinh doanh.");
 const ql=val("QUY_LUONG","T"),dt=val("DThu","T"),ld=val("SO_LD","T");
 if(ql!=null&&dt)add("Chi phí lương / Doanh thu",ql/dt*100,"%",null,"Tỷ trọng tiền lương, tiền công trên doanh thu thuần.");
 if(dt&&ld)add("Doanh thu bình quân / lao động (năm)",dt/ld*AN(),"m",null,"Năng suất doanh thu của một lao động bình quân.");
 const c621=val("CP621","T"),c622=val("CP622","T"),c623=val("CP623","T"),c627=val("CP627","T");
 const tot=[c621,c622,c623,c627].reduce((t,x)=>t+(x||0),0);
 if(MODELS[L].gt&&tot>0){
  if(c621!=null)add("Tỷ trọng CP NVL trực tiếp / tổng CP sản xuất",c621/tot*100,"%",null,"Cơ cấu giá thành: nguyên vật liệu.");
  if(c622!=null)add("Tỷ trọng CP nhân công trực tiếp",c622/tot*100,"%",null,"Cơ cấu giá thành: nhân công.");
  if(c623)add("Tỷ trọng CP máy thi công",c623/tot*100,"%",null,"Cơ cấu giá thành: máy thi công.");
  if(c627!=null)add("Tỷ trọng CP sản xuất chung",c627/tot*100,"%",(L==="sx"||L==="xd")&&(x=>band(x,[[25,"good","Hợp lý"],[40,"ok","Cao"],[I,"warn","Rất cao – kiểm tra phân bổ"]])),"SXC lớn thường do phân bổ chưa hợp lý hoặc dưới công suất.");
 }
 const dd=val("CPDD","T");
 if(L==="sx"){
  const h=val("HTK","T");if(dd!=null&&h)add("Dở dang 154 / Hàng tồn kho",dd/h*100,"%",x=>band(x,[[30,"good","Bình thường"],[60,"ok","Cao"],[I,"warn","Dở dang tồn đọng"]]),"154 lớn so với kho có thể là chi phí chưa kết chuyển giá thành.");
  const z=val("Z_HT","T"),g=val("GVHB","T");if(z&&g)add("Giá vốn / Giá thành hoàn thành",g/z*100,"%",x=>band(x,[[70,"warn","Tồn TP tăng mạnh"],[130,"good","Cân đối"],[I,"warn","Xuất vượt nhập – kiểm tra tồn TP"]]),"So sánh giá vốn xuất bán với giá thành nhập kho trong kỳ.");
 }
 if(L==="xd"){
  const ts=val("TONG_TS","T"),g=val("GVHB","T");
  if(dd!=null&&ts)add("Dở dang 154 / Tổng tài sản",dd/ts*100,"%",x=>band(x,[[30,"good","Bình thường"],[50,"ok","Cao"],[I,"warn","Rất cao"]]),"Chi phí công trình chưa nghiệm thu, chưa kết chuyển giá vốn.");
  if(dd!=null&&g)add("Số tháng giá vốn đang dở dang",dd/(g/(n/30.4)),"t",x=>band(x,[[6,"good","Bình thường"],[12,"ok","Dài"],[I,"warn","Tồn đọng > 12 tháng"]]),"Số dư 154 tương đương bao nhiêu tháng giá vốn bình quân.");
  const nm=val("NMTT","T");if(nm!=null&&dd)add("Tiền khách ứng trước / Dở dang 154",nm/dd*100,"%",null,"Mức độ chủ đầu tư ứng tiền cho phần việc đang thi công.");
 }
 if(L==="nh"||L==="ks"){
  const nl=val("CP_NL","T"),au=val("DT_AU","T");
  if(nl!=null&&au)add("Food cost – CP nguyên liệu / DT ăn uống",nl/au*100,"%",x=>band(x,[[20,"warn","Thấp bất thường"],[28,"good","Tốt"],[38,"ok","Chấp nhận"],[I,"warn","Cao – kiểm tra định mức"]]),"Chuẩn ngành ăn uống thường 28–35%.");
  if(L==="nh"&&nl!=null&&ql!=null&&dt)add("Prime cost – (NL + lương) / Doanh thu",(nl+ql)/dt*100,"%",x=>band(x,[[55,"good","Tốt"],[65,"ok","Chấp nhận"],[I,"warn","Cao"]]),"Chi phí chính của nhà hàng; nên dưới 65%.");
  const ch=val("SO_CHO","T");if(L==="nh"&&ch&&au)add("Doanh thu ăn uống / chỗ ngồi / ngày",au/ch/n,"m",null,"Hiệu suất khai thác chỗ ngồi.");
 }
 if(L==="ks"){
  const p=val("SO_PHONG","T"),b=val("DEM_BAN","T"),r=val("DT_PHONG","T");
  if(p&&b!=null)add("Công suất phòng (OCC)",b/(p*n)*100,"%",x=>band(x,[[40,"warn","Thấp"],[65,"ok","Trung bình"],[95,"good","Tốt"],[I,"warn","Bất thường > 95%"]]),"Số đêm phòng bán / (số phòng × số ngày).");
  if(r&&b)add("Giá phòng bình quân (ADR)",r/b,"m",null,"Doanh thu phòng / số đêm phòng bán.");
  if(r&&p)add("RevPAR",r/(p*n),"m",null,"Doanh thu phòng trên mỗi phòng sẵn có mỗi ngày.");
  if(r&&dt)add("Tỷ trọng doanh thu phòng",r/dt*100,"%",null,"Cơ cấu doanh thu lưu trú.");
  const kh=val("KHAU_HAO","T");if(kh&&dt)add("Khấu hao / Doanh thu",kh/dt*100,"%",null,"Khách sạn thâm dụng tài sản, khấu hao thường lớn.");
 }
 if(L==="vt"){
  const nl=val("CP_NHIENLIEU","T");if(nl!=null&&dt)add("Chi phí nhiên liệu / Doanh thu",nl/dt*100,"%",x=>band(x,[[20,"good","Thấp"],[40,"ok","Bình thường"],[I,"warn","Cao – đối chiếu định mức"]]),"Đối chiếu với định mức tiêu hao nhiên liệu theo km.");
  const xe=val("SO_XE","T");if(xe&&dt)add("Doanh thu / phương tiện (năm)",dt/xe*AN(),"m",null,"Năng suất khai thác phương tiện.");
 }
 if((L==="dv"||L==="dl")&&dd!=null&&dt)add("Dở dang 154 / Doanh thu",dd/dt*100,"%",x=>band(x,[[10,"good","Thấp"],[25,"ok","Theo dõi"],[I,"warn","Cao – kiểm tra kết chuyển"]]),"Chi phí dịch vụ, tour đã chi chưa ghi nhận giá vốn.");
 if(L==="dl"){const nm=val("NMTT","T");if(nm!=null&&dt)add("Khách trả trước / Doanh thu",nm/dt*100,"%",null,"Tiền khách đặt tour chưa ghi nhận doanh thu; kiểm tra thời điểm xuất hóa đơn.")}
 if(L==="tm"){const g=val("HGB","T"),h=val("HTK","T");if(g!=null&&h)add("Hàng gửi bán / Hàng tồn kho",g/h*100,"%",x=>band(x,[[20,"good","Bình thường"],[I,"warn","Cao – kiểm tra biên bản, HĐ đại lý"]]),"Hàng đã xuất cho đại lý, ký gửi chưa ghi nhận doanh thu.")}
 return out;
}
function fmtK(k){return k.u==="%"?fx(k.x)+"%":k.u==="d"?fx(k.x,0)+" ngày":k.u==="t"?fx(k.x,1)+" tháng":compact(k.x)}
function balChecks(){
 const C=[],tt133=S.meta.cheDo==="tt133";
 const chk=(id,n,ls,rs,lf,rf,sides=["T","P"],grp)=>{for(const s of sides){const L=lf(s),Rv=rf(s);let st,diff=null;
   if(L==null||Rv==null)st="na";else{diff=L-Rv;const base=Math.max(Math.abs(L),Math.abs(Rv),1);st=Math.abs(diff)<=1?"ok":Math.abs(diff)/base<=0.001?"round":"fail"}
   C.push({id:id+s,n,ls,rs,s,L,R:Rv,diff,st,grp})}};
 const r=raw;
 if(!tt133)chk("B1","TSNH + TSDH = Tổng tài sản","TSNH + TSDH","Tổng TS",s=>r("TSNH",s)!=null&&r("TSDH",s)!=null?r("TSNH",s)+r("TSDH",s):null,s=>r("TONG_TS",s),undefined,"cd");
 chk("B2","Nợ phải trả + Vốn chủ = Tổng nguồn vốn","Nợ + VCSH","Tổng NV",s=>r("TONG_NO",s)!=null&&r("VCSH",s)!=null?r("TONG_NO",s)+r("VCSH",s):null,s=>r("TONG_NV",s),undefined,"cd");
 chk("B3","Tổng tài sản = Tổng nguồn vốn","Tổng TS","Tổng NV",s=>r("TONG_TS",s),s=>r("TONG_NV",s),undefined,"cd");
 if(!tt133)chk("B4","Chi tiết TSNH cộng đúng tổng","Tiền+ĐTNH+PT+HTK+khác","TSNH",s=>{const c=["TIEN","DTNH","PTHU","HTK","TSNH_KHAC"];return c.every(x=>r(x,s)==null)?null:c.reduce((t,x)=>t+(r(x,s)||0),0)},s=>r("TSNH",s),undefined,"cd");
 if(!tt133)chk("B5","Nợ ngắn hạn + Nợ dài hạn = Nợ phải trả","NNH + NDH","Nợ phải trả",s=>r("NO_NH",s)!=null&&r("NO_DH",s)!=null?r("NO_NH",s)+r("NO_DH",s):null,s=>r("TONG_NO",s),undefined,"cd");
 chk("K1","Doanh thu − Giảm trừ = Doanh thu thuần","01 − 02","10",s=>r("DT_BH",s)!=null?r("DT_BH",s)-(r("GTDT",s)||0):null,s=>r("DThu",s),undefined,"kd");
 chk("K2","Doanh thu thuần − Giá vốn = Lợi nhuận gộp","10 − 11","20",s=>r("DThu",s)!=null&&r("GVHB",s)!=null?r("DThu",s)-r("GVHB",s):null,s=>r("LNG",s),undefined,"kd");
 chk("K3","LN gộp + DTTC − CPTC − CPBH − CPQL = LN thuần HĐKD","20+21−22−25−26","30",s=>r("LNG",s)==null?null:r("LNG",s)+(r("DTTC",s)||0)-(r("CPTC",s)||0)-(r("CPBH",s)||0)-(r("CPQL",s)||0),s=>r("LNHDKD",s),undefined,"kd");
 chk("K4","Thu nhập khác − Chi phí khác = LN khác","31 − 32","40",s=>r("TN_KHAC",s)==null&&r("CP_KHAC",s)==null?null:(r("TN_KHAC",s)||0)-(r("CP_KHAC",s)||0),s=>r("LNKHAC",s),undefined,"kd");
 chk("K5","LN thuần HĐKD + LN khác = LN trước thuế","30 + 40","50",s=>r("LNHDKD",s)==null?null:r("LNHDKD",s)+(r("LNKHAC",s)||0),s=>r("LNTT",s),undefined,"kd");
 chk("K6","LN trước thuế − Thuế TNDN = LN sau thuế","50 − 51 − 52","60",s=>r("LNTT",s)==null?null:r("LNTT",s)-(r("THUE",s)||0),s=>r("LNST",s),undefined,"kd");
 chk("L1","CFO + CFI + CFF = Lưu chuyển tiền thuần","20+30+40","50",s=>r("CFO",s)!=null&&r("CFI",s)!=null&&r("CFF",s)!=null?r("CFO",s)+r("CFI",s)+r("CFF",s):null,s=>r("CF_NET",s),undefined,"lc");
 chk("L2","Tiền đầu kỳ + Lưu chuyển thuần = Tiền cuối kỳ (chưa tính CL tỷ giá)","60 + 50","70",s=>r("TIEN_DAU",s)!=null&&r("CF_NET",s)!=null?r("TIEN_DAU",s)+r("CF_NET",s):null,s=>r("TIEN_CUOI",s),["T"],"lc");
 chk("X1","Tiền cuối kỳ LCTT = Tiền trên BCĐKT cuối kỳ","LCTT 70","BCĐKT 110",s=>r("TIEN_CUOI","T"),s=>r("TIEN","T"),["T"],"x");
 chk("X2","Tiền đầu kỳ LCTT = Tiền trên BCĐKT đầu năm","LCTT 60","BCĐKT 110 đầu năm",s=>r("TIEN_DAU","T"),s=>r("TIEN","P"),["T"],"x");
 // biến động LNCPP — chỉ cảnh báo
 const lt=r("LNCPP","T"),lp=r("LNCPP","P"),st=r("LNST","T");
 let x3=null;if(lt!=null&&lp!=null&&st!=null){const d=(lt-lp)-st;x3={id:"X3T",n:"Biến động LN chưa phân phối ≈ LNST trong kỳ",ls:"421 cuối − đầu",rs:"LNST",s:"T",L:lt-lp,R:st,diff:d,st:Math.abs(d)<=1?"ok":"note",grp:"x",note:"Chênh lệch thường do chia lợi nhuận, trích quỹ, điều chỉnh hồi tố. Cần giải thích nếu có."};C.push(x3)}
 if(S.meta.ky!=="nam"){}
 return C;
}
function risks(Rt,K,C){
 const out=[],add=(sev,t,d,kn,cb,cat="tc")=>out.push({sev,t,d,kn,cb,cat});
 const v=k=>val(k,"T"),vp=k=>val(k,"P"),g=id=>Rt.find(r=>r.id===id);
 const L=S.meta.loai;
 // cân đối
 C.filter(c=>c.st==="fail").forEach(c=>add("NT",`Lệch cân đối: ${c.n} (${c.s==="T"?"kỳ này":"kỳ trước"})`,`${c.ls} = ${fm(c.L)} nhưng ${c.rs} = ${fm(c.R)}, chênh ${fm(c.diff)} ${S.meta.donVi}.`,"Đọc lại số liệu trên BCTC gốc; nếu đúng là BCTC lệch thì phải điều chỉnh trước khi nộp.","Đối chiếu nội bộ BCTC (TT200/TT133)","cd"));
 if(S.meta.ykien&&!["chua","tp","khong"].includes(S.meta.ykien)){const m={nt:"ngoại trừ",tn:"trái ngược",tc:"từ chối đưa ra ý kiến",lt:"có đoạn nhấn mạnh về hoạt động liên tục"}[S.meta.ykien];add("NT",`Ý kiến kiểm toán: ${m}`,"BCTC không được kiểm toán chấp nhận toàn phần.","Đọc kỹ cơ sở ý kiến, đánh giá ảnh hưởng tới số liệu thuế và kế hoạch xử lý.","Báo cáo kiểm toán")}
 const vc=v("VCSH");if(vc!=null&&vc<0)add("NT","Vốn chủ sở hữu âm",`Vốn chủ cuối kỳ ${compact(vc)}: nợ phải trả vượt tổng tài sản.`,"Đánh giá khả năng hoạt động liên tục; xem xét tăng vốn, chuyển nợ thành vốn; thuyết minh trên BCTC.","VAS 21; đánh giá giả định hoạt động liên tục");
 const lc=v("LNCPP"),vg=v("VON_GOP");
 if(lc!=null&&vg&&lc<0){const r=-lc/vg;if(r>=1)add("NT","Lỗ lũy kế vượt vốn góp",`Lỗ lũy kế ${compact(-lc)} bằng ${fx(r*100,0)}% vốn góp.`,"Rủi ro mất khả năng thanh toán, ngân hàng hạn chế cấp tín dụng; cần phương án tái cấu trúc.","BCĐKT mã 411, 421");else if(r>=0.5)add("TY","Lỗ lũy kế trên 50% vốn góp",`Lỗ lũy kế ${compact(-lc)} bằng ${fx(r*100,0)}% vốn góp.`,"Lập kế hoạch kinh doanh có lãi; rà soát chi phí; lưu ý doanh nghiệp lỗ kéo dài thuộc diện rủi ro cao khi CQT phân loại kiểm tra.","BCĐKT mã 411, 421")}
 const ln=v("LNST"),lnp=vp("LNST");
 if(ln!=null&&ln<0){if(lnp!=null&&lnp<0)add("NT","Lỗ 2 kỳ liên tiếp",`Kỳ này lỗ ${compact(-ln)}, cùng kỳ lỗ ${compact(-lnp)}.`,"Phân tích nguyên nhân lỗ (giá vốn, chi phí lương, lãi vay). Doanh nghiệp lỗ liên tục dễ được chọn kiểm tra quyết toán; chuẩn bị hồ sơ giải trình.","Tiêu chí rủi ro trong lựa chọn kiểm tra thuế");else add("TY","Kết quả kinh doanh lỗ",`Lỗ sau thuế ${compact(-ln)}.`,"Rà soát giá vốn, chi phí không có hóa đơn hợp lệ; xác định số lỗ được chuyển theo tờ khai 03/TNDN.","Luật Thuế TNDN – chuyển lỗ tối đa 5 năm")}
 const cfo=v("CFO");if(cfo!=null&&cfo<0&&ln>0)add("TY","Có lãi nhưng dòng tiền kinh doanh âm",`LNST ${compact(ln)} nhưng CFO ${compact(cfo)}.`,"Kiểm tra phải thu tăng, hàng tồn kho tăng, doanh thu ghi nhận chưa thu tiền; đánh giá khả năng thu hồi.","LCTT – phương pháp gián tiếp");
 const cr=g("CS09");if(cr.t!=null&&cr.t<1)add("TY","Thanh khoản ngắn hạn yếu",`Hệ số thanh toán hiện hành ${fx(cr.t,2)} < 1.`,"Lập kế hoạch dòng tiền 3 tháng; đàm phán giãn nợ hoặc chuyển vay ngắn hạn sang dài hạn.","Phân tích chỉ số");
 const ic=g("CS17");if(ic.t!=null&&ic.t<1.5)add("TY","Khả năng trả lãi vay thấp",`ICR ${fx(ic.t,2)} < 1,5.`,"Rủi ro không trả được lãi; kiểm tra khoản vay quá hạn, tài sản thế chấp.","Phân tích chỉ số");
 const de=g("CS14");if(de.t!=null&&de.t>2)add("TY","Đòn bẩy tài chính cao",`Nợ / Vốn chủ = ${fx(de.t,2)} lần.`,"Kiểm tra vay cá nhân, vay thành viên góp vốn (chứng từ, lãi suất, khấu trừ TNCN tiền lãi trả cá nhân).","Phân tích chỉ số");
 ["TIEN","PTHU","HTK","TSCD","TONG_TS","PTNB","NMTT","TIEN_MAT","CPDD","NVL","HH","TP"].forEach(k=>{const x=v(k);if(x!=null&&x<0)add("NT",`Số dư âm: ${FK[k].l}`,`Cuối kỳ ${fm(x)} ${S.meta.donVi}.`,"Số dư âm sai nguyên tắc kế toán (tồn kho âm, quỹ âm...). Rà soát thứ tự hạch toán, xuất kho trước khi nhập, chi trước khi thu.","Nguyên tắc số dư tài khoản","cd")});
 const tm=v("TIEN_MAT"),ts=v("TONG_TS");
 if(tm!=null&&ts){const r=tm/ts;if(r>0.2)add("TY","Tồn quỹ tiền mặt lớn",`Tiền mặt ${compact(tm)} bằng ${fx(r*100,0)}% tổng tài sản.`,"Kiểm kê quỹ thực tế; tồn quỹ lớn bất thường là dấu hiệu chi phí hoặc doanh thu chưa phản ánh. CQT thường yêu cầu giải trình hoặc điều chỉnh thành khoản cho vay/ thu nhập.","Rủi ro thường gặp khi kiểm tra thuế","thue");else if(r>0.1)add("NHO","Tiền mặt tồn quỹ tương đối cao",`Tiền mặt ${compact(tm)} bằng ${fx(r*100,0)}% tổng tài sản.`,"Đối chiếu biên bản kiểm kê quỹ cuối kỳ.","Kiểm kê quỹ","thue")}
 const gv=g("CS08");if(gv.t!=null&&gv.t>100)add("TY","Giá vốn lớn hơn doanh thu",`Giá vốn bằng ${fx(gv.t)}% doanh thu thuần.`,"Kiểm tra giá xuất kho, hàng bán dưới giá vốn, giá vốn ghi nhận trước doanh thu. CQT có thể ấn định giá bán nếu giá thấp bất thường.","Luật Quản lý thuế – ấn định thuế","thue");
 const gm=g("CS01");if(gm.rt&&gm.rt.l==="Cao bất thường")add("NHO","Biên lợi nhuận gộp cao bất thường so với ngành",`Biên gộp ${fx(gm.t)}% (${MODELS[L].n}).`,"Có thể thiếu giá vốn (chưa kết chuyển 154, thiếu hóa đơn đầu vào) hoặc ghi nhận doanh thu sớm. Đối chiếu sổ kho, bảng tính giá thành.","Ngưỡng tham chiếu theo loại hình");
 const dbh=v("DT_BH"),dg=v("DT_GTGT");
 if(dbh!=null&&dg!=null){const d=dbh-dg,base=Math.max(Math.abs(dbh),1);if(Math.abs(d)/base>0.01)add("TY","Doanh thu BCTC lệch doanh thu tờ khai GTGT",`BCTC (mã 01): ${fm(dbh)}; tờ khai GTGT ([34]) cộng trong kỳ: ${fm(dg)}; chênh ${fm(d)} (${fx(d/base*100)}%).`,"Lập bảng đối chiếu: doanh thu chưa xuất hóa đơn, hóa đơn xuất trước khi ghi nhận doanh thu, hàng biếu tặng/tiêu dùng nội bộ, chiết khấu, doanh thu không chịu thuế. Phần sai sót xử lý theo quy tắc khai bổ sung 01/KHBS.","Đối chiếu tờ khai 01/GTGT với sổ sách (BM04A)","thue");}
 const lt=v("LNTT"),th_=v("THUE");
 if(lt!=null&&lt>0&&th_!=null){
  const dpv=vp("DThu")??vp("DT_BH"),y=+S.meta.nam||0;
  const rate_=y>=2025&&dpv!=null?(dpv<=3e9/unitMul()?15:dpv<=50e9/unitMul()?17:20):20,hasDK=(S.dk||[]).some(d=>d.type==="tndn03");
  const eff=th_/lt*100;
  if(th_===0&&!(__SUA.B7&&__mienThueTndn()))add("TY","Có lợi nhuận nhưng không ghi nhận chi phí thuế TNDN",`LNTT ${compact(lt)}, chi phí thuế bằng 0.`,"Kiểm tra lỗ được chuyển, ưu đãi miễn giảm; nếu không có căn cứ thì đang thiếu thuế TNDN phải nộp.","Luật Thuế TNDN; tờ khai 03/TNDN","tndn");
  else if(!hasDK&&eff<rate_-2)add("NHO","Thuế suất TNDN hiệu dụng thấp hơn thuế suất áp dụng",`Thuế/LNTT = ${fx(eff)}%, thuế suất tham chiếu ${rate_}% (theo doanh thu năm trước ${dpv!=null?fm(dpv):"chưa có"}).`,"Xác định nguyên nhân: chuyển lỗ, ưu đãi, thu nhập miễn thuế. Lưu hồ sơ chứng minh.",`Thuế suất ${rate_}% tham chiếu theo quy mô doanh thu (Luật Thuế TNDN 67/2025/QH15 cho kỳ từ 2025 – cần đối chiếu điều kiện áp dụng)`,"tndn");
  else if(!hasDK&&eff>rate_+5)add("NHO","Thuế suất TNDN hiệu dụng cao hơn thuế suất áp dụng",`Thuế/LNTT = ${fx(eff)}%, thuế suất tham chiếu ${rate_}% (theo doanh thu năm trước ${dpv!=null?fm(dpv):"chưa có"}).`,"Có chi phí không được trừ lớn hoặc truy thu kỳ trước. Liệt kê chi phí bị loại để kiểm soát cho kỳ sau.",`Thuế suất tham chiếu ${rate_}% – cần đối chiếu`,"tndn");
 }
 const qt=v("THUE_QT");if(qt!=null&&th_!=null&&Math.abs(qt-th_)>Math.max(1,Math.abs(th_)*0.01))add("NHO","Thuế TNDN trên BCTC khác tờ khai quyết toán",`BCTC: ${fm(th_)}; 03/TNDN: ${fm(qt)}.`,"Giải thích do thuế hoãn lại hoặc điều chỉnh; nếu do sai sót cần thống nhất số liệu.","Đối chiếu BCTC – QT TNDN (BM04C)","tndn");
 const lv=v("LAI_VAY"),kh=v("KHAU_HAO");
 if(lv&&lt!=null){const ebitda=lt+lv+(kh||0);if(ebitda<=0||lv>0.3*ebitda)add("NHO","Chi phí lãi vay vượt 30% EBITDA",`Lãi vay ${compact(lv)}, EBITDA ${compact(ebitda)}.`,"Nếu doanh nghiệp có giao dịch liên kết: phần lãi vay vượt 30% EBITDA không được trừ khi tính thuế TNDN. Xác định có quan hệ liên kết hay không.","NĐ 132/2020/NĐ-CP (đã sửa đổi) về giao dịch liên kết – cần đối chiếu văn bản hiện hành","thue")}
 const gp=gro("PTHU"),gd=gro("DThu");if(gp!=null&&gd!=null&&gp-gd>30&&v("PTHU")>0.1*(ts||1))add("TY","Phải thu tăng nhanh hơn doanh thu",`Phải thu tăng ${fx(gp)}%, doanh thu ${gd>=0?"tăng":"giảm"} ${fx(Math.abs(gd))}%.`,"Đối chiếu công nợ, đánh giá tuổi nợ, trích lập dự phòng; kiểm tra doanh thu ghi nhận cuối kỳ.","Phân tích biến động");
 const gh=gro("HTK");if(gh!=null&&gh>50&&(gd??0)<0)add("TY","Hàng tồn kho tăng mạnh khi doanh thu giảm",`HTK tăng ${fx(gh)}%, doanh thu giảm ${fx(Math.abs(gd))}%.`,"Kiểm kê thực tế; kiểm tra hàng chậm luân chuyển, trích lập dự phòng; rủi ro tồn kho khống do mua hóa đơn.","Phân tích biến động","thue");
 const c43=v("CT43"),gvhb=v("GVHB");if(c43!=null&&gvhb&&c43>0.1*gvhb)add("NHO","Thuế GTGT đầu vào còn khấu trừ lớn",`CT [43] = ${compact(c43)}, bằng ${fx(c43/gvhb*100)}% giá vốn.`,"Xem xét điều kiện hoàn thuế; số khấu trừ lớn kéo dài là tiêu chí rủi ro. Rà soát hóa đơn đầu vào không phục vụ SXKD.","Thuế GTGT – BM04A","thue");
 const dp=v("DP_PT"),pt=v("PTKH")??v("PTHU");if(pt&&g("CS25").t>180&&!dp)add("NHO","Phải thu tồn lâu nhưng chưa trích dự phòng",`Kỳ thu tiền bình quân ${fx(g("CS25").t,0)} ngày.`,"Lập bảng tuổi nợ; trích lập dự phòng phải thu khó đòi đủ hồ sơ để được tính vào chi phí được trừ.","TT 48/2019/TT-BTC về trích lập dự phòng (cần đối chiếu văn bản hiện hành)");
 const gts=gro("TONG_TS");if(gts!=null&&gts>50)add("NHO","Quy mô tài sản tăng đột biến",`Tổng tài sản tăng ${fx(gts)}%.`,"Xác định nguồn tài trợ (vay, góp vốn, chiếm dụng); kiểm tra chứng từ góp vốn, hợp đồng vay.","Phân tích biến động");
 if(Math.abs(gd??0)>20&&gd!=null)add("NHO",`Doanh thu biến động ${gd>0?"tăng":"giảm"} trên 20%`,`Doanh thu thuần ${gd>0?"tăng":"giảm"} ${fx(Math.abs(gd))}% so với cùng kỳ.`,"Giải thích nguyên nhân (hợp đồng lớn, mất khách hàng, thay đổi chính sách giá) trong thuyết minh và hồ sơ PLAN thuế.","Phân tích biến động");
 // đặc thù
 K.forEach(k=>{if(k.ev&&(k.ev.lv==="warn"||k.ev.lv==="bad"))add(k.ev.lv==="bad"?"TY":"NHO",`${k.n}: ${k.ev.l}`,`Giá trị ${fmtK(k)}. ${k.m}`,KN_MODEL[k.n]||"Rà soát theo checklist đặc thù của loại hình.",`Chỉ tiêu đặc thù – ${MODELS[L].n}`,"dt")});
 tbRules().forEach(r=>out.push(r));
 const ord={NT:0,TY:1,NHO:2};out.sort((a,b)=>ord[a.sev]-ord[b.sev]);return out;
}
function unitMul(){return S.meta.donVi==="nghìn đồng"?1e3:S.meta.donVi==="triệu đồng"?1e6:1}
const KN_MODEL={
 "Dở dang 154 / Hàng tồn kho":"Kiểm tra bảng tính giá thành, kết chuyển 154 sang 155 khi sản phẩm hoàn thành; xác định đúng sản phẩm dở dang cuối kỳ.",
 "Dở dang 154 / Tổng tài sản":"Rà soát từng công trình: đã nghiệm thu chưa xuất hóa đơn, chưa kết chuyển giá vốn; chi phí công trình đã quyết toán.",
 "Số tháng giá vốn đang dở dang":"Lập bảng 154 theo công trình, tuổi chi phí; công trình dừng thi công cần đánh giá khả năng thu hồi.",
 "Food cost – CP nguyên liệu / DT ăn uống":"Đối chiếu định mức món ăn, phiếu xuất kho bếp, bảng kê mua nguyên liệu không có hóa đơn (01/TNDN); kiểm tra doanh thu bán lẻ qua HĐĐT máy tính tiền.",
 "Prime cost – (NL + lương) / Doanh thu":"Rà soát bảng lương thời vụ, chi phí nguyên liệu; so sánh với doanh thu theo phần mềm bán hàng.",
 "Công suất phòng (OCC)":"Đối chiếu báo cáo phần mềm quản lý khách sạn với doanh thu phòng và hóa đơn đã xuất.",
 "Tỷ trọng CP sản xuất chung":"Kiểm tra tiêu thức phân bổ SXC; phần chi phí dưới công suất bình thường ghi vào giá vốn trong kỳ.",
 "Chu kỳ chuyển đổi tiền (CCC)":"Rà soát chính sách bán chịu, tồn kho chậm luân chuyển; dự báo nhu cầu vốn lưu động.",
 "Số ngày trả tiền người bán (DPO)":"Đối chiếu công nợ nhà cung cấp; hóa đơn từ 5 triệu chưa thanh toán quá hạn hợp đồng phải điều chỉnh giảm khấu trừ GTGT (CT [37]).",
 "Giá vốn / Giá thành hoàn thành":"Đối chiếu nhập – xuất – tồn thành phẩm, giá xuất kho.",
 "Dở dang 154 / Doanh thu":"Kiểm tra kết chuyển chi phí khi dịch vụ hoàn thành; đối chiếu biên bản nghiệm thu, hóa đơn.",
 "Chi phí nhiên liệu / Doanh thu":"Lập định mức nhiên liệu theo phương tiện, đối chiếu lệnh vận chuyển, nhật trình xe.",
 "Hàng gửi bán / Hàng tồn kho":"Đối chiếu biên bản giao hàng đại lý, báo cáo bán hàng của đại lý; ghi nhận doanh thu khi hàng đã bán."
};
function health(Rt,Rk){
 const W=[25,20,20,15,20],P={good:100,ok:70,warn:40,bad:10};let tot=0,wt=0;const gs=[];
 for(let g=0;g<5;g++){const xs=Rt.filter(r=>r.g===g&&r.rt&&P[r.rt.lv]!=null);if(!xs.length){gs.push(null);continue}const sc=xs.reduce((t,r)=>t+P[r.rt.lv],0)/xs.length;gs.push(sc);tot+=sc*W[g];wt+=W[g]}
 if(!wt)return null;
 let s=tot/wt;const nt=Rk.filter(r=>r.sev==="NT").length,ty=Rk.filter(r=>r.sev==="TY").length;s-=Math.min(30,nt*8+ty*2);s=Math.max(0,Math.round(s));
 const gr=s>=80?"A":s>=65?"B":s>=50?"C":s>=35?"D":"E";
 const lb={A:"Lành mạnh",B:"Khá",C:"Trung bình – cần theo dõi",D:"Yếu – nhiều rủi ro",E:"Rủi ro cao"}[gr];
 return{s,gr,lb,gs,nt,ty};
}
function zscore(){
 const ts=val("TONG_TS","T"),tsnh=val("TSNH","T"),nnh=val("NO_NH","T"),re=val("LNCPP","T"),e=EBIT("T"),vc=val("VCSH","T"),no=val("TONG_NO","T");
 if(!ts||tsnh==null||nnh==null||re==null||e==null||vc==null||!no)return null;
 const x1=(tsnh-nnh)/ts,x2=re/ts,x3=e*AN()/ts,x4=vc/no;const z=6.56*x1+3.26*x2+6.72*x3+1.05*x4;
 return{z,x1,x2,x3,x4,zone:z>2.6?{lv:"good",l:"Vùng an toàn"}:z>=1.1?{lv:"warn",l:"Vùng cảnh báo"}:{lv:"bad",l:"Vùng nguy hiểm"}};
}
function dupont(){
 const ln=val("LNST","T"),dt=val("DThu","T"),ts=avg("TONG_TS"),vc=avg("VCSH");
 if(ln==null||!dt||!ts||!vc||vc<=0)return null;
 const a=ln/dt,b=dt/ts*AN(),c=ts/vc;return{a,b,c,roe:a*b*c};
}
function tbParseRows(rows){
 const out=[];const __cot=__SUA.B17?__cotNoCo(rows):null;
 for(const cols0 of rows){
  const cols=cols0.map(c=>c==null?"":String(c).trim());
  const i=cols.findIndex(c=>/^[1-9]\d{2,}[0-9A-Za-z_.]*$/.test(c.replace(/\s/g,"")));
  if(i<0)continue;
  const tk=cols[i].replace(/[\s._]/g,"");
  let j=i+1,ten="";while(j<cols.length&&cols[j]!==""&&pn(cols[j])==null){ten+=(ten?" ":"")+cols[j];j++}
  const nums=cols.slice(j).map(c=>c===""?0:pn(c)).filter(x=>x!=null);
  if(!__cot&&nums.length<6)continue;
  const n=__cot?__cot.map(k=>{const x=cols0[k];return x===""||x==null?0:(pn(x)??0)}):nums.slice(-6);if(__cot&&n.every(x=>!x)&&!nums.length)continue;
  out.push({tk,ten,dnd:n[0],dcd:n[1],psn:n[2],psc:n[3],dnc:n[4],dcc:n[5]});
 }
 const seen=new Set();return out.filter(r=>seen.has(r.tk)?false:(seen.add(r.tk),true));
}
function tbRoots(){return S.tb.filter(r=>/^[1-9]/.test(r.tk)&&!S.tb.some(p=>p!==r&&p.tk.length<r.tk.length&&r.tk.startsWith(p.tk)))}
function tbHas(){return Array.isArray(S.tb)&&S.tb.length>0}
function tbGet(tk){
 if(!tbHas())return null;
 const ex=S.tb.find(r=>r.tk===tk);if(ex)return ex;
 const ch=S.tb.filter(r=>r.tk.startsWith(tk));if(!ch.length)return null;
 const ml=Math.min(...ch.map(r=>r.tk.length));
 return ch.filter(r=>r.tk.length===ml).reduce((a,r)=>{for(const k of["dnd","dcd","psn","psc","dnc","dcc"])a[k]+=r[k];return a},{tk,ten:"",dnd:0,dcd:0,psn:0,psc:0,dnc:0,dcc:0});
}
const T0={dnd:0,dcd:0,psn:0,psc:0,dnc:0,dcc:0};
const tg=tk=>tbGet(tk)||T0;
const tsum=(tks,f)=>tks.reduce((t,k)=>t+f(tg(k)),0);
const tbIs=tk=>!!tbGet(tk);
const NO_CO=["111","112","113","121","128","136","141","151","1331","1332","152","153","154","155","156","157","158","211","212","213","217","241","221","222","228","242","244"];
const NO_NO=["214","229","334","335","341","343","344","347","352","353","356","3382","3383","3384","3386","3387","411"];
const ZERO=["511","515","521","611","621","622","623","627","631","632","635","641","642","711","811","821","911"];
const TKN={"111":"Tiền mặt","112":"Tiền gửi ngân hàng","113":"Tiền đang chuyển","121":"Chứng khoán kinh doanh","128":"Đầu tư nắm giữ đến ngày đáo hạn","136":"Phải thu nội bộ","141":"Tạm ứng","151":"Hàng mua đang đi đường","1331":"Thuế GTGT được khấu trừ của HHDV","1332":"Thuế GTGT được khấu trừ của TSCĐ","152":"Nguyên liệu, vật liệu","153":"Công cụ, dụng cụ","154":"Chi phí SXKD dở dang","155":"Thành phẩm","156":"Hàng hóa","157":"Hàng gửi đi bán","158":"Hàng hóa kho bảo thuế","211":"TSCĐ hữu hình","212":"TSCĐ thuê tài chính","213":"TSCĐ vô hình","217":"Bất động sản đầu tư","241":"XDCB dở dang","221":"Đầu tư vào công ty con","222":"Đầu tư vào công ty liên doanh, liên kết","228":"Đầu tư khác","242":"Chi phí trả trước","244":"Cầm cố, thế chấp, ký quỹ","214":"Hao mòn TSCĐ","229":"Dự phòng tổn thất tài sản","334":"Phải trả người lao động","335":"Chi phí phải trả","341":"Vay và nợ thuê tài chính","343":"Trái phiếu phát hành","344":"Nhận ký quỹ, ký cược","347":"Thuế TNDN hoãn lại phải trả","352":"Dự phòng phải trả","353":"Quỹ khen thưởng, phúc lợi","356":"Quỹ phát triển KH&CN","3382":"Kinh phí công đoàn","3383":"Bảo hiểm xã hội","3384":"Bảo hiểm y tế","3386":"Bảo hiểm thất nghiệp","3387":"Doanh thu chưa thực hiện","411":"Vốn đầu tư của chủ sở hữu","511":"Doanh thu bán hàng","515":"Doanh thu tài chính","521":"Giảm trừ doanh thu","611":"Mua hàng","621":"CP NVL trực tiếp","622":"CP nhân công trực tiếp","623":"CP máy thi công","627":"CP sản xuất chung","631":"Giá thành sản xuất","632":"Giá vốn hàng bán","635":"Chi phí tài chính","641":"Chi phí bán hàng","642":"Chi phí quản lý","711":"Thu nhập khác","811":"Chi phí khác","821":"Chi phí thuế TNDN","911":"Xác định kết quả kinh doanh"};
function tbRules(){
 const out=[],L=S.meta.loai,add=(sev,t,d,kn,cb="Nguyên tắc tài khoản – CĐPS")=>out.push({sev,t,d,kn,cb,cat:"tb"});
 if(!tbHas())return out;
 const top=S.tb.filter(r=>r.tk.length===3),roots=tbRoots();
 const sm=k=>roots.reduce((t,r)=>t+r[k],0);
 [["dnd","dcd","Số dư đầu kỳ"],["psn","psc","Số phát sinh"],["dnc","dcc","Số dư cuối kỳ"]].forEach(([a,b,n])=>{const d=sm(a)-sm(b);if(Math.abs(d)>1)add("NT",`CĐPS không cân: ${n}`,`Tổng bên Nợ ${fm(sm(a))}, tổng bên Có ${fm(sm(b))}, lệch ${fm(d)} (tính trên tài khoản tổng hợp).`,"Kiểm tra bút toán một vế, tài khoản ngoài hệ thống, số dư nhập tay sai.","Nguyên tắc ghi sổ kép")});
 const roll=S.tb.filter(r=>Math.abs((r.dnc-r.dcc)-(r.dnd-r.dcd+r.psn-r.psc))>1);
 if(roll.length)add("NT",`${roll.length} tài khoản có số dư cuối không khớp số dư đầu + phát sinh`,roll.slice(0,8).map(r=>r.tk).join(", ")+(roll.length>8?"…":""),"Kiểm tra lại file kết xuất hoặc công thức tổng hợp.");
 const kids=p=>S.tb.filter(r=>r.tk!==p.tk&&r.tk.startsWith(p.tk)&&!S.tb.some(q=>q.tk.length>p.tk.length&&q.tk.length<r.tk.length&&r.tk.startsWith(q.tk)));
 const par=S.tb.filter(p=>{const ch=kids(p);if(!ch.length)return false;const net=x=>x.dnc-x.dcc;return Math.abs(ch.reduce((t,r)=>t+net(r),0)-net(p))>1||["psn","psc"].some(k=>Math.abs(ch.reduce((t,r)=>t+r[k],0)-p[k])>1)});
 if(par.length)add("TY","Tài khoản cấp 1 khác tổng tài khoản cấp 2",par.map(r=>r.tk).join(", "),"Rà soát tài khoản chi tiết thiếu hoặc hạch toán thẳng vào tài khoản tổng hợp.");
 const nm=tk=>`${tk} ${TKN[tk]||""}`.trim();
 NO_CO.forEach(tk=>{const r=tbGet(tk);if(r&&r.dcc>1){const sev=["111","112","113","152","153","155","156","157","158"].includes(tk)?"NT":"TY";add(sev,`TK ${nm(tk)} có số dư Có cuối kỳ`,`Dư Có ${fm(r.dcc)}.`,tk.startsWith("11")?"Âm quỹ/âm tài khoản ngân hàng: kiểm tra chi trước khi thu, thu chưa ghi sổ, thấu chi phải hạch toán vào 341.":tk.startsWith("15")?"Âm kho: kiểm tra xuất trước nhập, chưa nhập hóa đơn mua, tính giá xuất kho.":"Sai bản chất tài khoản; kiểm tra bút toán đối ứng.")}});
 NO_NO.forEach(tk=>{const r=tbGet(tk);if(r&&r.dnc>1){const sev=tk==="411"?"NT":tk.startsWith("338")?"NHO":"TY";add(sev,`TK ${nm(tk)} có số dư Nợ cuối kỳ`,`Dư Nợ ${fm(r.dnc)}.`,tk==="334"?"Trả lương thừa hoặc tạm ứng lương hạch toán vào 334: chuyển sang 141/1388.":tk==="214"?"Hao mòn ghi giảm sai; đối chiếu bảng khấu hao.":"Sai bản chất tài khoản hoặc nộp thừa; kiểm tra bút toán đối ứng.")}});
 const z=ZERO.filter(tk=>{const r=tbGet(tk);return r&&(r.dnc>1||r.dcc>1)});
 if(z.length)add("NT","Tài khoản doanh thu, chi phí chưa kết chuyển hết cuối kỳ",z.map(tk=>{const r=tbGet(tk);return`${tk}: ${fm(r.dnc||r.dcc)}`}).join("; "),"Chạy lại kết chuyển lãi lỗ; kiểm tra bút toán phát sinh sau kết chuyển.");
 const hm=tg("214").dcc,ng=tsum(["211","213","217"],r=>r.dnc);
 if(hm>ng+1)add("NT","Hao mòn lũy kế vượt nguyên giá",`Dư Có 214 ${fm(hm)} > nguyên giá 211+213+217 ${fm(ng)}.`,"Đối chiếu bảng khấu hao, TSCĐ đã thanh lý chưa ghi giảm hao mòn.");
 if(tg("211").dnc>0&&tbIs("214")&&tg("214").psc===0)add("TY","Có TSCĐ nhưng không trích khấu hao trong kỳ",`Dư Nợ 211 ${fm(tg("211").dnc)}, PS Có 214 bằng 0.`,"Kiểm tra bảng khấu hao, TSCĐ chưa đưa vào sử dụng.");
 const vo=tg("1331"),ra=tbGet("33311")||tbGet("3331")||T0;
 if(ra.dnc>1)add("NHO","Thuế GTGT đầu ra (33311) dư Nợ",`Dư Nợ ${fm(ra.dnc)}.`,"Nộp thừa hoặc chưa bù trừ với 1331.");
 if(vo.dnc>1&&ra.dcc>1)add("TY","Đồng thời còn thuế GTGT được khấu trừ và còn thuế đầu ra phải nộp",`Dư Nợ 1331 ${fm(vo.dnc)}, dư Có 33311 ${fm(ra.dcc)}.`,"Chưa bù trừ thuế cuối kỳ hoặc còn nợ thuế một kỳ; kiểm tra tờ khai kỳ cuối.");
 const chk=(sev,t,a,b,la,lb,kn,cb,tol=1)=>{if(a==null||b==null)return;const d=a-b;if(Math.abs(d)>Math.max(tol,Math.abs(b)*0.001))add(sev,t,`${la}: ${fm(a)}; ${lb}: ${fm(b)}; chênh ${fm(d)}.`,kn,cb)};
 chk("TY","Dư đầu 1331 lệch chỉ tiêu [22] tờ khai kỳ đầu năm",tbIs("1331")?vo.dnd:null,val("CT22_DAU","T"),"Dư Nợ đầu 1331","[22] kỳ đầu","Kiểm tra hóa đơn hạch toán khác kỳ, TKBS năm trước chưa cập nhật sổ.","Mẫu 01/GTGT – cần đối chiếu số chỉ tiêu theo TT 89/2026");
 chk("TY","Dư cuối 1331 lệch chỉ tiêu [43] tờ khai kỳ cuối",tbIs("1331")?vo.dnc:null,val("CT43","T"),"Dư Nợ cuối 1331","[43] kỳ cuối","Hóa đơn đầu vào hạch toán nhưng chưa kê khai hoặc ngược lại; điều chỉnh theo quy tắc khai bổ sung.","Mẫu 01/GTGT – cần đối chiếu");
 chk("TY","Thuế GTGT đầu vào trên sổ lệch tờ khai",tbIs("1331")?vo.psn:null,val("CT24_SUM","T"),"PS Nợ 1331","Σ[24] các kỳ","Đối chiếu bảng kê mua vào với sổ theo từng hóa đơn; loại bút toán điều chỉnh.","Luật Thuế GTGT 48/2024/QH15");
 chk("TY","Thuế GTGT đầu ra trên sổ lệch tờ khai",tbIs("3331")||tbIs("33311")?ra.psc:null,val("CT_RA_SUM","T"),"PS Có 33311","Σ thuế đầu ra tờ khai","Đối chiếu bảng kê bán ra với hóa đơn điện tử đã xuất.","Mẫu 01/GTGT");
 chk("TY","Thuế GTGT còn phải nộp trên sổ lệch tờ khai kỳ cuối",tbIs("3331")||tbIs("33311")?ra.dcc:null,val("CT40_CUOI","T"),"Dư Có 33311","[40] kỳ cuối","Kiểm tra số đã nộp, bút toán bù trừ.","Mẫu 01/GTGT");
 const dtT=tg("511").psc-tg("521").psc,dt711=tg("711").psc;
 if(ra.psc>0.1005*(tg("511").psc+dt711)+1)add("TY","Thuế GTGT đầu ra lớn hơn 10% doanh thu",`PS Có 33311 ${fm(ra.psc)} > 10% × (511 + 711).`,"Kiểm tra hóa đơn bán ra hạch toán thiếu doanh thu, thuế suất sai.","Luật Thuế GTGT 48/2024/QH15");
 if(tg("511").psc>0&&(tbIs("3331")||tbIs("33311"))&&ra.psc===0)add("NHO","Có doanh thu nhưng không phát sinh thuế GTGT đầu ra",`PS Có 511 ${fm(tg("511").psc)}.`,"Xác nhận doanh nghiệp thuộc diện không chịu thuế / xuất khẩu 0%; nếu không là thiếu thuế.","Luật Thuế GTGT 48/2024/QH15");
 if(val("DT_BH","T")==null)chk("TY","Doanh thu sổ (511 sau giảm trừ) lệch doanh thu tờ khai GTGT",tbIs("511")?dtT:null,val("DT_GTGT","T"),"PS Có 511 − 521","Σ[34] tờ khai","Lập bảng giải trình 11 nguyên nhân: biếu tặng, tiêu dùng nội bộ, DT chưa thực hiện, chiết khấu, thanh lý TSCĐ, sai thời điểm, thu nhập không cần hóa đơn…","Đối chiếu GTGT ↔ TNDN (TNDN-27)");
 const t3334=tbGet("3334"),t821=tbGet("8211")||tbGet("821");
 if(t3334&&t821)chk("TY","Thuế TNDN phải nộp (3334) lệch chi phí thuế (8211)",t3334.psc,t821.psn,"PS Có 3334","PS Nợ 8211","Kiểm tra bút toán điều chỉnh thuế năm trước, thuế hoãn lại.","Luật Thuế TNDN 67/2025/QH15");
 if(t3334)chk("TY","Thuế TNDN trên sổ lệch tờ khai quyết toán",t3334.psc,val("THUE_QT","T"),"PS Có 3334","Thuế trên 03/TNDN","Thống nhất số liệu sổ và quyết toán.","Luật Thuế TNDN 67/2025/QH15");
 if(t3334&&t3334.dnc>1)add("NHO","Thuế TNDN tạm nộp thừa",`Dư Nợ 3334 ${fm(t3334.dnc)}.`,"Bù trừ sang kỳ sau hoặc đề nghị hoàn; kiểm tra tạm nộp 4 quý ≥ 80% số quyết toán.","NĐ 126/2020 sửa đổi – cần đối chiếu NĐ 252/2026");
 const t3335=tbGet("3335");if(t3335){chk("TY","Thuế TNCN trên sổ lệch tờ khai",t3335.psc,val("TNCN_TK","T"),"PS Có 3335","Σ thuế khấu trừ trên tờ khai","Đối chiếu bảng lương ↔ tờ khai ↔ 05/QTT theo từng người.","TT 89/2026 – cần đối chiếu mẫu");if(t3335.dnc>1)add("NHO","Thuế TNCN nộp thừa",`Dư Nợ 3335 ${fm(t3335.dnc)}.`,"Kiểm tra hoàn thuế cho người lao động sau quyết toán.")}
 const ps334=tg("334").psc,qlbh=val("QL_BH","T");
 const rates=[["3383",0.255,"BHXH (17,5% + 8%)"],["3384",0.045,"BHYT (3% + 1,5%)"],["3386",0.02,"BHTN (1% + 1%)"],["3382",0.02,"KPCĐ (2%)"]];
 if(qlbh){rates.forEach(([tk,r,n])=>{const x=tbGet(tk);if(!x)return;const rr=x.psc/qlbh;if(Math.abs(rr-r)>r*0.1)add(tk==="3382"?"NHO":"TY",`Trích ${n} lệch tỷ lệ quy định`,`PS Có ${tk} ${fm(x.psc)} = ${fx(rr*100)}% quỹ lương đóng BH (chuẩn ${fx(r*100)}%).`,"Đối chiếu C12 từng tháng; kiểm tra lao động mới, nghỉ việc, thay đổi mức đóng.","Luật BHXH 41/2024/QH15; Luật Việc làm; Luật Công đoàn")})}
 else if(ps334>0){const x=tbGet("3383");if(!x||x.psc===0)add("TY","Có chi lương nhưng không trích BHXH",`PS Có 334 ${fm(ps334)}, không phát sinh Có 3383.`,"Xác định lao động thuộc diện bắt buộc tham gia (HĐLĐ từ 1 tháng).","Luật BHXH 41/2024/QH15 Đ2");else{const r=x.psc/ps334;if(r<0.12)add("TY","Quỹ lương đóng BHXH thấp so với tổng lương",`Trích BHXH bằng ${fx(r*100)}% tổng lương (đóng đủ trên toàn bộ lương là 25,5%). Ước lương đóng BH ≈ ${fx(r/0.255*100,0)}% tổng thu nhập.`,"Kiểm tra tách lương thành phụ cấp, hỗ trợ cố định để giảm mức đóng – rủi ro truy thu khi thanh tra BHXH.","Luật BHXH 41/2024/QH15 Đ31")}}
 ["3383","3384","3386"].forEach(tk=>{const x=tbGet(tk);if(x&&x.psc>0&&tbIs("334")&&ps334===0)add("NHO",`Trích ${TKN[tk]} nhưng không phát sinh lương`,`PS Có ${tk} ${fm(x.psc)}.`,"Kiểm tra hạch toán lương thẳng vào chi phí không qua 334.")});
 const p632=tg("632").psn,p511=tg("511").psc;
 if(tbIs("632")&&p632>p511&&p511>0)add("TY","Giá vốn lớn hơn doanh thu (lỗ gộp)",`PS Nợ 632 ${fm(p632)} > PS Có 511 ${fm(p511)}.`,"Giải trình bán dưới giá vốn; kiểm tra giá xuất kho, hàng hủy hạch toán vào 632.","VAS 02, VAS 14");
 if((L==="tm"||L==="sx")&&p511>0&&p632===0)add("TY","Có doanh thu nhưng không có giá vốn",`PS Có 511 ${fm(p511)}.`,"Kiểm tra xuất kho, tính giá vốn, kết chuyển 154/155.");
 if(L==="tm"&&p632>0&&tbIs("156")){const d=Math.abs(p632-tg("156").psc)/p632;if(d>0.05)add("NHO","Luồng giá vốn thương mại bất thường",`PS Nợ 632 ${fm(p632)} khác PS Có 156 ${fm(tg("156").psc)} (${fx(d*100)}%).`,"Thương mại: Nợ 632 đối ứng Có 156; kiểm tra xuất kho cho mục đích khác, giá vốn ghi tay.")}
 if(tbIs("154")&&tg("154").psc>0){let b=null,lb="";if(L==="sx"){b=tg("155").psn;lb="PS Nợ 155"}else if(["xd","dv","vt","dl"].includes(L)){b=p632;lb="PS Nợ 632"}if(b!=null&&Math.abs(tg("154").psc-b)/Math.max(b,1)>0.05)add("NHO","Kết chuyển giá thành từ 154 lệch",`PS Có 154 ${fm(tg("154").psc)}; ${lb} ${fm(b)}.`,"Kiểm tra kết chuyển giá thành, xuất thẳng 154 sang tài khoản khác.","TNDN-28/29: kiểm soát giá vốn qua TK đối ứng")}
 // LN theo CĐPS
 const ln=(tg("511").psc-tg("521").psc)+tg("515").psc+tg("711").psc-tg("632").psn-tg("635").psn-tg("641").psn-tg("642").psn-tg("811").psn-tg("821").psn;
 if(tbIs("511")){const b=val("LNST","T");if(b!=null&&Math.abs(ln-b)>Math.max(1,Math.abs(b)*0.01))add("NHO","Lợi nhuận tính từ CĐPS khác LNST trên BCTC",`CĐPS: ${fm(ln)}; BCTC: ${fm(b)}.`,"Số tham khảo (chưa loại hoàn nhập, giảm giá vốn). Kiểm tra kết chuyển 911.");
  if(tbIs("421")){const t4=tbGet("4212")||tg("421");const bd=(t4.dcc-t4.dnc)-(t4.dcd-t4.dnd);if(tbGet("4212")&&Math.abs(bd-ln)>Math.max(1,Math.abs(ln)*0.01))add("TY","Biến động 4212 khác lợi nhuận trong kỳ",`Biến động 4212 ${fm(bd)}; LN theo CĐPS ${fm(ln)}.`,"Kiểm tra chia lợi nhuận, trích quỹ, kết chuyển 4212 → 4211 đầu năm.")}}
 const ts=val("TONG_TS","T")||roots.filter(r=>/^[12]/.test(r.tk)).reduce((t,r)=>t+r.dnc-r.dcc,0);
 const m111=tg("111").dnc;
 if(ts&&m111>0.2*ts&&(tg("341").dcc>0||tg("635").psn>0))add("TY","Tồn quỹ tiền mặt lớn trong khi đi vay",`Dư 111 ${compact(m111)} (${fx(m111/ts*100,0)}% tổng TS); có vay/chi phí lãi vay.`,"Rủi ro CQT loại chi phí lãi vay tương ứng; kiểm kê quỹ, xử lý tiền mặt treo.","RUIRO-06, SODU-02");
 if(tg("635").psn>0&&!tbIs("341")&&!tbIs("3388")&&!tbIs("343"))add("NHO","Có chi phí tài chính nhưng không có khoản vay",`PS Nợ 635 ${fm(tg("635").psn)}.`,"Xác định bản chất (lãi chậm trả, chiết khấu thanh toán, chênh lệch tỷ giá) và chứng từ.");
 if(ts&&tg("141").dnc>0.05*ts)add("NHO","Tạm ứng treo lớn",`Dư Nợ 141 ${compact(tg("141").dnc)} (${fx(tg("141").dnc/ts*100)}% tổng TS).`,"Rà soát tạm ứng quá 3 tháng, người đã nghỉ việc; yêu cầu hoàn ứng.","SODU-15");
 if(tg("131").dcc>0)add("NHO","Khách hàng ứng trước (dư Có 131)",`Dư Có 131 ${fm(tg("131").dcc)}.`,"Kiểm tra hàng đã giao/dịch vụ đã hoàn thành chưa xuất hóa đơn → doanh thu, thuế ghi nhận chậm.","SODU-11");
 if(tg("331").dnc>0)add("NHO","Trả trước người bán (dư Nợ 331)",`Dư Nợ 331 ${fm(tg("331").dnc)}.`,"Kiểm tra đã nhận hàng/hóa đơn chưa; khoản trả trước lâu không có hàng.","SODU-33");
 const t331=tbGet("331");if(t331&&t331.dcc>0&&t331.psn<t331.dcc*0.02&&Math.abs(t331.dcc-t331.dcd)<t331.dcd*0.05)add("TY","Công nợ phải trả treo, gần như không thanh toán trong kỳ",`Dư Có 331 đầu ${fm(t331.dcd)}, cuối ${fm(t331.dcc)}, PS Nợ ${fm(t331.psn)}.`,"Dấu hiệu hóa đơn không có giao dịch thực hoặc chưa thanh toán: ảnh hưởng khấu trừ GTGT (hóa đơn từ 5 triệu) và chi phí được trừ.","SODU-34");
 if(tbIs("131")&&tg("131").psn>tg("511").psc+ra.psc+dt711+1)add("NHO","Phát sinh phải thu lớn hơn doanh thu + thuế đầu ra",`PS Nợ 131 ${fm(tg("131").psn)}.`,"Kiểm tra bút toán bù trừ, thu hộ, phân loại sai sang 131.","SODU-12");
 const nv=["152","153","154","156","211","241","242","621","622","623","627","641","642","1331"].reduce((t,k)=>t+tg(k).psn,0);
 if(tbIs("331")&&tg("331").psc>nv+1)add("NHO","Phát sinh phải trả lớn hơn tổng mua vào",`PS Có 331 ${fm(tg("331").psc)}; tổng PS Nợ kho, TSCĐ, chi phí, 1331 ${fm(nv)}.`,"Kiểm tra đối ứng bất thường (331 ↔ 111/112 vay mượn).","SODU-35");
 const t242=tbGet("242");if(t242&&t242.dnc>0&&t242.psc===0)add("TY","Chi phí trả trước không được phân bổ trong kỳ",`Dư Nợ 242 ${fm(t242.dnc)}, PS Có 0.`,"Lập bảng phân bổ 242, không bỏ tháng.","SODU-16");
 const t153=tbGet("153");if(t153&&t153.dnc>0&&t153.psn===0&&t153.psc===0)add("NHO","Công cụ dụng cụ tồn không luân chuyển cả kỳ",`Dư Nợ 153 ${fm(t153.dnc)}.`,"Kiểm kê; xuất dùng và phân bổ nếu đã sử dụng.");
 ["1388","3388"].forEach(tk=>{const x=tbGet(tk);if(x&&ts&&(x.dnc+x.dcc)>0.05*ts)add("NHO",`Số dư ${tk} lớn`,`Dư ${tk}: ${compact(x.dnc||x.dcc)}.`,"Kiểm tra vay mượn cá nhân, khoản treo; hồ sơ vay, lãi và khấu trừ TNCN tiền lãi trả cá nhân.","SODU-14, SODU-39")});
 if(S.meta.cheDo==="tt133"){const x=tbGet("413");if(x&&(x.dnc>1||x.dcc>1))add("NHO","Chênh lệch tỷ giá (413) chưa kết chuyển","TT133: 413 không có số dư cuối kỳ.","Kết chuyển sang 515/635.")}
 if(+S.meta.nam>=2026){const x=tbGet("33382");if(x&&(x.dnc>1||x.dcc>1))add("NHO","Còn số dư lệ phí môn bài","Lệ phí môn bài đã bãi bỏ từ 01/01/2026.","Xử lý số dư còn lại từ các năm trước.","NQ 198/2025/QH15")}
 const vdl=val("VDL","T"),v411=tbGet("4111")||tbGet("411");if(vdl&&v411&&Math.abs(v411.dcc-vdl)>1)add("TY","Vốn góp trên sổ khác vốn điều lệ đăng ký",`Dư Có 411 ${fm(v411.dcc)}; vốn điều lệ ${fm(vdl)}.`,"Góp chưa đủ: lãi vay tương ứng phần vốn còn thiếu không được trừ; kiểm tra thời hạn góp 90 ngày.","Luật Doanh nghiệp 2020 Đ47, Đ75; Luật Thuế TNDN 67/2025/QH15");
 const ord={NT:0,TY:1,NHO:2};return out.sort((a,b)=>ord[a.sev]-ord[b.sev]);
}
const cellStr=c=>c==null?"":c instanceof Date?fd(pd(c)):String(c).trim();
const TITLE_KW={
 bctc:["bang can doi ke toan","bao cao tinh hinh tai chinh","ket qua hoat dong kinh doanh","bao cao ket qua kinh doanh","luu chuyen tien te","mau so b01","mau so b02","mau so b03"],
 cdps:["can doi phat sinh","can doi so phat sinh","can doi tai khoan","bang can doi tai khoan","bang can doi so phat sinh"],
 nkc:["nhat ky chung","so nhat ky chung"],
 quy:["so quy tien mat","chi tiet quy tien mat","so ke toan chi tiet quy tien mat","so quy"],
 tgnh:["so tien gui ngan hang","so tien gui","so chi tiet tien gui"],
 sct:["so chi tiet cac tai khoan","so chi tiet tai khoan","so cai","so chi tiet"],
 cn131:["cong no phai thu","tong hop cong no khach hang","tong hop phai thu","chi tiet cong no phai thu","cong no khach hang"],
 cn331:["cong no phai tra","tong hop cong no nha cung cap","tong hop phai tra","cong no nha cung cap","phai tra nguoi ban"],
 nxt:["nhap xuat ton","nhap ton xuat","tong hop ton kho","bao cao ton kho"],
 gt:["gia thanh","bang tinh gia thanh","tong hop chi phi san xuat","chi phi theo cong trinh","lai lo cong trinh"],
 hdr:["hoa don ban ra","bang ke hoa don chung tu hang hoa dich vu ban ra","hang hoa dich vu ban ra"],
 hdv:["hoa don mua vao","bang ke hoa don chung tu hang hoa dich vu mua vao","hang hoa dich vu mua vao"]
};
const COLS={
 ngay:["ngay ghi so","ngay hach toan","ngay ht","ngay gs","=ngay"],
 ngayct:["ngay chung tu","ngay ct","ngay thang chung tu","chung tu ngay"],
 so:["so chung tu","so ct","so phieu thu","so phieu","so hieu chung tu","chung tu so","=so","so hieu"],
 so2:["so phieu chi"],
 bank:["tai khoan ngan hang","so tai khoan","ngan hang","tk ngan hang"],
 dg:["dien giai","noi dung","trich yeu","ly do"],
 tkno:["tk no","tai khoan no","no tk","so hieu tk no","tk ghi no"],
 tkco:["tk co","tai khoan co","co tk","so hieu tk co","tk ghi co"],
 tk:["so hieu tai khoan","so hieu tk","sh tk","=tai khoan","=tk","ma tai khoan","ma tk"],
 du:["tk doi ung","tai khoan doi ung","tk du","doi ung","sh tk doi ung"],
 n:["phat sinh no","ps no","so phat sinh no","so tien no","no"],
 c:["phat sinh co","ps co","so phat sinh co","so tien co","co"],
 tien:["so tien","thanh tien","gia tri","so tien phat sinh"],
 thu:["thu","so tien thu","gui vao","tien thu","so thu"],
 chi:["chi","so tien chi","rut ra","tien chi","so chi"],
 ton:["ton","con lai","so ton","so du","ton quy"],
 dt:["ma doi tuong","doi tuong","ma khach hang","ma kh","ma ncc","ma nha cung cap","khach hang","nha cung cap","ten doi tuong"],
 ma:["ma doi tuong","ma khach hang","ma kh","ma ncc","ma nha cung cap","ma hang","ma vat tu","ma vt","ma hh","ma san pham","ma sp","ma cong trinh","ma ct","ma hop dong","ma tour","=ma"],
 ten:["ten doi tuong","ten khach hang","ten nha cung cap","ten ncc","ten hang","ten vat tu","ten hang hoa","ten san pham","ten cong trinh","ten hop dong","ten tour","=ten"],
 dvt:["dvt","don vi tinh"],
 kho:["kho","ma kho","ten kho"],
 dnd:["du no dau","no dau ky","dau ky no","so du dau ky no","so du dau no"],
 dcd:["du co dau","co dau ky","dau ky co","so du dau ky co","so du dau co"],
 psn:["phat sinh no","ps no","phat sinh trong ky no"],
 psc:["phat sinh co","ps co","phat sinh trong ky co"],
 dnc:["du no cuoi","no cuoi ky","cuoi ky no","so du cuoi ky no","so du cuoi no"],
 dcc:["du co cuoi","co cuoi ky","cuoi ky co","so du cuoi ky co","so du cuoi co"],
 sld:["dau ky so luong","ton dau so luong","sl dau","so luong dau","ton dau ky so luong"],
 gtd:["dau ky gia tri","ton dau gia tri","gt dau","gia tri dau","ton dau ky gia tri","dau ky thanh tien"],
 sln:["nhap so luong","nhap trong ky so luong","sl nhap","so luong nhap"],
 gtn:["nhap gia tri","nhap trong ky gia tri","gt nhap","gia tri nhap","nhap thanh tien"],
 slx:["xuat so luong","xuat trong ky so luong","sl xuat","so luong xuat"],
 gtx:["xuat gia tri","xuat trong ky gia tri","gt xuat","gia tri xuat","xuat thanh tien"],
 slc:["cuoi ky so luong","ton cuoi so luong","sl cuoi","so luong cuoi","ton cuoi ky so luong"],
 gtc:["cuoi ky gia tri","ton cuoi gia tri","gt cuoi","gia tri cuoi","ton cuoi ky gia tri","cuoi ky thanh tien"],
 ddd:["do dang dau","dd dau","chi phi do dang dau","dau ky do dang","cp dd dau ky"],
 nvl:["nguyen vat lieu","nvl","nguyen lieu","chi phi nvl","cp nvl","vat lieu"],
 nc:["nhan cong","chi phi nhan cong","cp nc","nctt"],
 mtc:["may thi cong","chi phi may","cp mtc","mtc"],
 sxc:["san xuat chung","chi phi chung","cp sxc","sxc","chi phi khac"],
 ddc:["do dang cuoi","dd cuoi","chi phi do dang cuoi","cuoi ky do dang","cp dd cuoi ky"],
 z:["tong gia thanh","gia thanh","tong z","gia thanh san pham","gia von ket chuyen"],
 sl:["so luong hoan thanh","sl hoan thanh","san luong"],
 dgz:["gia thanh don vi","z don vi","gia thanh dv"],
 dthu:["doanh thu"],
 kh:["ky hieu hoa don","ky hieu hd","ky hieu"],
 shd:["so hoa don","so hd"],
 nhd:["ngay lap","ngay hoa don","ngay hd","ngay lap hoa don","ngay thang nam lap","ngay thang nam phat hanh","ngay phat hanh"],
 mst:["mst nguoi ban","mst nguoi mua","ma so thue","mst"],
 tdt:["ten nguoi ban","ten nguoi mua","ten don vi","ten nguoi xuat hang","nguoi ban","nguoi mua"],
 truoc:["tong tien chua thue","tien chua thue","gia tri chua thue","doanh so ban chua co thue","doanh so mua chua co thue","doanh so chua co thue","doanh thu chua co thue","gia tri chua co thue","chua co thue","thanh tien chua thue"],
 thue:["tong tien thue","tien thue","thue gtgt","tien thue gtgt"],
 tong:["tong tien thanh toan","tong thanh toan","tong cong tien thanh toan","tong tien"],
 ts:["thue suat"],
 tt:["trang thai hoa don","trang thai","tinh chat hoa don","ket qua kiem tra"]
};
const HDR_KEYS={
 nkc:["ngay","so","dg","tkno","tkco","tk","du","n","c","tien","dt","ngayct"],
 sct:["ngay","so","dg","tk","du","n","c","dt","ngayct"],
 quy:["ngay","so","so2","dg","du","thu","chi","ton","dt","ngayct"],
 tgnh:["ngay","so","dg","du","thu","chi","ton","dt","ngayct","bank"],
 cn131:["ma","ten","tk","dnd","dcd","psn","psc","dnc","dcc"],
 cn331:["ma","ten","tk","dnd","dcd","psn","psc","dnc","dcc"],
 nxt:["ma","ten","dvt","kho","tk","sld","gtd","sln","gtn","slx","gtx","slc","gtc"],
 gt:["ma","ten","ddd","nvl","nc","mtc","sxc","ddc","z","sl","dgz","dthu"],
 hdr:["kh","shd","nhd","mst","tdt","truoc","thue","tong","ts","tt"],
 hdv:["kh","shd","nhd","mst","tdt","truoc","thue","tong","ts","tt"],
 cdps:["tk","ten","dnd","dcd","psn","psc","dnc","dcc"]
};
function pmatch(h,pat){if(!h)return 0;if(pat[0]==="="){return h===pat.slice(1)?3:0}if(h===pat)return 3;if((" "+h+" ").includes(" "+pat+" "))return 2;return 0}
function headerAt(rows,r,depth){
 const w=Math.max(...rows.slice(r,r+depth).map(x=>x.length));const lines=[];
 for(let k=0;k<depth;k++){const row=rows[r+k]||[];let last="";const out=[];for(let i=0;i<w;i++){let v=norm(cellStr(row[i]));if(!v&&k<depth-1){const below=norm(cellStr((rows[r+k+1]||[])[i]));v=below?last:""}else last=v;out.push(v)}lines.push(out)}
 return Array.from({length:w},(_,i)=>lines.map(l=>l[i]).filter(Boolean).join(" ").replace(/\b(\w+)( \1\b)+/g,"$1"));
}
function mapCols(hdr,keys){
 const cols={};const used=new Set();
 const cand=[];keys.forEach(k=>(COLS[k]||[]).forEach((p,pi)=>hdr.forEach((h,i)=>{const s=pmatch(h,p);if(s)cand.push({k,i,s:s*10-pi*0.1-(h.length/100)})})));
 cand.sort((a,b)=>b.s-a.s);for(const c of cand){if(cols[c.k]!=null||used.has(c.i))continue;cols[c.k]=c.i;used.add(c.i)}
 return cols;
}
function findHeader(rows,kind){
 const keys=HDR_KEYS[kind];let best={score:0};
 for(let r=0;r<Math.min(rows.length,40);r++)for(const depth of[1,2,3]){const h=headerAt(rows,r,depth);const cols=mapCols(h,keys);const score=Object.keys(cols).length+(depth>1?0.01:0);if(score>best.score)best={score,r,depth,cols,hdr:h}}
 return best;
}
function headText(rows,n=14){return norm(rows.slice(0,n).map(r=>r.map(cellStr).join(" ")).join(" | "))}
// B18: sheet có ít nhất 3 tên tài khoản chuẩn (CĐPS thật luôn có; bảng lương, tờ khai hải quan thì không)
function __coTenTaiKhoan(rows) {
  const tx = headText(rows, 400)
  return ['tien mat', 'tien gui ngan hang', 'phai thu cua khach hang', 'phai tra cho nguoi ban', 'phai tra nguoi ban', 'phai tra nguoi lao dong',
    'thue va cac khoan phai nop', 'thue gtgt duoc khau tru', 'von gop cua chu so huu', 'von dau tu cua chu so huu', 'loi nhuan sau thue chua phan phoi',
    'doanh thu ban hang', 'gia von hang ban', 'chi phi quan ly', 'xac dinh ket qua kinh doanh', 'hang hoa', 'nguyen lieu',
      'cash on hand', 'cash in bank', 'accounts receivable', 'accounts payable', 'cost of goods sold', 'retained earnings', 'owner s equity', 'trial balance'].filter(w => tx.includes(w)).length >= 3
}
function detectKind(t){
 const head=headText(t.rows),all=headText(t.rows,60);
 const sc={};for(const[k,kws]of Object.entries(TITLE_KW))sc[k]=kws.reduce((m,w)=>head.includes(w)?Math.max(m,w.length):m,0);
 // phân biệt
 if(sc.sct&&(sc.quy||sc.tgnh))sc.sct=0;
 if(sc.cn131&&sc.cn331)(head.indexOf("phai thu")<head.indexOf("phai tra")?sc.cn331=0:sc.cn131=0);
 if(sc.bctc&&sc.cdps)sc.bctc=0;
 if(!sc.sk&&/so du|balance/.test(all)&&/ghi no|ghi co|debit|credit|tien vao|tien ra|rut ra|gui vao/.test(all)&&!/tai khoan doi ung|tk doi ung|so hieu tk/.test(all))sc.sk=20;
 if(/thong tin nguoi ban|mst nguoi ban|ten nguoi ban/.test(all)&&/so hoa don|ky hieu/.test(all))sc.hdv=Math.max(sc.hdv,30);
 if(/thong tin nguoi mua|mst nguoi mua|ten nguoi mua/.test(all)&&/so hoa don|ky hieu/.test(all))sc.hdr=Math.max(sc.hdr,30);
 let kind=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0];
 if(kind[1]>0){kind=kind[0]}else{
  // không có tiêu đề: đoán theo cấu trúc
  const codeRows=t.rows.filter(r=>r.some(c=>/^(0[1-9]|[1-9]\d{1,2})$/.test(cellStr(c)))&&r.filter(c=>pn(c)!=null&&Math.abs(pn(c))>999).length>=1).length;
  const tkRows=t.rows.filter(r=>r.some(c=>/^[1-9]\d{2,}$/.test(cellStr(c)))&&r.filter(c=>pn(c)!=null).length>=6).length;
  const cand=["nkc","quy","tgnh","cn131","nxt","gt","hdr"].map(k=>[k,findHeader(t.rows,k).score]).sort((a,b)=>b[1]-a[1])[0];
  if(tkRows>=8&&tkRows>codeRows*0.6&&(!__SUA.B18||__coTenTaiKhoan(t.rows)))kind="cdps";else if(cand[1]>=4)kind=cand[0];else if(codeRows>=8)kind="bctc";else kind="unknown";
 }
 return kind;
}
function sniffMeta(rows){
 const out={};const txt=rows.slice(0,25).map(r=>r.map(cellStr).filter(Boolean).join(" ")).join("\n");
 let m=txt.match(/(?:tên người nộp thuế|đơn vị báo cáo|tên đơn vị|tên doanh nghiệp|đơn vị)\s*[:：]\s*([^\n]{4,120})/i);if(m)out.ten=m[1].replace(/\s{2,}.*$/,"").trim();
 if(!out.ten){m=txt.match(/^\s*((?:CÔNG TY|CTY|DOANH NGHIỆP|HỢP TÁC XÃ)[^\n]{4,100})/m);if(m)out.ten=m[1].trim()}
 m=txt.match(/(?:mã số thuế|mst)\s*[:：]?\s*([0-9][0-9\- ]{8,15}[0-9])/i);if(m)out.mst=m[1].replace(/\s/g,"");
 m=txt.match(/qu[ýy]\s*([1-4])\s*(?:\/|năm)\s*(20\d\d)/i);if(m){out.ky="q";out.quy=+m[1];out.nam=+m[2]}
 else{m=txt.match(/(?:năm|ngày\s*\d{1,2}\s*tháng\s*12\s*năm|31\/12\/)\s*(20\d\d)/i)||txt.match(/(?:từ ngày|from)\s*[:：]?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.](20\d\d)/i);if(m){out.nam=+m[1];out.ky="nam"}}
 m=txt.match(/(?:đơn vị tính|đvt)\s*[:：]?\s*(nghìn đồng|ngàn đồng|triệu đồng|đồng|vnd|vnđ)/i);if(m)out.donVi=/ngh|ngàn/i.test(m[1])?"nghìn đồng":/triệu/i.test(m[1])?"triệu đồng":"đồng";
 return out;
}
const SKIPROW=/^(so du dau ky|so du dau|so du dau nam|cong phat sinh|cong so phat sinh|so du cuoi ky|so du cuoi|tong cong|cong|cong luy ke|luy ke|cong chuyen sang|so trang truoc chuyen sang|chuyen sang trang sau|tong|cong thang|cong quy|cong nam)\b/;
const SEC_KW=[["cd",/bang can doi ke toan|bao cao tinh hinh tai chinh|mau so b01/],["kd",/ket qua hoat dong kinh doanh|bao cao ket qua kinh doanh|mau so b02/],["lc",/luu chuyen tien te|mau so b03/]];
function codeMaps(){const m={cd:{},kd:{},lc:{}};F.forEach(f=>{if(!m[f.g])return;f.c.forEach((cs,ci)=>String(cs).split("+").forEach(c=>{c=c.trim();if(/^\d+$/.test(c)){const key=String(+c);(m[f.g][key]=m[f.g][key]||[]).push({k:f.k,ci,plus:String(cs).includes("+")})}}))});return m}
function parseBCTCRows(tables){
 const maps=codeMaps(),vals={},hits={cd:0,kd:0,lc:0};let sec=null,regime=null;
 const allCodes={cd:new Set(),kd:new Set(),lc:new Set()};
 for(const t of tables){
  let codeCol=null;for(let r=0;r<Math.min(t.rows.length,30);r++){const i=t.rows[r].findIndex(c=>/^(ma so|ma chi tieu|ms|ma)$/.test(norm(cellStr(c))));if(i>=0){codeCol=i;break}}
  for(const row of t.rows){
   const line=norm(row.map(cellStr).join(" "));
   for(const[s,re]of SEC_KW)if(re.test(line)&&line.length<160&&!/^\d/.test(line)){if(s==="cd"&&/luu chuyen|ket qua/.test(line))continue;sec=s}
   if(!sec)continue;
   let ci=codeCol;let code=null;
   if(ci!=null){const v=cellStr(row[ci]);if(/^\d{1,3}$/.test(v))code=String(+v)}
   if(code==null){for(let i=0;i<row.length;i++){const v=cellStr(row[i]);if(/^\d{2,3}$/.test(v)||(typeof row[i]==="number"&&row[i]>=1&&row[i]<=600&&Number.isInteger(row[i])&&i<4)){code=String(+v);ci=i;break}}}
   if(code==null)continue;
   const nums=row.slice(ci+1).map(c=>{const s=cellStr(c);if(s!=="0"&&/^[IVX]+\.?\d*$|^V?I?\.?\d{1,2}$|^\(?\d{1,2}\)?$/.test(s)&&!(typeof c==="number"&&Math.abs(c)>99))return null;return pn(c)}).filter(x=>x!=null);
   if(!nums.length)continue;
   allCodes[sec].add(+code);
   const cand=maps[sec][code];if(!cand)continue;
   const t_=nums[0],p_=nums.length>1?nums[1]:null;
   hits[sec]++;
   for(const c of cand){const key=sec+":"+c.k+":"+c.ci;if(c.plus){const o=vals[key]||{t:0,p:0,plus:true};o.t+=t_||0;o.p+=p_||0;vals[key]=o}else if(!vals[key])vals[key]={t:t_,p:p_}}
  }
 }
 // chọn chế độ: TT133 có mã 500 tổng NV hoặc tổng TS = 200 & không có 270
 const cd=allCodes.cd;regime=cd.has(500)||(cd.has(200)&&!cd.has(270)&&cd.has(300))?1:0;
 const out={};for(const[key,v]of Object.entries(vals)){const[sec,k,ci]=key.split(":");if(+ci!==regime&&!(F.find(f=>f.k===k).c[0]===F.find(f=>f.k===k).c[1]))continue;if(out[k]&&+ci!==regime)continue;out[k]={t:v.t,p:v.p}}
 if(out.CAPEX){out.CAPEX.t=out.CAPEX.t!=null?Math.abs(out.CAPEX.t):null;out.CAPEX.p=out.CAPEX.p!=null?Math.abs(out.CAPEX.p):null}
 return{v:out,hits,regime:regime?"tt133":(cd.has(440)||cd.has(270)?"tt200":null)};
}
function parseJournal(t,kind,hd){
 const c=hd.cols,rows=t.rows,out=[],open={};let curTK=kind==="quy"?"111":kind==="tgnh"?"112":null,curBank="";
 const g=(row,k)=>c[k]!=null?row[c[k]]:null;
 const hasPair=c.tkno!=null&&c.tkco!=null;
 for(let r=hd.r+hd.depth;r<rows.length;r++){
  const row=rows[r];const line=row.map(cellStr).join(" ");const nl=norm(line);
  let m=line.match(/(?:tài khoản|tk)\s*[:：]?\s*(\d{3,}[0-9A-Za-z]*)/i);
  if(m&&!pd(g(row,"ngay"))&&!pd(g(row,"ngayct"))&&(c.n==null||pn(g(row,"n"))==null||nl.length<80)){if(kind!=="quy"&&kind!=="tgnh")curTK=m[1];else if(kind==="tgnh"){curTK=m[1].startsWith("112")?m[1]:curTK}}
  m=line.match(/(?:số tài khoản|stk|tài khoản ngân hàng|ngân hàng)\s*[:：]?\s*([0-9A-Za-z .\-–]{4,60})/i);if(kind==="tgnh"&&m&&!pd(g(row,"ngay")))curBank=m[1].trim();
  const d=pd(g(row,"ngay"))||pd(g(row,"ngayct"));
  const dg=cellStr(g(row,"dg"));
  const lab=norm(dg||cellStr(row.find(x=>cellStr(x))));
  if(!d){
   if(/so du dau|ton dau/.test(lab)){const key=(kind==="tgnh"?curBank:"")+"|"+(curTK||"");const n=pn(g(row,"n")),cc=pn(g(row,"c"));const ton=pn(g(row,"ton"));open[key]={tk:curTK,bank:curBank,du:ton!=null?ton:(n||0)-(cc||0)}}
   continue;
  }
  if(SKIPROW.test(lab))continue;
  const base={d,dc:pd(g(row,"ngayct"))||d,so:cellStr(g(row,"so"))||cellStr(g(row,"so2")),dg,dt:cellStr(g(row,"dt")),src:kind};
  if(kind==="quy"||kind==="tgnh"){
   const thu=pn(g(row,"thu"))||(c.thu==null?pn(g(row,"n")):0)||0,chi=pn(g(row,"chi"))||(c.chi==null?pn(g(row,"c")):0)||0;if(!thu&&!chi)continue;
   out.push({...base,tk:curTK,du:tkOf(g(row,"du")),n:thu,c:chi,ton:pn(g(row,"ton")),bank:cellStr(g(row,"bank"))||curBank});continue;
  }
  if(hasPair){const no=tkOf(g(row,"tkno")),co=tkOf(g(row,"tkco"));const v=pn(g(row,"tien"))??pn(g(row,"n"));if(!no||!co||!v)continue;out.push({...base,tk:no,du:co,n:v,c:0},{...base,tk:co,du:no,n:0,c:v});continue}
  const tk=tkOf(g(row,"tk"))||curTK;if(!tk)continue;
  let n=pn(g(row,"n"))||0,cc=pn(g(row,"c"))||0;
  if(!n&&!cc&&c.tien!=null){continue}
  if(!n&&!cc)continue;
  out.push({...base,tk,du:tkOf(g(row,"du")),n,c:cc});
 }
 return{rows:out,open};
}
function parseBalances(t,hd){
 const c=hd.cols,out=[];const g=(row,k)=>c[k]!=null?row[c[k]]:null;
 for(let r=hd.r+hd.depth;r<t.rows.length;r++){const row=t.rows[r];const ma=cellStr(g(row,"ma")),ten=cellStr(g(row,"ten"));const lab=norm(ma+" "+ten);if(!ma&&!ten)continue;if(SKIPROW.test(lab)||/^tong|^cong/.test(lab))continue;
  let v=["dnd","dcd","psn","psc","dnc","dcc"].map(k=>c[k]!=null?pn(g(row,k))||0:null);
  if(v.some(x=>x==null)){const nums=row.map((x,i)=>i===c.ma||i===c.ten?null:pn(x)).filter(x=>x!=null);if(nums.length<6)continue;v=nums.slice(-6)}
  if(v.every(x=>!x))continue;
  out.push({ma:ma||ten,ten:ten||ma,tk:tkOf(g(row,"tk")),dnd:v[0],dcd:v[1],psn:v[2],psc:v[3],dnc:v[4],dcc:v[5]})}
 return out;
}
function parseNXT(t,hd){
 const c=hd.cols,out=[];const g=(row,k)=>c[k]!=null?row[c[k]]:null;let curKho="";
 for(let r=hd.r+hd.depth;r<t.rows.length;r++){const row=t.rows[r];const ma=cellStr(g(row,"ma")),ten=cellStr(g(row,"ten"));const lab=norm(ma+" "+ten);
  const mk=cellStr(row.map(cellStr).join(" ")).match(/^\s*kho\s*[:：]\s*(.+)$/i);if(mk&&!pn(g(row,"gtc"))){curKho=mk[1].trim();continue}
  if(!ma||SKIPROW.test(lab)||/^tong|^cong/.test(lab))continue;
  let v=["sld","gtd","sln","gtn","slx","gtx","slc","gtc"].map(k=>c[k]!=null?pn(g(row,k))||0:null);
  if(v.some(x=>x==null)){const nums=row.map((x,i)=>[c.ma,c.ten,c.dvt,c.kho,c.tk].includes(i)?null:pn(x)).filter(x=>x!=null);if(nums.length<8)continue;v=nums.slice(-8)}
  out.push({ma,ten,dvt:cellStr(g(row,"dvt")),kho:cellStr(g(row,"kho"))||curKho,tk:tkOf(g(row,"tk")),sld:v[0],gtd:v[1],sln:v[2],gtn:v[3],slx:v[4],gtx:v[5],slc:v[6],gtc:v[7]})}
 return out;
}
function parseGT(t,hd){
 const c=hd.cols,out=[];const g=(row,k)=>c[k]!=null?pn(row[c[k]])||0:0;
 for(let r=hd.r+hd.depth;r<t.rows.length;r++){const row=t.rows[r];const ma=cellStr(c.ma!=null?row[c.ma]:""),ten=cellStr(c.ten!=null?row[c.ten]:"");const lab=norm(ma+" "+ten);if(!ma&&!ten)continue;if(SKIPROW.test(lab)||/^tong|^cong/.test(lab))continue;
  const o={ma:ma||ten,ten:ten||ma,ddd:g(row,"ddd"),nvl:g(row,"nvl"),nc:g(row,"nc"),mtc:g(row,"mtc"),sxc:g(row,"sxc"),ddc:g(row,"ddc"),z:g(row,"z"),sl:g(row,"sl"),dgz:g(row,"dgz"),dthu:c.dthu!=null?g(row,"dthu"):null};
  if(!o.nvl&&!o.nc&&!o.sxc&&!o.z&&!o.ddc&&!o.ddd)continue;out.push(o)}
 return out;
}
function parseHD(t,hd){
 const c=hd.cols,out=[];const g=(row,k)=>c[k]!=null?row[c[k]]:null;
 for(let r=hd.r+hd.depth;r<t.rows.length;r++){const row=t.rows[r];const so=cellStr(g(row,"shd"));if(!so||!/\d/.test(so))continue;const lab=norm(row.map(cellStr).join(" "));if(/^tong|^cong/.test(lab))continue;
  const truoc=pn(g(row,"truoc"))||0,thue=pn(g(row,"thue"))||0;
  out.push({kh:cellStr(g(row,"kh")),so:so.replace(/^0+(?=\d)/,""),d:pd(g(row,"nhd")),mst:cellStr(g(row,"mst")).replace(/\s/g,""),ten:cellStr(g(row,"tdt")),truoc,thue,tong:pn(g(row,"tong"))||truoc+thue,ts:cellStr(g(row,"ts")),tt:cellStr(g(row,"tt"))})}
 return out;
}
function parseXML(text){
 const doc=new DOMParser().parseFromString(text,"application/xml");if(doc.querySelector("parsererror"))return{kind:"unknown",note:"File XML lỗi cấu trúc"};
 const all=[...doc.getElementsByTagName("*")];const ln=e=>e.localName||e.nodeName;
 const txt=n=>{const e=all.find(x=>norm(ln(x))===norm(n));return e?e.textContent.trim():""};
 const maTK=txt("maTKhai"),tenTK=txt("tenTKhai");const meta={ten:txt("tenNNT"),mst:txt("mst")};
 const kyStr=txt("kyKKhai"),kieu=txt("kieuKy");
 const leaves=all.filter(e=>!e.children.length&&/^ct\d+[a-z0-9_]*$/i.test(ln(e)));
 {const ty=dkTypeOf(maTK+" "+tenTK)||dkTypeOf(text.slice(0,5000));if(ty&&ty!=="tk")return parseDeclXML(doc,ty,meta,txt);}
 const isGTGT=/01\/GTGT|^842$|^01GTGT/i.test(maTK+" "+tenTK)||/gtgt/i.test(tenTK)||(leaves.some(e=>/^ct22$/i.test(ln(e)))&&leaves.some(e=>/^ct43$/i.test(ln(e)))&&!all.some(e=>/cdkt|kqkd|lctt/i.test(ln(e))));
 if(isGTGT){
  const ct={};leaves.forEach(e=>{const k=ln(e).slice(2).toLowerCase();const v=pn(e.textContent);if(v!=null&&ct[k]==null)ct[k]=v});
  let ky=kyStr;let m=kyStr.match(/^(\d{1,2})\/(\d{4})$/);let key=null;
  if(m)key=(kieu==="Q"||/^[1-4]$/.test(m[1])&&kieu!=="M"&&/Q/i.test(kieu)?`Q${+m[1]}/${m[2]}`:`T${+m[1]}/${m[2]}`);
  if(!key&&kyStr)key=kyStr;
  const lan=+txt("soLan")||0,loai=/B/i.test(txt("loaiTKhai"))?"B":"C";
  return{kind:"tk",tk:{ky:key||"?",kieu:kieu||"",lan,loai,ct,mau:/TT80|80\/2021/i.test(txt("pbanTKhaiXML")+text.slice(0,2000))?"TT80":"",nop:txt("ngayLapTKhai")},meta};
 }
 // BCTC
 const vals={},maps=codeMaps();let hits=0;
 const secOf=e=>{for(let p=e;p&&p.nodeType===1;p=p.parentNode){const n=norm(ln(p));if((__SUA.B16?/kqkd|kqhd|ketqua|b02/:/kqkd|ketqua|b02/).test(n))return"kd";if(/lctt|luuchuyen|b03/.test(n))return"lc";if(/cdkt|bcdkt|candoi|b01|tinhhinhtaichinh/.test(n))return"cd"}return null};
 const colOf=e=>{for(let p=e;p&&p.nodeType===1;p=p.parentNode){const n=norm(ln(p));if(/cuoi|namnay|kynay|nay|sochitieuky|^so ?cuoi/.test(n))return"t";if(/dau|namtruoc|kytruoc|truoc/.test(n))return"p"}return null};
 const __maCd=new Set(),__theoCi={};const put=(sec,code,col,v)=>{const c=maps[sec]&&maps[sec][String(+code)];if(!c||v==null)return;hits++;if(sec==="cd")__maCd.add(+code);for(const x of c){const kho=__SUA.B15?__theoCi:vals;const key=__SUA.B15?x.k+":"+x.ci:x.k;const o=kho[key]||(kho[key]={t:null,p:null});if(x.plus)o[col]=(o[col]||0)+v;else if(o[col]==null)o[col]=v}};
 all.forEach(e=>{const m=ln(e).match(/^ct(\d{1,3})$/i);if(!m)return;const sec=secOf(e)||"cd";
  if(e.children.length){const kids=[...e.children];kids.forEach(k=>{const n=norm(ln(k));const col=/cuoi|namnay|kynay|nay/.test(n)?"t":/dau|truoc/.test(n)?"p":null;if(col)put(sec,m[1],col,pn(k.textContent))})}
  else{const col=colOf(e.parentNode)||"t";put(sec,m[1],col,pn(e.textContent))}});
 // dạng <ChiTieu MaSo="110"><SoCuoiNam>..</SoCuoiNam>
 all.forEach(e=>{const ms=e.getAttribute&&(e.getAttribute("MaSo")||e.getAttribute("maSo")||e.getAttribute("ma"));if(!ms||!/^\d{1,3}$/.test(ms))return;const sec=secOf(e)||"cd";[...e.children].forEach(k=>{const n=norm(ln(k));const col=/cuoi|namnay|kynay|nay/.test(n)?"t":/dau|truoc/.test(n)?"p":null;if(col)put(sec,ms,col,pn(k.textContent))})});
 if(__SUA.B15)__chonCheDoXml(vals,__theoCi,__maCd);if(vals.CAPEX){["t","p"].forEach(s=>{if(vals.CAPEX[s]!=null)vals.CAPEX[s]=Math.abs(vals.CAPEX[s])})}
 if(hits>=5)return{kind:"bctc",v:vals,hits,meta,note:`${hits} chỉ tiêu`};
 return{kind:"unknown",note:"Không nhận diện được loại tờ khai/báo cáo trong file XML",meta};
}
const KIND_NAME={bctc:"Bộ báo cáo tài chính",cdps:"Bảng cân đối phát sinh",tk:"Tờ khai GTGT (XML)",...BOOKS,unknown:"Chưa nhận diện",scan:"PDF/ảnh cần AI đọc",image:"Ảnh BCTC (AI đọc)"};
function applyTable(t,kind,fileName){
 // trả về {kind,n,note}
 if(kind==="sk"){const r=parseStatement(t);if(!r.rows.length)return{kind,n:0,note:"Không nhận diện được giao dịch (cần cột ngày và số tiền)"};const key=r.meta.acct||r.meta.bank||(t.name||"TK");r.rows.forEach(x=>{x.acct=x.acct||r.meta.acct||"";x.bank=x.bank||r.meta.bank||""});const ak=r.meta.acct||r.meta.bank||"";S.bk.sk=(S.bk.sk||[]).filter(x=>(x.acct||x.bank||"")!==ak).concat(r.rows);S.meta.skBal={...(S.meta.skBal||{}),[ak]:{open:r.meta.open??null,close:r.meta.close??(r.rows.at(-1).bal??null),from:r.meta.from,to:r.meta.to,bank:r.meta.bank}};return{kind,n:r.rows.length,note:`${r.meta.bank||"Ngân hàng"}${r.meta.acct?" · TK "+r.meta.acct:""} · ${r.rows.length} giao dịch · ${r.how}`}}
 if(["tk","kk05","qt05","tndn03"].includes(kind)){const r=parseDeclRows(t.rows);if(!Object.keys(r.ct).length)return{kind,n:0,note:"Không thấy chỉ tiêu dạng [mã] kèm số liệu"};
  if(kind==="tk"){const tk={ky:r.ky,kieu:/^Q/.test(r.ky)?"Q":"M",lan:r.lan,loai:r.loai,ct:r.ct,mau:"",nop:""};S.tk=(S.tk||[]).filter(x=>!(x.ky===tk.ky&&x.lan===tk.lan&&x.loai===tk.loai));S.tk.push(tk);S.tk.sort(kyCmp);return{kind,n:Object.keys(r.ct).length,note:`Kỳ ${r.ky} · ${Object.keys(r.ct).length} chỉ tiêu`}}
  const dk={type:kind,ky:kind==="kk05"?r.ky:(r.ky.startsWith("N/")?r.ky:`N/${kyYear(r.ky)||S.meta.nam}`),lan:r.lan,loai:r.loai,ct:r.ct,pl:{},ppl:[],nop:""};storeDK(dk);return{kind,n:Object.keys(r.ct).length,note:dkNote(dk)}}
 if(kind==="cdps"){const r=tbParseRows(t.rows);if(!r.length)return{kind,n:0,note:"Không thấy dòng tài khoản đủ 6 cột số"};S.tb=r;return{kind,n:r.length,note:`${r.length} tài khoản`}}
 if(kind==="bctc"){const r=parseBCTCRows([t]);const n=Object.keys(r.v).length;if(!n)return{kind,n:0,note:"Không thấy mã số chỉ tiêu"};Object.assign(S.v,r.v);if(r.regime&&r.regime!==S.meta.cheDo&&!(r.regime==="tt200"&&S.meta.cheDo==="tt99"))S.meta.cheDo=r.regime;return{kind,n,note:`${n} chỉ tiêu (B01 ${r.hits.cd}, B02 ${r.hits.kd}, B03 ${r.hits.lc})`}}
 const hd=findHeader(t.rows,kind);if(!hd.score)return{kind,n:0,note:"Không tìm thấy dòng tiêu đề cột"};
 let rows=[],note="";
 if(["nkc","sct","quy","tgnh"].includes(kind)){const r=parseJournal(t,kind,hd);rows=r.rows;if(Object.keys(r.open).length)(S.bkOpen=S.bkOpen||{})[kind]=r.open;
  if(kind==="sct"){const tks=[...new Set(rows.map(x=>x.tk))];note=`TK ${tks.slice(0,6).join(", ")}${tks.length>6?"…":""}`}}
 else if(kind==="cn131"||kind==="cn331")rows=parseBalances(t,hd);
 else if(kind==="nxt")rows=parseNXT(t,hd);
 else if(kind==="gt")rows=parseGT(t,hd);
 else if(kind==="hdr"||kind==="hdv")rows=parseHD(t,hd);
 else if(kind==="luong")rows=parseLuong(t,hd);
 if(!rows.length)return{kind,n:0,note:"Đọc được tiêu đề nhưng không có dòng dữ liệu"};
 if(kind==="sct"){const tks=new Set(rows.map(r=>r.tk));S.bk.sct=(S.bk.sct||[]).filter(r=>!tks.has(r.tk)).concat(rows)}
 else if(kind==="luong"){const ys=new Set(rows.map(r=>r.ym));S.bk.luong=(S.bk.luong||[]).filter(r=>!ys.has(r.ym)).concat(rows)}
 else S.bk[kind]=rows;
 return{kind,n:rows.length,note:note||`${fm(rows.length)} dòng`};
}
function guessYear(t,k){if(!/^(nkc|sct|quy|tgnh|sk|hdr|hdv|luong)$/.test(k))return null;const c={};t.rows.slice(0,400).forEach(r=>r.forEach(x=>{if(!(x instanceof Date)&&typeof x!=="string")return;const d=pd(x);if(d&&/^20\d\d/.test(d)){const y=d.slice(0,4);c[y]=(c[y]||0)+1}}));const e=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return e&&e[1]>=5?+e[0]:null}
function applyMeta(m){if(!m)return;const M=S.meta;if(m.ten&&(!M.ten||M.vd))M.ten=m.ten;if(m.mst&&!M.mst)M.mst=m.mst;if(m.ky&&!yearHasData(yearData()))M.ky=m.ky;if(m.quy)M.quy=m.quy;if(m.donVi)M.donVi=m.donVi;if(M.vd&&(m.ten||m.mst)){M.vd=false}}
function kyCmp(a,b){const k=x=>{const m=String(x.ky).match(/([TQ])(\d+)\/(\d{4})/);return m?+m[3]*100+(m[1]==="Q"?+m[2]*3:+m[2]):0};return k(a)-k(b)||a.lan-b.lan}
BOOKS.sk="Sao kê ngân hàng";
TITLE_KW.sk=["sao ke tai khoan","sao ke giao dich","sao ke","account statement","statement of account","lich su giao dich","chi tiet giao dich","bao cao giao dich","transaction history","bang ke giao dich","giao dich tai khoan"];
const BANKS=[["vietcombank","Vietcombank"],["vcb","Vietcombank"],["bidv","BIDV"],["vietinbank","VietinBank"],["agribank","Agribank"],["techcombank","Techcombank"],["tcb","Techcombank"],["mbbank","MB"],["mb bank","MB"],["quan doi","MB"],["acb","ACB"],["a chau","ACB"],["vpbank","VPBank"],["tpbank","TPBank"],["sacombank","Sacombank"],["hdbank","HDBank"],["vib","VIB"],["shb","SHB"],["ocb","OCB"],["msb","MSB"],["seabank","SeABank"],["lpbank","LPBank"],["lienviet","LPBank"],["eximbank","Eximbank"],["nam a","Nam A Bank"],["bac a","Bac A Bank"],["kienlong","KienlongBank"],["pvcombank","PVcomBank"],["shinhan","Shinhan"],["woori","Woori"],["hsbc","HSBC"],["standard chartered","Standard Chartered"],["uob","UOB"],["cake","Cake"],["timo","Timo"]];
const SKC={
 d:["ngay giao dich","ngay gd","transaction date","trans date","ngay","date","ngay hach toan","posting date","ngay hieu luc","effective date","value date","ngay gio giao dich","thoi gian","time"],
 ref:["so tham chieu","so but toan","so giao dich","ma giao dich","so ct","reference","ref","transaction no","trans no","so chung tu","so tc","ma gd"],
 dg:["noi dung","mo ta","dien giai","noi dung giao dich","chi tiet","description","remarks","details","narrative","transaction details","noi dung chi tiet","dien giai giao dich"],
 n:["ghi co","so tien ghi co","credit","credits","tien vao","gui vao","so tien gui","thu","phat sinh co","cr","credit amount","so tien vao"],
 c:["ghi no","so tien ghi no","debit","debits","tien ra","rut ra","so tien rut","chi","phat sinh no","dr","debit amount","so tien ra"],
 amt:["so tien","amount","so tien giao dich","transaction amount","so tien gd"],
 typ:["loai giao dich","loai","type","dr cr","no co","c d","debit credit","+/-"],
 bal:["so du","balance","so du cuoi","so du sau giao dich","running balance","closing balance","so du tai khoan","ending balance"],
 dt:["doi tac","ten doi ung","tai khoan doi ung","doi tuong","beneficiary","counterparty","nguoi nhan","nguoi chuyen","ten tai khoan doi ung","remitter"]
};
function skMeta(rows){const txt=rows.slice(0,25).map(r=>r.map(cellStr).filter(Boolean).join(" ")).join("\n");const n=norm(txt);const o={};
 let m=txt.match(/(?:số tài khoản|so tai khoan|tài khoản số|account (?:number|no\.?)|stk|tk số|tài khoản)\s*[:：]?\s*([0-9][0-9 .\-]{5,25}[0-9])/i);if(m)o.acct=m[1].replace(/[^0-9]/g,"");
 const hi=rows.findIndex(r=>r.filter(c=>cellStr(c)).length>=4);const nh=norm(rows.slice(0,hi>0?hi:8).map(r=>r.map(cellStr).join(" ")).join(" "));
 const FULL=[["ngoai thuong","Vietcombank"],["foreign trade","Vietcombank"],["dau tu va phat trien","BIDV"],["investment and development","BIDV"],["cong thuong","VietinBank"],["industry and trade","VietinBank"],["nong nghiep va phat trien nong thon","Agribank"],["agriculture and rural","Agribank"],["ky thuong","Techcombank"],["technological and commercial","Techcombank"],["quan doi","MB"],["military commercial","MB"],["a chau","ACB"],["asia commercial","ACB"],["viet nam thinh vuong","VPBank"],["prosperity","VPBank"],["tien phong","TPBank"],["sai gon thuong tin","Sacombank"],["phat trien tp","HDBank"],["quoc te viet nam","VIB"],["sai gon ha noi","SHB"],["phuong dong","OCB"],["hang hai","MSB"],["dong nam a","SeABank"],["xuat nhap khau","Eximbank"]];
 const hit=s=>(FULL.find(([k])=>s.includes(k))||BANKS.find(([k])=>(" "+s+" ").includes(" "+k+" ")));const b=hit(nh)||hit(n);if(b)o.bank=b[1];
 m=txt.match(/(?:số dư đầu kỳ|so du dau ky|số dư đầu|opening balance|beginning balance|số dư đầu ngày)\s*[:：]?\s*([\-\(]?[0-9][0-9.,]*\)?)/i);if(m)o.open=pn(m[1]);
 m=txt.match(/(?:số dư cuối kỳ|so du cuoi ky|số dư cuối|closing balance|ending balance)\s*[:：]?\s*([\-\(]?[0-9][0-9.,]*\)?)/i);if(m)o.close=pn(m[1]);
 m=txt.match(/(?:từ ngày|tu ngay|from)\s*[:：]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}).{0,20}?(?:đến ngày|den ngay|to)\s*[:：]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i);if(m){o.from=pd(m[1]);o.to=pd(m[2])}
 return o}
function parseStatement(t){
 const rows=t.rows;const meta=skMeta(rows);
 let best={s:0};for(let r=0;r<Math.min(rows.length,40);r++)for(const depth of[1,2]){const h=headerAt(rows,r,depth);const cols={};const used=new Set();const cand=[];Object.entries(SKC).forEach(([k,ps])=>ps.forEach((p,pi)=>h.forEach((x,i)=>{const sc=pmatch(x,p)||((" "+x+" ").includes(" "+p+" ")?2:0);if(sc)cand.push({k,i,s:sc*10-pi*0.1})})));cand.sort((a,b)=>b.s-a.s);for(const c of cand){if(cols[c.k]!=null||used.has(c.i))continue;cols[c.k]=c.i;used.add(c.i)}const s=Object.keys(cols).length;if(s>best.s)best={s,r,depth,cols}}
 const start=best.s>=2?best.r+best.depth:0;const body=rows.slice(start);
 const W=Math.max(...body.slice(0,200).map(r=>r.length),0);
 // hồ sơ dữ liệu từng cột
 const prof=Array.from({length:W},(_,i)=>{let dates=0,nums=0,txt=0,len=0,n=0;body.slice(0,400).forEach(r=>{const v=r[i];if(v===""||v==null)return;n++;if(pd(v))dates++;else if(pn(v)!=null&&/\d/.test(cellStr(v)))nums++;else{txt++;len+=cellStr(v).length}});return{i,dates,nums,txt,len:txt?len/txt:0,n}});
 let cols={...(best.s>=2?best.cols:{})};
 if(cols.d==null){const c=prof.filter(p=>p.dates>=3).sort((a,b)=>b.dates-a.dates)[0];if(c)cols.d=c.i}
 if(cols.dg==null){const c=prof.filter(p=>p.txt>=3&&p.i!==cols.d).sort((a,b)=>b.len*b.txt-a.len*a.txt)[0];if(c)cols.dg=c.i}
 const numCols=prof.filter(p=>p.nums>=2&&![cols.d,cols.dg,cols.ref].includes(p.i)).map(p=>p.i);
 const val=(r,i)=>i==null?0:(pn(r[i])||0);
 const dataRows=body.filter(r=>pd(r[cols.d]));
 // kiểm tra số dư chạy liên tục để chọn cột vào/ra/số dư
 const score=(ni,ci,bi,sgn)=>{let ok=0,tot=0,prev=null;for(const r of dataRows){const b=pn(r[bi]);if(b==null)continue;const delta=sgn?val(r,ni):val(r,ni)-val(r,ci);if(prev!=null){tot++;if(Math.abs(prev+delta-b)<=1||Math.abs(prev-delta-b)<=1)ok++}prev=b}return tot?ok/tot:0};
 if((cols.n==null||cols.c==null)&&cols.amt==null&&numCols.length>=2){let bestS={s:-1};for(const bi of numCols)for(const ni of numCols)for(const ci of numCols){if(new Set([bi,ni,ci]).size<3)continue;const s=score(ni,ci,bi);if(s>bestS.s)bestS={s,ni,ci,bi}}
  if(bestS.s>=0.6){cols.n=bestS.ni;cols.c=bestS.ci;cols.bal=bestS.bi}else{for(const bi of numCols)for(const ai of numCols){if(ai===bi)continue;const s=score(ai,null,bi,true);if(s>bestS.s)bestS={s,ai,bi}}if(bestS.s>=0.6){cols.amt=bestS.ai;cols.bal=bestS.bi}}}
 if(cols.bal==null&&numCols.length){const c=numCols.filter(i=>![cols.n,cols.c,cols.amt].includes(i));if(c.length)cols.bal=c[c.length-1]}
 const out=[];let last=null;
 for(const r of body){const d=pd(r[cols.d]);
  if(!d){// dòng nối mô tả (PDF/Excel xuống dòng)
   if(last&&cols.dg!=null&&cellStr(r[cols.dg])&&!r.some((x,i)=>i!==cols.dg&&pn(x)!=null&&Math.abs(pn(x))>999)&&!/so du|tong|cong|balance|total/.test(norm(r.map(cellStr).join(" "))))last.dg+=" "+cellStr(r[cols.dg]);continue}
  let n=0,c=0;
  if(cols.n!=null||cols.c!=null){n=Math.abs(val(r,cols.n));c=Math.abs(val(r,cols.c))}
  else if(cols.amt!=null){const a=val(r,cols.amt);const ty=norm(cellStr(r[cols.typ]));if(/^(c|cr|credit|co|ghi co|\+)/.test(ty))n=Math.abs(a);else if(/^(d|dr|debit|no|ghi no|\-)/.test(ty))c=Math.abs(a);else if(a<0)c=-a;else n=a}
  if(!n&&!c)continue;
  const dg=cellStr(r[cols.dg]);if(/^(so du dau|opening|so du cuoi|closing|tong cong|total)/.test(norm(dg)))continue;
  last={d,ref:cellStr(r[cols.ref]),dg,dt:cellStr(r[cols.dt]),n,c,bal:cols.bal!=null?pn(r[cols.bal]):null,acct:meta.acct||"",bank:meta.bank||""};out.push(last)}
 // xác định chiều số dư nếu chỉ có cột số tiền không dấu
 return{rows:out,meta,cols,how:best.s>=2?"Theo tiêu đề cột":"Suy luận từ dữ liệu"};
}
function skAccounts(){const m=new Map();if(__SUA.B10)Object.entries(S.meta.skBal||{}).forEach(([k,b])=>m.set(k,{acct:k,bank:b.bank,rows:[]}));(S.bk.sk||[]).forEach(r=>{const k=r.acct||r.bank||"?";const o=m.get(k)||{acct:r.acct,bank:r.bank,rows:[]};o.rows.push(r);m.set(k,o)});const bal=S.meta.skBal||{};return[...m.values()].map(o=>{const b=bal[o.acct||o.bank]||{};return{...o,open:b.open??null,close:b.close??null}})}
function bookRowsFor(acc){
 const src=S.bk.tgnh&&S.bk.tgnh.length?S.bk.tgnh:GL().filter(p=>P_(p.tk,"112"));if(!src.length)return[];
 const keys=new Map();src.forEach(p=>{const k=p.bank||p.tk;(keys.get(k)||keys.set(k,[]).get(k)).push(p)});if(keys.size===1)return src;
 const dig=acc.acct||"";const bn=norm(acc.bank||"");
 let pick=[...keys.keys()].find(k=>dig&&String(k).replace(/\D/g,"").includes(dig.slice(-6)));
 if(!pick&&bn)pick=[...keys.keys()].find(k=>norm(k).includes(bn));
 if(!pick&&S.meta.skMap&&S.meta.skMap[acc.acct||acc.bank])pick=S.meta.skMap[acc.acct||acc.bank];
 if(!pick){let best=-1;for(const[k,rows]of keys){const amts=new Set(rows.map(p=>Math.round(p.n||p.c)));const hit=acc.rows.filter(r=>amts.has(Math.round(r.n||r.c))).length;if(hit>best){best=hit;pick=k}}}
 return keys.get(pick)||[];
}
const dd=(a,b)=>Math.abs(new Date(a)-new Date(b))/864e5;
function tokens(s){return new Set(norm(s).split(" ").filter(w=>w.length>=3&&!/^(chuyen|tien|thanh|toan|cong|ty|tnhh|tai|khoan|ngan|hang|giao|dich|noi|dung|cho|cua|tu|den|thang|nam|so|ngay)$/.test(w)))}
function bankMatch(acc){
 const bk=bookRowsFor(acc).map((p,i)=>({...p,i,amt:p.n||p.c,dir:p.n?1:-1,used:false}));const st=acc.rows.map((r,i)=>({...r,i,amt:r.n||r.c,dir:r.n?1:-1,used:false}));
 const pairs=[],multi=[];const W=5;
 const byAmt=new Map();bk.forEach(b=>{const k=b.dir+"|"+Math.round(b.amt);(byAmt.get(k)||byAmt.set(k,[]).get(k)).push(b)});
 for(const pass of[0,1])for(const s of st){if(s.used)continue;const c=(byAmt.get(s.dir+"|"+Math.round(s.amt))||[]).filter(b=>!b.used&&dd(b.d,s.d)<=(pass?31:W));if(!c.length)continue;const ts=tokens(s.dg+" "+s.ref);
  c.sort((a,b)=>{const sa=dd(a.d,s.d)-[...tokens(a.dg+" "+a.so)].filter(x=>ts.has(x)).length*0.5-(s.ref&&a.so&&norm(s.ref).includes(norm(a.so))?3:0);const sb=dd(b.d,s.d)-[...tokens(b.dg+" "+b.so)].filter(x=>ts.has(x)).length*0.5-(s.ref&&b.so&&norm(s.ref).includes(norm(b.so))?3:0);return sa-sb});
  const b=c[0];b.used=s.used=true;pairs.push({s,b,lag:dd(b.d,s.d),cross:b.d.slice(0,7)!==s.d.slice(0,7)})}
 // một dòng sao kê = tổng nhiều dòng sổ (cùng chiều, ±2 ngày), tối đa 6 dòng
 const subset=(target,cands)=>{cands=cands.slice(0,22);const n=cands.length;let found=null;const rec=(k,sum,pick)=>{if(found||pick.length>6)return;if(Math.abs(sum-target)<=1&&pick.length>1){found=[...pick];return}if(k>=n||sum>target+1)return;rec(k+1,sum+cands[k].amt,[...pick,cands[k]]);rec(k+1,sum,pick)};rec(0,0,[]);return found};
 for(const s of st){if(s.used)continue;const c=bk.filter(b=>!b.used&&b.dir===s.dir&&dd(b.d,s.d)<=2&&b.amt<s.amt).sort((a,b)=>b.amt-a.amt);const f=subset(s.amt,c);if(f){s.used=true;f.forEach(b=>b.used=true);multi.push({s,bs:f})}}
 for(const b of bk){if(b.used)continue;const c=st.filter(s=>!s.used&&s.dir===b.dir&&dd(b.d,s.d)<=2&&s.amt<b.amt).sort((a,b)=>b.amt-a.amt);const f=subset(b.amt,c);if(f){b.used=true;f.forEach(s=>s.used=true);multi.push({b,ss:f})}}
 return{pairs,multi,stOnly:st.filter(s=>!s.used),bkOnly:bk.filter(b=>!b.used),bk,st};
}
const SK_CAT=[["Phí ngân hàng",/\b(phi|fee|charge|sms|phi quan ly|phi duy tri|phi chuyen tien|vat phi)\b/,"Hạch toán Nợ 6427/6422 (+1331 nếu có hóa đơn) / Có 112."],["Lãi tiền gửi",/\b(lai|tra lai|interest|lai nhap goc|lai tien gui)\b/,"Hạch toán Nợ 112 / Có 515."],["Nộp thuế NSNN",/\b(nsnn|thue|kho bac|ngan sach|tax)\b/,"Hạch toán Nợ 333x / Có 112; đối chiếu giấy nộp tiền."],["BHXH",/\b(bhxh|bao hiem xa hoi|bhyt|bhtn)\b/,"Hạch toán Nợ 338x / Có 112."],["Lương",/\b(luong|salary|payroll)\b/,"Hạch toán Nợ 334 / Có 112."],["Rút tiền mặt",/\b(rut tien|rut tm|atm|cash withdrawal)\b/,"Hạch toán Nợ 111 / Có 112 và lập phiếu thu."],["Vay, trả nợ vay",/\b(giai ngan|vay|tra no|tra goc|loan)\b/,"Hạch toán 341/635."]];
function skCat(dg){const s=norm(dg);const c=SK_CAT.find(([n,re])=>re.test(s));return c||["Khác",null,"Xác định bản chất, bổ sung chứng từ và hạch toán."]}
function bankChecks(){
 const out=[],rec=[];const accs=skAccounts();if(!accs.length)return{issues:out,rec,accs:[]};
 const add=(code,sev,t,d,kn,cb,items)=>out.push({code,sev,t,d,kn,cb,items,cat:"nh"});const[pa,pb]=periodRange();
 const res=accs.map(acc=>{const M=bankMatch(acc);const name=`${acc.bank||"Ngân hàng"}${acc.acct?" – "+acc.acct:""}`;
  // liên tục số dư trên sao kê
  const br=[];let prev=null;acc.rows.forEach(r=>{if(r.bal==null){prev=null;return}if(prev!=null&&Math.abs(prev+r.n-r.c-r.bal)>1&&Math.abs(prev-r.n+r.c-r.bal)>1)br.push({d:r.d,so:r.ref,dg:"Số dư không liên tục – có thể thiếu trang/thiếu giao dịch",amt:r.bal-prev});prev=r.bal});
  if(br.length)add("SK_DUT_QUANG","TY",`Sao kê ${name}: số dư không liên tục ${br.length} chỗ`,"Số dư sau giao dịch không bằng số dư trước + tiền vào − tiền ra.","Tải lại sao kê đầy đủ các trang, đúng khoảng thời gian.","Đối chiếu sao kê",br.slice(0,10));
  if(M.stOnly.length){const g=new Map();M.stOnly.forEach(s=>{const[c,,kn]=skCat(s.dg);(g.get(c)||g.set(c,{kn,items:[]}).get(c)).items.push({d:s.d,so:s.ref,dg:s.dg,amt:s.n?s.n:-s.c})});
   add("SK_CHUA_GHI","TY",`Sao kê ${name}: ${M.stOnly.length} giao dịch chưa hạch toán trên sổ`,[...g].map(([c,o])=>`${c}: ${o.items.length} giao dịch, ${fm(sumBy(o.items,x=>Math.abs(x.amt)))}`).join("; ")+".",[...g].map(([c,o])=>`${c} – ${o.kn}`).join(" "),"Đối chiếu sổ TGNH với sao kê",M.stOnly.slice(0,40).map(s=>({d:s.d,so:s.ref,dg:`[${skCat(s.dg)[0]}] ${s.dg}`,amt:s.n?s.n:-s.c})))}
  if(M.bkOnly.length)add("SO_KHONG_CO_SK","NT",`Sổ TGNH ${name}: ${M.bkOnly.length} bút toán không có trên sao kê`,`Tổng ${fm(sumBy(M.bkOnly,b=>b.amt))}. Có thể ghi sai tài khoản ngân hàng, ghi trùng, ghi khống hoặc nghiệp vụ chưa thực hiện.`,"Xem chứng từ gốc (UNC, giấy báo có); điều chỉnh tài khoản hoặc hủy bút toán.","Đối chiếu sổ TGNH với sao kê",M.bkOnly.slice(0,40).map(b=>({d:b.d,so:b.so,dg:b.dg,amt:b.dir*b.amt})));
  const lag=M.pairs.filter(p=>p.cross);if(lag.length)add("SK_LECH_KY","TY",`${name}: ${lag.length} giao dịch ghi sổ khác tháng với ngày trên sao kê`,"","Ghi sổ theo ngày phát sinh trên sao kê/giấy báo; lệch kỳ làm sai số dư cuối tháng, quý.","Nguyên tắc kỳ kế toán",lag.slice(0,20).map(p=>({d:p.s.d,so:p.b.so,dg:`Sao kê ${fd(p.s.d)} – sổ ${fd(p.b.d)}: ${p.s.dg}`,amt:p.s.n||-p.s.c})));
  // số dư cuối
  const lastBal=[...acc.rows].reverse().find(r=>r.bal!=null);const close=acc.close??(lastBal?lastBal.bal:null);const firstBal=acc.rows.find(r=>r.bal!=null);const open=acc.open??(firstBal?firstBal.bal-firstBal.n+firstBal.c:null);
  const bkRows=M.bk;const bkTk=bkRows[0]?bkRows[0].tk:null;const t=bkTk?tbGet(bkTk):null;
  const bookOpen=t&&bkRows.every(b=>b.tk===bkTk)?t.dnd-t.dcd:null;const bookClose=bookOpen!=null?bookOpen+sumBy(bkRows,b=>b.n)-sumBy(bkRows,b=>b.c):null;
  rec.push({name,open,close,bookOpen,bookClose,stOnlyIn:sumBy(M.stOnly,s=>s.n),stOnlyOut:sumBy(M.stOnly,s=>s.c),bkOnlyIn:sumBy(M.bkOnly,b=>b.n),bkOnlyOut:sumBy(M.bkOnly,b=>b.c),pairs:M.pairs.length,multi:M.multi.length,n:acc.rows.length,M});
  if(close!=null&&bookClose!=null){const d=bookClose-close;const expl=sumBy(M.bkOnly,b=>b.n-b.c)-sumBy(M.stOnly,s=>s.n-s.c);if(Math.abs(d)>1)add("SK_SO_DU","TY",`${name}: số dư cuối sổ ${fm(bookClose)} ≠ sao kê ${fm(close)}`,`Chênh ${fm(d)}; trong đó giao dịch chỉ có trên sổ/sao kê giải thích ${fm(expl)}${Math.abs(d-expl)>1?`, còn ${fm(d-expl)} chưa giải thích (kiểm tra số dư đầu kỳ)`:" (giải thích đủ)"}.`,"Lập bảng đối chiếu số dư ngân hàng; điều chỉnh các khoản chưa ghi.","Đối chiếu số dư tiền gửi (SODU-07)",null)}
  // giao dịch cá nhân lớn, rút tiền mặt ↔ phiếu thu
  const wd=acc.rows.filter(r=>r.c>0&&/rut tien|atm|cash withdrawal/.test(norm(r.dg)));if(wd.length&&(S.bk.quy||[]).length){const q=S.bk.quy;const miss=wd.filter(w=>!q.some(p=>p.n>0&&Math.abs(p.n-w.c)<=1&&dd(p.d,w.d)<=3));if(miss.length)add("RUT_KHONG_NHAP_QUY","TY",`${miss.length} lần rút tiền mặt trên sao kê không có phiếu thu tương ứng`,`Tổng ${fm(sumBy(miss,w=>w.c))}.`,"Lập phiếu thu nhập quỹ hoặc xác định người nhận tiền.","QUY-06",miss.map(w=>({d:w.d,so:w.ref,dg:w.dg,amt:-w.c})))}
  return null});
 // tổng tiền gửi ↔ CĐPS ↔ BCTC
 const totClose=sumBy(rec,r=>r.close||0);if(rec.every(r=>r.close!=null)&&tbGet("112")){const t=tbGet("112");const d=(t.dnc-t.dcc)-totClose;if(Math.abs(d)>1)add("SK_CDPS","TY","Tổng số dư sao kê khác dư TK 112 trên CĐPS",`Sao kê ${fm(totClose)} · CĐPS ${fm(t.dnc-t.dcc)} · chênh ${fm(d)}.`,"Kiểm tra tài khoản ngân hàng chưa có sao kê, tiền gửi có kỳ hạn, giao dịch chưa ghi.","SODU-07",null)}
 // hóa đơn đầu vào ≥ ngưỡng có thanh toán qua ngân hàng?
 if((S.bk.hdv||[]).length){const paid=new Set();accs.forEach(a=>a.rows.filter(r=>r.c>0).forEach(r=>paid.add(norm(r.dg+" "+r.dt))));const big=S.bk.hdv.filter(x=>x.tong>=(pol("vat_cash",x.d||pb)||5e6)&&!/huy|thay the/.test(norm(x.tt)));const words=x=>norm(x.ten).replace(/\b(cong ty|cty|tnhh|co phan|cp|mtv|thuong mai|dich vu|san xuat)\b/g,"").trim().split(" ").filter(w=>w.length>2).slice(0,3);
  const __traNH=__SUA.B11?__hdTraQuaNH():null;const noPay=big.filter(x=>{if(__traNH&&__traNH.has(x))return false;const w=words(x);if(!w.length)return false;return![...paid].some(s=>w.every(z=>s.includes(z))||(x.mst&&s.includes(x.mst)))});
  if(noPay.length&&(__SUA.B13||noPay.length<big.length))add("HD_CHUA_TT_NH","TY",`${noPay.length} hóa đơn đầu vào từ ngưỡng chưa thấy thanh toán qua ngân hàng trên sao kê`,`Thuế ${fm(sumBy(noPay,x=>x.thue))}. Đối chiếu theo tên/MST người bán trong nội dung chuyển khoản.`,"Nếu chưa thanh toán: theo dõi hạn thanh toán; quá hạn hợp đồng mà chưa có chứng từ không dùng tiền mặt thì điều chỉnh giảm thuế đã khấu trừ.","Luật GTGT 48/2024; NĐ 181/2025",noPay.slice(0,25).map(x=>({d:x.d,so:x.so,dg:x.ten,amt:x.tong})))}
 return{issues:out,rec,accs};
}
const P_=(tk,p)=>String(tk||"").startsWith(p);
const inAny=(tk,list)=>list.some(p=>P_(tk,p));
function GL(){const b=S.bk||{};if(b.nkc&&b.nkc.length)return b.nkc;return[...(b.sct||[]),...(b.quy||[]),...(b.tgnh||[])]}
function glSrc(){return S.bk.nkc&&S.bk.nkc.length?"Sổ nhật ký chung":"Sổ chi tiết/quỹ/TGNH"}
const TOL=v=>Math.max(1000,Math.abs(v)*0.0001);
const isKC=p=>P_(p.du,"911")||P_(p.tk,"911");
function byMonth(rows,f){const a=Array(13).fill(0);rows.forEach(r=>{const m=mon(r.d);if(m)a[m]+=f(r)||0});return a}
function median(a){const b=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);if(!b.length)return null;const m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2}
const monthsIn=()=>{const[a,b]=periodRange();const out=[];for(let m=+a.slice(5,7);m<=+b.slice(5,7);m++)out.push(m);return out};
const vkey=p=>p.d+"|"+p.so;
function vouchers(gl){const m=new Map();gl.forEach(p=>{const k=vkey(p);let v=m.get(k);if(!v){v={d:p.d,so:p.so,dg:p.dg,lines:[]};m.set(k,v)}v.lines.push(p)});return[...m.values()]}
const ev=(p,amt)=>({d:p.d,so:p.so,dg:p.dg,tk:p.tk,du:p.du,amt:amt??(p.n||p.c)});
function explain(D,pool,opt={}){
 const out=[],A=Math.abs(D),tol=TOL(D);if(A<=tol)return[{p:100,t:"Chênh lệch nhỏ do làm tròn"}];
 const add=(p,t,items)=>{if(out.length<12)out.push({p,t,items})};
 (opt.cands||[]).forEach(c=>{if(c.v==null)return;if(Math.abs(Math.abs(c.v)-A)<=tol)add(95,`${c.label} (${fm(c.v)}) bằng đúng phần chênh lệch`);else if(c.v&&Math.abs(c.v)<A&&Math.abs(c.v)>A*0.3)add(45,`${c.label} (${fm(c.v)}) giải thích được ${fx(Math.abs(c.v)/A*100,0)}% chênh lệch`)});
 if(opt.months){const ms=opt.months;const tot=ms.reduce((t,x)=>t+Math.abs(x||0),0);const big=ms.map((x,i)=>[i,x||0]).filter(([i,x])=>Math.abs(x)>TOL(x)).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  if(big.length===1)add(80,`Chênh lệch nằm toàn bộ ở tháng ${big[0][0]}`);
  else if(big.length>=2){const[x,y]=big;if(Math.abs(x[0]-y[0])===1&&Math.abs(x[1]+y[1])<=TOL(x[1]))add(85,`Lệch kỳ giữa tháng ${Math.min(x[0],y[0])} và tháng ${Math.max(x[0],y[0])}: số chênh tháng này bù đúng tháng kia (${fm(Math.abs(x[1]))})`);else if(Math.abs(x[1])>=0.9*tot)add(70,`Chênh lệch tập trung ở tháng ${x[0]} (${fx(Math.abs(x[1])/tot*100,0)}%)`);else add(40,`Chênh lệch rải ở ${big.length} tháng: ${big.slice(0,4).map(([m,v])=>`T${m} ${fm(v)}`).join(", ")}`)}}
 const pl=(pool||[]).filter(p=>p.amt);
 const one=pl.filter(p=>Math.abs(Math.abs(p.amt)-A)<=tol);
 if(one.length)add(one.length===1?90:65,one.length===1?`Khớp đúng một chứng từ: ${one[0].so} ngày ${fd(one[0].d)} – ${one[0].dg} (${fm(one[0].amt)}). Có thể chứng từ này chỉ ghi ở một nguồn hoặc ghi thiếu/thừa`:`Có ${one.length} chứng từ bằng đúng số chênh lệch; kiểm tra lần lượt`,one.slice(0,6));
 const two=pl.filter(p=>Math.abs(Math.abs(p.amt)*2-A)<=tol);if(two.length)add(70,`Có thể ghi ngược Nợ/Có: chứng từ ${two[0].so} ngày ${fd(two[0].d)} (${fm(two[0].amt)}) – chênh lệch bằng 2 lần số tiền`,two.slice(0,4));
 const seen=new Map(),dups=[];pl.forEach(p=>{const k=p.d+"|"+p.so+"|"+Math.round(p.amt)+"|"+(p.tk||"");if(seen.has(k))dups.push(p);else seen.set(k,p)});const dmatch=dups.filter(p=>Math.abs(Math.abs(p.amt)-A)<=tol);if(dmatch.length)add(88,`Chứng từ ${dmatch[0].so} ngày ${fd(dmatch[0].d)} bị ghi trùng, số trùng bằng phần chênh lệch`,dmatch.slice(0,4));
 if(!one.length&&pl.length&&pl.length<=4000){const sorted=[...pl].sort((a,b)=>Math.abs(a.amt)-Math.abs(b.amt));const mp=new Map();const key=x=>Math.round(Math.abs(x)/1000);let found=null;for(const p of sorted){const need=key(A-Math.abs(p.amt));if(mp.has(need)){found=[mp.get(need),p];break}mp.set(key(p.amt),p)}if(found)add(55,`Tổ hợp 2 chứng từ bằng chênh lệch: ${found.map(p=>`${p.so} ${fd(p.d)} (${fm(p.amt)})`).join(" + ")}`,found)}
 if(Math.round(A)%9===0&&pl.length<=5000){const t=pl.find(p=>{const s=String(Math.round(Math.abs(p.amt)));for(let i=0;i<s.length-1;i++){const sw=s.slice(0,i)+s[i+1]+s[i]+s.slice(i+2);if(Math.abs(Math.abs(+sw-+s)-A)<=1)return true}return false});if(t)add(50,`Có thể đảo chữ số khi nhập: chứng từ ${t.so} ngày ${fd(t.d)} (${fm(t.amt)})`,[t])}
 const unit=pl.find(p=>[9,99,999,0.9].some(k=>Math.abs(Math.abs(p.amt)*k-A)<=tol));if(unit)add(45,`Có thể sai đơn vị (thừa/thiếu số 0): chứng từ ${unit.so} (${fm(unit.amt)})`,[unit]);
 if(opt.open!=null&&Math.abs(Math.abs(opt.open)-A)<=tol)add(85,"Chênh lệch có từ số dư đầu kỳ (phát sinh trong kỳ khớp) – kiểm tra chuyển số dư năm trước");
 if(!out.length)add(10,"Chưa tìm được nguyên nhân tự động – đối chiếu chi tiết theo tháng/đối tượng ở bảng dưới");
 return out.sort((a,b)=>b.p-a.p);
}
const KW_CITE={
 K1:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15, NĐ 320/2025/NĐ-CP (từ kỳ 2025)",why:"Tiền phạt vi phạm hành chính, tiền chậm nộp thuế không được trừ khi tính thuế TNDN; bị loại khi quyết toán, phát sinh thuế TNDN và phạt."},
 K2:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); NĐ 320/2025/NĐ-CP (từ kỳ 2025); TT 219/2013/TT-BTC Đ7 (đến 30/06/2025); NĐ 181/2025/NĐ-CP (từ 01/07/2025) – hàng biếu tặng phải lập hóa đơn, kê khai GTGT",why:"Quà biếu không phục vụ SXKD hoặc không có quy chế, hóa đơn bị loại khỏi chi phí; hàng biếu tặng chưa xuất hóa đơn còn thiếu thuế GTGT đầu ra."},
 K3:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15 (từ kỳ 2025) – chi phí không liên quan hoạt động SXKD",why:"Chi phí mang tính cá nhân, giải trí dễ bị loại khi quyết toán; nếu chi cho người lao động có thể phải tính thu nhập chịu thuế TNCN."},
 K4:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15 (từ kỳ 2025); TT 45/2013/TT-BTC – tiêu chuẩn TSCĐ ≥ 30 triệu",why:"Đồ dùng cá nhân không phục vụ SXKD bị loại khỏi chi phí; tài sản đủ tiêu chuẩn TSCĐ mà ghi thẳng chi phí bị loại phần vượt khấu hao."},
 K5:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); Luật TNDN 67/2025/QH15 (từ kỳ 2025) – chi phí không gắn với hoạt động SXKD",why:"Chi phí của chủ doanh nghiệp, gia đình không được trừ; có thể bị coi là thu nhập của cá nhân và phải khấu trừ TNCN."},
 K6:{cb:"TT 96/2015/TT-BTC Đ4 khoản 2.30 (đến kỳ 2024); NĐ 320/2025/NĐ-CP (từ kỳ 2025) – phúc lợi ≤ 1 tháng lương bình quân",why:"Phần chi phúc lợi vượt 1 tháng lương bình quân thực hiện trong năm bị loại khỏi chi phí được trừ."},
 K7:{cb:"TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); NĐ 320/2025/NĐ-CP (từ kỳ 2025) – chi phí phải có hóa đơn, chứng từ hợp pháp; bảng kê 01/TNDN",why:"Chi phí không có hóa đơn hợp pháp và không lập bảng kê đúng mẫu bị loại khi quyết toán; thuế GTGT đầu vào không được khấu trừ."},
 K9:{cb:"TT 45/2013/TT-BTC Đ9 (đến kỳ 2024); NĐ 320/2025/NĐ-CP (từ kỳ 2025) – khấu hao ô tô ≤ 9 chỗ chỉ được trừ phần nguyên giá ≤ 1,6 tỷ",why:"Khấu hao phần nguyên giá vượt 1,6 tỷ của ô tô ≤ 9 chỗ (trừ DN kinh doanh vận tải, du lịch, khách sạn) không được trừ; thuế GTGT đầu vào phần vượt không được khấu trừ."},
 K10:{cb:"Luật Kế toán 88/2015/QH13 – chứng từ, sửa chữa sổ kế toán; chế độ kế toán áp dụng (TT 200/TT 133/TT 99)",why:"Bút toán điều chỉnh không có căn cứ, phê duyệt làm sai lệch số liệu và là điểm CQT thường yêu cầu giải trình."},
 K11:{cb:"TT 103/2014/TT-BTC (nhà thầu nước ngoài); Luật Quản lý thuế 38/2019/QH14; NĐ 117/2025/NĐ-CP (từ 01/07/2025) – nền tảng số",why:"Khoản trả cho tổ chức nước ngoài chưa kê khai thuế nhà thầu bị truy thu GTGT, TNDN nhà thầu và phạt."},
 K12:{cb:"TT 40/2021/TT-BTC – cá nhân cho thuê tài sản; TT 96/2015/TT-BTC Đ4 (đến kỳ 2024); NĐ 320/2025/NĐ-CP (từ kỳ 2025)",why:"Thuê tài sản cá nhân cần hợp đồng, chứng từ thanh toán và chứng từ nộp thuế thay (nếu có thỏa thuận); thiếu thì chi phí bị loại."}};
const KW=[
 ["K1","Tiền phạt, chậm nộp","NT",/\b(phat vi pham|nop phat|xu phat|tien phat|cham nop|tien cham nop|truy thu)\b/,null,"Khoản phạt vi phạm hành chính, tiền chậm nộp không được tính vào chi phí được trừ (phạt vi phạm hợp đồng thì được trừ).","Luật Thuế TNDN – khoản chi không được trừ"],
 ["K2","Quà tặng, biếu, hiếu hỉ, từ thiện","TY",/\b(qua tang|qua tet|bieu|gio qua|sinh nhat|dam cuoi|dam hieu|phung vieng|mung tho|tu thien|ung ho|tai tro)\b/,null,"Kiểm tra quy chế, hóa đơn; quà biếu cho cá nhân/gia đình lãnh đạo không phục vụ SXKD là chi phí không được trừ; hàng biếu tặng phải lập hóa đơn.","TNDN-24, GTGT-21"],
 ["K3","Giải trí, cá nhân","TY",/\b(karaoke|massage|spa|bar|pub|golf|xong hoi|ruou ngoai|thuoc la|xi ga)\b/,null,"Chi phí mang tính cá nhân, rủi ro bị loại khi quyết toán.","RUIRO-08"],
 ["K4","Đồ dùng cá nhân, hàng hiệu","TY",/\b(dong ho|tui xach|trang suc|my pham|nuoc hoa|iphone|ipad|macbook|hoc phi|kham benh gia dinh)\b/,null,"Rà soát mục đích sử dụng; tài sản ≥ 30 triệu phải ghi tăng TSCĐ.","TNDN-24"],
 ["K5","Chi phí của chủ doanh nghiệp, gia đình","TY",/\b(nha rieng|gia dinh giam doc|gia dinh|chi ho|tra ho|xe ca nhan|ca nhan giam doc)\b/,null,"Chi phí không phục vụ SXKD không được trừ.","TNDN-24"],
 ["K6","Du lịch, nghỉ dưỡng","NHO",/\b(du lich|nghi mat|nghi duong|resort|team building)\b/,["dl"],"Là phúc lợi: kiểm tra mức ≤ 1 tháng lương bình quân.","TNDN-16"],
 ["K7","Chứng từ yếu, không hóa đơn","TY",/\b(khong hoa don|khong hd|chua co hd|hd ban le|phieu chi tay|tam tinh|uoc tinh|khoan chi|chi khac|mua cho)\b/,null,"Chi phí không có hóa đơn hợp lệ: cần bảng kê 01/TNDN hoặc bị loại.","TNDN-19"],
 ["K9","Xe ô tô giá trị lớn","NHO",/\b(mercedes|lexus|bmw|audi|porsche|range rover|land cruiser)\b/,["ks","dl","vt"],"Ô tô ≤ 9 chỗ: chỉ trừ khấu hao phần nguyên giá ≤ 1,6 tỷ (trừ DN kinh doanh vận tải, du lịch, khách sạn).","TNDN-13"],
 ["K10","Bút toán điều chỉnh, xử lý chênh lệch","TY",/\b(dieu chinh so du|xu ly chenh lech|ket chuyen sai|dao but toan|lam tron so)\b/,null,"Bút toán điều chỉnh phải có căn cứ, phê duyệt.","SODU"],
 ["K11","Nhà thầu nước ngoài, nền tảng số","TY",/\b(booking com|booking|agoda|expedia|traveloka|airbnb|trip com|google ads|facebook ads|meta platforms)\b/,null,"Khoản trả cho tổ chức nước ngoài: kiểm tra nghĩa vụ thuế nhà thầu (GTGT, TNDN) hoặc nhà cung cấp đã đăng ký thuế tại Việt Nam.","Thuế nhà thầu nước ngoài – cần đối chiếu","NHA_THAU_NN"],
 ["K12","Thuê tài sản của cá nhân","TY",/\b(thue xe (ong|ba|anh|chi|cua)|thue nha (ong|ba|anh|chi|cua)|thue xe ca nhan|thue nha ca nhan|thue nha rieng)\b/,null,"Thuê tài sản của cá nhân: cần hợp đồng, kê khai/khấu trừ thuế GTGT, TNCN thay cá nhân khi doanh thu vượt ngưỡng; chi từ 5 triệu phải chuyển khoản.","TNCN-18","THUE_TS_CA_NHAN"]
];
const PAIRS=[ // [Nợ, Có, mức, tên, ghi chú, chỉ áp dụng loại hình]
 ["411","111","NT","Rút vốn bằng tiền mặt"],["411","112","NT","Hoàn trả vốn góp"],["421","111","TY","Chia lợi nhuận bằng tiền mặt"],
 ["111","411","TY","Góp vốn bằng tiền mặt"],["111","341","TY","Vay bằng tiền mặt"],["111","3388","TY","Mượn tiền mặt của cá nhân/tổ chức"],
 ["131","111","TY","Chi tiền mặt cho khách hàng"],["642","131","TY","Xóa nợ phải thu vào chi phí quản lý (không qua dự phòng)"],["811","131","TY","Xóa nợ phải thu vào chi phí khác"],["635","131","TY","Xóa nợ phải thu vào chi phí tài chính"],
 ["1331","141","TY","Thuế đầu vào thanh toán qua tạm ứng"],["1331","334","TY","Thuế đầu vào đối ứng phải trả người lao động"],["1331","33311","NT","Kết chuyển thuế GTGT ngược chiều"],
 ["33311","511","NT","Giảm thuế đầu ra ghi tăng doanh thu"],["511","33311","NT","Giảm doanh thu ghi tăng thuế đầu ra"],["156","511","NT","Nhập kho đối ứng doanh thu"],
 ["635","15","NT","Xuất kho hạch toán vào chi phí tài chính"],["811","15","TY","Xuất kho hạch toán vào chi phí khác (hủy hàng?)"],["641","15","TY","Xuất kho dùng cho bán hàng (khuyến mại/biếu tặng) – kiểm tra hóa đơn"],["642","15","TY","Xuất kho dùng cho quản lý (biếu tặng?) – kiểm tra hóa đơn"],
 ["154","632","NT","Giá vốn chuyển ngược về dở dang"],["214","711","NT","Ghi giảm hao mòn vào thu nhập khác"],["8211","111","NT","Thuế TNDN ghi chi phí trực tiếp bằng tiền mặt"],["8211","112","NT","Thuế TNDN ghi chi phí trực tiếp qua ngân hàng"],
 ["642","411","NT","Chi phí đối ứng vốn chủ"],["642","421","NT","Chi phí đối ứng lợi nhuận chưa phân phối"],["622","111","TY","Lương nhân công trực tiếp chi tiền mặt không qua 334"],["622","112","TY","Lương nhân công trực tiếp chuyển khoản không qua 334"],
 ["632","111","TY","Giá vốn chi tiền mặt trực tiếp (mua bán thẳng)",["tm"]],["632","331","NHO","Giá vốn ghi thẳng công nợ người bán (mua bán thẳng)",["tm"]],["156","411","TY","Hàng hóa góp vốn – cần biên bản định giá"],
 ["811","333","NT","Tiền phạt/chậm nộp thuế ghi chi phí khác"]
];
function bookChecks(){
 const out=[],L=S.meta.loai,gl=GL(),[pa,pb]=periodRange();const has=k=>S.bk[k]&&S.bk[k].length;
 const add=(code,sev,t,d,kn,cb,items,extra={})=>out.push({code,sev,t,d,kn,cb,items,cat:extra.cat||"so",...extra});
 if(gl.length){
  const vs=vouchers(gl);
  // NKC-01 chứng từ không cân
  if(has("nkc")){const unb=vs.filter(v=>Math.abs(sumBy(v.lines,p=>p.n)-sumBy(v.lines,p=>p.c))>1);if(unb.length)add("CT_KHONG_CAN","NT",`${unb.length} chứng từ không cân Nợ – Có`,"Tổng phát sinh Nợ khác tổng phát sinh Có trong cùng chứng từ.","Kiểm tra dòng bị thiếu khi xuất sổ hoặc chứng từ hạch toán dở dang.","Nguyên tắc ghi sổ kép",unb.slice(0,30).map(v=>({d:v.d,so:v.so,dg:v.dg,amt:sumBy(v.lines,p=>p.n)-sumBy(v.lines,p=>p.c)})));
   const tn=sumBy(gl,p=>p.n),tc=sumBy(gl,p=>p.c);if(Math.abs(tn-tc)>1)add("NKC_KHONG_CAN","NT","Sổ nhật ký chung không cân",`Tổng PS Nợ ${fm(tn)}, tổng PS Có ${fm(tc)}, lệch ${fm(tn-tc)}.`,"Kiểm tra file xuất thiếu trang/dòng.","Nguyên tắc ghi sổ kép")}
  // NKC-12 ngoài kỳ
  const outP=gl.filter(p=>p.d<pa||p.d>pb);if(outP.length)add("NGOAI_KY","TY",`${vouchers(outP).length} chứng từ ngoài kỳ kiểm tra`,`Kỳ kiểm tra ${fd(pa)}–${fd(pb)}.`,"Loại khỏi số liệu kỳ này hoặc kiểm tra ghi nhận sai kỳ.","Nguyên tắc kỳ kế toán",vouchers(outP).slice(0,20).map(v=>({d:v.d,so:v.so,dg:v.dg,amt:sumBy(v.lines,p=>p.n)})));
  const ks=__SUA.B3?__khoaSoNam():S.meta.khoaSo;if(ks){const late=gl.filter(p=>p.dc&&p.dc>ks&&p.d<=pb);if(late.length)add("SAU_KHOA_SO","TY","Chứng từ ngày sau ngày khóa sổ",`${vouchers(late).length} chứng từ có ngày chứng từ sau ${fd(ks)}.`,"Kiểm tra ghi sổ lùi ngày.","",vouchers(late).slice(0,20).map(v=>({d:v.d,so:v.so,dg:v.dg,amt:sumBy(v.lines,p=>p.n)})))}
  // NKC-05 trùng chứng từ
  const seen=new Map(),dup=[];gl.forEach(p=>{if(!p.n)return;const k=[p.d,p.so,p.tk,p.du,Math.round(p.n),norm(p.dg),p.dt||""].join("|");if(seen.has(k))dup.push(p);else seen.set(k,p)});
  if(dup.length)add("TRUNG_CT","TY",`${dup.length} dòng phát sinh bị ghi trùng`,"Cùng ngày, số chứng từ, tài khoản, đối ứng, số tiền và diễn giải xuất hiện hơn một lần.","Xóa bút toán trùng; nếu là nhiều mặt hàng cùng giá thì bỏ qua cảnh báo.","SODU – chất lượng ghi sổ",dup.slice(0,20).map(p=>ev(p,p.n)));
  // NKC-06 trùng nghiệp vụ khác số chứng từ (cùng đối tượng, cặp TK, số tiền ±7 ngày)
  {const grp=new Map();gl.filter(p=>p.n>=1e6&&p.dt&&inAny(p.tk,["6","15","211","242","1331","331"])).forEach(p=>{const k=[p.dt,p.tk,p.du,Math.round(p.n)].join("|");(grp.get(k)||grp.set(k,[]).get(k)).push(p)});const hits=[];grp.forEach(a=>{const so=new Set(a.map(x=>x.so));if(so.size>1){a.sort((x,y)=>x.d.localeCompare(y.d));for(let i=1;i<a.length;i++){if(a[i].so!==a[i-1].so&&(new Date(a[i].d)-new Date(a[i-1].d))/864e5<=7)hits.push(a[i])}}});if(hits.length)add("TRUNG_NGHIEP_VU","TY",`${hits.length} nghiệp vụ nghi ghi trùng (khác số chứng từ)`,"Cùng đối tượng, cùng cặp tài khoản, cùng số tiền trong vòng 7 ngày.","Kiểm tra hóa đơn gốc; tránh ghi trùng chi phí.","NKC-06",hits.slice(0,20).map(p=>ev(p,p.n)))}
  // NKC-08 cặp đối ứng bất thường
  const pairHits={};gl.forEach(p=>{if(!p.n||!p.du)return;for(const[no,co,sev,name,mods]of PAIRS){if(mods&&!mods.includes(L))continue;if(P_(p.tk,no)&&P_(p.du,co)){if(no==="811"&&co==="333"&&!/phat|cham nop|truy thu/.test(norm(p.dg)))continue;(pairHits[no+"/"+co]||(pairHits[no+"/"+co]={sev,name,no,co,items:[]})).items.push(ev(p,p.n));break}}});
  Object.values(pairHits).forEach(h=>add("DU_BAT_THUONG",h.sev,`Đối ứng bất thường: Nợ ${h.no.length<3?h.no+"x":h.no} / Có ${h.co.length<3?h.co+"x":h.co} – ${h.name}`,`${h.items.length} bút toán, tổng ${fm(sumBy(h.items,x=>x.amt))}.`,"Xem chứng từ gốc, xác định bản chất nghiệp vụ và điều chỉnh tài khoản cho đúng.","Danh mục cặp đối ứng bất thường (SODU-04/23/45/46)",h.items.slice(0,20)));
  // NKC-09/10 chi tiền mặt từ ngưỡng
  {const hits=[];vs.forEach(v=>{const cash=v.lines.filter(p=>P_(p.tk,"111")&&p.c>0&&inAny(p.du,["15","211","213","241","242","6","811","1331","331"]));if(!cash.length)return;const invoiced=v.lines.some(p=>p.hd||P_(p.tk,"1331")||P_(p.du,"1331"))||/\b(hd|hoa don)\b/.test(norm(v.dg))||cash.some(p=>inAny(p.du,["15","211","213","241","331"]));if(!invoiced)return;const tot=sumBy(cash,p=>p.c);const vat=v.lines.some(p=>P_(p.tk,"1331")&&p.n>0)||cash.some(p=>P_(p.du,"1331"));const thV=pol("vat_cash",v.d),thC=pol("cit_cash",v.d);const cost=cash.some(p=>inAny(p.du,["6","811","15","211","242","241"]));
   const rules=[];if(vat&&tot>=thV)rules.push(`không được khấu trừ GTGT (ngưỡng ${fm(thV)} đ)`);if(cost&&tot>=thC)rules.push(`không được trừ khi tính TNDN (ngưỡng ${fm(thC)} đ)`);if(P_(cash[0].du,"331")&&tot>=thV)rules.push("trả nợ người bán bằng tiền mặt – hóa đơn liên quan mất điều kiện khấu trừ");
   if(rules.length)hits.push({d:v.d,so:v.so,dg:v.dg+" → "+rules.join("; "),amt:tot})});
   const hdCash=[];// bổ sung từ bảng kê HĐ đầu vào đã ghép
   if(hits.length)add("TM_5TR","NT",`${hits.length} khoản chi tiền mặt ≥ ${fm(pol("vat_cash",pb)/1e6)} triệu (phải thanh toán không dùng tiền mặt)`,`Tổng ${fm(sumBy(hits,x=>x.amt))}. Ngưỡng xét theo ngày chứng từ – GTGT được khấu trừ: ${POLICY.vat_cash.map(p=>`≥ ${fm(p.v/1e6)} triệu từ ${fd(p.from)}`).join(", ")}; chi phí được trừ TNDN: ${(POLICY.cit_cash||[]).map(p=>`≥ ${fm(p.v/1e6)} triệu từ ${fd(p.from)}`).join(", ")||"theo GTGT"}.`,"Chuyển sang thanh toán qua ngân hàng; loại thuế GTGT đầu vào và chi phí tương ứng khi quyết toán nếu không có chứng từ thanh toán không dùng tiền mặt.",`${polAt("vat_cash",pb)?.doc}; ${polAt("cit_cash",pb)?.doc}`,hits.slice(0,30))}
  // NKC-11 chia nhỏ chi tiền mặt
  {const g=new Map();gl.filter(p=>P_(p.tk,"111")&&p.c>0&&inAny(p.du,["6","15","331"])&&p.dt).forEach(p=>{const k=p.d+"|"+p.dt;(g.get(k)||g.set(k,[]).get(k)).push(p)});const hits=[];g.forEach(a=>{const th=pol("vat_cash",a[0].d);if(a.length>1&&a.every(p=>p.c<th)&&sumBy(a,p=>p.c)>=th)hits.push({d:a[0].d,so:a.map(p=>p.so).join(", "),dg:`${a[0].dt}: ${a.length} phiếu chi trong ngày`,amt:sumBy(a,p=>p.c)})});if(hits.length)add("CHIA_NHO_TM","TY","Chi tiền mặt chia nhỏ cho cùng đối tượng trong ngày","Từng phiếu dưới ngưỡng nhưng tổng trong ngày vượt ngưỡng.","Rủi ro bị xác định là tách nhỏ để né quy định thanh toán không dùng tiền mặt.","GTGT-08 – cần đối chiếu",hits)}
  // NKC-15 từ khóa
  const kwHit={};gl.forEach(p=>{if(!(p.n>0)||!inAny(p.tk,["6","811","242","1331","141","1388","331","154","627"]))return;const s=norm(p.dg);for(const[id,name,sev,re,exc,kn,cb,code]of KW){if(exc&&exc.includes(L))continue;if(id==="K3"&&(L==="nh"||L==="ks")&&/ruou|bia/.test(s))continue;if(re.test(s)&&!(__SUA.B9&&__kwNham(id,p.dg))){(kwHit[id]||(kwHit[id]={id,name,sev,kn,cb,code,items:[]})).items.push(ev(p,p.n));break}}});
  Object.values(kwHit).forEach(h=>add(h.code||"TU_KHOA",h.sev,`Diễn giải nhạy cảm: ${h.name}`,`${h.items.length} bút toán, tổng ${fm(sumBy(h.items,x=>x.amt))}.`,h.kn,KW_CITE[h.id]?.cb||h.cb,h.items.slice(0,20),{cite:KW_CITE[h.id]?{...KW_CITE[h.id],fix:h.kn}:undefined}));
  // NKC-31 chi lương không qua 334
  {const hits=gl.filter(p=>p.n>0&&inAny(p.tk,["622","627","641","642","154"])&&inAny(p.du,["111","112"])&&/\b(luong|thuong|thu lao|cong nhat|boi duong|phu cap)\b/.test(norm(p.dg)));if(hits.length)add("LUONG_NGOAI_334","TY","Chi lương, thưởng, thù lao không qua TK 334",`${hits.length} bút toán, tổng ${fm(sumBy(hits,p=>p.n))}.`,"Khoản có tính chất tiền lương phải qua 334 để kê khai, khấu trừ TNCN và đối chiếu BHXH.","TNCN-10",hits.slice(0,20).map(p=>ev(p,p.n)))}
  // NKC-16 số tròn lớn
  {const hits=gl.filter(p=>p.n>=50e6&&p.n%1e6===0&&(inAny(p.tk,["6","811","1388","141","3388"])||inAny(p.du,["711","3388","1388"]))&&!/luong|khau hao|phan bo|ket chuyen|nop thue|vay/.test(norm(p.dg)));if(hits.length)add("SO_TRON","NHO",`${hits.length} bút toán số tròn lớn`,"Số tiền chẵn triệu từ 50 triệu trở lên ở tài khoản chi phí, tạm ứng, phải thu/trả khác.","Kiểm tra căn cứ ước tính, hợp đồng, nghiệm thu.","NKC-16",hits.slice(0,15).map(p=>ev(p,p.n)))}
  // tháng thiếu khấu hao, lương, BH, phân bổ
  const months=monthsIn();const credM=pre=>byMonth(gl.filter(p=>P_(p.tk,pre)&&p.c>0&&!isKC(p)),p=>p.c);
  const hasFA=(tbGet("211")&&tbGet("211").dnd>0)||gl.some(p=>P_(p.tk,"211")&&p.n>0);
  if(hasFA){const m=credM("214");const miss=months.filter(i=>!m[i]);if(miss.length&&miss.length<months.length)add("THANG_THIEU_KH","TY",`Tháng không trích khấu hao: ${miss.map(i=>"T"+i).join(", ")}`,"Có TSCĐ nhưng các tháng này không có phát sinh Có TK 214.","Trích bổ sung khấu hao đúng kỳ; khấu hao không đều làm sai lệch kết quả từng kỳ.","TNDN-13; NKC-18")}
  const m334=credM("334");if(m334.some(x=>x)){const med=median(months.map(i=>m334[i]).filter(x=>x>0));const miss=months.filter(i=>!m334[i]||m334[i]<0.5*med);if(miss.length&&miss.length<months.length)add("THANG_THIEU_LUONG","TY",`Tháng không có hoặc rất thấp chi phí lương: ${miss.map(i=>"T"+i).join(", ")}`,`Trung vị lương tháng ${fm(med)}.`,"Kiểm tra lương dồn tháng, lương treo, bảng lương thiếu.","SODU-37; NKC-19");
   const m338=credM("3383");const miss2=months.filter(i=>m334[i]>0&&!m338[i]);if(miss2.length)add("THANG_THIEU_BH","TY",`Tháng có lương nhưng không trích BHXH: ${miss2.map(i=>"T"+i).join(", ")}`,"Có phát sinh Có 334 nhưng không phát sinh Có 3383.","Đối chiếu C12 từng tháng; trích bổ sung và nộp tiền chậm đóng nếu thiếu.","BHXH-08; Luật BHXH 41/2024")}
  if((tbGet("242")&&tbGet("242").dnd>0)||gl.some(p=>P_(p.tk,"242")&&p.n>0)){const m=credM("242");const miss=months.filter(i=>!m[i]);if(miss.length&&miss.length<months.length)add("THANG_THIEU_PB","TY",`Tháng không phân bổ chi phí trả trước: ${miss.map(i=>"T"+i).join(", ")}`,"Còn số dư TK 242 nhưng không có phát sinh Có.","Lập bảng phân bổ 242 liên tục, không bỏ tháng.","SODU-16")}
  // doanh thu – giá vốn theo tháng
  const dtM=byMonth(gl.filter(p=>P_(p.tk,"511")&&p.c>0&&!isKC(p)),p=>p.c),gvM=byMonth(gl.filter(p=>P_(p.tk,"632")&&p.n>0&&!isKC(p)),p=>p.n);
  if(dtM.some(x=>x)&&L!=="dv"||dtM.some(x=>x)&&gvM.some(x=>x)){const noGV=months.filter(i=>dtM[i]>0&&!gvM[i]);if(noGV.length)add("DT_KHONG_GV","TY",`Tháng có doanh thu nhưng không có giá vốn: ${noGV.map(i=>"T"+i).join(", ")}`,noGV.map(i=>`T${i}: DT ${fm(dtM[i])}`).join("; "),"Kiểm tra kết chuyển giá vốn, xuất kho, nghiệm thu chi phí.","SODU-43; NKC-23",null,{cat:"dt"});
   const rat=months.map(i=>dtM[i]?gvM[i]/dtM[i]:null);const med=median(rat);const odd=months.filter(i=>rat[__SUA.B5?months.indexOf(i):i-1]!=null&&med!=null&&gvM[i]&&Math.abs(rat[months.indexOf(i)]-med)>0.2);if(odd.length&&med)add("GV_DT_LECH","NHO",`Tỷ lệ giá vốn/doanh thu bất thường ở ${odd.map(i=>"T"+i).join(", ")}`,`Trung vị ${fx(med*100)}%; ${odd.map(i=>`T${i}: ${fx(gvM[i]/dtM[i]*100)}%`).join("; ")}.`,"Kiểm tra giá vốn ghi sai kỳ, chưa tính giá xuất kho.","NKC-23",null,{cat:"dt"});
   const noDT=months.filter(i=>gvM[i]>0&&!dtM[i]);if(noDT.length&&["tm","sx","xd"].includes(L))add("GV_KHONG_DT","TY",`Tháng có giá vốn nhưng không có doanh thu: ${noDT.map(i=>"T"+i).join(", ")}`,"","Doanh thu ghi thiếu hoặc lệch kỳ.","NKC-24",null,{cat:"dt"});
   if(months.length===12){const avg=sumBy(months.slice(0,11),i=>dtM[i])/11;if(avg>0&&dtM[12]/avg>2.5)add("DT_THANG12","TY","Doanh thu tháng 12 đột biến",`T12: ${fm(dtM[12])} = ${fx(dtM[12]/avg,1)} lần bình quân 11 tháng.`,"Kiểm tra ghi nhận doanh thu sớm, hóa đơn cuối năm, phải thu không thu được tiền sau kỳ.","TNDN-25; NKC-25",null,{cat:"dt"})}}
  // tỷ lệ thuế đầu ra / doanh thu theo tháng
  {const vatM=byMonth(gl.filter(p=>P_(p.tk,"3331")&&p.c>0&&!P_(p.du,"1331")),p=>p.c);const r=months.map(i=>dtM[i]?vatM[i]/dtM[i]:null);const hi=months.filter((i,k)=>r[k]!=null&&r[k]>0.1005);if(hi.length)add("VAT_DT_CAO","TY",`Thuế GTGT đầu ra > 10% doanh thu ở ${hi.map(i=>"T"+i).join(", ")}`,hi.map(i=>`T${i}: ${fx(vatM[i]/dtM[i]*100,2)}%`).join("; "),"Hóa đơn có thuế nhưng doanh thu ghi thiếu (ghi vào 131/3387/711?).","GTGT-19",null,{cat:"thue"})}
 }
 // ---------- sổ quỹ ----------
 {const q=has("quy")?S.bk.quy:gl.filter(p=>P_(p.tk,"111"));
  if(q.length){let open=tbGet("111")?tbGet("111").dnd-tbGet("111").dcd:null;if(open==null&&S.bkOpen&&S.bkOpen.quy){open=Object.values(S.bkOpen.quy).reduce((t,o)=>t+(o.du||0),0)}open=open||0;
   const byDay=new Map();q.forEach(p=>{const o=byDay.get(p.d)||{thu:0,chi:0,items:[]};o.thu+=p.n||0;o.chi+=p.c||0;o.items.push(p);byDay.set(p.d,o)});
   let bal=open,neg=[],soft=[];[...byDay.keys()].sort().forEach(d=>{const o=byDay.get(d);if(bal-o.chi<-1&&bal+o.thu-o.chi>=-1)soft.push({d,so:o.items.filter(p=>p.c).map(p=>p.so).join(", "),dg:"Chi trước khi thu trong ngày",amt:bal-o.chi});bal+=o.thu-o.chi;if(bal<-1)neg.push({d,so:o.items.map(p=>p.so).slice(0,4).join(", "),dg:`Tồn quỹ cuối ngày âm`,amt:bal})});
   if(neg.length)add("QUY_AM","NT",`Quỹ tiền mặt âm ${neg.length} ngày`,`Ngày đầu tiên ${fd(neg[0].d)}: tồn ${fm(neg[0].amt)}. Tồn đầu kỳ dùng để tính: ${fm(open)}.`,"Kiểm tra phiếu thu ghi thiếu/chậm (rút tiền ngân hàng, thu bán hàng), phiếu chi ghi trước ngày thực chi. Quỹ âm là sai nguyên tắc và là dấu hiệu chứng từ không trung thực.","SODU-01; QUY-01",neg.slice(0,20));
   else if(soft.length)add("QUY_AM_TRONG_NGAY","NHO","Quỹ âm tạm thời trong ngày (chi trước thu)",`${soft.length} ngày.`,"Sắp xếp thứ tự phiếu thu/chi theo thời gian thực tế.","QUY-01",soft.slice(0,10));
   const ts=val("TONG_TS","T");const avgBal=(()=>{let b=open,t=0,last=pa;const days=[...byDay.keys()].sort();days.forEach(d=>{t+=b*((new Date(d)-new Date(last))/864e5);last=d;b+=byDay.get(d).thu-byDay.get(d).chi});t+=b*((new Date(pb)-new Date(last))/864e5);return t/Math.max(1,(new Date(pb)-new Date(pa))/864e5)})();
   const loan=(tbGet("341")&&tbGet("341").dcc>0)||gl.some(p=>P_(p.tk,"635")&&p.n>0&&/lai vay/.test(norm(p.dg)));
   if(loan&&avgBal>Math.max(200e6/unitMul(),(ts||0)*0.05))add("QUY_LON_KHI_VAY","TY","Tồn quỹ tiền mặt bình quân lớn trong khi đi vay",`Tồn bình quân ${compact(avgBal)}.`,"CQT có thể loại chi phí lãi vay tương ứng phần tiền mặt tồn; kiểm kê quỹ, xử lý tiền treo.","SODU-02; QUY-05",null,{cat:"thue"});
   if(has("quy")&&tbGet("111")){const d=(open+sumBy(q,p=>p.n)-sumBy(q,p=>p.c))-(tbGet("111").dnc-tbGet("111").dcc);if(Math.abs(d)>TOL(d))add("QUY_LECH_CDPS","TY","Tồn cuối sổ quỹ lệch số dư TK 111 trên CĐPS",`Chênh ${fm(d)}.`,"Xem phần đối chiếu chéo để biết nguyên nhân.","QUY-10")}}}
 // rút tiền gửi không nhập quỹ
 {const hits=gl.filter(p=>P_(p.tk,"112")&&p.c>0&&/\brut (tien|tm|tien mat)\b|\brut tien\b/.test(norm(p.dg))&&!P_(p.du,"111")&&!P_(p.du,"113"));if(hits.length)add("RUT_KHONG_NHAP_QUY","TY",`${hits.length} lần rút tiền ngân hàng không nhập quỹ tiền mặt`,`Tổng ${fm(sumBy(hits,p=>p.c))}. Đối ứng: ${[...new Set(hits.map(p=>p.du))].join(", ")}.`,"Tiền rút ra phải nhập quỹ (Nợ 111) rồi mới chi; ghi thẳng tạm ứng/phải thu khác che giấu dòng tiền mặt.","QUY-06; RUIRO-06",hits.slice(0,15).map(p=>ev(p,p.c)))}
 // ---------- TGNH ----------
 {const b=has("tgnh")?S.bk.tgnh:gl.filter(p=>P_(p.tk,"112"));if(b.length){const accs=new Map();b.forEach(p=>{const k=p.bank||p.tk;(accs.get(k)||accs.set(k,[]).get(k)).push(p)});
  accs.forEach((rows,k)=>{const tk=rows[0].tk;const t=tbGet(tk);let bal=t&&t.tk===tk?t.dnd-t.dcd:0;const neg=[];const dd=new Map();rows.forEach(p=>{const o=dd.get(p.d)||{v:0,so:[]};o.v+=(p.n||0)-(p.c||0);if(p.c)o.so.push(p.so);dd.set(p.d,o)});[...dd.keys()].sort().forEach(d=>{const o=dd.get(d);bal+=o.v;if(bal<-1)neg.push({d,so:o.so.slice(0,3).join(", "),dg:"Số dư cuối ngày âm",amt:bal})});if(neg.length&&t&&t.tk===tk)add("TGNH_AM","TY",`Tài khoản ngân hàng ${k} có số dư âm`,`Lần đầu ${fd(neg[0].d)}: ${fm(neg[0].amt)}.`,"Thấu chi phải ghi vay (341); hoặc sót chứng từ báo có.","NH-01",neg.slice(0,10))});
  const ind=b.filter(p=>p.c>=20e6&&inAny(p.du,["141","1388","3388","334"])&&!(P_(p.du,"334")&&/luong/.test(norm(p.dg)))&&!/\b(cong ty|cty|tnhh|co phan|jsc|ngan hang|kho bac|bhxh|chi nhanh)\b/.test(norm(p.dg+" "+(p.dt||""))));if(ind.length)add("CK_CA_NHAN","TY",`${ind.length} khoản chuyển tiền lớn cho cá nhân`,`Tổng ${fm(sumBy(ind,p=>p.c))}.`,"Kiểm tra hồ sơ tạm ứng, cho vay, hoàn ứng; rủi ro dòng tiền quay vòng.","NH-03; RUIRO-06",ind.slice(0,15).map(p=>ev(p,p.c)))}}
 // ---------- công nợ ----------
 for(const k of["cn131","cn331"]){const rows=S.bk[k]||[];if(!rows.length)continue;const tk=k==="cn131"?"131":"331",nm=k==="cn131"?"khách hàng":"nhà cung cấp";
  const roll=rows.filter(r=>Math.abs((r.dnd-r.dcd+r.psn-r.psc)-(r.dnc-r.dcc))>1);if(roll.length)add("CN_KHONG_CAN","TY",`${roll.length} ${nm} có số dư cuối không khớp đầu kỳ + phát sinh`,"","Kiểm tra bảng tổng hợp bị sửa tay hoặc lọc thiếu chứng từ.","CN-01",roll.slice(0,15).map(r=>({so:r.ma,dg:r.ten,amt:(r.dnd-r.dcd+r.psn-r.psc)-(r.dnc-r.dcc)})));
  const both=rows.filter(r=>r.dnc>0&&r.dcc>0);if(both.length)add("CN_HAI_BEN","NHO",`${both.length} ${nm} vừa có dư Nợ vừa có dư Có`,"","Bù trừ trong cùng đối tượng trước khi lên BCTC.","CN-04",both.slice(0,10).map(r=>({so:r.ma,dg:r.ten,amt:r.dnc-r.dcc})));
  const treo=rows.filter(r=>!r.psn&&!r.psc&&Math.abs(r.dnc-r.dcc)>=1e6);if(treo.length)add("CN_TREO",k==="cn331"?"TY":"TY",`${treo.length} ${nm} còn số dư nhưng cả kỳ không phát sinh`,`Tổng ${fm(sumBy(treo,r=>Math.abs(r.dnc-r.dcc)))}.`,k==="cn331"?"Nợ phải trả treo lâu: dấu hiệu hóa đơn không có giao dịch thực hoặc chưa thanh toán. Hóa đơn từ 5 triệu chưa thanh toán quá hạn hợp đồng phải điều chỉnh giảm thuế GTGT đã khấu trừ; nợ không phải trả phải ghi thu nhập khác.":"Phải thu treo: đánh giá khả năng thu hồi, lập dự phòng hoặc xóa nợ đủ hồ sơ.",k==="cn331"?"SODU-34; GTGT-09; TNDN-26":"SODU-13",treo.slice(0,15).map(r=>({so:r.ma,dg:r.ten,amt:r.dnc-r.dcc})));
  const byName=new Map();rows.forEach(r=>{const n=norm(r.ten).replace(/\b(cong ty|cty|tnhh|co phan|cp|mtv|thuong mai|dich vu)\b/g,"").replace(/\s+/g," ").trim();if(!n)return;(byName.get(n)||byName.set(n,[]).get(n)).push(r)});const dupN=[...byName.values()].filter(a=>a.length>1);if(dupN.length)add("CN_TRUNG_DT","TY",`${dupN.length} đối tượng có nhiều mã`,dupN.slice(0,5).map(a=>a.map(r=>r.ma).join(" = ")).join("; "),"Gộp mã, bù trừ công nợ cùng đối tượng.","CN-05");
  const tot=sumBy(rows,r=>k==="cn131"?r.psn:r.psc);const top=[...rows].sort((a,b)=>(k==="cn131"?b.psn-a.psn:b.psc-a.psc))[0];if(top&&tot&&(k==="cn131"?top.psn:top.psc)/tot>0.5)add("CN_TAP_TRUNG","NHO",`Phụ thuộc một ${nm}: ${top.ten}`,`Chiếm ${fx((k==="cn131"?top.psn:top.psc)/tot*100,0)}% phát sinh.`,"Đánh giá rủi ro bên liên kết, tính liên tục hoạt động.","CN-09")}
 // ---------- NXT ----------
 if(has("nxt")){const r=S.bk.nxt;
  const roll=r.filter(x=>Math.abs(x.sld+x.sln-x.slx-x.slc)>0.001||Math.abs(x.gtd+x.gtn-x.gtx-x.gtc)>1);if(roll.length)add("NXT_KHONG_CAN","TY",`${roll.length} mã hàng không cân nhập – xuất – tồn`,"","Kiểm tra báo cáo lọc thiếu chứng từ hoặc sửa tay.","KHO-01",roll.slice(0,15).map(x=>({so:x.ma,dg:x.ten,amt:x.gtd+x.gtn-x.gtx-x.gtc})));
  const neg=r.filter(x=>x.slc<0||x.gtc<-1);if(neg.length)add("NXT_AM","NT",`${neg.length} mã hàng tồn kho âm`,neg.slice(0,5).map(x=>`${x.ma}: SL ${fm(x.slc)}, GT ${fm(x.gtc)}`).join("; "),"Xuất trước khi nhập, chưa nhập hóa đơn mua, xuất sai mã. Hàng bán không rõ nguồn gốc là rủi ro thuế lớn.","SODU-19; KHO-02",neg.slice(0,20).map(x=>({so:x.ma,dg:`${x.ten} – tồn ${fm(x.slc)} ${x.dvt||""}`,amt:x.gtc})));
  const z=r.filter(x=>(x.slc===0&&Math.abs(x.gtc)>1000)||(x.slc>0&&x.gtc===0));if(z.length)add("NXT_SL_GT","TY",`${z.length} mã hàng số lượng và giá trị không tương ứng`,"Số lượng bằng 0 nhưng còn giá trị, hoặc ngược lại.","Chạy lại tính giá xuất kho; xử lý chênh lệch làm tròn.","KHO-03",z.slice(0,15).map(x=>({so:x.ma,dg:`${x.ten}: SL ${fm(x.slc)}`,amt:x.gtc})));
  const pc=r.filter(x=>{if(!x.slx||x.slx<=0||x.sld+x.sln<=0)return false;const px=x.gtx/x.slx,pa_=(x.gtd+x.gtn)/(x.sld+x.sln);return pa_>0&&Math.abs(px/pa_-1)>0.05});if(pc.length)add("NXT_DON_GIA","TY",`${pc.length} mã hàng có đơn giá xuất lệch quá 5% so với giá bình quân`,"","Chưa chạy tính giá xuất kho, hoặc xuất theo giá tạm tính.","KHO-04; SODU-22",pc.slice(0,15).map(x=>({so:x.ma,dg:`${x.ten}: giá xuất ${fm(x.gtx/x.slx)} / bình quân ${fm((x.gtd+x.gtn)/(x.sld+x.sln))}`,amt:x.gtx-x.slx*(x.gtd+x.gtn)/(x.sld+x.sln)})));
  const slow=r.filter(x=>!x.slx&&x.slc>0&&x.gtc>0);if(slow.length)add("NXT_CHAM","NHO",`${slow.length} mã hàng không xuất trong kỳ`,`Giá trị ${fm(sumBy(slow,x=>x.gtc))}.`,"Đánh giá lập dự phòng giảm giá hàng tồn kho (2294).","SODU-21; KHO-06",slow.slice(0,15).map(x=>({so:x.ma,dg:x.ten,amt:x.gtc})))}
 // ---------- giá thành ----------
 if(has("gt")){const r=S.bk.gt;
  const roll=r.filter(x=>Math.abs(x.ddd+x.nvl+x.nc+x.mtc+x.sxc-x.ddc-x.z)>Math.max(1000,x.z*0.0001));if(roll.length)add("GT_ROLL","TY",`${roll.length} đối tượng giá thành không cân`,"Dở dang đầu + chi phí trong kỳ − dở dang cuối ≠ tổng giá thành.","Kiểm tra lại bảng tính giá thành, số dở dang cuối kỳ.","GT-01",roll.slice(0,15).map(x=>({so:x.ma,dg:x.ten,amt:x.ddd+x.nvl+x.nc+x.mtc+x.sxc-x.ddc-x.z})));
  const neg=r.filter(x=>x.ddc<-1);if(neg.length)add("GT_DD_AM","NT",`${neg.length} đối tượng dở dang cuối kỳ âm`,"","Kết chuyển giá vốn vượt chi phí đã tập hợp.","GT-03",neg.map(x=>({so:x.ma,dg:x.ten,amt:x.ddc})));
  if(["xd","dv","dl","vt"].includes(L)){const fz=r.filter(x=>x.ddc>0&&!(x.nvl+x.nc+x.mtc+x.sxc));if(fz.length)add("CT_TON_DONG","TY",`${fz.length} ${L==="xd"?"công trình":L==="dl"?"tour":"hợp đồng"} còn dở dang nhưng cả kỳ không phát sinh chi phí`,`Tổng ${fm(sumBy(fz,x=>x.ddc))}.`,"Kiểm tra tình trạng thi công/thực hiện, quyết toán; chi phí dở dang lâu có thể không có thật hoặc phải kết chuyển giá vốn.","GT-06; SODU-25",fz.map(x=>({so:x.ma,dg:x.ten,amt:x.ddc})))}
  const lo=r.filter(x=>x.dthu!=null&&x.dthu>0&&x.z>x.dthu);if(lo.length)add("CT_LO","TY",`${lo.length} ${L==="xd"?"công trình":L==="dl"?"tour":"hợp đồng/sản phẩm"} có giá vốn lớn hơn doanh thu`,lo.map(x=>`${x.ma}: DT ${fm(x.dthu)}, Z ${fm(x.z)}`).join("; "),"Giải trình nguyên nhân lỗ; kiểm tra chi phí phân bổ nhầm đối tượng.","GT-07; SODU-24",lo.map(x=>({so:x.ma,dg:x.ten,amt:x.dthu-x.z})),{cat:"dt"});
  if(L==="sx"){const zs=r.filter(x=>x.sl>0);zs.forEach(()=>0)}}
 // ---------- bảng kê hóa đơn ----------
 const match=hdMatch();
 for(const k of["hdr","hdv"]){const r=S.bk[k]||[];if(!r.length)continue;const io=k==="hdr"?"bán ra":"mua vào";
  const bad=r.filter(x=>/huy|bi thay the|da bi thay the/.test(norm(x.tt)));if(bad.length)add("HD_TRANG_THAI","NT",`${bad.length} hóa đơn ${io} đã hủy hoặc đã bị thay thế`,"","Không kê khai, không hạch toán hóa đơn đã hủy/bị thay thế; kiểm tra hóa đơn thay thế tương ứng.","NĐ 123/2020 sđ NĐ 70/2025",bad.slice(0,15).map(x=>({d:x.d,so:x.so,dg:`${x.ten} – ${x.tt}`,amt:x.thue})));
  const s=new Map(),dp=[];r.forEach(x=>{const kk=x.mst+"|"+x.kh+"|"+x.so;if(s.has(kk))dp.push(x);else s.set(kk,x)});if(dp.length)add("HD_TRUNG","NT",`${dp.length} hóa đơn ${io} trùng trong bảng kê`,"","Loại hóa đơn trùng khỏi kê khai.","GTGT-05",dp.map(x=>({d:x.d,so:x.so,dg:x.ten,amt:x.thue})));
  if(match){const un=match[k].unmatched;if(un.length)add(k==="hdr"?"HDR_CHUA_GHI":"HDV_CHUA_GHI",k==="hdr"?"NT":"TY",`${un.length} hóa đơn ${io} có trên bảng kê nhưng không tìm thấy trên sổ`,`Tổng tiền thuế ${fm(sumBy(un,x=>x.thue))}, chưa thuế ${fm(sumBy(un,x=>x.truoc))}.`,k==="hdr"?"Doanh thu và thuế đầu ra chưa ghi sổ: ghi bổ sung đúng kỳ hóa đơn.":"Hóa đơn đầu vào chưa hạch toán: kiểm tra hàng đã nhận, chi phí đã ghi nhận chưa.","RUIRO-05; HD-06",un.slice(0,25).map(x=>({d:x.d,so:x.so,dg:x.ten,amt:x.truoc+x.thue})),{cat:"thue"});
   const ub=match[k].unbooked;if(ub.length)add(k==="hdr"?"SO_KHONG_HDR":"SO_KHONG_HDV",k==="hdr"?"TY":"NT",`${ub.length} bút toán thuế GTGT ${io} không ghép được hóa đơn trên bảng kê`,`Tổng thuế ${fm(sumBy(ub,x=>x.amt))}.`,k==="hdv"?"Thuế đầu vào ghi sổ nhưng không có hóa đơn trên hệ thống: rủi ro khấu trừ không hợp lệ.":"Thuế đầu ra ghi sổ nhưng không có hóa đơn: kiểm tra hóa đơn đã xuất, bảng kê đủ chưa.","HD-07",ub.slice(0,20),{cat:"thue"})}
  if(k==="hdv"){const big=r.filter(x=>x.tong>=pol("vat_cash",x.d||pb)&&!/huy|thay the/.test(norm(x.tt)));if(big.length&&match){const cash=big.filter(x=>{const v=match.hdv.link.get(x);return v&&v.cash});if(cash.length)add("TM_5TR","NT",`${cash.length} hóa đơn đầu vào ≥ ${fm(pol("vat_cash",pb)/1e6)} triệu thanh toán bằng tiền mặt`,`Thuế ${fm(sumBy(cash,x=>x.thue))} không đủ điều kiện khấu trừ.`,"Loại khỏi số thuế được khấu trừ, điều chỉnh giảm qua chỉ tiêu [37] hoặc khai bổ sung.",polAt("vat_cash",pb)?.doc,cash.map(x=>({d:x.d,so:x.so,dg:x.ten,amt:x.tong})),{cat:"thue"})}}}
 // ---------- tờ khai GTGT ----------
 const tks=finalTK();if(tks.length){
  const chain=[];for(let i=1;i<tks.length;i++){const a=tks[i-1].ct,b=tks[i].ct;if(a["43"]!=null&&b["22"]!=null&&Math.abs(a["43"]-b["22"])>1)chain.push({so:tks[i].ky,dg:`[22] ${fm(b["22"])} ≠ [43] kỳ ${tks[i-1].ky} ${fm(a["43"])}`,amt:b["22"]-a["43"]})}
  if(chain.length)add("TK_CHUOI","TY",`${chain.length} kỳ có chỉ tiêu [22] không khớp [43] kỳ trước`,"","Giải trình hoặc khai bổ sung kỳ trước; kiểm tra tờ khai bổ sung chưa cập nhật.","GTGT-02; TK-01",chain,{cat:"thue"});
  const fe=[];tks.forEach(t=>{const c=t.ct,g=x=>c[x]||0;const chk=(n,a,b)=>{if(Math.abs(a-b)>2)fe.push({so:t.ky,dg:`${n}: ${fm(a)} ≠ ${fm(b)}`,amt:a-b})};if(c["36"]!=null)chk("[36] = [35] − [25]",g("36"),g("35")-g("25"));const X=g("36")-g("22")+g("37")-g("38")-g("39a");if(c["40a"]!=null)chk("[40a]",g("40a"),Math.max(0,X));if(c["41"]!=null)chk("[41]",g("41"),Math.max(0,-X));if(c["43"]!=null&&c["41"]!=null)chk("[43] = [41] − [42]",g("43"),g("41")-g("42"))});
  if(fe.length)add("TK_CONG_THUC","NT",`${fe.length} lỗi công thức trên tờ khai GTGT`,"","Lập lại tờ khai trên HTKK; kiểm tra file XML bị sửa.","TK-02",fe,{cat:"thue"});
 }
 return out;
}
function finalTK(){const m=new Map();(S.tk||[]).forEach(t=>{const o=m.get(t.ky);if(!o||t.lan>o.lan||(t.loai==="B"&&o.loai!=="B"))m.set(t.ky,t)});return[...m.values()].sort(kyCmp)}
function tkMonth(ky){const m=String(ky).match(/([TQ])(\d+)\/(\d{4})/);if(!m)return null;return m[1]==="T"?[+m[2]]:[+m[2]*3-2,+m[2]*3-1,+m[2]*3]}
function syncTK(){const t=finalTK();if(!t.length)return;const set=(k,v)=>{if(v==null)return;const o=S.v[k];if(!o||o.t==null||o.auto){S.v[k]={t:Math.round(v),p:o?o.p:null,auto:true}}};
 set("CT22_DAU",t[0].ct["22"]);set("CT43",t.at(-1).ct["43"]);set("CT40_CUOI",t.at(-1).ct["40"]);set("CT24_SUM",__SUA.B14&&t.some(x=>x.ct["24"]==null)?null:sumBy(t,x=>x.ct["24"]));set("CT_RA_SUM",sumBy(t,x=>x.ct["35"]??x.ct["28"]));set("DT_GTGT",sumBy(t,x=>x.ct["34"]))}
let _hdm=null,_hdmKey="";
function hdMatch(){
 const gl=GL();if(!gl.length||(!S.bk.hdr.length&&!S.bk.hdv.length))return null;
 const key=gl.length+"|"+S.bk.hdr.length+"|"+S.bk.hdv.length;if(_hdm&&_hdmKey===key)return _hdm;
 const vs=vouchers(gl);const res={};
 for(const k of["hdr","hdv"]){const list=(S.bk[k]||[]).filter(x=>!/huy|bi thay the/.test(norm(x.tt)));
  const taxP=gl.filter(p=>k==="hdr"?P_(p.tk,"3331")&&p.c>0&&!P_(p.du,"1331")&&!P_(p.du,"112")&&!P_(p.du,"111")||(k==="hdr"&&P_(p.tk,"3331")&&p.c>0&&(P_(p.du,"111")||P_(p.du,"112"))):P_(p.tk,"1331")&&p.n>0);
  const used=new Set(),link=new Map(),unmatched=[];
  const vmap=new Map();vs.forEach(v=>vmap.set(vkey(v),v));
  const byHd=new Map();taxP.forEach(p=>{const h=p.hd||(norm(p.dg).match(/(?:hd|hoa don)\s*(?:so)?\s*0*(\d{1,8})/)||[])[1];if(h){(byHd.get(String(+h))||byHd.set(String(+h),[]).get(String(+h))).push(p)}});
  for(const x of list){let p=null;const c=byHd.get(String(+x.so))||[];p=c.find(q=>!used.has(q)&&Math.abs((k==="hdr"?q.c:q.n)-x.thue)<=Math.max(2,x.thue*0.001));
   if(!p)p=taxP.find(q=>!used.has(q)&&Math.abs((k==="hdr"?q.c:q.n)-x.thue)<=1&&x.d&&Math.abs(new Date(q.d)-new Date(x.d))/864e5<=31);
   if(p){used.add(p);const v=vmap.get(vkey(p));link.set(x,{p,cash:!!(v&&v.lines.some(l=>P_(l.tk,"111")&&l.c>0))})}else unmatched.push(x)}
  const unbooked=taxP.filter(p=>!used.has(p)&&(k==="hdr"?p.c:p.n)>0).map(p=>ev(p,k==="hdr"?p.c:p.n));
  res[k]={link,unmatched,unbooked};
 }
 _hdm=res;_hdmKey=key;return res;
}
function recon(){
 const rows=[],gl=GL(),L=S.meta.loai;const st=(d,ref)=>Math.abs(d)<=1?"ok":Math.abs(d)<=Math.max(1000,Math.abs(ref||0)*0.0005)?"round":"fail";
 const row=(grp,n,a,b,la,lb,causes,extra={})=>{if(a==null||b==null)return;const d=a-b;rows.push({grp,n,a,b,la,lb,d,st:st(d,b),causes:st(d,b)==="fail"?causes(d):null,...extra})};
 const pool=(pred,side)=>gl.filter(pred).map(p=>ev(p,side==="n"?p.n:side==="c"?p.c:(p.n||p.c)));
 const has=tbHas();
 // 1. BCTC ↔ CĐPS
 if(has&&Object.keys(S.v).length){
  const t=k=>tbGet(k)||T0;const sumNet=(tks,end=true)=>tks.reduce((s,k)=>{const r=tbGet(k);return r?s+(end?r.dnc-r.dcc:r.dnd-r.dcd):s},0);
  const D131=t("131"),D331=t("331");
  const items=[
   ["Tiền và tương đương tiền (110)","TIEN",sumNet(["111","112","113"]),d=>explain(d,[],{cands:[{label:"Số dư 1281 (tương đương tiền)",v:sumNet(["1281"])},{label:"Số dư 113 (tiền đang chuyển)",v:sumNet(["113"])},{label:"Dư Có TK 112 (thấu chi)",v:t("112").dcc}]})],
   ["Phải thu khách hàng (131)","PTKH",D131.dnc,d=>explain(d,[],{cands:[{label:"Tổng dư Có chi tiết 131 (chưa tách lưỡng tính)",v:D131.dcc},{label:"Dự phòng phải thu khó đòi 2293",v:t("2293").dcc}]})],
   ["Trả trước cho người bán (132)","TTNB",D331.dnc,d=>explain(d,[],{cands:[{label:"Tổng dư Nợ chi tiết 331 bị bù trừ vào phải trả",v:D331.dnc}]})],
   ["Hàng tồn kho (140)","HTK",sumNet(["151","152","153","154","155","156","157","158"]),d=>explain(d,[],{cands:[{label:"Dự phòng giảm giá 2294",v:t("2294").dcc},{label:"Dư 154 dài hạn",v:0},{label:"Dư Có 154",v:t("154").dcc}]})],
   ["Tài sản cố định (220)","TSCD",sumNet(["211","212","213","214"]),d=>explain(d,[],{cands:[{label:"BĐS đầu tư 217/2147",v:sumNet(["217","2147"])},{label:"XDCB dở dang 241",v:sumNet(["241"])}]})],
   ["Phải trả người bán (311)","PTNB",D331.dcc,d=>explain(d,[],{cands:[{label:"Tổng dư Nợ chi tiết 331 (trả trước người bán bị bù trừ)",v:D331.dnc}]})],
   ["Người mua trả tiền trước (312)","NMTT",D131.dcc,d=>explain(d,[],{cands:[{label:"Tổng dư Có chi tiết 131",v:D131.dcc},{label:"Doanh thu chưa thực hiện 3387",v:t("3387").dcc}]})],
   ["Vốn góp của chủ sở hữu (411)","VON_GOP",(tbGet("4111")||t("411")).dcc,d=>explain(d,[],{})],
   ["LN sau thuế chưa phân phối (421)","LNCPP",-sumNet(["421"]),d=>explain(d,pool(p=>P_(p.tk,"421")),{cands:[{label:"Chia lợi nhuận/trích quỹ trong kỳ (PS Nợ 421 ngoài kết chuyển)",v:sumBy(gl.filter(p=>P_(p.tk,"421")&&p.n>0&&!P_(p.du,"911")),p=>p.n)}]})],
   ["Doanh thu bán hàng (01)","DT_BH",t("511").psc-sumBy(gl.filter(p=>P_(p.tk,"511")&&p.c>0&&P_(p.du,"911")),p=>p.c),d=>explain(d,pool(p=>P_(p.tk,"511")&&p.c>0,"c"),{cands:[{label:"Phát sinh 521 giảm trừ",v:t("521").psn}]})],
   ["Giá vốn hàng bán (11)","GVHB",t("632").psn-sumBy(gl.filter(p=>P_(p.tk,"632")&&p.n>0&&P_(p.du,"911")),p=>p.n),d=>explain(d,pool(p=>P_(p.tk,"632")&&p.n>0,"n"),{cands:[{label:"Hoàn nhập dự phòng ghi giảm 632",v:sumBy(gl.filter(p=>P_(p.tk,"632")&&p.c>0&&!P_(p.du,"911")),p=>p.c)}]})]
  ];
  if(!gl.length)items.forEach(x=>{if(x[0].includes("(01)"))x[2]=t("511").psc;if(x[0].includes("(11)"))x[2]=t("632").psn});
  items.forEach(([n,k,a,cz])=>{const b=val(k,"T");if(b==null)return;if(!["TIEN","PTKH","TTNB","HTK","TSCD","PTNB","NMTT","VON_GOP","LNCPP","DT_BH","GVHB"].includes(k))return;const tkl=n.match(/\((\d+)\)/);row("BCTC ↔ Bảng cân đối phát sinh",n,a,b,"Theo CĐPS","Theo BCTC",cz,{code:(k==="PTNB"||k==="TTNB"||k==="PTKH"||k==="NMTT")?"TRINH_BAY_LT":"BCTC_CDPS"})});
 }
 // 2. CĐPS ↔ sổ (NKC/sổ chi tiết) theo tài khoản
 if(has&&gl.length){const leaf=S.tb.filter(r=>!S.tb.some(x=>x!==r&&x.tk.length>r.tk.length&&x.tk.startsWith(r.tk)));const glTk=new Map();gl.forEach(p=>{const o=glTk.get(p.tk)||{n:0,c:0};o.n+=p.n||0;o.c+=p.c||0;glTk.set(p.tk,o)});
  const tks=new Set([...leaf.map(r=>r.tk),...glTk.keys()]);const onlyNKC=S.bk.nkc&&S.bk.nkc.length;
  [...tks].sort().forEach(tk=>{const r=tbGet(tk);const g=glTk.get(tk)||{n:0,c:0};if(!onlyNKC&&!glTk.has(tk))return;if(!r){if(g.n||g.c)rows.push({grp:"CĐPS ↔ "+glSrc(),n:`TK ${tk} – có trên sổ, không có trên CĐPS`,a:g.n,b:0,la:"PS Nợ sổ",lb:"CĐPS",d:g.n,st:"fail",causes:[{p:60,t:"Tài khoản phát sinh trên sổ nhưng bảng CĐPS không có: CĐPS lọc thiếu tài khoản hoặc sổ dùng tài khoản chi tiết khác"}]});return}
   for(const[side,lab]of[["n","PS Nợ"],["c","PS Có"]]){const a=side==="n"?g.n:g.c,b=side==="n"?r.psn:r.psc;const d=a-b;if(Math.abs(d)<=1)continue;const ps=gl.filter(p=>p.tk===tk&&(side==="n"?p.n:p.c));row("CĐPS ↔ "+glSrc(),`TK ${tk} ${TKN[tk]||TKN[tk.slice(0,3)]||""} – ${lab}`,a,b,"Theo sổ","Theo CĐPS",dd=>explain(dd,ps.map(p=>ev(p,side==="n"?p.n:p.c)),{cands:[{label:"Bút toán kết chuyển 911",v:sumBy(ps.filter(isKC),p=>side==="n"?p.n:p.c)}]}),{code:"CDPS_SO"})}})}
 // 3. 111 ↔ sổ quỹ ; 112 ↔ sổ TGNH
 if(has&&S.bk.quy&&S.bk.quy.length&&tbGet("111")){const q=S.bk.quy,t=tbGet("111");row("Tiền mặt, tiền gửi","Phát sinh thu – Sổ quỹ ↔ PS Nợ 111",sumBy(q,p=>p.n),t.psn,"Sổ quỹ","CĐPS",d=>explain(d,q.map(p=>ev(p,p.n)),{}));row("Tiền mặt, tiền gửi","Phát sinh chi – Sổ quỹ ↔ PS Có 111",sumBy(q,p=>p.c),t.psc,"Sổ quỹ","CĐPS",d=>explain(d,q.map(p=>ev(p,p.c)),{}))}
 if(has&&S.bk.tgnh&&S.bk.tgnh.length&&tbGet("112")){const b=S.bk.tgnh,t=tbGet("112");row("Tiền mặt, tiền gửi","Tiền gửi vào – Sổ TGNH ↔ PS Nợ 112",sumBy(b,p=>p.n),t.psn,"Sổ TGNH","CĐPS",d=>explain(d,b.map(p=>ev(p,p.n)),{}));row("Tiền mặt, tiền gửi","Rút ra – Sổ TGNH ↔ PS Có 112",sumBy(b,p=>p.c),t.psc,"Sổ TGNH","CĐPS",d=>explain(d,b.map(p=>ev(p,p.c)),{}));
  // rút tiền ngân hàng ↔ phiếu thu quỹ
  if(S.bk.quy&&S.bk.quy.length){const wd=b.filter(p=>p.c>0&&P_(p.du,"111")),rc=S.bk.quy.filter(p=>p.n>0&&P_(p.du,"112"));row("Tiền mặt, tiền gửi","Rút tiền gửi về quỹ ↔ phiếu thu từ ngân hàng",sumBy(wd,p=>p.c),sumBy(rc,p=>p.n),"Sổ TGNH","Sổ quỹ",d=>explain(d,[...wd.map(p=>ev(p,p.c)),...rc.map(p=>ev(p,p.n))],{}))}}
 // 4. công nợ ↔ CĐPS
 for(const[k,tk]of[["cn131","131"],["cn331","331"]]){const r=S.bk[k]||[];const t=tbGet(tk);if(!r.length||!t)continue;const nm=tk==="131"?"Phải thu khách hàng":"Phải trả người bán";
  [["dnd","Dư Nợ đầu kỳ"],["dcd","Dư Có đầu kỳ"],["psn","PS Nợ"],["psc","PS Có"],["dnc","Dư Nợ cuối kỳ"],["dcc","Dư Có cuối kỳ"]].forEach(([f,lab])=>row(`Công nợ ${tk}`,`${nm} – ${lab}`,sumBy(r,x=>x[f]),t[f],"Bảng tổng hợp công nợ","CĐPS",d=>{const net=sumBy(r,x=>x.dnc-x.dcc)-(t.dnc-t.dcc);const c=[];if(f.startsWith("d")&&Math.abs(net)<=1)c.push({p:92,t:"Số ròng khớp, chỉ lệch do CĐPS in số dư ròng (chưa tách lưỡng tính theo đối tượng)"});const ps=gl.filter(p=>P_(p.tk,tk));return[...c,...explain(d,ps.map(p=>ev(p,p.n||p.c)),{})]}))}
 // 5. kho ↔ CĐPS ; xuất kho ↔ giá vốn
 if(has&&S.bk.nxt&&S.bk.nxt.length){const r=S.bk.nxt;const grp=new Map();r.forEach(x=>{const tk=(x.tk||"").slice(0,3)||guessTkKho(x);(grp.get(tk)||grp.set(tk,[]).get(tk)).push(x)});
  grp.forEach((xs,tk)=>{const t=tbGet(tk);if(!t)return;[["gtd","dnd","Tồn đầu"],["gtn","psn","Nhập"],["gtx","psc","Xuất"],["gtc","dnc","Tồn cuối"]].forEach(([a,b,lab])=>row("Hàng tồn kho",`TK ${tk} – ${lab}: NXT ↔ CĐPS`,sumBy(xs,x=>x[a]),t[b]-(b==="dnc"?t.dcc:b==="dnd"?t.dcd:0),"Bảng NXT","CĐPS",d=>explain(d,gl.filter(p=>P_(p.tk,tk)).map(p=>ev(p,p.n||p.c)),{cands:[{label:"Hàng gửi bán 157/hàng đi đường 151",v:sumBy(["151","157"],k=>tbGet(k)?tbGet(k).dnc:0)}]})))});
  if(gl.length&&["tm","sx"].includes(L)){const tk=L==="tm"?"156":"155";const xs=grp.get(tk)||[];if(xs.length){const a=sumBy(xs,x=>x.gtx),b=sumBy(gl.filter(p=>P_(p.tk,"632")&&p.n>0&&P_(p.du,tk)),p=>p.n);row("Hàng tồn kho",`Giá trị xuất kho ${tk} (NXT) ↔ giá vốn Nợ 632/Có ${tk}`,a,b,"Bảng NXT","Sổ",d=>explain(d,gl.filter(p=>P_(p.tk,tk)&&p.c>0).map(p=>ev(p,p.c)),{cands:[{label:`Xuất kho ${tk} không vào giá vốn (đối ứng khác 632)`,v:sumBy(gl.filter(p=>P_(p.tk,tk)&&p.c>0&&!P_(p.du,"632")),p=>p.c)}]}))}}}
 // 6. giá thành ↔ CĐPS
 if(has&&S.bk.gt&&S.bk.gt.length&&tbGet("154")){const r=S.bk.gt,t=tbGet("154");row("Giá thành","Dở dang cuối kỳ: bảng giá thành ↔ dư 154",sumBy(r,x=>x.ddc),t.dnc-t.dcc,"Bảng giá thành","CĐPS",d=>explain(d,[],{cands:[...r.map(x=>({label:`Bảng giá thành không cân ở ${x.ma} (đầu kỳ + chi phí − cuối kỳ − giá thành)`,v:x.ddd+x.nvl+x.nc+x.mtc+x.sxc-x.ddc-x.z})).filter(c=>Math.abs(c.v)>1000),...r.map(x=>({label:`Dở dang của ${x.ma}`,v:x.ddc}))]}),{code:"GT_LECH_SO"});
  row("Giá thành","Dở dang đầu kỳ: bảng giá thành ↔ dư đầu 154",sumBy(r,x=>x.ddd),t.dnd-t.dcd,"Bảng giá thành","CĐPS",d=>explain(d,[],{}),{code:"GT_LECH_SO"});
  if(gl.length){const z=sumBy(r,x=>x.z);const out=sumBy(gl.filter(p=>P_(p.tk,"154")&&p.c>0),p=>p.c);row("Giá thành","Tổng giá thành ↔ PS Có 154",z,out,"Bảng giá thành","Sổ",d=>explain(d,gl.filter(p=>P_(p.tk,"154")&&p.c>0).map(p=>ev(p,p.c)),{cands:[{label:"Phế liệu thu hồi/ hàng hỏng ghi giảm 154",v:sumBy(gl.filter(p=>P_(p.tk,"154")&&p.c>0&&!inAny(p.du,["155","632"])),p=>p.c)}]}),{code:"GT_LECH_SO"})}}
 // 7. tờ khai ↔ sổ theo kỳ (doanh thu, thuế đầu ra, thuế đầu vào)
 const tks=finalTK();if(tks.length&&gl.length){
  const outM=byMonth(gl.filter(p=>P_(p.tk,"3331")&&p.c>0&&!P_(p.du,"1331")),p=>p.c),inM=byMonth(gl.filter(p=>P_(p.tk,"133")&&p.n>0),p=>p.n),dtM=byMonth(gl.filter(p=>P_(p.tk,"511")&&p.c>0&&!isKC(p)),p=>p.c);
  const hdr=S.bk.hdr||[],hdv=S.bk.hdv||[];const mt=match_=>match_;const hm=hdMatch();
  [["35","Thuế GTGT đầu ra",outM,"hdr",x=>x.thue],["24","Thuế GTGT đầu vào",inM,"hdv",x=>x.thue],["34","Doanh thu",dtM,"hdr",x=>x.truoc]].forEach(([ct,nm,m,hk,f])=>{
   const diffs=Array(13).fill(0);let A=0,B=0;tks.forEach(t=>{const ms=tkMonth(t.ky);if(!ms)return;const so=sumBy(ms,i=>m[i]);const tkv=t.ct[ct]??(ct==="35"?t.ct["28"]:null);if(tkv==null)return;A+=so;B+=tkv;if(ms.length===1)diffs[ms[0]]=so-tkv;else diffs[ms[2]]=so-tkv});
   const ym=diffs.map((x,i)=>[i,x]).filter(([i,x])=>i&&Math.abs(x)>TOL(x));
   ym.forEach(([i,dm])=>{const ky=tks.find(t=>(tkMonth(t.ky)||[]).includes(i));const un=hm&&hm[hk]?hm[hk].unmatched.filter(x=>mon(x.d)===i||(ky&&(tkMonth(ky.ky)||[]).includes(mon(x.d)))):[];
    const late=(S.bk[hk]||[]).filter(x=>x.d&&(tkMonth(ky?.ky)||[]).includes(mon(x.d))&&hm&&hm[hk].link.get(x)&&mon(hm[hk].link.get(x).p.d)!==mon(x.d)).map(x=>({...x,amt:f(x),dg:`${x.ten} – HĐ ngày ${fd(x.d)}, ghi sổ ${fd(hm[hk].link.get(x).p.d)}`}));
    rows.push({grp:"Sổ ↔ Tờ khai GTGT",n:`${nm} kỳ ${ky?ky.ky:"T"+i}: sổ ↔ tờ khai [${ct}]`,a:sumBy(tkMonth(ky?.ky)||[i],j=>m[j]),b:(ky&&(ky.ct[ct]??ky.ct["28"]))||0,la:"Theo sổ",lb:"Tờ khai",d:dm,st:"fail",code:ct==="24"?"TK_LECH_KY":"HDR_CHUA_GHI",
     causes:[...(un.length?[{p:90,t:`${un.length} hóa đơn ${hk==="hdr"?"bán ra":"mua vào"} có trên bảng kê kỳ này nhưng không có trên sổ (tổng ${fm(sumBy(un,f))})`,items:un.slice(0,8).map(x=>({d:x.d,so:x.so,dg:x.ten,amt:f(x)}))}]:[]),
      ...(late.length?[{p:88,t:`${late.length} hóa đơn kê khai kỳ này nhưng ghi sổ kỳ khác (lệch kỳ)`,items:late.slice(0,8)}]:[]),
      ...explain(dm,gl.filter(p=>mon(p.d)===i&&(ct==="24"?P_(p.tk,"133")&&p.n:ct==="35"?P_(p.tk,"3331")&&p.c:P_(p.tk,"511")&&p.c)).map(p=>ev(p,p.n||p.c)),{months:diffs})]})});
   if(!ym.length&&B)rows.push({grp:"Sổ ↔ Tờ khai GTGT",n:`${nm}: tổng các kỳ sổ ↔ tờ khai [${ct}]`,a:A,b:B,la:"Theo sổ",lb:"Tờ khai",d:A-B,st:st(A-B,B),causes:null});
  });
  // bảng kê ↔ tờ khai
  [["hdr","35","Thuế đầu ra: bảng kê HĐ ↔ tờ khai"],["hdv","24","Thuế đầu vào: bảng kê HĐ ↔ tờ khai"]].forEach(([hk,ct,n])=>{const L_=(S.bk[hk]||[]).filter(x=>!/huy|bi thay the/.test(norm(x.tt)));if(!L_.length)return;if(__SUA.B14&&ct==="24"&&tks.some(t=>t.ct["24"]==null))return;let A=0,B=0;const dif=Array(13).fill(0);tks.forEach(t=>{const ms=tkMonth(t.ky)||[];const a=sumBy(L_.filter(x=>ms.includes(mon(x.d))),x=>x.thue);const b=t.ct[ct]??t.ct["28"]??0;A+=a;B+=b;dif[ms.at(-1)]=a-b});row("Sổ ↔ Tờ khai GTGT",n,A,B,"Bảng kê HĐ","Tờ khai",d=>explain(d,L_.map(x=>({d:x.d,so:x.so,dg:x.ten,amt:x.thue})),{months:dif}))});
 }
 // 8. thuế TNDN, BH
 if(has){const t3=tbGet("3334"),t8=tbGet("8211")||tbGet("821");if(t3&&t8)row("Thuế TNDN, BHXH","Thuế TNDN: PS Có 3334 ↔ PS Nợ 8211",t3.psc,t8.psn,"3334","8211",d=>explain(d,gl.filter(p=>P_(p.tk,"3334")||P_(p.tk,"821")).map(p=>ev(p,p.n||p.c)),{}));
  const qb=val("QL_BH","T");if(qb){[["3383",0.255,"BHXH"],["3384",0.045,"BHYT"],["3386",0.02,"BHTN"]].forEach(([tk,r,n])=>{const t=tbGet(tk);if(t)row("Thuế TNDN, BHXH",`${n}: PS Có ${tk} ↔ quỹ lương đóng BH × ${fx(r*100,1)}%`,t.psc,Math.round(qb*r),"Sổ","Theo tỷ lệ",d=>{const c=[];const m=byMonth(gl.filter(p=>P_(p.tk,tk)&&p.c>0),p=>p.c);const miss=monthsIn().filter(i=>!m[i]);if(miss.length)c.push({p:85,t:`Tháng không trích: ${miss.map(i=>"T"+i).join(", ")} (ước ${fm(qb*r/12*miss.length)})`});return[...c,...explain(d,[],{})]})})}}
 return rows;
}
function guessTkKho(x){const s=norm(x.kho+" "+x.ten);if(/thanh pham/.test(s))return"155";if(/nguyen|vat lieu|nvl/.test(s))return"152";if(/cong cu|dung cu/.test(s))return"153";return"156"}
function monthly(){const gl=GL();if(!gl.length)return null;const L=S.meta.loai,ms=monthsIn();
 const dt=byMonth(gl.filter(p=>P_(p.tk,"511")&&p.c>0&&!isKC(p)),p=>p.c),gv=byMonth(gl.filter(p=>P_(p.tk,"632")&&p.n>0&&!isKC(p)),p=>p.n),cp=byMonth(gl.filter(p=>inAny(p.tk,["641","642"])&&p.n>0&&!isKC(p)),p=>p.n),
  tien=byMonth(gl.filter(p=>P_(p.tk,"111")&&p.n>0&&P_(p.du,"511")),p=>p.n),nl=byMonth(gl.filter(p=>P_(p.tk,"152")&&p.c>0&&!P_(p.du,"152")),p=>p.c);
 const rows=ms.map(i=>({m:i,dt:dt[i],gv:gv[i],cp:cp[i],bg:dt[i]?(dt[i]-gv[i])/dt[i]*100:null,tm:dt[i]?tien[i]/dt[i]*100:null,fc:dt[i]&&nl[i]?nl[i]/dt[i]*100:null}));
 const issues=[];
 if(L==="nh"){const med=median(rows.map(r=>r.fc));const odd=rows.filter(r=>r.fc!=null&&med!=null&&Math.abs(r.fc-med)>8);if(odd.length)issues.push({code:"FOOD_COST_THANG",sev:"TY",t:`Food cost bất thường ở ${odd.map(r=>"T"+r.m).join(", ")}`,d:`Trung vị ${fx(med)}%; ${odd.map(r=>`T${r.m}: ${fx(r.fc)}%`).join("; ")}.`,kn:"Kiểm tra định mức món ăn, xuất kho bếp, hàng hỏng, doanh thu bán lẻ chưa xuất hóa đơn.",cb:"Phân tích đặc thù nhà hàng",cat:"dt"});
  const cash=rows.filter(r=>r.tm!=null&&r.tm>60);if(cash.length)issues.push({code:"TIEN_MAT_CAO",sev:"NHO",t:"Tỷ trọng thu tiền mặt cao",d:cash.map(r=>`T${r.m}: ${fx(r.tm,0)}%`).join("; "),kn:"Đối chiếu hóa đơn khởi tạo từ máy tính tiền với doanh thu ngày.",cb:"NĐ 70/2025 – hóa đơn máy tính tiền",cat:"dt"})}
 const bgMed=median(rows.map(r=>r.bg));const bgOdd=rows.filter(r=>r.bg!=null&&bgMed!=null&&Math.abs(r.bg-bgMed)>(L==="tm"?6:10));if(bgOdd.length)issues.push({code:"BIEN_GOP_THANG",sev:"NHO",t:`Biên lãi gộp biến động mạnh ở ${bgOdd.map(r=>"T"+r.m).join(", ")}`,d:`Trung vị ${fx(bgMed)}%; ${bgOdd.map(r=>`T${r.m}: ${fx(r.bg)}%`).join("; ")}.`,kn:"Kiểm tra giá vốn lệch kỳ, chiết khấu, hàng trả lại.","cb":"PLAN-02",cat:"dt"});
 return{rows,issues};
}
BOOKS.luong="Bảng lương / thu nhập cá nhân";
TITLE_KW.luong=["bang luong","bang thanh toan tien luong","bang thanh toan luong","bang tinh thue tncn","bang tong hop thu nhap","thu nhap ca nhan","bang ke thu nhap"];
Object.assign(COLS,{
 mnv:["ma nhan vien","ma nv","ma so nv","msnv","=ma"],hoten:["ho va ten","ho ten","ten nhan vien","nhan vien","=ten"],
 mstcn:["ma so thue","mst ca nhan","mst","ma so thue ca nhan"],thang:["=thang","ky luong","thang luong","ky"],
 tn:["tong thu nhap","tong luong","tong tien luong","thu nhap","tong cong thu nhap","tong so"],
 mien:["thu nhap mien thue","khoan mien thue","mien thue","khong chiu thue","an ca","an giua ca"],
 tnct:["thu nhap chiu thue","tong thu nhap chiu thue","tnct"],
 bhnld:["bh bat buoc","bhxh bhyt bhtn","bao hiem bat buoc","bh nld","trich bh","bao hiem nld","bao hiem"],
 npt:["so nguoi phu thuoc","so npt","npt","nguoi phu thuoc"],
 gtgc:["giam tru gia canh","tong giam tru","giam tru"],
 tntt:["thu nhap tinh thue","tntt"],
 thuecn:["thue tncn da khau tru","thue tncn","thue thu nhap ca nhan","thue khau tru","khau tru thue"],
 loai:["loai hop dong","loai hd","hinh thuc","loai lao dong","doi tuong"],
 uq:["uy quyen","uy quyen quyet toan","uq qt"]
});
HDR_KEYS.luong=["mnv","hoten","mstcn","thang","tn","mien","tnct","bhnld","npt","gtgc","tntt","thuecn","loai","uq"];
function parseLuong(t,hd){
 const c=hd.cols,out=[];const g=(row,k)=>c[k]!=null?row[c[k]]:null;
 const head=t.rows.slice(0,hd.r+1).map(r=>r.map(cellStr).join(" ")).join(" ")+" "+(t.name||"");
 let m=head.match(/th[áa]ng\s*(\d{1,2})\s*(?:\/|năm|nam|-)\s*(20\d\d)/i);const defM=m?`${m[2]}-${m[1].padStart(2,"0")}`:null;
 for(let r=hd.r+hd.depth;r<t.rows.length;r++){const row=t.rows[r];const ten=cellStr(g(row,"hoten")),ma=cellStr(g(row,"mnv"));if(!ten&&!ma)continue;const lab=norm(ten+" "+ma);if(SKIPROW.test(lab)||/^tong|^cong/.test(lab))continue;
  const tn=pn(g(row,"tn"));if(tn==null)continue;
  let th=cellStr(g(row,"thang"));let ym=defM;const d=pd(g(row,"thang"));if(d)ym=d.slice(0,7);else{const mm=th.match(/(\d{1,2})\s*[\/\-]\s*(20\d\d)/);if(mm)ym=`${mm[2]}-${mm[1].padStart(2,"0")}`;else if(/^\d{1,2}$/.test(th))ym=`${S.meta.nam}-${th.padStart(2,"0")}`}
  out.push({ma:ma||ten,ten,mst:cellStr(g(row,"mstcn")).replace(/\s/g,""),ym:ym||`${S.meta.nam}-12`,tn,mien:pn(g(row,"mien"))||0,tnct:pn(g(row,"tnct")),bh:pn(g(row,"bhnld"))||0,npt:pn(g(row,"npt"))||0,gt:pn(g(row,"gtgc")),tntt:pn(g(row,"tntt")),thue:pn(g(row,"thuecn"))||0,loai:cellStr(g(row,"loai")),uq:/co|x|yes|1/i.test(cellStr(g(row,"uq")))})}
 return out;
}
const isCasual=r=>/vang lai|thoi vu|duoi 3 thang|cong tac vien|ctv|khoan viec|thu viec|dich vu ca nhan/.test(norm(r.loai));
function pitRow(r,opt={}){
 const date=r.ym+"-15";const self=opt.self??pol("pit_self",date),dep=opt.dep??pol("pit_dep",date);
 const tnct=r.tnct!=null?r.tnct:Math.max(0,r.tn-r.mien);const tntt=Math.max(0,tnct-r.bh-self-dep*r.npt);
 return{tnct,tntt,tax:opt.br?pitTaxWith(tntt,opt.br):pitTax(tntt,date)};
}
function pitTaxWith(tntt,br){let t=0,lo=0;for(const[hi,r]of br){if(tntt<=lo)break;t+=(Math.min(tntt,hi)-lo)*r;lo=hi}return Math.round(t)}
function tncnChecks(){
 const rows=__SUA.B12?__gopLuong(S.bk.luong||[]):(S.bk.luong||[]);const out=[];if(!rows.length)return{issues:out,people:[],totals:null};
 const add=(code,sev,t,d,kn,cb,items)=>out.push({code,sev,t,d,kn,cb,items,cat:"tncn"});
 const wrong=[],h1=[],casual=[],noMST=[],noBH=[],lowBH=[];
 rows.forEach(r=>{const date=r.ym+"-15";
  if(isCasual(r)){const th=pol("pit_casual",date);if(r.tn>=th&&r.thue<Math.round(r.tn*0.1)-1000)casual.push({d:date,so:r.ma,dg:`${r.ten} – ${r.loai}: thu nhập ${fm(r.tn)}, đã khấu trừ ${fm(r.thue)}`,amt:Math.round(r.tn*0.1)-r.thue});return}
  const e=pitRow(r);if(Math.abs(e.tax-r.thue)>1000){let why="";const yr=+r.ym.slice(0,4);
   const old=POLICY.pit_self[0],oldDep=POLICY.pit_dep[0],oldBr=POLICY.pit_br[0].v;
   if(Math.abs(pitRow(r,{self:old.v,dep:oldDep.v,br:oldBr}).tax-r.thue)<=1000&&old.v!==pol("pit_self",date))why=" – trùng với cách tính theo mức giảm trừ/biểu thuế cũ";
   else if(r.npt&&Math.abs(pitRow({...r,npt:r.npt-1}).tax-r.thue)<=1000)why=" – trùng với cách tính thiếu 1 người phụ thuộc";
   else if(Math.abs(pitRow({...r,npt:r.npt+1}).tax-r.thue)<=1000)why=" – trùng với cách tính thừa 1 người phụ thuộc";
   else if(r.bh&&Math.abs(pitRow({...r,bh:0}).tax-r.thue)<=1000)why=" – chưa trừ bảo hiểm bắt buộc";
   (why.includes("cũ")&&r.ym>="2026-01"&&r.ym<="2026-06"?h1:wrong).push({d:date,so:r.ma,dg:`${r.ten} T${+r.ym.slice(5)}: khấu trừ ${fm(r.thue)}, tính lại ${fm(e.tax)}${why}`,amt:r.thue-e.tax})}
  if(!r.mst&&(r.thue>0||e.tntt>0))noMST.push({so:r.ma,dg:r.ten,amt:r.thue,d:date});
  if(!r.bh&&r.tn>0)noBH.push({d:date,so:r.ma,dg:`${r.ten} T${+r.ym.slice(5)}`,amt:r.tn});
  else if(r.bh>0){const base=r.bh/0.105;const mw=pol("min_wage1",date);if(mw&&base<mw-1000)lowBH.push({d:date,so:r.ma,dg:`${r.ten}: lương đóng BH ≈ ${fm(base)} < tối thiểu vùng I ${fm(mw)}`,amt:base})}});
 if(wrong.length)add("TNCN_TINH_LAI","TY",`${wrong.length} dòng lương khấu trừ thuế TNCN khác số tính lại`,`Chênh lệch ròng ${fm(sumBy(wrong,x=>x.amt))} (dương = khấu trừ thừa). Tính lại theo giảm trừ, biểu thuế của tháng chi trả.`,"Điều chỉnh tờ khai kỳ phát sinh, hoàn/truy thu cho người lao động khi quyết toán.",`${polAt("pit_self",periodRange()[1])?.doc}; ${polAt("pit_br",periodRange()[1])?.doc}`,wrong.slice(0,40));
 if(h1.length)add("TNCN_H1_2026","NHO",`${h1.length} dòng lương tháng 1–6/2026 khấu trừ theo giảm trừ/biểu thuế cũ`,`Chênh ${fm(sumBy(h1,x=>x.amt))}. Được phép – không khai lại tờ khai tháng/quý, bù trừ khi quyết toán năm 2026.`,"Tính lại cả năm 2026 theo biểu 5 bậc và giảm trừ 15,5/6,2 triệu khi quyết toán.","Luật 109/2025 Đ29.2; NĐ 253/2026 Đ70",h1.slice(0,30));
 if(casual.length)add("TNCN_VANG_LAI","TY",`${casual.length} khoản chi cho lao động vãng lai/thời vụ chưa khấu trừ 10%`,`Thiếu ${fm(sumBy(casual,x=>x.amt))}.`,"Khấu trừ 10% với khoản chi từ ngưỡng/lần, trừ khi có cam kết 08/CK-TNCN đủ điều kiện.",polAt("pit_casual",periodRange()[1])?.doc,casual);
 if(noMST.length)add("TNCN_KHONG_MST","NHO",`${new Set(noMST.map(x=>x.so)).size} người có thu nhập chịu thuế nhưng chưa có MST`,"","Đăng ký MST/định danh trước khi quyết toán.","TNCN-15",noMST.slice(0,20));
 {const byM=new Map();rows.filter(r=>!isCasual(r)).forEach(r=>{const o=byM.get(r.ym)||{n:0,z:0};o.n++;if(!r.bh)o.z++;byM.set(r.ym,o)});const allZero=[...byM].filter(([k,o])=>o.n>1&&o.z===o.n).map(([k])=>k);
  const per=new Map();noBH.filter(x=>!allZero.includes(x.d.slice(0,7))).forEach(x=>{const o=per.get(x.so)||{n:0,x};o.n++;per.set(x.so,o)});const ppl=[...per.values()].filter(o=>o.n>=2);
  if(ppl.length)add("TNCN_KHONG_BH","TY",`${ppl.length} người lao động có hợp đồng nhưng không trích BH bắt buộc`,`${sumBy(ppl,o=>o.n)} tháng lương không có khấu trừ BH.`,"Người lao động có HĐLĐ từ 1 tháng thuộc diện BHXH bắt buộc; rủi ro truy đóng, phạt.","Luật BHXH 41/2024/QH15 Đ2",ppl.map(o=>({so:o.x.so,dg:`${o.x.dg.split(" T")[0]} – ${o.n} tháng`,amt:o.x.amt})));
  if(allZero.length)add("BL_THANG_KHONG_BH","TY",`Bảng lương tháng ${allZero.map(k=>+k.slice(5)).join(", ")} không khấu trừ BH cho toàn bộ người lao động`,"","Kiểm tra trích nộp BH tháng này (đối chiếu C12, sổ 3383).","BHXH-08")}
 if(lowBH.length)add("BH_DUOI_TOI_THIEU","TY",`${new Set(lowBH.map(x=>x.so)).size} người có lương đóng BH thấp hơn lương tối thiểu vùng I`,"Áp mức vùng I; nếu DN ở vùng II–IV thì đối chiếu lại.","Điều chỉnh mức đóng; kiểm tra tách lương thành phụ cấp.",polAt("min_wage1",periodRange()[1])?.doc,lowBH.slice(0,20));
 // quyết toán năm theo từng người
 const ppl=new Map();rows.filter(r=>!isCasual(r)).forEach(r=>{const o=ppl.get(r.ma)||{ma:r.ma,ten:r.ten,mst:r.mst,uq:r.uq,months:0,tnct:0,bh:0,dep:0,self:0,thue:0,npt:new Set()};const date=r.ym+"-15";const e=pitRow(r);o.months++;o.tnct+=e.tnct;o.bh+=r.bh;o.self+=pol("pit_self",date);o.dep+=pol("pit_dep",date)*r.npt;o.thue+=r.thue;o.npt.add(r.npt);ppl.set(r.ma,o)});
 const y=S.meta.nam;const brY=(pol("pit_br",`${y}-12-31`)||[]).map(([h,r])=>[h===Infinity?h:h*12,r]);
 const people=[...ppl.values()].map(o=>{const tntt=Math.max(0,o.tnct-o.bh-o.self-o.dep);const tax=pitTaxWith(tntt,brY);return{...o,npt:[...o.npt].join("/"),tntt,qt:tax,diff:tax-o.thue}}).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
 const add_=people.filter(p=>p.diff>1000),ref=people.filter(p=>p.diff<-1000);
 if(add_.length||ref.length)add("TNCN_QT","NHO",`Quyết toán năm (ước tính): ${add_.length} người phải nộp thêm, ${ref.length} người được hoàn`,`Nộp thêm ${fm(sumBy(add_,p=>p.diff))}; hoàn ${fm(-sumBy(ref,p=>p.diff))}. Ước tính trên dữ liệu bảng lương tại đơn vị, chưa gồm thu nhập nơi khác.`,"Lập 05/QTT-TNCN; người có thu nhập nơi khác không được ủy quyền quyết toán.","TNCN-03/12",people.filter(p=>Math.abs(p.diff)>1000).slice(0,20).map(p=>({so:p.ma,dg:`${p.ten}: thuế cả năm ${fm(p.qt)}, đã khấu trừ ${fm(p.thue)}`,amt:p.diff})));
 const nptVar=people.filter(p=>p.npt.includes("/"));if(nptVar.length)add("TNCN_NPT_DOI","NHO",`${nptVar.length} người thay đổi số người phụ thuộc trong năm`,"","Kiểm tra hồ sơ đăng ký NPT, tháng bắt đầu/kết thúc giảm trừ.","TNCN-08",nptVar.map(p=>({so:p.ma,dg:`${p.ten}: ${p.npt}`,amt:0})));
 const totals={tn:sumBy(rows,r=>r.tn),thue:sumBy(rows,r=>r.thue),bh:sumBy(rows,r=>r.bh),n:ppl.size,casual:rows.filter(isCasual).length};
 // đối chiếu tổng
 const gl=GL();const ps3335=tbGet("3335")?tbGet("3335").psc:(gl.length?sumBy(gl.filter(p=>P_(p.tk,"3335")&&p.c>0),p=>p.c):null);const ps334=tbGet("334")?tbGet("334").psc:(gl.length?sumBy(gl.filter(p=>P_(p.tk,"334")&&p.c>0),p=>p.c):null);
 totals.rec=[["Thuế TNCN khấu trừ: bảng lương ↔ PS Có 3335",totals.thue,ps3335],["Thuế TNCN: bảng lương ↔ tờ khai (số liệu bổ sung)",totals.thue,val("TNCN_TK","T")],["Tổng thu nhập: bảng lương ↔ PS Có 334",sumBy(rows.filter(r=>!isCasual(r)),r=>r.tn),ps334]].filter(x=>x[2]!=null).map(([n,a,b])=>({n,a,b,d:a-b,st:Math.abs(a-b)<=1000?"ok":"fail"}));
 return{issues:out,people,totals};
}
Object.assign(TITLE_KW,{tk:["to khai thue gia tri gia tang","mau so 01 gtgt"],kk05:["to khai khau tru thue thu nhap ca nhan","mau so 05 kk tncn"],qt05:["to khai quyet toan thue thu nhap ca nhan","mau so 05 qtt tncn"],tndn03:["to khai quyet toan thue thu nhap doanh nghiep","mau so 03 tndn"]});
function dkTypeOf(s){const n=norm(s);
 if(/05 ?qtt|quyet toan thue thu nhap ca nhan/.test(n))return"qt05";
 if(/05 ?kk ?tncn|khau tru thue thu nhap ca nhan/.test(n))return"kk05";
 if(/03 ?tndn|quyet toan thue thu nhap doanh nghiep/.test(n))return"tndn03";
 if(/01 ?gtgt|to khai thue gia tri gia tang/.test(n))return"tk";return null}
function kyKey(kyStr,kieu){kyStr=String(kyStr||"").trim();let m=kyStr.match(/^(\d{1,2})\/(\d{4})$/);
 if(m)return(/Q/i.test(kieu||"")?`Q${+m[1]}/${m[2]}`:`T${+m[1]}/${m[2]}`);
 m=kyStr.match(/^Q(\d)\/(\d{4})$/i);if(m)return`Q${m[1]}/${m[2]}`;
 m=kyStr.match(/^(\d{4})$/);if(m)return`N/${m[1]}`;return kyStr||"?"}
function kyMonths(key){const m=String(key).match(/^([TQN])(\d*)\/(\d{4})$/);if(!m)return[];if(m[1]==="T")return[+m[2]];if(m[1]==="Q")return[+m[2]*3-2,+m[2]*3-1,+m[2]*3];return[1,2,3,4,5,6,7,8,9,10,11,12]}
const kyYear=key=>{const m=String(key).match(/(\d{4})$/);return m?+m[1]:null};
function parseDeclXML(doc,type,meta,txt){
 const all=[...doc.getElementsByTagName("*")];const ln=e=>e.localName||e.nodeName;
 const inPL=e=>{for(let p=e.parentNode;p&&p.nodeType===1;p=p.parentNode){if(/^(PLuc|PL_|PL\d|BKe|BangKe|CTiet|ChiTiet)/i.test(ln(p))||/^PL/i.test(ln(p)))return p}return null};
 const ct={},pl={},rows=new Map();
 all.forEach(e=>{if(e.children.length)return;const m=ln(e).match(/^ct([a-z]{0,2}\d+[a-z0-9_]*|[a-z]{1,2})$/i);if(!m)return;const k=m[1].toLowerCase();const raw=e.textContent.trim();const v=pn(raw);
  const P=inPL(e);if(!P){if(v!=null&&ct[k]==null)ct[k]=v;return}
  if(type==="qt05"){const row=e.parentNode;const o=rows.get(row)||{ent:[]};if(raw)o.ent.push([k,raw,v]);rows.set(row,o)}
  else if(v!=null&&pl[k]==null)pl[k]=v});
 const ppl=[...rows.values()].map(o=>{// MST = ô 10/13 số đầu tiên; ô 9/12 số liền sau là CMND/CCCD; còn lại là số liệu
  const E=o.ent;const mi=E.findIndex(([,r])=>/^\d{10}(-?\d{3})?$/.test(r.replace(/\s/g,"")));const skip=new Set(mi>=0?[mi]:[]);if(mi>=0&&E[mi+1]&&+E[mi+1][0]===+E[mi][0]+1&&/^\d{9}$|^\d{12}$/.test(E[mi+1][1]))skip.add(mi+1);
  const vals={};E.forEach(([k,r,v],i)=>{if(!skip.has(i)&&v!=null&&!/[a-zA-ZÀ-ỹ]/.test(r))vals[k]=v});
  const ten=(E.filter(([,r])=>/[a-zA-ZÀ-ỹ]{2,}/.test(r)).sort((a,b)=>b[1].length-a[1].length)[0]||[])[1]||"";return{ten,mst:mi>=0?E[mi][1]:"",vals}}).filter(p=>p.ten||p.mst);
 const key=kyKey(txt("kyKKhai"),txt("kieuKy"));
 return{kind:"dk",dk:{type,ky:type==="kk05"?key:key.startsWith("N/")?key:`N/${kyYear(key)||key}`,lan:+txt("soLan")||0,loai:/B/i.test(txt("loaiTKhai"))?"B":"C",ct,pl,ppl,nop:txt("ngayLapTKhai")},meta}}
function parseDeclRows(rows){
 const ct={};const txtAll=headText(rows,80);
 rows.forEach(r=>{let code=null;for(let i=0;i<r.length;i++){const s=cellStr(r[i]);const ms=[...s.matchAll(/\[\s*([A-Z]{0,2}\d{0,3}[a-z]?)\s*\]/gi)].filter(m=>m[1]);
   if(ms.length){code=ms[ms.length-1][1].toLowerCase();// số nằm chung ô sau mã
    const rest=s.slice(s.lastIndexOf("]")+1).trim();const v=pn(rest);if(v!=null&&rest.length>0&&ct[code]==null){ct[code]=v;code=null}continue}
   if(code){const v=pn(r[i]);if(v!=null&&!/^\d{1,2}$/.test(s)||v===0&&s.length){if(ct[code]==null)ct[code]=v;code=null}}}});
 let ky=null,m;
 if((m=txtAll.match(/thang\s*(\d{1,2})\s*nam\s*(\d{4})/)))ky=`T${+m[1]}/${m[2]}`;
 else if((m=txtAll.match(/quy\s*(\d)\s*nam\s*(\d{4})/)))ky=`Q${m[1]}/${m[2]}`;
 else if((m=txtAll.match(/ky tinh thue\s*nam\s*(\d{4})/)||txtAll.match(/nam\s*(20\d{2})/)))ky=`N/${m[1]}`;
 const b=txtAll.match(/bo sung lan thu\s*(\d+)/);
 return{ct,ky:ky||"?",lan:b?+b[1]:0,loai:b?"B":"C"}}
function storeDK(dk){S.dk=(S.dk||[]).filter(x=>!(x.type===dk.type&&x.ky===dk.ky&&x.lan===dk.lan&&x.loai===dk.loai));S.dk.push(dk);S.dk.sort((a,b)=>a.type.localeCompare(b.type)||kyCmp(a,b))}
function dkNote(dk){return`${dk.ky.replace("N/","Năm ")}${dk.loai==="B"?` · bổ sung lần ${dk.lan}`:""} · ${Object.keys(dk.ct).length} chỉ tiêu${dk.ppl&&dk.ppl.length?` · ${dk.ppl.length} cá nhân`:""}`}
function finalDK(type){const by=new Map();(S.dk||[]).filter(x=>x.type===type).forEach(x=>{const o=by.get(x.ky);if(!o||(x.loai==="B"&&(o.loai!=="B"||x.lan>o.lan)))by.set(x.ky,x)});return[...by.values()].sort(kyCmp)}
function dkPick(ct){const ks=Object.keys(ct).filter(k=>/^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);const tri=[];
 ks.forEach(a=>{const x=ct[a],y=ct[a+1],z=ct[a+2];if(x==null||y==null||z==null)return;if(Math.abs(x-y-z)<=2&&x>=1e5)tri.push({k:a,v:x})});
 if(!tri.length)return null;const tn=tri.reduce((m,t)=>t.v>m.v?t:m,tri[0]);const tx=tri.filter(t=>t.v<tn.v*0.45).sort((a,b)=>a.v-b.v||a.k-b.k)[0]||null;
 return{tn:tn.v,tnK:tn.k,tax:tx?tx.v:0,taxK:tx?tx.k:null}}
function declChecks(){
 const out=[],rows=[];const gl=GL();const[pa,pb]=periodRange();const Y=+S.meta.nam;
 const add=(code,sev,t,d,kn,cb,items,cat)=>out.push({code,sev,t,d,kn,cb,items,cat:cat||"tncn"});
 const st=(d,ref)=>Math.abs(d)<=1000?"ok":Math.abs(d)<=Math.max(5000,Math.abs(ref||0)*0.0005)?"round":"fail";
 const row=(grp,n,a,b,la,lb,causes,code)=>{if(a==null||b==null)return;const d=a-b;const s=st(d,b);rows.push({grp,n,a,b,la,lb,d,st:s,causes:s==="fail"?(typeof causes==="function"?causes(d):causes):null,code})};
 const psM=(tk,side,pred)=>{const o={};gl.filter(p=>P_(p.tk,tk)&&(side==="n"?p.n:p.c)>0&&(!pred||pred(p))).forEach(p=>{const m=mon(p.d);o[m]=(o[m]||0)+(side==="n"?p.n:p.c)});return o};
 const tbPS=(tk,side)=>{const r=tbGet(tk);return r?(side==="n"?r.psn:r.psc):null};
 const ps=(tk,side,pred)=>{if(!pred){const t=tbPS(tk,side);if(t!=null)return t}return gl.length?sumBy(Object.values(psM(tk,side,pred)),x=>x):null};
 const L=S.bk.luong||[];const lM=(f)=>{const o={};L.filter(r=>+r.ym.slice(0,4)===Y).forEach(r=>{const m=+r.ym.slice(5,7);o[m]=(o[m]||0)+f(r)});return o};
 const sumMs=(o,ms)=>ms.reduce((t,m)=>t+(o[m]||0),0);
 // nguyên nhân theo tháng/kỳ: so hai chuỗi theo kỳ, chỉ ra kỳ lệch và lệch kỳ bù trừ
 const byKy=(kys,fa,fb,la,lb)=>d=>{const c=[];const ds=kys.map(k=>({k,a:fa(k),b:fb(k)})).map(o=>({...o,d:o.a-o.b})).filter(o=>Math.abs(o.d)>1000);
  for(let i=0;i<ds.length-1;i++)if(Math.abs(ds[i].d+ds[i+1].d)<=1000)c.push({p:85,t:`Lệch kỳ giữa ${ds[i].k} và ${ds[i+1].k}: ${fm(Math.abs(ds[i].d))} ghi ở kỳ này nhưng kê khai ở kỳ kia`});
  ds.forEach(o=>{if(Math.abs(o.d-d)<=1000)c.push({p:80,t:`Toàn bộ chênh lệch nằm ở kỳ ${o.k}: ${la} ${fm(o.a)}, ${lb} ${fm(o.b)}`})});
  if(!c.length&&ds.length)c.push({p:50,t:`Lệch ở ${ds.length} kỳ: `+ds.slice(0,6).map(o=>`${o.k} (${fm(o.d)})`).join(", ")});return c};
 const KK=finalDK("kk05").filter(x=>kyYear(x.ky)===Y),QT=finalDK("qt05").filter(x=>kyYear(x.ky)===Y)[0],TD=finalDK("tndn03").filter(x=>kyYear(x.ky)===Y)[0];
 const G="Thuế TNCN – bảng lương, sổ, tờ khai";
 const tnctOf=r=>r.tnct??(r.tn-(r.mien||0));const blTax=lM(r=>r.thue),blTn=lM(tnctOf),blAdj=lM(r=>isCasual(r)?tnctOf(r):-(r.mien||0)),c3335=psM("3335","c"),n3335=psM("3335","n"),c334=psM("334","c");
 // 1. bảng lương ↔ sổ (đã có ở TNCN tổng) – theo tháng để tìm nguyên nhân
 if(L.length&&gl.length){const ms=monthsIn();
  row(G,"Thuế TNCN khấu trừ: bảng lương ↔ PS Có 3335 (theo tháng)",sumMs(blTax,ms),sumMs(c3335,ms),"Bảng lương","Sổ 3335",byKy(ms.map(m=>"T"+m),k=>blTax[+k.slice(1)]||0,k=>c3335[+k.slice(1)]||0,"bảng lương","sổ"),"TNCN_BL_SO")}
 // 2. tờ khai 05/KK ↔ sổ, ↔ bảng lương
 const kkP=KK.map(x=>({x,p:(__SUA.B2?(((c)=>c[34]!=null||c[33]!=null?(c[26]!=null&&c[32]!=null?{tn:c[26],tnK:26,tax:c[32],taxK:32}:null):(c[16]!=null&&c[21]!=null&&c[29]!=null?{tn:c[21],tnK:21,tax:c[29],taxK:29}:null))(x.ct)||dkPick(x.ct)):dkPick(x.ct)),ms:kyMonths(x.ky)})).filter(o=>o.p);
 if(kkP.length){const kys=kkP.map(o=>o.x.ky),f=k=>kkP.find(o=>o.x.ky===k);const kkTax=sumBy(kkP,o=>o.p.tax),kkTn=sumBy(kkP,o=>o.p.tn);
  if(gl.length||tbHas())row(G,`Thuế TNCN: Σ tờ khai 05/KK (${kkP.length} kỳ) ↔ PS Có 3335`,kkTax,gl.length?sumMs(c3335,kkP.flatMap(o=>o.ms)):ps("3335","c"),"Tờ khai","Sổ 3335",gl.length?byKy(kys,k=>f(k).p.tax,k=>sumMs(c3335,f(k).ms),"tờ khai","sổ"):[],"TNCN_TK_SO");
  if(L.length){row(G,"Thuế TNCN: Σ tờ khai 05/KK ↔ bảng lương",kkTax,sumMs(blTax,kkP.flatMap(o=>o.ms)),"Tờ khai","Bảng lương",byKy(kys,k=>f(k).p.tax,k=>sumMs(blTax,f(k).ms),"tờ khai","bảng lương"),"TNCN_TK_BL");
   row(G,"Thu nhập chịu thuế: Σ tờ khai 05/KK ↔ bảng lương",kkTn,sumMs(blTn,kkP.flatMap(o=>o.ms)),"Tờ khai","Bảng lương",byKy(kys,k=>f(k).p.tn,k=>sumMs(blTn,f(k).ms),"tờ khai","bảng lương"),"TNCN_TK_BL")}
  if(gl.length)row(G,"Thu nhập chịu thuế: Σ tờ khai 05/KK ↔ PS Có 334 (trừ khoản miễn thuế, cộng thu nhập vãng lai)",kkTn,sumMs(c334,kkP.flatMap(o=>o.ms))+(L.length?sumMs(blAdj,kkP.flatMap(o=>o.ms)):0),"Tờ khai","Sổ 334",d=>{const c=byKy(kys,k=>f(k).p.tn,k=>sumMs(c334,f(k).ms)+(L.length?sumMs(blAdj,f(k).ms):0),"tờ khai","sổ")(d);c.push({p:40,t:"Có thể do khoản thu nhập miễn thuế (ăn giữa ca, làm thêm giờ, trang phục…) không kê vào thu nhập chịu thuế – xem chi tiết bảng lương"});return c},"TNCN_TK_334");
  // kỳ khai sau 01/07/2026 phải theo quý
  const mon26=KK.filter(x=>/^T/.test(x.ky)&&kyYear(x.ky)===2026&&+x.ky.slice(1).split("/")[0]>=7);
  if(mon26.length)add("TNCN_KY_KHAI","TY",`${mon26.length} tờ khai 05/KK theo tháng từ tháng 7/2026`,"Từ 01/07/2026 thuế TNCN khấu trừ chỉ khai theo quý.","Chuyển sang khai quý; tờ khai tháng đã nộp không thay thế được nghĩa vụ khai quý.","TT 89/2026 Đ22");
  // thiếu kỳ khai
  const have=new Set(kkP.flatMap(o=>o.ms)),miss=monthsIn().filter(m=>!have.has(m)&&(blTax[m]||0)>0);
  if(miss.length)add("TNCN_THIEU_KY","TY",`Thiếu tờ khai 05/KK cho tháng ${miss.join(", ")}`,`Bảng lương có khấu trừ thuế ${fm(sumMs(blTax,miss))} trong các tháng này nhưng chưa thấy tờ khai.`,"Nạp đủ tờ khai các kỳ hoặc kiểm tra việc nộp tờ khai (phạt chậm nộp hồ sơ theo NĐ 125/2020 Đ13).","Luật QLT; NĐ 125/2020");
  // dư 3335 cuối kỳ ↔ thuế kỳ cuối chưa đến hạn nộp
  const t5=tbGet("3335");if(t5){const last=kkP[kkP.length-1];const due=last?last.p.tax:0;const end=t5.dcc-t5.dnc;
   if(end>due+1000)add("TNCN_NO_DONG","TY",`Dư Có 3335 cuối kỳ ${fm(end)} lớn hơn số thuế kỳ cuối ${fm(due)}`,`Phần ${fm(end-due)} là thuế TNCN đã khấu trừ của các kỳ trước nhưng chưa nộp.`,`Nộp ngay và tính tiền chậm nộp ${String(pol("late_rate",pb)*100).replace(".",",")}%/ngày.`,"Luật QLT Đ59/Đ16");
   if(end<-1000)add("TNCN_NOP_THUA","NHO",`TK 3335 dư Nợ cuối kỳ ${fm(-end)}`,"Nộp thừa thuế TNCN hoặc hạch toán khấu trừ thiếu.","Bù trừ khi quyết toán hoặc đề nghị hoàn; kiểm tra lại bút toán khấu trừ.","TT 200/TT 99 – TK 3335")}}
 // 3. quyết toán 05/QTT ↔ Σ 05/KK, ↔ bảng lương, ↔ sổ; từng người
 if(QT){const q=dkPick(QT.ct);
  if(q){if(kkP.length){row(G,`Thuế đã khấu trừ: quyết toán 05/QTT [${q.taxK}] ↔ Σ tờ khai 05/KK`,q.tax,sumBy(kkP,o=>o.p.tax),"Quyết toán","Σ 05/KK",[{p:60,t:"Quyết toán phải khớp tổng các tờ khai trong năm; nếu tờ khai kỳ sai thì khai bổ sung tờ khai kỳ đó trước khi quyết toán"}],"TNCN_QT_KK");
    row(G,`Thu nhập chịu thuế: quyết toán [${q.tnK}] ↔ Σ tờ khai 05/KK`,q.tn,sumBy(kkP,o=>o.p.tn),"Quyết toán","Σ 05/KK",[],"TNCN_QT_KK")}
   if(L.length)row(G,"Thu nhập chịu thuế: quyết toán ↔ bảng lương cả năm",q.tn,sumBy(L.filter(r=>+r.ym.slice(0,4)===Y),tnctOf),"Quyết toán","Bảng lương",[],"TNCN_QT_BL");
   if(gl.length||tbHas())row(G,"Thuế đã khấu trừ: quyết toán ↔ PS Có 3335 cả năm",q.tax,ps("3335","c"),"Quyết toán","Sổ 3335",[],"TNCN_QT_SO")}
  else add("TNCN_QT_MA","NHO","Chưa xác định được chỉ tiêu tổng trên tờ khai 05/QTT","Không tìm thấy quan hệ cộng [a] = [a+1] + [a+2] giữa các chỉ tiêu.","Kiểm tra file XML/PDF; đối chiếu thủ công các chỉ tiêu thu nhập, thuế đã khấu trừ.","05/QTT-TNCN");
  // từng người: phụ lục 05-1/BK ↔ bảng lương
  if(QT.ppl&&QT.ppl.length&&L.length){const ppl=new Map();L.filter(r=>+r.ym.slice(0,4)===Y&&!isCasual(r)).forEach(r=>{const k=(r.mst||"").replace(/\D/g,"")||norm(r.ten);const o=ppl.get(k)||{ten:r.ten,mst:r.mst,tn:0,thue:0,bh:0};o.tn+=tnctOf(r);o.thue+=r.thue;o.bh+=r.bh||0;ppl.set(k,o)});
   const notIn=[],bad=[];const seen=new Set();
   QT.ppl.forEach(p=>{const k=(p.mst||"").replace(/\D/g,"")||norm(p.ten);const o=ppl.get(k)||[...ppl.values()].find(x=>norm(x.ten)===norm(p.ten));if(!o){notIn.push({so:p.mst,dg:`${p.ten}: có trên quyết toán, không có trên bảng lương`,amt:Math.max(0,...Object.values(p.vals))});return}seen.add(o);
    const vs=Object.values(p.vals);const hasTn=vs.some(v=>Math.abs(v-o.tn)<=1000),hasTax=o.thue===0||vs.some(v=>Math.abs(v-o.thue)<=1000);
    if(!hasTn||!hasTax)bad.push({so:p.mst||o.mst,dg:`${p.ten}: bảng lương TNCT ${fm(o.tn)}, thuế ${fm(o.thue)} – ${!hasTn?"thu nhập":"thuế đã khấu trừ"} không khớp phụ lục`,amt:!hasTn?o.tn:o.thue})});
   const missing=[...ppl.values()].filter(o=>!seen.has(o)&&o.tn>0).map(o=>({so:o.mst,dg:`${o.ten}: có thu nhập ${fm(o.tn)} trên bảng lương, không có trên phụ lục quyết toán`,amt:o.tn}));
   if(missing.length)add("TNCN_QT_THIEU_NGUOI","TY",`${missing.length} người có trên bảng lương nhưng thiếu trên phụ lục 05-1/BK-QTT`,`Thu nhập ${fm(sumBy(missing,x=>x.amt))}.`,"Bổ sung cá nhân vào bảng kê quyết toán; khai bổ sung nếu đã nộp.","05/QTT-TNCN, phụ lục 05-1/BK",missing.slice(0,40));
   if(notIn.length)add("TNCN_QT_THUA_NGUOI","TY",`${notIn.length} người trên phụ lục quyết toán không có trên bảng lương`,"","Đối chiếu hồ sơ lao động; có thể bảng lương nạp chưa đủ hoặc kê khai nhầm.","05/QTT-TNCN",notIn.slice(0,40));
   if(bad.length)add("TNCN_QT_LECH_NGUOI","TY",`${bad.length} người có số liệu quyết toán khác bảng lương`,"","Đối chiếu từng người; điều chỉnh phụ lục 05-1/BK trước khi nộp hoặc khai bổ sung.","05/QTT-TNCN",bad.slice(0,40))}}
 else if(S.meta.ky==="nam"&&(L.length||kkP.length))add("TNCN_CHUA_QT","NHO","Chưa nạp tờ khai quyết toán thuế TNCN 05/QTT-TNCN","Nạp để đối chiếu quyết toán với tờ khai kỳ, bảng lương và sổ 3335.","Tổ chức trả thu nhập phải quyết toán thay cho người ủy quyền; hạn ngày cuối tháng thứ 3 sau năm.","Luật QLT; 05/QTT-TNCN");
 // 4. sổ 334, 335, 338 ↔ BCTC, bảng lương
 const T=k=>tbGet(k);const GB="Lương, bảo hiểm – sổ ↔ BCTC";
 if(T("334")){const t=T("334");const end=t.dcc-t.dnc;const ptn=val("PTNLD","T");if(ptn!=null)row(GB,"Phải trả người lao động: BCTC (314) ↔ dư Có 334",ptn,Math.max(0,end),"BCTC","CĐPS",[{p:50,t:"Dư Nợ chi tiết 334 (tạm ứng lương) bị bù trừ hoặc trình bày nhầm sang khoản phải thu"}],"TNCN_314");
  const avgM=L.length?sumBy(L,r=>r.tn)/Math.max(1,new Set(L.map(r=>r.ym)).size):(t.psc/Math.max(1,monthsIn().length));
  if(end>avgM*1.8&&avgM>0)add("LUONG_CHUA_CHI","TY",`Lương còn phải trả cuối kỳ ${fm(end)} ≈ ${fx(end/avgM,1)} tháng lương`,"Chi phí tiền lương chỉ được trừ khi thực chi trước thời hạn nộp hồ sơ quyết toán TNDN; thuế TNCN tính khi trả thu nhập.","Kiểm tra lịch chi lương tháng 1–3 năm sau; loại khỏi chi phí được trừ phần không chi trước hạn.","NĐ 320/2025 Đ9; TT 96/2015 Đ4",[],"tndn")}
 if(gl.length){const l335=gl.filter(p=>P_(p.tk,"335")&&p.c>0&&/luong|thuong|tien cong/.test(norm(p.dg)));const t=T("335");const end=t?t.dcc-t.dnc:null;
  if(l335.length&&end>0)add("TRICH_LUONG_335","NHO",`Trích trước lương/thưởng qua 335: ${fm(sumBy(l335,p=>p.c))}`,`Dư Có 335 cuối kỳ ${fm(end)}.`,"Khoản trích trước chỉ được trừ nếu chi trước hạn quyết toán TNDN; TNCN khấu trừ theo thời điểm chi trả.","NĐ 320/2025; TT 111/2013",l335.slice(0,20).map(p=>ev(p,p.c)),"tndn")}
 if(L.length&&gl.length){const bhNLD=sumBy(L.filter(r=>+r.ym.slice(0,4)===Y),r=>r.bh||0);const n334_338=ps("334","n",p=>P_(p.du,"338"));
  row(GB,"BH khấu trừ NLĐ: bảng lương ↔ PS Nợ 334 đối ứng 338",bhNLD,n334_338,"Bảng lương","Sổ 334/338",byKy(monthsIn().map(m=>"T"+m),k=>lM(r=>r.bh||0)[+k.slice(1)]||0,k=>psM("334","n",p=>P_(p.du,"338"))[+k.slice(1)]||0,"bảng lương","sổ"),"BH_BL_SO");
  const base=bhNLD/0.105;const er=ps("338","c",p=>/^(3383|3384|3386|3382)/.test(p.tk)&&!P_(p.du,"334"));
  if(base>0&&er!=null){const rts=monthsIn().map(m=>{const v=pol("bh_rate_er",`${Y}-${String(m).padStart(2,"0")}-15`);return v&&typeof v==="object"?Object.values(v).reduce((a,b)=>a+(+b||0),0):0.235});const rt=rts.reduce((a,b)=>a+b,0)/rts.length;const exp=base*rt;row(GB,`BH, KPCĐ doanh nghiệp đóng ≈ ${fx(rt*100,1)}% quỹ lương đóng BH theo tỷ lệ từng tháng (PS Có 3382/3383/3384/3386 trừ phần NLĐ)`,er,Math.round(exp),"Sổ 338",`Ước tính ${fx(rt*100,1)}%`,[{p:40,t:"Có thể DN được áp mức TNLĐ-BNN 0,3% hoặc không đóng KPCĐ – chênh lệch nhỏ chấp nhận được"}],"BH_DN")}}
 // 5. quyết toán TNDN 03/TNDN
 if(TD){const c=TD.ct,g=k=>c[k]!=null?c[k]:null;const GD="Quyết toán TNDN 03/TNDN";const lntt=val("LNTT","T");
  const A1=g("a1"),B1=g("b1"),B8=g("b8"),B12=g("b12"),C4=g("c4"),D=g("d"),E=g("e"),Gg=g("g");
  if(A1!=null&&lntt!=null)row(GD,"Lợi nhuận kế toán trước thuế: tờ khai [A1] ↔ BCTC (50)",A1,lntt,"Tờ khai","BCTC",[{p:60,t:"BCTC đã điều chỉnh sau khi nộp quyết toán – cần khai bổ sung 03/TNDN"}],"TNDN_A1");
  if(A1!=null&&B12!=null&&B1!=null&&B8!=null&&Math.abs(A1+B1-B8-B12)>1000)add("TNDN_CONG_THUC","TY","Tờ khai 03/TNDN: [B12] ≠ [A1] + [B1] − [B8]",`Chênh ${fm(A1+B1-B8-B12)}.`,"Kiểm tra lại công thức trên tờ khai hoặc bản XML.","03/TNDN",[],"tndn");
  if(D!=null&&E!=null&&Gg!=null&&Math.abs(D-E-Gg)>1000)add("TNDN_CONG_THUC","NHO","Tờ khai 03/TNDN: [G] ≠ [D] − [E]",`Chênh ${fm(D-E-Gg)}.`,"Kiểm tra số thuế đã tạm nộp và số còn phải nộp.","03/TNDN",[],"tndn");
  const pl01=TD.pl&&TD.pl["01"];const dtb=val("DT_BH","T");if(pl01!=null&&dtb!=null)row(GD,"Doanh thu: phụ lục 03-1A [01] ↔ BCTC (01)",pl01,dtb,"Phụ lục 03-1A","BCTC",[],"TNDN_DT");
  if(D!=null){const rr=C4>0?D/C4:0.2;const cz=d=>[{p:60,t:`Chênh lệch ${fm(Math.abs(d))} tương ứng ${fm(Math.abs(d)/(rr||0.2))} thu nhập tính thuế (thuế suất ${fx((rr||0.2)*100,0)}%): ${d<0?"sổ sách ghi chi phí thuế theo số khác tờ khai, hoặc tờ khai chưa đưa đủ khoản điều chỉnh tăng":"tờ khai có điều chỉnh tăng chưa ghi nhận vào chi phí thuế trên sổ"}`},{p:40,t:"Chi phí thuế TNDN hoãn lại (52) hoặc điều chỉnh thuế năm trước ghi vào 8211 năm nay"}];
   const cp=val("THUE","T");if(cp!=null)row(GD,"Thuế TNDN phải nộp [D] ↔ chi phí thuế TNDN trên BCTC (51+52)",D,cp,"Tờ khai","BCTC",cz,"TNDN_D");
   const p3334=ps("3334","c");if(p3334!=null&&p3334>0)row(GD,"Thuế TNDN phải nộp [D] ↔ PS Có 3334",D,p3334,"Tờ khai","Sổ 3334",cz,"TNDN_3334");
   // thuế suất
   if(C4>0&&D>0){const r=D/C4,dtP=val("DThu","P");let exp=0.2,why="20%";if(Y>=2025&&dtP!=null){if(Y>=2026&&dtP<=1e9){exp=0;why="miễn thuế (DT năm trước ≤ 1 tỷ)"}else if(dtP<=3e9){exp=.15;why="15% (DT năm trước ≤ 3 tỷ)"}else if(dtP<=50e9){exp=.17;why="17% (DT năm trước 3–50 tỷ)"}}
    if(Math.abs(r-exp)>0.006)add("TNDN_THUE_SUAT",exp<r?"TY":"NHO",`Thuế suất TNDN hiệu dụng ${fx(r*100)}% khác mức dự kiến ${why}`,`[D] ${fm(D)} / [C4] ${fm(C4)}. Doanh thu năm trước theo BCTC ${dtP!=null?fm(dtP):"chưa có"}.`,exp<r?"Có thể áp sai thuế suất ưu đãi theo Luật 67/2025 – kiểm tra điều kiện và khai bổ sung để giảm thuế.":"Đối chiếu điều kiện ưu đãi; nếu không đủ điều kiện thì phải áp thuế suất cao hơn.","Luật TNDN 67/2025 Đ10; NĐ 320/2025 Đ11",[],"tndn")}
   // tạm nộp ≥ 80%
   if(E!=null&&D>0&&E<D*0.8-1000){const short=D*0.8-E;const days=Math.max(0,Math.round((new Date(`${Y+1}-05-01`)-new Date(`${Y+1}-01-30`))/864e5));
    add("TNDN_TAM_NOP","TY",`Tạm nộp thuế TNDN 4 quý ${fm(E)} < 80% số phải nộp (${fm(D*0.8)})`,`Thiếu ${fm(short)}. Tiền chậm nộp ước tính đến hạn quyết toán ≈ ${fm(short*pol("late_rate",pb)*days)} (${days} ngày từ 30/01).`,"Nộp bổ sung và tự tính tiền chậm nộp trên phần thiếu so với 80%.","NĐ 91/2022; Luật QLT",[],"tndn")}}
  // chi phí không được trừ chưa loại: tiền mặt từ ngưỡng, tiền phạt
  if(gl.length&&B1!=null){const cash=gl.filter(p=>p.n>0&&/^(6|8)/.test(p.tk)&&!P_(p.tk,"821")&&P_(p.du,"111")&&p.n>=(pol("cit_cash",p.d)||5e6));
   const fine=gl.filter(p=>p.n>0&&P_(p.tk,"811")&&(__SUA.B8?/\b(phat vi pham|nop phat|xu phat|tien phat|cham nop|vi pham hanh chinh)\b/:/phat|cham nop|vi pham/).test(norm(p.dg)));const need=sumBy(cash,p=>p.n)+sumBy(fine,p=>p.n);
   if(need>B1+1000)add("TNDN_CHUA_LOAI","TY",`Chi phí không được trừ ${fm(need)} lớn hơn tổng điều chỉnh tăng [B1] ${fm(B1)}`,`${cash.length} chứng từ chi phí trả tiền mặt từ ngưỡng (${fm(sumBy(cash,p=>p.n))}), ${fine.length} khoản tiền phạt, chậm nộp (${fm(sumBy(fine,p=>p.n))}).`,"Loại các khoản này vào chỉ tiêu B4 (chi phí không được trừ) và khai bổ sung 03/TNDN.","NĐ 320/2025 Đ9; Luật TNDN 67/2025",[...cash,...fine].slice(0,40).map(p=>ev(p,p.n)),"tndn")}}
 else if(S.meta.ky==="nam"&&hasData()&&val("LNTT","T")!=null)add("TNDN_CHUA_QT","NHO","Chưa nạp tờ khai quyết toán thuế TNDN 03/TNDN","Nạp file XML/PDF để đối chiếu lợi nhuận, thuế phải nộp, tạm nộp 80% và chi phí không được trừ.","Hạn nộp ngày cuối tháng thứ 3 sau năm tài chính.","03/TNDN",[],"tndn");
 return{issues:out,rows,kk:kkP,qt:QT?{x:QT,p:dkPick(QT.ct)}:null,td:TD}}
const cheDoFor=y=>S.meta.cheDo==="tt133"?"tt133":(+y>=2026?"tt99":"tt200");
function yearData(){return{v:S.v,tb:S.tb,tk:S.tk,dk:S.dk,bk:S.bk,files:S.files,cheDo:S.meta.cheDo,ky:S.meta.ky,quy:S.meta.quy,skBal:S.meta.skBal||{},skMap:S.meta.skMap||{},ck:S.ck,notes:S.notes}}
function emptyYear(y){return{v:{},tb:[],tk:[],dk:[],bk:emptyBooks(),files:[],cheDo:cheDoFor(y),ky:"nam",quy:4,skBal:{},skMap:{},ck:{},notes:{kl:"",ai:""}}}
function applyYear(y,d){d=d||emptyYear(y);S.v=d.v||{};S.tb=d.tb||[];S.tk=d.tk||[];S.dk=d.dk||[];S.bk={...emptyBooks(),...(d.bk||{})};S.files=d.files||[];S.ck=d.ck||{};S.notes={kl:"",ai:"",...(d.notes||{})};
 S.meta.nam=+y;S.meta.cheDo=d.cheDo||cheDoFor(y);S.meta.ky=d.ky||"nam";S.meta.quy=d.quy||4;S.meta.skBal=d.skBal||{};S.meta.skMap=d.skMap||{}}
function syncYear(){S.years=S.years||{};S.years[S.meta.nam]=yearData()}
function yearHasData(d){return!!d&&(Object.keys(d.v||{}).length>0||(d.tb||[]).length>0||(d.tk||[]).length>0||(d.dk||[]).length>0||Object.values(d.bk||{}).some(x=>x&&x.length))}
function yearKeys(){syncYear();return Object.keys(S.years).map(Number).filter(y=>y===+S.meta.nam||yearHasData(S.years[y])).sort((a,b)=>a-b)}
function setYear(y){y=+y;if(!y||y===+S.meta.nam)return;syncYear();applyYear(y,S.years[y]||emptyYear(y));syncYear();invalidate()}
function withYear(y,fn){y=+y;const cur=+S.meta.nam;if(y===cur)return fn();const keep=CACHE;syncYear();applyYear(y,S.years[y]);CACHE=null;_hdm=null;
 try{return fn()}finally{S.years[y]=yearData();applyYear(cur,S.years[cur]);CACHE=keep;_hdm=null}}
let _touched=new Set();
function routeYear(fy){fy=+fy;if(!fy||fy<2000||fy>2100)return;_touched.add(fy);if(fy===+S.meta.nam)return;syncYear();
 const any=Object.values(S.years).some(yearHasData);if(!any){delete S.years[S.meta.nam];S.meta.nam=fy;S.meta.cheDo=cheDoFor(fy);syncYear();return}
 setYear(fy)}
function linkRows(){
 const y=+S.meta.nam,p=S.years&&S.years[y-1];if(!p||!yearHasData(p))return[];const rows=[];const G=`Liên kết năm ${y-1} → ${y}`;
 const st=d=>Math.abs(d)<=1?"ok":Math.abs(d)<=1000?"round":"fail";
 const add=(n,a,b,la,lb,causes,code)=>{if(a==null||b==null)return;const d=a-b;rows.push({grp:G,n,a,b,la,lb,d,st:st(d),causes:st(d)==="fail"?causes:null,code})};
 // BCTC: số đầu năm = số cuối năm trước; cùng kỳ năm trước = năm trước
 const pv=k=>p.v&&p.v[k];
 F.filter(f=>["cd","kd"].includes(f.g)&&!f.sub).forEach(f=>{const a=S.v[f.k]&&S.v[f.k].p,b=pv(f.k)&&pv(f.k).t;if(a==null||b==null)return;
  add(`${f.l} (${f.c[S.meta.cheDo==="tt133"?1:0]}): ${f.g==="cd"?"số đầu năm":"năm trước"} ↔ BCTC ${y-1}`,a,b,`BCTC ${y}`,`BCTC ${y-1}`,[{p:70,t:f.g==="cd"?`BCTC năm ${y-1} đã điều chỉnh sau khi nộp nhưng số đầu năm ${y} chưa cập nhật, hoặc ngược lại – kiểm tra hồ sơ khai bổ sung, báo cáo kiểm toán`:`Số liệu năm trước trên BCTC ${y} được trình bày lại – cần thuyết minh lý do (VAS 29)`},...(y===2026&&S.meta.cheDo==="tt99"?[{p:50,t:"Chuyển đổi TT 200 → TT 99: mã số chỉ tiêu thay đổi, kiểm tra bảng chuyển đổi số dư đầu năm 2026"}]:[])],"LK_BCTC")});
 // CĐPS: dư đầu kỳ = dư cuối kỳ năm trước
 if((S.tb||[]).length&&(p.tb||[]).length){const pt=Object.fromEntries(p.tb.map(r=>[r.tk,r]));const bad=[];
  S.tb.forEach(r=>{if(/^[5-9]/.test(r.tk)||r.tk.length>4)return;const q=pt[r.tk];const a=r.dnd-r.dcd,b=q?q.dnc-q.dcc:0;if(/^421/.test(r.tk))return;if(Math.abs(a-b)>1)bad.push({so:"TK "+r.tk,dg:`${r.ten||TKN[r.tk]||""}: dư đầu ${y} ${fm(a)} ≠ dư cuối ${y-1} ${fm(b)}`,amt:a-b})});
  const r4=t=>{const x=S.tb.find(z=>z.tk===t);return x?x.dnd-x.dcd:0},q4=t=>{const x=p.tb.find(z=>z.tk===t);return x?x.dnc-x.dcc:0};
  add(`CĐPS: dư đầu kỳ ${y} ↔ dư cuối kỳ ${y-1} (${p.tb.length} tài khoản)`,__SUA.B4?(bad.length?sumBy(bad,x=>Math.abs(x.amt)):0):bad.length,0,__SUA.B4?"Tổng tiền lệch":"Số TK lệch","",bad.length?[{p:90,t:`${bad.length} tài khoản có số dư đầu năm khác số dư cuối năm trước`,items:bad.slice(0,30)}]:null,"LK_CDPS");
  add("LN chưa phân phối: dư đầu 4211 + 4212 năm nay ↔ dư cuối 4211 + 4212 năm trước",r4("4211")+r4("4212"),q4("4211")+q4("4212"),`CĐPS ${y}`,`CĐPS ${y-1}`,[{p:60,t:"Kết chuyển 4212 → 4211 đầu năm sai hoặc điều chỉnh hồi tố chưa thuyết minh"}],"LK_421")}
 // Tờ khai GTGT: [22] kỳ đầu năm = [43] kỳ cuối năm trước
 const t0=finalTK()[0],pl=(()=>{const by=new Map();(p.tk||[]).forEach(x=>{const o=by.get(x.ky);if(!o||(x.loai==="B"&&(o.loai!=="B"||x.lan>o.lan)))by.set(x.ky,x)});return[...by.values()].sort(kyCmp)})().at(-1);
 if(t0&&pl)add(`Thuế GTGT còn được khấu trừ: [22] ${t0.ky} ↔ [43] ${pl.ky}`,t0.ct["22"]??0,pl.ct["43"]??0,"Tờ khai đầu năm","Tờ khai cuối năm trước",[{p:80,t:"Tờ khai kỳ cuối năm trước đã khai bổ sung nhưng [22] kỳ đầu năm chưa cập nhật – kiểm tra lần khai bổ sung mới nhất"}],"LK_CT22");
 return rows}
function policyChecks(){
 const out=[];const add=(code,sev,t,d,kn,cb,items,cat)=>out.push({code,sev,t,d,kn,cb,items,cat:cat||"thue"});
 const hr=(S.bk.hdr||[]).filter(x=>x.d&&/^8\s*%?$/.test(String(x.ts).trim())&&!pol("vat8",x.d));
 if(hr.length)add("VAT8_SAI_KY","NT",`${hr.length} hóa đơn bán ra áp thuế suất 8% ngoài thời gian được giảm thuế`,`Thuế khai thiếu ${fm(sumBy(hr,x=>(x.truoc||0)*0.02))} (chênh 2%). Thời gian không được giảm: ${POLICY.vat8.filter(p=>p.v===false).map(p=>`${fd(p.from)}${p.to?"–"+fd(p.to):" trở đi"}`).join("; ")}.`,"Lập hóa đơn điều chỉnh thuế suất 10%, khai bổ sung và nộp tiền chậm nộp.","Các nghị quyết, nghị định giảm thuế GTGT theo từng đợt (NQ 43/2022, 101/2023, 110/2023, 142/2024, 174/2024, 204/2025)",hr.slice(0,40).map(x=>({d:x.d,so:x.so,dg:`${x.ten} – thuế suất ${x.ts}`,amt:x.truoc})));
 const hv=(S.bk.hdv||[]).filter(x=>x.d&&/^8\s*%?$/.test(String(x.ts).trim())&&!pol("vat8",x.d));
 if(hv.length)add("VAT8_DAU_VAO","TY",`${hv.length} hóa đơn mua vào ghi thuế suất 8% ngoài thời gian được giảm`,"Người bán áp sai thuế suất; thuế đầu vào chỉ được khấu trừ theo số ghi đúng.","Đề nghị người bán lập hóa đơn điều chỉnh; không kê khai phần chênh lệch chưa được điều chỉnh.","Các NQ, NĐ giảm thuế GTGT theo đợt",hv.slice(0,30).map(x=>({d:x.d,so:x.so,dg:`${x.ten} – ${x.ts}`,amt:x.truoc})));
 return out}
let _ySum={key:"",val:null};
function yearSummaries(){
 const ks=yearKeys();const key=ks.join(",")+"|"+S.updated+"|"+S.meta.loai;if(_ySum.key===key)return _ySum.val;
 const out=ks.map(y=>withYear(y,()=>{const c=compute();const m=k=>val(k,"T");const R=id=>{const r=c.Rt.find(x=>x.id===id);return r?r.t:null};
  const bySev=sevCnt(c.Rk);const byCat={};c.Rk.forEach(r=>{const o=byCat[r.cat]||(byCat[r.cat]={NT:0,TY:0,NHO:0});o[r.sev]++});
  const tkFinal=finalTK();
  return{y,cheDo:S.meta.cheDo,has:yearHasData(yearData()),
   m:{DThu:m("DThu"),GVHB:m("GVHB"),LNG:m("LNG"),LNTT:m("LNTT"),LNST:m("LNST"),TONG_TS:m("TONG_TS"),VCSH:m("VCSH"),TONG_NO:m("TONG_NO"),HTK:m("HTK"),PTKH:m("PTKH"),TIEN:m("TIEN"),CFO:m("CFO")},
   r:{bienGop:R("CS01"),bienRong:R("CS04"),roe:R("CS05"),roa:R("CS06"),hsTT:R("CS09"),noVCSH:R("CS14"),dso:R("CS25"),dio:R("CS23")},
   H:c.H?c.H.s:null,gr:c.H?c.H.gr:null,Q:c.Q.s,qgr:c.Q.gr,sev:bySev,byCat,codes:[...new Set(c.Rk.filter(r=>r.cat!=="cs").map(r=>r.code).filter(Boolean))],
   issues:c.Rk.filter(r=>r.cat!=="cs"),rcFail:c.RC.filter(r=>r.st==="fail").length,rcAll:c.RC.length,
   vat:{out:sumBy(tkFinal,t=>t.ct["35"]??t.ct["28"]??0),inp:sumBy(tkFinal,t=>t.ct["24"]??0),pay:sumBy(tkFinal,t=>t.ct["40"]??0)},
   tndn:(()=>{const t=finalDK("tndn03").find(x=>kyYear(x.ky)===y);return t?t.ct.d??null:null})(),
   tncn:(()=>{const x=c.DK&&c.DK.kk;return x&&x.length?sumBy(x,o=>o.p.tax):(c.TN.totals?c.TN.totals.thue:null)})(),
   staff:c.TN.totals?c.TN.totals.n:null}}));
 _ySum={key,val:out};return out}
const sevCnt=xs=>{const o={NT:0,TY:0,NHO:0};xs.forEach(x=>o[x.sev]=(o[x.sev]||0)+1);return o};
function mkRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const R1000=x=>Math.round(x/1000)*1000;
const PROFILES={
 tm:{n:"Công ty TNHH Thương mại Minh Phát",dt:48e9,gm:0.13,bh:0.035,ql:0.045,cashSale:0.08,vat:0.1,staff:24,salPct:0.045,fa:3.6e9,life:8,loan:6e9,rate:0.085,cap:5e9,season:[.8,.7,.9,.95,1,1,1,1,1.05,1.1,1.2,1.4],
  items:[["DH12","Điều hòa Inverter 12000BTU","bộ",8.2e6],["DH18","Điều hòa Inverter 18000BTU","bộ",11.5e6],["TL300","Tủ lạnh 300L","chiếc",7.1e6],["MG9","Máy giặt 9kg","chiếc",6.4e6],["LVS","Lò vi sóng","chiếc",1.9e6],["NCN","Nồi chiên không dầu","chiếc",1.4e6],["TV55","Tivi 55 inch","chiếc",9.6e6],["QD","Quạt điều hòa","chiếc",2.3e6]]},
 dv:{n:"Công ty TNHH Tư vấn Giải pháp Số Việt",dt:12.5e9,gm:0.42,bh:0.05,ql:0.2,cashSale:0.02,vat:0.1,staff:38,salPct:0.31,fa:1.4e9,life:5,loan:0.8e9,rate:0.09,cap:3e9,season:[.85,.7,1,1,1,1,1,1,1.05,1.05,1.1,1.25],
  jobs:[["HD01","Triển khai ERP – Hưng Thịnh"],["HD02","Bảo trì phần mềm – Đông Á"],["HD03","Tư vấn chuyển đổi số – Sen Vàng"],["HD04","Thiết kế website – Bắc Hà"],["HD05","Phần mềm nhân sự – Hồ Tây"]]},
 sx:{n:"Công ty CP Bao bì Nhựa Hưng Thịnh",dt:86e9,gm:0.19,bh:0.03,ql:0.05,cashSale:0.01,vat:0.1,staff:210,salPct:0.12,fa:48e9,life:10,loan:25e9,rate:0.08,cap:22e9,season:[.85,.75,.95,1,1,1,1,1.05,1.05,1.1,1.1,1.15],
  items:[["PP","Hạt nhựa PP","kg",31e3],["PE","Hạt nhựa PE","kg",29e3],["MUC","Mực in","kg",120e3],["KEO","Keo ghép màng","kg",85e3]],
  products:[["TUI-PP","Túi PP dệt 50kg","cái"],["MANG-PE","Màng PE quấn pallet","cuộn"],["BAO-IN","Bao bì in ống đồng","m2"]]},
 xd:{n:"Công ty TNHH Xây dựng Đông Á",dt:63e9,gm:0.26,bh:0.004,ql:0.055,cashSale:0,vat:0.08,staff:120,salPct:0.14,fa:9e9,life:8,loan:17.5e9,rate:0.09,cap:15e9,season:[.6,.5,.9,1,1,1.1,1,1,1.1,1.1,1.2,1.5],
  jobs:[["CT01","Nhà xưởng KCN Quang Minh"],["CT02","Trường mầm non Hoa Sen"],["CT03","Cải tạo trụ sở UBND xã"],["CT04","Kho lạnh Đông Anh"],["CT05","Nhà điều hành dự án Sóc Sơn"]]},
 nh:{n:"Công ty TNHH Nhà hàng Bếp Quê",dt:9.8e9,gm:0.61,bh:0.08,ql:0.36,cashSale:0.55,vat:0.08,staff:32,salPct:0.29,fa:4.6e9,life:6,loan:1.3e9,rate:0.09,cap:4.2e9,season:[1.3,1.1,.9,.9,.95,1,1,1,.9,.95,1,1.2],
  items:[["THITBO","Thịt bò","kg",260e3],["HAISAN","Hải sản tổng hợp","kg",320e3],["GA","Gà ta","kg",110e3],["RAU","Rau củ","kg",28e3],["GAO","Gạo","kg",22e3],["BIA","Bia thùng 24 lon","thùng",330e3],["NUOCNGOT","Nước ngọt thùng","thùng",180e3]]},
 ks:{n:"Công ty TNHH Khách sạn Hồ Tây View",dt:28.5e9,gm:0.36,bh:0.06,ql:0.21,cashSale:0.25,vat:0.08,staff:95,salPct:0.24,fa:96e9,life:20,loan:40e9,rate:0.085,cap:40e9,rooms:120,season:[.8,1.2,1,.9,.95,1.05,1.1,1.05,.9,1,1,1.1],
  jobs:[["PHONG","Bộ phận phòng"],["F&B","Bộ phận ăn uống"]]},
 vt:{n:"Công ty TNHH Vận tải Bắc Hà",dt:35e9,gm:0.15,bh:0.01,ql:0.07,cashSale:0.05,vat:0.1,staff:85,salPct:0.21,fa:38e9,life:8,loan:15e9,rate:0.09,cap:14e9,season:[1.1,.8,.95,1,1,1,1,1,1,1,1.05,1.15],
  jobs:[["R01","Tuyến Hà Nội – Hải Phòng"],["R02","Tuyến Hà Nội – Lạng Sơn"],["R03","Vận chuyển nội thành"]]},
 dl:{n:"Công ty TNHH Du lịch Sen Vàng",dt:22e9,gm:0.28,bh:0.03,ql:0.065,cashSale:0.05,vat:0.1,staff:28,salPct:0.1,fa:1.2e9,life:6,loan:0,rate:0.09,cap:3.5e9,season:[.9,1.1,.8,1.1,1.2,1.4,1.4,1.2,.8,.7,.7,1],
  jobs:[["T01","Tour Đà Nẵng – Hội An 4N3Đ"],["T02","Tour Phú Quốc 3N2Đ"],["T03","Tour Sapa 3N2Đ"],["T04","Tour Thái Lan 5N4Đ"],["T05","Tour Hà Giang 4N3Đ"]]}
};
const CUSTS=["Công ty CP Điện máy Hoàng Long","Công ty TNHH Thương mại An Phú","Công ty TNHH Kỹ thuật Việt Nhật","Công ty CP Xây lắp Thăng Long","Công ty TNHH Sản xuất Hòa Bình","Công ty CP Đầu tư Phương Nam","Công ty TNHH Dịch vụ Ánh Dương","Công ty TNHH Nội thất Gia Bảo","Công ty CP Thực phẩm Sao Mai","Công ty TNHH Logistics Hải Âu"];
const SUPS=["Công ty TNHH Phân phối Điện tử Miền Bắc","Công ty CP Vật tư Kim Thành","Công ty TNHH Dịch vụ Kỹ thuật Trường An","Công ty CP Năng lượng Xanh","Công ty TNHH In ấn Tân Tiến","Công ty TNHH Văn phòng phẩm Hồng Hà","Công ty CP Vận tải Bình Minh","Công ty TNHH Thiết bị Đức Phát"];
function demoCase(L,opt={}){
 const Y=opt.year||2025,P={...PROFILES[L],dt:Math.round(PROFILES[L].dt*Math.pow(1.09,Y-2025))},r=mkRng((opt.seed||{tm:11,dv:12,sx:13,xd:14,nh:15,ks:16,vt:17,dl:18}[L])+(Y-2025)*101),ERR=opt.errors!==false;
 const pick=a=>a[Math.floor(r()*a.length)],rv=(a,b)=>a+(b-a)*r();
 const J=[],inj=[];let sc=0;
 const day=(m,d)=>`${Y}-${String(m).padStart(2,"0")}-${String(Math.min(d,[31,28,31,30,31,30,31,31,30,31,30,31][m-1])).padStart(2,"0")}`;
 // ghi một chứng từ nhiều dòng: lines=[[no,co,tien,dtNo,dtCo]]
 const B={};const post=(d,so,dg,lines,extra={})=>{for(const[no,co,t,dn,dc,cat]of lines){const v=Number.isInteger(t)?t:R1000(t);if(!v||v<0)continue;J.push({d,so,dg,no,co,tien:v,dn:dn||"",dc:dc||"",cat:cat||"",...extra});B[no]=(B[no]||0)+v;B[co]=(B[co]||0)-v}};
 const balAt=(tk,d)=>{let b=0;for(const[k,v]of Object.entries(OB))if(k.split("|")[0].startsWith(tk))b+=v;J.forEach(j=>{if(j.d<=d){if(j.no.startsWith(tk))b+=j.tien;if(j.co.startsWith(tk))b-=j.tien}});return b};
 const cus=CUSTS.map((n,i)=>({ma:`KH${String(i+1).padStart(3,"0")}`,ten:n,mst:`01${String(5000000+i*7919).slice(0,8)}`}));
 const sup=SUPS.map((n,i)=>({ma:`NCC${String(i+1).padStart(3,"0")}`,ten:n,mst:`01${String(6000000+i*6151).slice(0,8)}`}));
 // ---------- số dư đầu năm ----------
 const OB={};const ob=(tk,v,dt)=>{const k=tk+"|"+(dt||"");OB[k]=(OB[k]||0)+R1000(v)};
 const dt=P.dt,cogsY=dt*(1-P.gm);
 ob("1121",dt*0.025,"VCB");ob("1122",dt*0.012,"BIDV");ob("1111",dt*0.004);
 cus.forEach((c,i)=>ob("131",dt*0.11/10*rv(0.4,1.6),c.ma));
 ob("131",-dt*0.006,cus[3].ma); // KH ứng trước
 ob("1331",dt*0.002);ob("242",dt*0.006);ob("211",P.fa);ob("2141",-P.fa*0.32);
 sup.forEach((s,i)=>ob("331",-cogsY*0.07/8*rv(0.5,1.5),s.ma));ob("331",cogsY*0.004,sup[2].ma);
 if(ERR){ob("331",-R1000(dt*0.0042),"NCC009");inj.push({code:"CN_TREO",desc:"NCC009 (Công ty TNHH Thương mại Hưng Gia) còn dư Có từ năm trước, cả năm không phát sinh thanh toán"})}
 ob("33311",-dt*0.0015);ob("3334",-dt*0.001);ob("3341",-P.dt*P.salPct/12*0.85);ob("3411",-P.loan);ob("4111",-P.cap);
 // tồn kho đầu
 const stock={};const items=P.items||[];
 const isInv=["tm","nh","sx"].includes(L);
 if(isInv)items.forEach(([ma,ten,dvt,gia])=>{const q=Math.round((L==="tm"?cogsY*0.17:L==="sx"?cogsY*0.09:cogsY*0.012)/items.length/gia);stock[ma]={ma,ten,dvt,q,v:R1000(q*gia),gia,tk:L==="tm"?"1561":"1521",sld:q,gtd:R1000(q*gia),sln:0,gtn:0,slx:0,gtx:0};ob(stock[ma].tk,stock[ma].v)});
 const prods=P.products||[];const pstock={};
 if(L==="sx")prods.forEach(([ma,ten,dvt],i)=>{const g=[4200,52000,8500][i];const q=Math.round(cogsY*0.12/prods.length/g);pstock[ma]={ma,ten,dvt,q,v:R1000(q*g),gia:g,tk:"155",sld:q,gtd:R1000(q*g),sln:0,gtn:0,slx:0,gtx:0};ob("155",pstock[ma].v)});
 const jobs=(P.jobs||[]).map(([ma,ten])=>({ma,ten,ddd:0,nvl:0,nc:0,mtc:0,sxc:0,z:0,dthu:0}));
 if(["xd","dv","dl","vt"].includes(L))jobs.forEach((j,i)=>{const v=R1000(L==="xd"?cogsY*0.1*rv(.3,1.4):cogsY*0.01*rv(.5,1.5));j.ddd=v;ob("154",v,j.ma)});
 if(L==="xd"&&ERR){jobs.push({ma:"CT06",ten:"Nhà văn hóa thôn Đoài (tạm dừng)",ddd:R1000(cogsY*0.028),nvl:0,nc:0,mtc:0,sxc:0,z:0,dthu:0,frozen:true});ob("154",jobs.at(-1).ddd,"CT06");inj.push({code:"CT_TON_DONG",desc:"Công trình CT06 có chi phí dở dang từ năm trước, cả năm không phát sinh chi phí, chưa nghiệm thu"})}
 // năm sau nối tiếp năm trước: số dư đầu = số dư cuối năm trước (4212 chuyển 4211), tồn kho, dở dang mang sang
 if(opt.prev){const pv=opt.prev;for(const k in OB)delete OB[k];for(const[k,v]of Object.entries(pv.close)){const t=k.split("|")[0];if(/^[5-9]/.test(t)||!v)continue;const kk=t==="4212"?"4211|":k;OB[kk]=(OB[kk]||0)+v}
  Object.values(stock).forEach(st=>{const q=pv.stock[st.ma];if(q){st.q=q.q;st.v=q.v;st.sld=q.q;st.gtd=q.v}});Object.values(pstock).forEach(st=>{const q=pv.stock[st.ma];if(q){st.q=q.q;st.v=q.v;st.sld=q.q;st.gtd=q.v}});
  jobs.forEach(j=>{j.ddd=OB["154|"+j.ma]||0});if(OB["154|CT06"]&&!jobs.some(j=>j.ma==="CT06")){jobs.push({ma:"CT06",ten:"Nhà văn hóa thôn Đoài (tạm dừng)",ddd:OB["154|CT06"],nvl:0,nc:0,mtc:0,sxc:0,z:0,dthu:0,frozen:true});if(ERR)inj.push({code:"CT_TON_DONG",desc:"Công trình CT06 dở dang từ các năm trước, không phát sinh"})}
  if(OB["331|NCC009"]&&ERR&&!inj.some(x=>x.code==="CN_TREO"))inj.push({code:"CN_TREO",desc:"NCC009 còn dư Có từ năm trước, không phát sinh"})}
 // cân đối số dư đầu: 4211
 const sumOB=Object.values(OB).reduce((t,v)=>t+v,0);ob("4211",-sumOB);
 for(const[k,v]of Object.entries(OB)){const tk=k.split("|")[0];B[tk]=(B[tk]||0)+v}
 // ---------- phát sinh 12 tháng ----------
 const sal=P.dt*P.salPct/12,bhBase=sal*0.72;let hdOut=0,hdIn=0;const HDR=[],HDV=[];
 const ar={},ap={};cus.forEach(c=>ar[c.ma]=Math.max(0,OB["131|"+c.ma]||0));sup.forEach(s=>ap[s.ma]=Math.max(0,-(OB["331|"+s.ma]||0)));
 const sold={};let prevOutVat=0,QLBH=0;
 // nhân sự & bảng lương
 const ne=Math.min(P.staff,60),EN0=["Nguyễn Văn An","Trần Thị Bích","Lê Hoàng Cường","Phạm Thu Dung","Hoàng Minh Đức","Vũ Thị Giang","Đặng Quốc Huy","Bùi Thanh Hương","Đỗ Văn Khánh","Ngô Thị Lan","Dương Văn Long","Lý Thị Mai","Phan Văn Nam","Trịnh Thị Oanh","Mai Văn Phúc","Đinh Thị Quỳnh","Hồ Văn Sơn","Cao Thị Thảo","Tạ Văn Tùng","Lương Thị Vân"];
 const HO=["Nguyễn","Trần","Lê","Phạm","Hoàng","Vũ","Đặng","Bùi","Đỗ","Ngô"],DEM=["Văn","Thị","Minh","Thu","Quốc","Thanh"],TEN=["Anh","Bình","Chi","Dũng","Hà","Hải","Hằng","Hiếu","Hoa","Khoa","Linh","Long","Nam","Ngọc","Phong","Quân","Sơn","Tâm","Trang","Tuấn"];const EN=i=>i<EN0.length?EN0[i]:`${HO[i%10]} ${DEM[(i*7)%6]} ${TEN[(i*3)%20]}`;
 const emp=Array.from({length:ne},(_,i)=>({ma:`NV${String(i+1).padStart(3,"0")}`,ten:EN(i),mst:i===ne-1?"":`80${String(31000000+i*1237).slice(0,8)}`,w:i<3?3-i*0.5:i<8?1.5:1,npt:i%4===1?1:i%5===2?2:0,noBH:ERR&&i===5}));
 const wsum=emp.reduce((t,e)=>t+e.w,0);const LUONG=[];
 const vatM=Array.from({length:13},()=>({out:0,in:0,dt:0,dtin:0}));
 const vatAt=d=>P.vat===0.08&&!pol("vat8",d)?0.1:P.vat;
 const salesInvoice=(d,c,truoc,dg,cash,rt)=>{const vr=rt||vatAt(d);const thue=R1000(truoc*vr),so=String(++hdOut).padStart(7,"0");const tk=cash?(r()<0.5?"1111":"1121"):"131";
  post(d,"BH"+so,dg,[[tk,"5111",truoc,cash?"":c.ma],[tk,"33311",thue,cash?"":c.ma]],{hd:so});
  HDR.push({kh:`1C${String(Y).slice(2)}TAP`,so,d,mst:cash?"":c.mst,ten:cash?"Khách lẻ":c.ten,truoc:R1000(truoc),thue,tong:R1000(truoc)+thue,ts:(vr*100)+"%",tt:"Hóa đơn mới"});
  const m=mon(d);vatM[m].out+=thue;vatM[m].dt+=R1000(truoc);if(!cash)ar[c.ma]+=R1000(truoc)+thue;return so};
 const buyInvoice=(d,s,truoc,lines,dg,payTk,vatRate=0.1,bookMonthShift=0)=>{const thue=R1000(truoc*vatRate),so=String(1000+(++hdIn));const pt=payTk||"331";
  post(d,"MH"+so,dg,[...lines.map(([no,v,dn,cat])=>[no,pt,v,dn||"",pt==="331"?s.ma:"",cat]),["1331",pt,thue,"",pt==="331"?s.ma:""]],{hd:so});
  HDV.push({kh:`1C${String(Y).slice(2)}T`+s.ma.slice(-3),so,d,mst:s.mst,ten:s.ten,truoc:R1000(truoc),thue,tong:R1000(truoc)+thue,ts:(vatRate*100)+"%",tt:"Hóa đơn mới"});
  const m=mon(d)+bookMonthShift;vatM[Math.min(12,m)].in+=thue;vatM[Math.min(12,m)].dtin+=R1000(truoc);if(pt==="331")ap[s.ma]+=R1000(truoc)+thue;return so};
 const jobKey=L==="nh"?["BEP"]:null;const avail=ma=>{let v=OB["154|"+ma]||0;J.forEach(j=>{if(j.no==="154"&&j.dn===ma)v+=j.tien;if(j.co==="154"&&j.dc===ma)v-=j.tien});return v};
 const actJobs=()=>jobs.filter(j=>!j.frozen).map(j=>j.ma);const splitJobs=(tk,v,cat)=>{const ks=L==="nh"?["BEP"]:actJobs();if(!ks.length)return[[tk,"3341",v]];let a=0;return ks.map((k,i)=>{const x=i===ks.length-1?v-a:Math.round(v/ks.length);a+=x;return[tk,null,x,k,"",cat]})};
 const HK={};const hook=(m,f)=>(HK[m]=HK[m]||[]).push(f);
 // ---------- lỗi cài sẵn (chạy cuối tháng tương ứng, trước khi quyết toán thuế GTGT tháng) ----------
 if(ERR){
  hook(3,()=>{const q=balAt("111",day(3,6));const v=R1000(Math.max(0,q)+38e6);post(day(3,6),"PC0306",`Chi tạm ứng mua vật tư khẩn – Nguyễn Văn Bình`,[["141","1111",v]]);post(day(3,9),"PT-RT0309","Rút tiền gửi về nhập quỹ bổ sung",[["1111","1121",R1000(v*0.7)]],{bank:"VCB"})});
  inj.push({code:"QUY_AM",desc:"Ngày 06/03 chi tạm ứng lớn khi quỹ chưa đủ tiền → quỹ tiền mặt âm"});
  hook(9,()=>buyInvoice(day(9,9),sup[7],Y>=2025?16.5e6:26.5e6,[["642",Y>=2025?16.5e6:26.5e6]],"Mua máy in văn phòng – thanh toán tiền mặt","1111"));
  inj.push({code:"TM_5TR",desc:"Hóa đơn mua máy in 16,5 triệu (chưa VAT) thanh toán bằng tiền mặt"});
  hook(8,()=>{post(day(8,25),"PC0825","Thù lao cộng tác viên biên soạn tài liệu – bà Lê Thị Hạnh",[["642","1111",8e6]]);LUONG.push({ma:"CTV01",ten:"Lê Thị Hạnh",mst:"",ym:`${Y}-08`,tn:8e6,mien:0,tnct:8e6,bh:0,npt:0,gt:null,tntt:null,thue:0,loai:"Cộng tác viên (vãng lai)",uq:false})});
  inj.push({code:"TNCN_VANG_LAI",desc:"Thù lao cộng tác viên 8 triệu chưa khấu trừ 10% thuế TNCN"});inj.push({code:"TNCN_TINH_LAI",desc:"NV001 tháng 6 khấu trừ thuế TNCN sai do khai thiếu/thừa 1 người phụ thuộc"});inj.push({code:"TNCN_KHONG_BH",desc:"NV006 có hợp đồng lao động nhưng không trích BH bắt buộc"});
  hook(7,()=>{const dup=J.find(j=>j.so==="PB7");if(dup){J.push({...dup});B[dup.no]+=dup.tien;B[dup.co]-=dup.tien}});
  inj.push({code:"TRUNG_CT",desc:"Chứng từ PB7 (phân bổ chi phí trả trước tháng 7) bị ghi hai lần"});
  hook(11,()=>{const c=cus[5];const truoc=R1000(dt*0.0031);const thue=R1000(truoc*vatAt(day(11,18)));const so=String(++hdOut).padStart(7,"0");HDR.push({kh:`1C${String(Y).slice(2)}TAP`,so,d:day(11,18),mst:c.mst,ten:c.ten,truoc,thue,tong:truoc+thue,ts:(vatAt(day(11,18))*100)+"%",tt:"Hóa đơn mới"});vatM[11].out+=thue;vatM[11].dt+=truoc;inj.find(x=>x.code==="HDR_CHUA_GHI").desc=`Hóa đơn bán ra số ${so} ngày 18/11 (${fm(truoc)} chưa VAT) đã kê khai nhưng chưa ghi sổ`});
  inj.push({code:"HDR_CHUA_GHI",desc:"Hóa đơn bán ra tháng 11 đã kê khai nhưng chưa ghi sổ"});
  hook(7,()=>{const s=sup[4];const v=R1000(dt*0.0009);buyInvoice(day(7,29),s,v,[["642",v]],"Chi phí in ấn tài liệu – HĐ về cuối tháng","331",0.1,1)});
  inj.push({code:"TK_LECH_KY",desc:"Hóa đơn đầu vào của NCC005 ngày 29/07 hạch toán tháng 7 nhưng kê khai ở tờ khai tháng 8"});
  if(isInv){hook(9,()=>{const st=Object.values(stock).sort((a,b)=>b.v-a.v)[0];const it=items.find(x=>x[0]===st.ma);const v=R1000(Math.max(2e6,Math.min(st.v*0.04,dt*0.0008)));post(day(9,15),"XK0915",`Xuất ${it[1]} dùng cho chi phí tài chính`,[["635",st.tk,v]]);st.v-=v;st.gtx+=v});inj.push({code:"DU_BAT_THUONG",desc:`Bút toán Nợ 635 / Có ${L==="tm"?"1561":"1521"} – xuất kho hạch toán vào chi phí tài chính`})}
  else{hook(9,()=>post(day(9,15),"PK0915","Điều chỉnh công nợ khách hàng vào chi phí",[["635","131",R1000(dt*0.0007),"",cus[2].ma]]));inj.push({code:"DU_BAT_THUONG",desc:"Bút toán Nợ 635 / Có 131 – xóa công nợ khách hàng vào chi phí tài chính"})}
  hook(1,()=>post(day(1,20),"PC0120","Mua quà tặng Tết cho đối tác và gia đình giám đốc",[["642","1111",R1000(28e6)]]));inj.push({code:"TU_KHOA",desc:"Phiếu chi quà Tết cho gia đình giám đốc – chi phí không phục vụ SXKD, không hóa đơn"});
  hook(6,()=>post(day(6,12),"UNC0612","Rút tiền mặt chi công tác Tây Nguyên",[["1388","1121",R1000(60e6)]],{bank:"VCB"}));inj.push({code:"RUT_KHONG_NHAP_QUY",desc:"Rút 60 triệu từ tài khoản VCB nhưng hạch toán Nợ 1388, không nhập quỹ tiền mặt"});
  if(L==="tm"){hook(12,()=>{const it=items[6],st=stock[it[0]];const q=st.q+6;const cost=R1000(st.v/Math.max(st.q,1)*q);salesInvoice(day(12,20),cus[0],q*it[3]*1.18,`Bán ${it[1]} cho ${cus[0].ten}`,false);post(day(12,20),"XK1220",`Xuất kho bán ${it[1]}`,[["632",st.tk,cost]],{ma:it[0],sl:q});st.q-=q;st.v-=cost;st.slx+=q;st.gtx+=cost});inj.push({code:"NXT_AM",desc:`Mặt hàng TV55 xuất bán vượt tồn → tồn kho âm`})}
  if(L==="nh"){hook(12,()=>{const st=stock.HAISAN;const q=st.q+12;const cost=R1000(Math.max(st.v,0)+dt/12*0.13);post(day(12,30),"XK12HS",`Xuất hải sản tiệc cuối năm`,[["154",st.tk,cost,"BEP","","nvl"]],{ma:"HAISAN",sl:q});st.q-=q;st.v-=cost;st.slx+=q;st.gtx+=cost});inj.push({code:"NXT_AM",desc:"Hải sản xuất vượt tồn tháng 12 → tồn kho âm"});inj.push({code:"FOOD_COST_THANG",desc:"Tháng 12 giá vốn nguyên liệu tăng đột biến so với doanh thu"})}
  if(L==="sx"){inj.push({code:"GT_LECH_SO",desc:"Bảng giá thành: dở dang cuối kỳ của TUI-PP ghi lệch 120 triệu so với sổ 154"})}
  if(L==="xd"){hook(12,()=>{const j=jobs[2];const v=R1000(j.dthu*0.6);buyInvoice(day(12,20),sup[1],v,[["154",v,j.ma,"nvl"]],"Vật tư phát sinh, sửa chữa CT03","331",0.08)});inj.push({code:"CT_LO",desc:"Công trình CT03 có giá vốn lớn hơn doanh thu"})}
  if(L==="dl"){hook(10,()=>{const j=jobs[3];const extra=R1000(j.dthu*0.35);buyInvoice(day(10,22),sup[6],extra,[["154",extra,j.ma,"nvl"]],"Chi phí phát sinh đoàn Thái Lan (đổi vé, khách sạn)","331",0.1)});inj.push({code:"CT_LO",desc:"Tour T04 có giá vốn lớn hơn doanh thu"})}
  if(L==="ks"){hook(10,()=>post(day(10,20),"PK-OTA10","Hoa hồng Booking.com tháng 9 (Booking.com B.V. – Hà Lan)",[["641","331",R1000(dt*0.004),"","BOOKING"]]));inj.push({code:"NHA_THAU_NN",desc:"Hoa hồng trả Booking.com (nước ngoài) – cần xem nghĩa vụ thuế nhà thầu"})}
  if(L==="vt"){hook(6,()=>post(day(6,30),"PC0630","Thuê xe ông Trần Văn Hùng 6 tháng đầu năm",[["627","1111",R1000(72e6)]]));inj.push({code:"THUE_TS_CA_NHAN",desc:"Thuê xe của cá nhân 72 triệu trả tiền mặt, không có hợp đồng/khấu trừ thuế"})}
 }
 if(ERR){hook(12,()=>post(day(12,30),"BC1230","Thu tiền "+cus[4].ten+" (khách báo đã chuyển)",[["1121","131",R1000(dt*0.0021),"",cus[4].ma]],{bank:"VCB",notInBank:true}));inj.push({code:"SO_KHONG_CO_SK",desc:"Ngày 30/12 ghi thu tiền khách hàng KH005 nhưng tiền chưa về tài khoản (không có trên sao kê)"});inj.push({code:"SK_CHUA_GHI",desc:"Phí ngân hàng hằng tháng và lãi không kỳ hạn trên sao kê chưa hạch toán"});inj.push({code:"SK_LECH_KY",desc:"Thanh toán NCC ngày 31/07 trên sao kê nhưng ghi sổ ngày 01/08"})}
 if(ERR&&Y===2023){hook(3,()=>salesInvoice(day(3,14),cus[1],R1000(dt*0.004),"Bán hàng – áp thuế suất 8% (hết thời gian giảm)",false,0.08));inj.push({code:"VAT8_SAI_KY",desc:"Hóa đơn tháng 3/2023 áp thuế suất 8% khi chính sách giảm thuế không còn hiệu lực"})}
 if(ERR)hook(10,()=>post(day(10,18),"UNC1018","Nộp phạt vi phạm hành chính chậm nộp tờ khai thuế",[["811","1121",6.5e6]],{bank:"VCB"}));
 hook(12,()=>{const ma=sup[7].ma;let b=OB["331|"+ma]||0;J.forEach(j=>{if(j.no==="331"&&j.dn===ma)b+=j.tien;if(j.co==="331"&&j.dc===ma)b-=j.tien});post(day(12,22),"UNC1222","Ứng trước tiền hàng cho "+sup[7].ten,[["331","1121",R1000(Math.max(0,-b)+dt*0.0015),ma,""]],{bank:"VCB"})});
 const cogsAcc={};
 for(let m=1;m<=12;m++){
  const S_=dt/12*P.season[m-1]/(P.season.reduce((a,b)=>a+b,0)/12);
  {const b=B["1121"]||0;if(b<dt*0.04)post(day(m,1),"KUV0-"+m,`Giải ngân vay ngắn hạn đầu tháng ${m}`,[["1121","3411",R1000(dt*0.05-b)]],{bank:"VCB"})}
  // --- doanh thu & giá vốn ---
  const nInv=L==="nh"||L==="ks"?8:6+Math.floor(r()*4);
  for(let k=0;k<nInv;k++){
   const d=day(m,2+Math.floor(k*27/nInv));const c=pick(cus);const cash=r()<P.cashSale;
   const truoc=S_/nInv*rv(0.8,1.2);
   if(L==="tm"){ // xuất bán theo mặt hàng
    let it=pick(items);let st=stock[it[0]];let q=Math.max(1,Math.round(truoc/(it[3]*1.16)));if(st.q<q){const alt=items.map(x=>stock[x[0]]).sort((a,b)=>b.q-a.q)[0];st=alt;it=items.find(x=>x[0]===alt.ma);q=Math.max(1,Math.min(Math.round(truoc/(it[3]*1.16)),st.q))}if(st.q<=0)continue;const gb=st.v/st.q;
    const so=salesInvoice(d,c,q*it[3]*1.16*rv(.97,1.03),`Bán ${it[1]} cho ${cash?"khách lẻ":c.ten}`,cash);
    const cost=R1000(q*gb);post(d,"XK"+so,`Xuất kho bán ${it[1]} – HĐ ${so}`,[["632",st.tk,cost]],{ma:it[0],sl:q});st.q-=q;st.v-=cost;st.slx+=q;st.gtx+=cost;
   }else if(L==="sx"){let pr=pick(prods);let ps=pstock[pr[0]];let q=Math.max(1,Math.round(truoc/(ps.gia*1.24)));if(ps.q<q){ps=Object.values(pstock).sort((a,b)=>b.q-a.q)[0];pr=prods.find(x=>x[0]===ps.ma);q=Math.max(1,Math.min(Math.round(truoc/(ps.gia*1.24)),ps.q))}if(ps.q<=0)continue;const g=ps.v/ps.q;
    const so=salesInvoice(d,c,q*ps.gia*1.24*rv(.97,1.03),`Bán ${pr[1]} cho ${c.ten}`,cash);const cost=R1000(q*g);post(d,"XK"+so,`Xuất kho thành phẩm ${pr[1]} – HĐ ${so}`,[["632","155",cost]],{ma:pr[0],sl:q});ps.q-=q;ps.v-=cost;ps.slx+=q;ps.gtx+=cost;
   }else{const j=jobs.length?pick(jobs.filter(x=>!x.frozen)):null;const so=salesInvoice(d,c,truoc,L==="nh"?`Doanh thu ăn uống ngày ${fd(d)}`:L==="ks"?`Doanh thu ${j&&j.ma==="F&B"?"ăn uống":"phòng"} ngày ${fd(d)}`:`Doanh thu ${j?j.ten:""} – ${c.ten}`,cash||L==="nh");if(j)j.dthu+=R1000(truoc);}
  }
  // --- mua hàng / chi phí sản xuất ---
  if(L==="tm"){items.forEach(it=>{const st=stock[it[0]];const need=Math.max(0,Math.round(S_*(1-P.gm)/items.length/it[3]*rv(0.95,1.2)+Math.max(0,(st.sld*0.8-st.q))*0.5));if(!need)return;const s=sup[items.indexOf(it)%3];const v=need*it[3]*rv(.98,1.02);const d=day(m,1+Math.floor(r()*20));buyInvoice(d,s,v,[[st.tk,v]],`Mua ${it[1]} – ${s.ten}`);st.q+=need;st.v+=R1000(v);st.sln+=need;st.gtn+=R1000(v)})}
  if(L==="nh"){items.forEach(it=>{const st=stock[it[0]];const need=Math.round(S_*(1-P.gm)*0.8/items.length/it[3]*rv(0.9,1.1));const s=sup[3+items.indexOf(it)%3];const v=need*it[3];const d=day(m,3+Math.floor(r()*24));buyInvoice(d,s,v,[[st.tk,v]],`Mua ${it[1]} – ${s.ten}`,"331",0.08);st.q+=need;st.v+=R1000(v);st.sln+=need;st.gtn+=R1000(v);
    const q=Math.round(need*rv(0.92,1.02));const gb=st.v/Math.max(st.q,1);const cost=R1000(q*gb);post(day(m,28),"XK"+m+it[0],`Xuất nguyên liệu ${it[1]} cho bếp tháng ${m}`,[["154",st.tk,cost,"BEP","","nvl"]],{ma:it[0],sl:q});st.q-=q;st.v-=cost;st.slx+=q;st.gtx+=cost})}
  if(L==="sx"){items.forEach(it=>{const st=stock[it[0]];const need=Math.round(S_*(1-P.gm)*0.62/items.length/it[3]*rv(.9,1.1));const s=sup[1];const v=need*it[3];buyInvoice(day(m,5+items.indexOf(it)*3),s,v,[[st.tk,v]],`Mua ${it[1]}`);st.q+=need;st.v+=R1000(v);st.sln+=need;st.gtn+=R1000(v);
    const q=Math.round(need*rv(.95,1.03));const gb=st.v/Math.max(st.q,1);const cost=R1000(q*gb);post(day(m,26),"XK"+m+it[0],`Xuất ${it[1]} cho sản xuất tháng ${m}`,[["621","1521",cost,"SX"]],{ma:it[0],sl:q});st.q-=q;st.v-=cost;st.slx+=q;st.gtx+=cost})}
  if(["xd","dv","dl","vt","ks"].includes(L)){const act=jobs.filter(j=>!j.frozen);act.forEach(j=>{const base=S_*(1-P.gm)/act.length*rv(.85,1.15);
    const nvl=base*(L==="xd"?0.55:L==="vt"?0.45:L==="dl"?0.7:L==="ks"?0.15:0.1),mtc=L==="xd"?base*0.12:0,sx_=base*(L==="dl"?0.25:0.13);const s=pick(sup);
    buyInvoice(day(m,6+Math.floor(r()*18)),s,nvl+mtc+sx_,[[L==="xd"||L==="vt"?"621":"154",nvl,j.ma,"nvl"],...(mtc?[["623",mtc,j.ma,"mtc"]]:[]),[L==="xd"||L==="vt"?"627":"154",sx_,j.ma,"sxc"]],L==="dl"?`Chi phí dịch vụ ${j.ten} (khách sạn, xe, vé)`:L==="vt"?`Nhiên liệu, phí cầu đường ${j.ten}`:`Chi phí ${j.ten}`,"331",L==="xd"?0.08:0.1);
    j.nvl+=R1000(nvl);j.mtc+=R1000(mtc);j.sxc+=R1000(sx_)})}
  // --- tiền lương, BH, TNCN ---
  const alloc=L==="sx"?[["622",.62],["627",.14],["641",.08],["642",.16]]:["xd","vt"].includes(L)?[["622",.7],["627",.1],["642",.2]]:["dv","dl","ks","nh"].includes(L)?[["154",.65],["641",.1],["642",.25]]:[["641",.55],["642",.45]];
  const d=day(m,28);
  const skipBH=ERR&&m===3;
  const ER=emp.map((e,i)=>{const tn=R1000(sal*e.w/wsum);const base=e.noBH?0:Math.min(tn,Math.max(R1000(tn*0.8),5.2e6));return{e,i,tn,base,bh:Math.round(base*0.105)}});const bhB=ER.reduce((t,x)=>t+x.base,0);QLBH+=skipBH?0:bhB;
  {const salM=ER.reduce((t,x)=>t+x.tn,0);let acc=0;post(d,"TL"+m,`Tính lương tháng ${m}/${Y}`,alloc.map(([tk,p],k)=>{const v=k===alloc.length-1?salM-acc:Math.round(salM*p);acc+=v;return[tk,"3341",v,""]}).flatMap(l=>l[0]==="154"?splitJobs("154",l[2],"nc").map(x=>[x[0],"3341",x[2],x[3],"",x[5]]):[l]))}
  if(["xd","vt","dv","dl","ks"].includes(L))jobs.filter(j=>!j.frozen).forEach(j=>j.nc+=R1000(sal*(alloc[0][1])/jobs.filter(x=>!x.frozen).length));
  if(!skipBH){post(d,"BH"+m,`Trích BHXH, BHYT, BHTN, KPCĐ tháng ${m}`,([...alloc.map(([tk,p])=>[tk,"3383",bhB*0.175*p]),...alloc.map(([tk,p])=>[tk,"3384",bhB*0.03*p]),...alloc.map(([tk,p])=>[tk,"3386",bhB*0.01*p]),...alloc.map(([tk,p])=>[tk,"3382",bhB*0.02*p])]).flatMap(l=>l[0]==="154"?splitJobs("154",l[2],"nc").map(x=>[x[0],l[1],x[2],x[3],"",x[5]]):[l]));
   post(d,"BH"+m+"NLD",`Khấu trừ BH người lao động tháng ${m}`,[["3341","3383",Math.round(bhB*0.08)],["3341","3384",Math.round(bhB*0.015)],["3341","3386",Math.round(bhB*0.01)]]);
   const pc=tk=>J.filter(j=>j.co===tk&&mon(j.d)===m&&/^BH/.test(j.so)).reduce((t,j)=>t+j.tien,0);post(day(m,30),"UNC-BH"+m,`Nộp BHXH tháng ${m}`,[["3383","1121",pc("3383")],["3384","1121",pc("3384")],["3386","1121",pc("3386")],["3382","1121",Math.round(pc("3382")*0.75)]],{bank:"VCB"})}
  else inj.push({code:"THANG_THIEU_BH",desc:`Tháng 3 không trích BHXH, BHYT, BHTN`});
  let tTax=0;ER.forEach(({e,i,tn,bh:bh0})=>{const mien=730000,bh=skipBH?0:bh0;const date=day(m,15);const npt=(ERR&&i===0&&m===6)?Math.max(0,e.npt-1):e.npt;
   const tntt=Math.max(0,tn-mien-bh-pol("pit_self",date)-pol("pit_dep",date)*npt);let thue=pitTax(tntt,date);if(ERR&&i===0&&m===6&&e.npt===0)thue=pitTax(tntt+pol("pit_dep",date),date);tTax+=thue;
   LUONG.push({ma:e.ma,ten:e.ten,mst:e.mst,ym:`${Y}-${String(m).padStart(2,"0")}`,tn,mien,tnct:tn-mien,bh,npt:e.npt,gt:null,tntt:null,thue,loai:"HĐLĐ không xác định thời hạn",uq:i>2})});
  post(d,"TNCN"+m,`Khấu trừ thuế TNCN tháng ${m}`,[["3341","3335",tTax]]);emp.tq=(emp.tq||0)+tTax;
  post(day(m%12+1===1?12:m,10),"UNC-L"+m,`Trả lương tháng ${m===1?12:m-1}`,[["3341","1121",sal*0.86]],{bank:"VCB"});
  if(m%3===0){post(day(m,20),"UNC-TNCN"+m,`Nộp thuế TNCN quý ${m/3}`,[["3335","1121",emp.tq]],{bank:"VCB"});emp.tq=0}
  // --- khấu hao, phân bổ ---
  const kh=P.fa/P.life/12;
  if(!(ERR&&m===5)){post(day(m,30),"KH"+m,`Khấu hao TSCĐ tháng ${m}`,(ls=>ls.flatMap(l=>l[0]==="154"?splitJobs("154",l[2],"sxc").map(x=>[x[0],"2141",x[2],x[3],"",x[5]]):[l]))(L==="sx"?[["627","2141",kh*0.85],["642","2141",kh*0.15]]:["xd","vt"].includes(L)?[["623"==="623"&&L==="xd"?"623":"627","2141",kh*0.8],["642","2141",kh*0.2]]:["ks","nh"].includes(L)?[["154","2141",kh*0.85],["642","2141",kh*0.15]]:[["641","2141",kh*0.4],["642","2141",kh*0.6]]))}
  else inj.push({code:"THANG_THIEU_KH",desc:"Tháng 5 không trích khấu hao TSCĐ"});
  post(day(m,30),"PB"+m,`Phân bổ chi phí trả trước tháng ${m}`,[["642","242",dt*0.006/12*0.8]]);
  // --- chi phí bán hàng, quản lý ---
  const ex=dt/12*(P.bh+P.ql)-sal*(alloc.filter(a=>a[0]==="641"||a[0]==="642").reduce((t,a)=>t+a[1],0))-kh*0.4;
  if(ex>0){const s=sup[5];buyInvoice(day(m,12),s,ex*0.55,[["642",ex*0.35],["641",ex*0.2]],`Thuê văn phòng, điện, nước, dịch vụ tháng ${m}`,"331");
   post(day(m,15),"PC"+m+"01",`Chi tiếp khách, công tác phí tháng ${m}`,[["642","1111",Math.min(ex*0.08,4.5e6)]]);
   buyInvoice(day(m,18),sup[6],ex*0.2,[["641",ex*0.2]],`Chi phí vận chuyển, quảng cáo tháng ${m}`,"1121")}
  // --- lãi vay, lãi tiền gửi ---
  if(P.loan)post(day(m,25),"UNC-LV"+m,`Trả lãi vay tháng ${m}`,[["635","1121",P.loan*P.rate/12]],{bank:"VCB"});
  post(day(m,30),"BC-LTG"+m,`Lãi tiền gửi tháng ${m}`,[["1121","515",dt*0.00004]],{bank:"VCB"});
  // --- thu tiền, trả tiền ---
  cus.forEach(c=>{const v=ar[c.ma]*rv(0.75,0.95);if(v>1e6){post(day(m,22+Math.floor(r()*6)),"BC"+m+c.ma,`Thu tiền ${c.ten}`,[[r()<0.85?"1121":"1122","131",v,"",c.ma]],{bank:"VCB"});ar[c.ma]-=R1000(v)}});
  sup.forEach(s=>{const v=Math.min(ap[s.ma]*rv(0.7,0.95),Math.max(0,(B["1121"]||0)-dt*0.006));if(v>1e6){post(day(m,28+Math.floor(r()*3)),"UNC"+m+s.ma,`Thanh toán ${s.ten}`,[["331","1121",v,s.ma,""]],{bank:"VCB"});ap[s.ma]-=R1000(v)}});
  // --- rút / nộp tiền mặt ---
  const cashNeed=Math.max(8e6,dt*0.0012);
  if(P.cashSale>=0.05){const dep=Math.max(0,(B["1111"]||0)-Math.max(30e6,dt*0.002));if(dep>0)post(day(m,27),"PC-NT"+m,`Nộp tiền bán hàng vào ngân hàng tháng ${m}`,[["1121","1111",dep]],{bank:"VCB"})}
  else post(day(m,14),"PT-RT"+m,`Rút tiền gửi về nhập quỹ`,[["1111","1121",cashNeed]],{bank:"VCB"});
  (HK[m]||[]).forEach(f=>f());
  // --- giá thành cuối tháng ---
  if(L==="sx"){const sumAcc=tk=>J.filter(j=>j.no===tk&&mon(j.d)===m).reduce((t,j)=>t+j.tien,0);const n621=sumAcc("621"),n622=sumAcc("622"),n627=sumAcc("627");
   post(day(m,31),"KC154-"+m,`Kết chuyển chi phí sản xuất tháng ${m}`,[["154","621",n621,"SX"],["154","622",n622,"SX"],["154","627",n627,"SX"]]);
   const tot=n621+n622+n627;prods.forEach((pr,i)=>{const share=[.45,.3,.25][i];const z=R1000(tot*share*0.985);const q=Math.round(z/pstock[pr[0]].gia/1.02);post(day(m,31),"NK"+m+pr[0],`Nhập kho thành phẩm ${pr[1]} tháng ${m}`,[["155","154",z,"","SX"]],{ma:pr[0],sl:q});pstock[pr[0]].q+=q;pstock[pr[0]].v+=z;pstock[pr[0]].sln+=q;pstock[pr[0]].gtn+=z;
    const gj=sold[pr[0]]||(sold[pr[0]]={ma:pr[0],ten:pr[1],ddd:0,nvl:0,nc:0,mtc:0,sxc:0,z:0,sl:0});gj.nvl+=R1000(n621*share);gj.nc+=R1000(n622*share);gj.sxc+=R1000(n627*share);gj.z+=z;gj.sl+=q})}
  if(["xd","vt"].includes(L)){const act=jobs.filter(j=>!j.frozen);["621","622","623","627"].forEach(tk=>{const v=J.filter(j=>j.no===tk&&mon(j.d)===m).reduce((t,j)=>t+j.tien,0);if(v)post(day(m,31),"KC154-"+m+tk,`Kết chuyển ${tk} sang 154 tháng ${m}`,(()=>{let a=0;return act.map((j,i)=>{const x=i===act.length-1?v-a:Math.round(v/act.length);a+=x;return["154",tk,x,j.ma,"",{"621":"nvl","622":"nc","623":"mtc","627":"sxc"}[tk]]})})())})}
  // giá vốn dịch vụ / công trình / tour / NH / KS
  if(["xd","dv","dl","vt","ks","nh"].includes(L)){const tgt=S_*(1-P.gm);const act=jobs.filter(j=>!j.frozen);
   if(act.length){if(ERR&&L==="dv"&&m===4){inj.push({code:"DT_KHONG_GV",desc:"Tháng 4 có doanh thu nhưng không kết chuyển giá vốn dịch vụ"})}else act.forEach(j=>{const f=L==="xd"?(m===12?1:m%3?0.55:0.9):1;const keep=L==="xd"?(j.keep??(j.keep=Math.round(j.ddd*0.9))):0;const z=Math.max(0,Math.round((avail(j.ma)-keep)*f));if(z)post(day(m,31),"KC632-"+m+j.ma,`Kết chuyển giá vốn ${j.ten} tháng ${m}`,[["632","154",z,"",j.ma]])})}
   else{const z=Math.max(0,avail("BEP"));if(z)post(day(m,31),"KC632-"+m,`Kết chuyển giá vốn tháng ${m}`,[["632","154",z,"","BEP"]])}}
  // --- thuế GTGT tháng: khấu trừ, nộp ---
  {const outB=J.filter(j=>j.co==="33311"&&mon(j.d)===m).reduce((t,j)=>t+j.tien,0)-J.filter(j=>j.no==="33311"&&mon(j.d)===m&&j.co!=="1331"&&j.co!=="1121").reduce((t,j)=>t+j.tien,0);const avail=Math.max(0,B["1331"]||0);const kc=Math.min(Math.max(0,-(B["33311"]||0)),avail);if(kc>0)post(day(m,31),"KC-GTGT"+m,`Khấu trừ thuế GTGT tháng ${m}`,[["33311","1331",kc]]);const pay=Math.max(0,-(B["33311"]||0));if(pay>0&&m<12)post(day(m+1,20),"UNC-GTGT"+m,`Nộp thuế GTGT tháng ${m}`,[["33311","1121",pay]],{bank:"VCB"})}
  {const b2=B["1122"]||0;if(b2>dt*0.006)post(day(m,28),"CK"+m,"Chuyển tiền từ TK BIDV sang TK Vietcombank",[["1121","1122",R1000(b2-dt*0.004)]],{bank:"VCB"});const bank=(B["1121"]||0);const floor=dt*0.015;if(bank<floor){const v=R1000((floor-bank)*1.3);post(day(m,1),"KUV"+m,`Giải ngân vay ngắn hạn bổ sung vốn lưu động tháng ${m}`,[["1121","3411",v]],{bank:"VCB"})}}
 }
 // ---------- thuế TNDN, kết chuyển ----------
 const tot=(tk,side)=>J.filter(j=>(side==="n"?j.no:j.co).startsWith(tk)).reduce((t,j)=>t+j.tien,0);
 const rev=tot("511","c")+tot("515","c")+tot("711","c"),exp=["632","635","641","642","811"].reduce((t,k)=>t+tot(k,"n"),0);
 const lntt=rev-exp;const rate=dt<=3e9?0.15:dt<=50e9?0.17:0.2;const cit=lntt>0?R1000(lntt*rate*1.04):0;
 {const b=B["1121"]||0;if(b<dt*0.01)post(day(12,30),"KUV-CN","Giải ngân vay ngắn hạn cuối năm",[["1121","3411",R1000(dt*0.015-b)]],{bank:"VCB"})}
 if(cit){post(day(12,31),"TNDN",`Chi phí thuế TNDN năm ${Y}`,[["8211","3334",cit]]);post(day(12,31),"UNC-TNDN",`Tạm nộp thuế TNDN năm ${Y}`,[["3334","1121",R1000(cit*0.82)]],{bank:"VCB"})}
 // kết chuyển thuế GTGT cuối năm

 // kết chuyển doanh thu, chi phí sang 911
 const close=[];const accs=[...new Set(J.flatMap(j=>[j.no,j.co]))];
 accs.filter(a=>/^(5|6|7|8)/.test(a)&&!/^(154|155|156|152)/.test(a)).forEach(a=>{const n=J.filter(j=>j.no===a).reduce((t,j)=>t+j.tien,0),c=J.filter(j=>j.co===a).reduce((t,j)=>t+j.tien,0);const bal=n-c;if(!bal)return;if(/^(621|622|623|627)/.test(a)&&["sx","xd","vt"].includes(L)){if(bal)close.push([ "154",a,bal,"",""]);return}if(bal>0)close.push(["911",a,bal]);else close.push([a,"911",-bal])});
 post(day(12,31),"KC-KQKD","Kết chuyển doanh thu, chi phí xác định kết quả",close);
 const r911=J.filter(j=>j.co==="911").reduce((t,j)=>t+j.tien,0)-J.filter(j=>j.no==="911").reduce((t,j)=>t+j.tien,0);
 post(day(12,31),"KC-LN","Kết chuyển lãi/lỗ năm "+Y,[r911>=0?["911","4212",r911]:["4212","911",-r911]]);
 // lệch kỳ: một khoản thanh toán NCC cuối tháng 7 ghi sổ sang 01/08
 if(ERR){const x=J.find(j=>j.co==="1121"&&j.no==="331"&&j.d.slice(0,7)===`${Y}-07`&&+j.d.slice(8)>=24);if(x){x.bankD=x.d;x.d=`${Y}-08-01`}}
 // ---------- dựng các sổ ----------
 J.forEach((j,i)=>j.i=i);J.sort((a,b)=>a.d.localeCompare(b.d)||a.i-b.i);
 const nkc=[];J.forEach(j=>{nkc.push({d:j.d,dc:j.d,so:j.so,dg:j.dg,tk:j.no,du:j.co,n:j.tien,c:0,dt:j.dn,src:"nkc",hd:j.hd||""});nkc.push({d:j.d,dc:j.d,so:j.so,dg:j.dg,tk:j.co,du:j.no,n:0,c:j.tien,dt:j.dc,src:"nkc",hd:j.hd||""})});
 // CĐPS
 const acc={};const A=tk=>acc[tk]||(acc[tk]={tk,dnd:0,dcd:0,psn:0,psc:0});
 for(const[k,v]of Object.entries(OB)){const tk=k.split("|")[0];v>=0?A(tk).dnd+=v:A(tk).dcd+=-v}
 J.forEach(j=>{A(j.no).psn+=j.tien;A(j.co).psc+=j.tien});
 // tài khoản lưỡng tính: tính số dư theo đối tượng
 const det=tk=>{const m={};for(const[k,v]of Object.entries(OB)){const[t,d]=k.split("|");if(t===tk)m[d]=(m[d]||0)+v}J.forEach(j=>{if(j.no===tk)m[j.dn]=(m[j.dn]||0)+j.tien;if(j.co===tk)m[j.dc]=(m[j.dc]||0)-j.tien});return m};
 const detOpen=tk=>{const m={};for(const[k,v]of Object.entries(OB)){const[t,d]=k.split("|");if(t===tk)m[d]=(m[d]||0)+v}return m};
 const tbRows=Object.values(acc).map(a=>{const net=a.dnd-a.dcd+a.psn-a.psc;let dnc=net>0?net:0,dcc=net<0?-net:0;
  if(a.tk==="131"||a.tk==="331"){const m=det(a.tk),o=detOpen(a.tk);dnc=Object.values(m).filter(v=>v>0).reduce((t,v)=>t+v,0);dcc=-Object.values(m).filter(v=>v<0).reduce((t,v)=>t+v,0);a.dnd=Object.values(o).filter(v=>v>0).reduce((t,v)=>t+v,0);a.dcd=-Object.values(o).filter(v=>v<0).reduce((t,v)=>t+v,0)}
  return{tk:a.tk,ten:TKN[a.tk]||TKN[a.tk.slice(0,3)]||"",dnd:a.dnd,dcd:a.dcd,psn:a.psn,psc:a.psc,dnc,dcc}}).sort((a,b)=>a.tk.localeCompare(b.tk));
 // thêm dòng tổng cấp 1 cho các TK có chi tiết
 const parents={};tbRows.forEach(x=>{if(x.tk.length>3){const p=x.tk.slice(0,3);const o=parents[p]||(parents[p]={tk:p,ten:TKN[p]||"",dnd:0,dcd:0,psn:0,psc:0,dnc:0,dcc:0});["dnd","dcd","psn","psc","dnc","dcc"].forEach(k=>o[k]+=x[k])}});
 Object.values(parents).forEach(p=>{const net0=p.dnd-p.dcd,net1=p.dnc-p.dcc;if(!["131","331","138","338","333"].includes(p.tk)){p.dnd=Math.max(net0,0);p.dcd=Math.max(-net0,0);p.dnc=Math.max(net1,0);p.dcc=Math.max(-net1,0)}});
 const tb=[...tbRows.filter(x=>!(x.tk.length===3&&parents[x.tk])),...Object.values(parents)].sort((a,b)=>a.tk.localeCompare(b.tk)||a.tk.length-b.tk.length);
 // sổ quỹ, TGNH
 const quy=nkc.filter(x=>x.tk.startsWith("111")).map(x=>({d:x.d,dc:x.d,so:x.so,dg:x.dg,tk:x.tk,du:x.du,n:x.n,c:x.c,src:"quy",dt:x.dt}));
 const tgnh=nkc.filter(x=>x.tk.startsWith("112")).map(x=>({d:x.d,dc:x.d,so:x.so,dg:x.dg,tk:x.tk,du:x.du,n:x.n,c:x.c,src:"tgnh",bank:x.tk==="1122"?"BIDV – 2201 0000 8888":"Vietcombank – 0011 0045 6789",dt:x.dt}));
 // sao kê ngân hàng sinh từ giao dịch thực (phí, lãi ngân hàng tự ghi; khoản ghi sổ trước khi tiền về không có)
 const SK=[];const skBal={};
 [["1121","Vietcombank","0011004567890"],["1122","BIDV","22010000888888"]].forEach(([tk,bank,acct])=>{const ob=Object.entries(OB).filter(([k])=>k.startsWith(tk+"|")).reduce((t,[,v])=>t+v,0);
  const tx=J.filter(j=>(j.no===tk||j.co===tk)&&!j.notInBank).map(j=>({d:j.bankD||j.d,n:j.no===tk?j.tien:0,c:j.co===tk?j.tien:0,dg:j.dg,so:j.so,i:j.i}));
  if(ERR&&tk==="1121")for(let m=1;m<=12;m++){tx.push({d:day(m,25),n:0,c:R1000(11000*1.1)+(m%2?55000:33000),dg:`PHI DICH VU SMS BANKING + PHI CHUYEN TIEN T${m}/${Y}`,so:"",fee:true});tx.push({d:day(m,day(m,31).slice(8)*1),n:Math.round(dt*0.0000035),c:0,dg:`TRA LAI TIEN GUI KHONG KY HAN THANG ${m}`,so:""})}
  tx.sort((a,b)=>a.d.localeCompare(b.d)||(a.i??1e9)-(b.i??1e9));let bal=ob;let k=0;
  tx.forEach(t=>{bal+=t.n-t.c;k++;const ref=(bank==="BIDV"?"FT":"")+String(5000000+k*37+(t.d.replace(/-/g,"")*1)%9973);const desc=t.fee?t.dg:(t.n?(/thu tien/i.test(t.dg)?`IBFT CT DEN: ${norm(t.dg).toUpperCase()}`:norm(t.dg).toUpperCase()):(/thanh toan/i.test(t.dg)?`TT TIEN HANG ${norm(t.dg).replace("thanh toan ","").toUpperCase()} ${t.so}`:norm(t.dg).toUpperCase()));
   SK.push({d:t.d,ref,dg:desc,dt:"",n:t.n,c:t.c,bal,acct,bank})});
  skBal[acct]={open:ob,close:bal,from:`${Y}-01-01`,to:`${Y}-12-31`,bank}});
 // công nợ
 const cnList=(tk,list)=>{const o=detOpen(tk),m=det(tk);const keys=new Set([...Object.keys(o),...Object.keys(m)]);return[...keys].filter(Boolean).map(k=>{const ps=J.filter(j=>j.no===tk&&j.dn===k).reduce((t,j)=>t+j.tien,0),pc=J.filter(j=>j.co===tk&&j.dc===k).reduce((t,j)=>t+j.tien,0);const od=o[k]||0,cd=m[k]||0;const x=list.find(z=>z.ma===k);return{ma:k,ten:x?x.ten:k==="NCC009"?"Công ty TNHH Thương mại Hưng Gia":k==="BOOKING"?"Booking.com B.V.":k,tk,dnd:Math.max(od,0),dcd:Math.max(-od,0),psn:ps,psc:pc,dnc:Math.max(cd,0),dcc:Math.max(-cd,0)}}).sort((a,b)=>a.ma.localeCompare(b.ma))};
 const cn131=cnList("131",cus),cn331=cnList("331",sup);
 // NXT
 const nxt=[...Object.values(stock),...Object.values(pstock)].map(s=>({ma:s.ma,ten:s.ten,dvt:s.dvt,kho:s.tk==="155"?"Kho thành phẩm":s.tk==="1561"?"Kho hàng hóa":"Kho nguyên vật liệu",tk:s.tk,sld:s.sld,gtd:s.gtd,sln:s.sln,gtn:s.gtn,slx:s.slx,gtx:s.gtx,slc:s.sld+s.sln-s.slx,gtc:s.gtd+s.gtn-s.gtx}));
 // giá thành
 let gt=[];
 if(L==="sx")gt=Object.values(sold).map(g=>({...g,ddd:0,mtc:0,ddc:R1000(g.nvl+g.nc+g.sxc-g.z),dgz:g.sl?Math.round(g.z/g.sl):0,dthu:null}));
 else if(jobs.length)gt=jobs.map(j=>{const c=k=>J.filter(x=>x.no==="154"&&x.dn===j.ma&&x.cat===k).reduce((t,x)=>t+x.tien,0);const z=J.filter(x=>x.co==="154"&&x.dc===j.ma).reduce((t,x)=>t+x.tien,0);const o={ma:j.ma,ten:j.ten,ddd:j.ddd,nvl:c("nvl"),nc:c("nc"),mtc:c("mtc"),sxc:c("sxc"),z,sl:0,dgz:0,dthu:j.dthu};o.ddc=o.ddd+o.nvl+o.nc+o.mtc+o.sxc-z;return o});
 if(ERR&&L==="sx"&&gt[0]){gt[0].ddc+=120e6}
 // tờ khai GTGT từng tháng (kê khai theo hóa đơn)
 const tk=[];let c43=opt.prev&&opt.prev.ct43!=null?opt.prev.ct43:(OB["1331|"]||0);
 for(let m=1;m<=12;m++){const v=vatM[m];const c22=c43;const c25=v.in;const c35=v.out;const x=c35-c25-c22;const c40=Math.max(0,x),c41=Math.max(0,-x);c43=c41;
  tk.push({ky:`T${m}/${Y}`,kieu:"M",lan:0,loai:"C",ct:{"21":0,"22":c22,"23":v.dtin,"24":v.in,"25":c25,"26":0,"27":v.dt,"28":c35,"29":0,"30":0,"31":0,"32":v.dt,"33":c35,"32a":0,"34":v.dt,"35":c35,"36":c35-c25,"37":0,"38":0,"39a":0,"40a":c40,"40b":0,"40":c40,"41":c41,"42":0,"43":c41}})}
 // ---------- BCTC từ CĐPS ----------
 const g=(tk,f)=>tb.filter(x=>x.tk===tk||(x.tk.startsWith(tk)&&x.tk.length>tk.length&&!tb.some(p=>p.tk===tk))).reduce((t,x)=>t+f(x),0);
 const gb=(tk,k)=>{const x=tb.find(z=>z.tk===tk);if(x)return x[k];return g(tk,z=>z[k])};
 const net=(tk,end)=>end?gb(tk,"dnc")-gb(tk,"dcc"):gb(tk,"dnd")-gb(tk,"dcd");
 const bs=end=>{const D=end?"dnc":"dnd",C=end?"dcc":"dcd";const v={};
  v.TIEN=net("111",end)+net("112",end);v.DTNH=0;v.PTKH=gb("131",D);v.TTNB=gb("331",D);const dp=k=>Math.max(0,net(k,end)),cp=k=>Math.max(0,-net(k,end));const pk=dp("138")+dp("141");v.PTHU=v.PTKH+v.TTNB+pk;
  v.HTK=["152","153","154","155","156","157"].reduce((t,k)=>t+net(k,end),0);v.TSNH_KHAC=dp("133")+dp("242")+dp("3331")+dp("3334")+dp("3335")+dp("334")+dp("338");
  v.TSNH=v.TIEN+v.DTNH+v.PTHU+v.HTK+v.TSNH_KHAC;v.TSCD=net("211",end)+net("214",end);v.TSDD=0;v.TSDH=v.TSCD;v.TONG_TS=v.TSNH+v.TSDH;
  v.PTNB=gb("331",C);v.NMTT=gb("131",C);v.THUE_PN=Math.max(0,-net("3331",end))+Math.max(0,-net("3334",end))+Math.max(0,-net("3335",end));v.VAY_NH=-net("341",end);v.PTNLD=Math.max(0,-net("334",end));v.NO_NH=v.PTNB+v.NMTT+v.THUE_PN+cp("334")+cp("338")+cp("138")+cp("141")+cp("133")+cp("242")+v.VAY_NH;v.VAY_DH=0;v.NO_DH=0;v.TONG_NO=v.NO_NH;
  v.VON_GOP=-net("411",end);v.LNCPP=-net("421",end);v.VCSH=v.VON_GOP+v.LNCPP;v.TONG_NV=v.TONG_NO+v.VCSH;return v};
 const BT=bs(true),BP=bs(false);
 const ps=(tk,side,excl)=>J.filter(j=>(side==="n"?j.no:j.co).startsWith(tk)&&!(excl&&(side==="n"?j.co:j.no).startsWith(excl))).reduce((t,j)=>t+j.tien,0);
 const K={};K.DT_BH=ps("511","c","911");K.GTDT=0;K.DThu=K.DT_BH;K.GVHB=ps("632","n","911");K.LNG=K.DThu-K.GVHB;K.DTTC=ps("515","c","911");K.CPTC=ps("635","n","911");K.LAI_VAY_KD=J.filter(j=>j.no==="635"&&/lãi vay/i.test(j.dg)).reduce((t,j)=>t+j.tien,0);
 K.CPBH=ps("641","n","911");K.CPQL=ps("642","n","911");K.LNHDKD=K.LNG+K.DTTC-K.CPTC-K.CPBH-K.CPQL;K.TN_KHAC=ps("711","c","911");K.CP_KHAC=ps("811","n","911");K.LNKHAC=K.TN_KHAC-K.CP_KHAC;K.LNTT=K.LNHDKD+K.LNKHAC;K.THUE=ps("821","n","911");K.LNST=K.LNTT-K.THUE;
 const LC={KHAU_HAO:ps("214","c"),LAI_VAY:K.LAI_VAY_KD,CAPEX:0,CFI:0,TIEN_DAU:BP.TIEN,TIEN_CUOI:BT.TIEN};LC.CF_NET=LC.TIEN_CUOI-LC.TIEN_DAU;LC.CFF=0;LC.CFO=LC.CF_NET;
 const grow=1+rv(0.06,0.16);const v={};const put=(o,side)=>{for(const k in o){v[k]=v[k]||{t:null,p:null};v[k][side]=Math.round(o[k])}};
 put(K,"t");put(LC,"t");put(BT,"t");put(BP,"p");
 const KP={};for(const k in K)KP[k]=Math.round(opt.prev?opt.prev.K[k]??0:K[k]/grow);if(opt.prev){put(KP,"p")}else{KP.LNHDKD=KP.LNG+KP.DTTC-KP.CPTC-KP.CPBH-KP.CPQL;KP.LNKHAC=KP.TN_KHAC-KP.CP_KHAC;KP.LNTT=KP.LNHDKD+KP.LNKHAC;KP.THUE=KP.LNTT>0?Math.round(KP.LNTT*0.2):0;KP.LNST=KP.LNTT-KP.THUE;KP.LNG=KP.DThu-KP.GVHB;KP.LNHDKD=KP.LNG+KP.DTTC-KP.CPTC-KP.CPBH-KP.CPQL;KP.LNTT=KP.LNHDKD+KP.LNKHAC;KP.LNST=KP.LNTT-KP.THUE;put(KP,"p")}
 const LP=opt.prev?{...opt.prev.LC}:{KHAU_HAO:Math.round(LC.KHAU_HAO*0.95),LAI_VAY:KP.LAI_VAY_KD,CAPEX:0,CFI:0,CFF:0,TIEN_CUOI:BP.TIEN,TIEN_DAU:Math.round(BP.TIEN*0.9)};LP.CF_NET=LP.TIEN_CUOI-LP.TIEN_DAU;LP.CFO=LP.CF_NET;put(LP,"p");
 if(ERR){v.PTNB.t=BT.PTNB-BT.TTNB;v.PTHU.t=BT.PTHU-BT.TTNB;v.TSNH.t-=BT.TTNB;v.TONG_TS.t-=BT.TTNB;v.NO_NH.t-=BT.TTNB;v.TONG_NO.t-=BT.TTNB;v.TONG_NV.t-=BT.TTNB;v.TTNB.t=0;inj.push({code:"TRINH_BAY_LT",desc:"BCTC trình bày phải trả người bán theo số thuần (bù trừ trả trước người bán), không tách mã 132/311"})}
 // số liệu bổ sung
 const sumPS=(tk,side)=>J.filter(j=>(side==="n"?j.no:j.co)===tk).reduce((t,j)=>t+j.tien,0);
 v.TIEN_MAT={t:net("111",true),p:net("111",false)};v.QUY_LUONG={t:sumPS("3341","c"),p:null};v.SO_LD={t:P.staff,p:Math.round(P.staff*0.93)};v.QL_BH={t:QLBH,p:null};v.VDL={t:P.cap,p:null};
 v.DT_GTGT={t:tk.reduce((t,x)=>t+x.ct["34"],0),p:null};v.CT43={t:tk.at(-1).ct["43"],p:null};v.CT22_DAU={t:tk[0].ct["22"],p:null};v.CT24_SUM={t:tk.reduce((t,x)=>t+x.ct["24"],0),p:null};v.CT_RA_SUM={t:tk.reduce((t,x)=>t+x.ct["35"],0),p:null};v.CT40_CUOI={t:tk.at(-1).ct["40"],p:null};
 v.THUE_QT={t:K.THUE,p:null};v.TNCN_TK={t:sumPS("3335","c"),p:null};
 if(L==="ks"){v.SO_PHONG={t:P.rooms,p:P.rooms};v.DEM_BAN={t:Math.round(P.rooms*365*0.68),p:null};v.DT_PHONG={t:Math.round(K.DThu*0.68),p:null};v.DT_AU={t:Math.round(K.DThu*0.3),p:null};v.CP_NL={t:Math.round(K.DThu*0.3*0.34),p:null}}
 if(L==="nh"){v.DT_AU={t:K.DThu,p:null};v.CP_NL={t:Math.round(nxt.reduce((t,x)=>t+x.gtx,0)),p:null};v.SO_CHO={t:140,p:140}}
 // tờ khai 05/KK-TNCN theo quý, quyết toán 05/QTT-TNCN (kèm bảng kê từng người), quyết toán 03/TNDN
 const DKS=[];const tnct=r=>r.tnct??(r.tn-(r.mien||0));
 for(let q=1;q<=4;q++){const rs=LUONG.filter(r=>Math.ceil(+r.ym.slice(5,7)/3)===q);if(!rs.length)continue;const ppl=new Set(rs.map(r=>r.ma)),wh=new Set(rs.filter(r=>r.thue>0).map(r=>r.ma));
  const TN=sumBy(rs,tnct),TNk=sumBy(rs.filter(r=>r.thue>0),tnct);let TX=sumBy(rs,r=>r.thue);
  if(ERR&&q===3){const cut=rs.filter(r=>r.thue>0&&r.ym.endsWith("-08"))[0];if(cut){TX-=cut.thue;inj.push({code:"TNCN_TK_SO",desc:`Tờ khai 05/KK quý 3 kê thiếu thuế của ${cut.ten} tháng 8`})}}
  DKS.push({type:"kk05",ky:`Q${q}/${Y}`,lan:0,loai:"C",ct:{"21":ppl.size,"22":ppl.size,"23":wh.size,"24":wh.size,"25":0,"26":TN,"27":TN,"28":0,"29":TNk,"30":TNk,"31":0,"32":TX,"33":TX,"34":0},pl:{},ppl:[]})}
 {const by=new Map();LUONG.filter(r=>!/vãng lai|thời vụ|cộng tác/i.test(r.loai||"")).forEach(r=>{const o=by.get(r.ma)||{ten:r.ten,mst:r.mst,tn:0,bh:0,thue:0,npt:r.npt};o.tn+=tnct(r);o.bh+=r.bh||0;o.thue+=r.thue;by.set(r.ma,o)});
  let ppl=[...by.values()].map(o=>({ten:o.ten,mst:o.mst,vals:{"10":o.tn,"13":o.npt,"16":o.bh,"19":o.thue}}));
  if(ERR&&ppl.length>3){const drop=ppl.splice(3,1)[0];inj.push({code:"TNCN_QT_THIEU_NGUOI",desc:`Phụ lục quyết toán thiếu ${drop.ten}`})}
  const TN=sumBy(LUONG,tnct),TX=sumBy(LUONG,r=>r.thue);
  DKS.push({type:"qt05",ky:`N/${Y}`,lan:0,loai:"C",ct:{"16":by.size,"17":by.size,"18":by.size,"19":by.size,"20":0,"23":TN,"24":TN,"25":0,"26":TN,"28":TX,"29":TX,"30":0,"31":TX,"32":TX,"33":0},pl:{},ppl})}
 {const A1=K.LNTT,C4=Math.max(0,A1),rate=dt<=3e9?0.15:dt<=50e9?0.17:0.2,D=R1000(C4*rate),E=sumBy(J.filter(j=>j.no==="3334"&&j.co.startsWith("112")),j=>j.tien);
  DKS.push({type:"tndn03",ky:`N/${Y}`,lan:0,loai:"C",ct:{a1:A1,b1:0,b8:0,b12:A1,b13:A1,c1:A1,c2:0,c3:0,c4:C4,c6:C4,c7:R1000(C4*0.2),d:D,e:E,g:D-E},pl:{"01":K.DT_BH,"19":A1},ppl:[]});
  if(ERR)inj.push({code:"TNDN_CHUA_LOAI",desc:"Không loại chi phí tiền phạt, chi tiền mặt từ ngưỡng khỏi chi phí được trừ (B1 = 0)"})}
 const meta={...blank().meta,skBal,loai:L,ten:P.n+" (ví dụ)",maKH:"VD-"+L.toUpperCase(),mst:"0109"+String(100000+L.charCodeAt(0)*977).slice(0,6),nam:Y,ky:"nam",cheDo:"tt200",nguoi:"Nguyễn Thu Hà",ktv:"Lương Dinh",vd:true,khoaSo:`${Y}-12-31`,cheDo:Y>=2026?"tt99":"tt200"};
 const cl={};for(const[k,x]of Object.entries(OB))cl[k]=(cl[k]||0)+x;J.forEach(j=>{const a=j.no+"|"+(j.dn||""),b=j.co+"|"+(j.dc||"");cl[a]=(cl[a]||0)+j.tien;cl[b]=(cl[b]||0)-j.tien});
 const next={ct43:tk.length?tk.at(-1).ct["43"]:null,close:cl,stock:Object.fromEntries([...Object.values(stock),...Object.values(pstock)].map(st=>[st.ma,{q:st.q,v:st.v}])),K,LC};
 return{next,meta,v,tb,tk,dk:DKS,bk:{...emptyBooks(),nkc,quy,tgnh,cn131,cn331,nxt,gt,hdr:HDR,hdv:HDV,luong:LUONG,sk:SK},skBal,injected:inj};
}
const DEMO_YEARS=[2023,2024,2025,2026];
function demoYears(L,years=DEMO_YEARS){let prev=null;return years.map(y=>{const d=demoCase(L,{year:y,prev});prev=d.next;d.meta.skBal=d.skBal;return d})}
let CACHE=null;
function invalidate(){CACHE=null;_hdm=null}
function compute(){if(__SUA.B6)__quyVeDong();
 if(CACHE)return CACHE;derived.clear();
 syncTK();
 const Rt=calcRatios(),K=modelKPIs(),C=balChecks(),PV=policyView();
 let BK=[],RC=[],TN={issues:[],people:[],totals:null},MO=null;
 try{BK=bookChecks()}catch(e){console.error(e)}
 try{RC=recon()}catch(e){console.error(e)}
 try{TN=tncnChecks()}catch(e){console.error(e)}
 try{MO=monthly()}catch(e){console.error(e)}
 let NH={issues:[],rec:[],accs:[]};try{NH=bankChecks()}catch(e){console.error(e)}
 let DK={issues:[],rows:[],kk:[],qt:null,td:null};try{DK=declChecks()}catch(e){console.error(e)}
 let LK=[],PC=[];try{LK=linkRows()}catch(e){console.error(e)}try{PC=policyChecks()}catch(e){console.error(e)}
 RC=[...RC,...DK.rows,...LK];
 const base=risks(Rt,K,C);// gồm cả kiểm tra CĐPS
 const fromRecon=RC.filter(r=>r.st==="fail").map(r=>({amt:Math.abs(r.d),code:r.code||"DOI_CHIEU",sev:/BCTC|Tờ khai/.test(r.grp)?"TY":"TY",t:`Lệch ${r.n}`,d:`${r.la}: ${fm(r.a)} · ${r.lb}: ${fm(r.b)} · chênh ${fm(r.d)}.`,kn:(typeof CITE!=="undefined"&&CITE[r.code||""]?.fix)||`Lập bảng đối chiếu chi tiết theo tháng, đối tượng giữa ${r.la} và ${r.lb}; xác định từng khoản tạo chênh ${fm(Math.abs(r.d))}; điều chỉnh sổ sách hoặc khai bổ sung bên bị sai.`,cb:r.grp,cat:/^Liên kết năm/.test(r.grp)?"lk":/^BCTC/.test(r.grp)?"cd":/TNCN|Lương/.test(r.grp)||/^(BH|KPCĐ)/.test(r.n)?"tncn":/TNDN/.test(r.grp)?"tndn":"dc",causes:r.causes}));
 const all=[...PV.warns,...base,...BK,...fromRecon,...TN.issues,...DK.issues,...PC,...NH.issues,...(MO?MO.issues:[])];
 // gộp mã trùng tiêu đề
 const seen=new Set(),Rk=[];all.forEach(x=>{const k=(x.code||"")+"|"+x.t;if(seen.has(k))return;seen.add(k);x.cat=x.cat||"tc";Rk.push(x)});
 const ord={NT:0,TY:1,NHO:2};Rk.sort((a,b)=>ord[a.sev]-ord[b.sev]);
 const H=health(Rt,[]);// sức khỏe tài chính: chỉ từ chỉ số
 const RI=Rk.filter(r=>r.cat!=="cs"),nF=[...C,...RC].filter(r=>r.st==="fail").length,sv=k=>RI.filter(r=>r.sev===k).length;
 const qs=Math.max(0,Math.round(100-Math.min(40,sv("NT")*5)-Math.min(25,sv("TY")*0.7)-Math.min(5,sv("NHO")*0.2)-Math.min(5,nF*0.3)));
 const Q={s:qs,gr:qs>=85?"A":qs>=70?"B":qs>=55?"C":qs>=40?"D":"E"};Q.lb={A:"Số liệu đáng tin cậy",B:"Khá – còn sai sót nhỏ",C:"Cần điều chỉnh một số điểm",D:"Nhiều sai sót trọng yếu",E:"Sai sót nghiêm trọng, cần rà soát toàn diện"}[Q.gr];
 CACHE={Rt,K,C,PV,BK,RC,TN,MO,NH,DK,Rk,H,Q,Z:zscore(),D:dupont()};return CACHE;
}
function hasData(){return Object.values(S.v).some(o=>o&&(o.t!=null||o.p!=null))}
function head(eyebrow,title,desc,actions=""){return`<div class="spread"><div class="pagehead"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc?`<p>${desc}</p>`:""}</div>${actions?`<div class="row">${actions}</div>`:""}</div>`}

  // ── Trợ giúp cho các chỗ Savitax sửa lỗi (công tắc __SUA.Bx, danh sách ở lib/soatbaocao/suaLoi.js) ──
  // B1: chỉ số thiếu số liệu giữ null (trước đây null × hệ số năm hóa = 0%)
  function __nhanNam(x){return __SUA.B1?(x==null?null:x*ann()):x*ann()}
  // B3: ngày khóa sổ theo TỪNG NĂM (S.meta.khoaSoNam[năm]); ngày khóa sổ của năm khác thì không dùng
  function __khoaSoNam(){const y=S.meta.nam;const k=(S.meta.khoaSoNam&&S.meta.khoaSoNam[y])||S.meta.khoaSo;return k&&String(k).slice(0,4)===String(y)?k:null}
  // B6: BCTC năm đang xem nhập theo nghìn / triệu đồng → quy về đồng trước khi so với tờ khai, CĐPS, sổ
  function __quyVeDong(){const u=S.meta.donVi==="nghìn đồng"?1e3:S.meta.donVi==="triệu đồng"?1e6:1;if(u===1)return;
    const doi=v=>{for(const[k,o]of Object.entries(v||{})){if(!o||o.auto||!FK[k]||FK[k].u!=="money")continue;if(o.t!=null)o.t=o.t*u;if(o.p!=null)o.p=o.p*u}};
    doi(S.v);S.meta.donVi="đồng";CACHE=null}
  // B7: DN được miễn thuế TNDN (từ 2026, doanh thu năm trước ≤ 1 tỷ) — cùng điều kiện declChecks đang dùng
  function __mienThueTndn(){const dtP=val("DThu","P");return S.meta.nam>=2026&&dtP!=null&&dtP<=1e9}
  // B9: từ khóa so sau khi bỏ dấu làm trùng từ khác nghĩa ("biểu mẫu" ↔ "biếu", "giả định" ↔ "gia đình")
  function __kwNham(id,dg){const t=String(dg||"").toLowerCase(),s=norm(dg);
    if(id==="K2")return!/\b(qua tang|qua tet|gio qua|sinh nhat|dam cuoi|dam hieu|phung vieng|mung tho|tu thien|ung ho|tai tro)\b/.test(s)&&!/biếu/.test(t);
    if(id==="K5")return!/\b(nha rieng|gia dinh giam doc|chi ho|tra ho|xe ca nhan|ca nhan giam doc)\b/.test(s)&&!/gia đình/.test(t);
    return false}
  // B11: hóa đơn ghi sổ cùng chứng từ có Có TK 112 VÀ dòng đó đã ghép được với sao kê → đã thanh toán qua ngân hàng
  function __hdTraQuaNH(){const ra=new Set();let hm;try{hm=hdMatch()}catch(e){return ra}const lk=hm&&hm.hdv&&hm.hdv.link;if(!lk)return ra;
    const daGhep=new Set();try{skAccounts().forEach(a=>(bankMatch(a).pairs||[]).forEach(p=>{if(p.b&&p.b.so)daGhep.add(p.b.so)}))}catch(e){}const theoSo=new Map();for(const p of S.bk.nkc||[]){if(!theoSo.has(p.so))theoSo.set(p.so,[]);theoSo.get(p.so).push(p)}
    for(const x of S.bk.hdv||[]){const l=lk.get(x);if(!l||!l.p)continue;if((theoSo.get(l.p.so)||[]).some(p=>String(p.tk).startsWith("112")&&p.c>0))if(daGhep.has(l.p.so))ra.add(x)}return ra}
  
  // ── Nạp file (lát 2) — phần lõi của importFiles bản gốc, KHÔNG có giao diện / lưu nháp / ảnh ──
  // tep: { ten, duoi, xml? (chuỗi), bang? ([{ name, rows }] — đọc như bản gốc: SheetJS cellDates:true, bỏ dòng trống),
  //        namGoiY? (năm của thư mục chứa file — chỉ dùng khi nội dung không cho biết năm; bản gốc bắt người dùng chọn năm trước) }
  // Trả [{ ten, kind, n, note, nam }] — mỗi bảng / tờ khai một dòng. Gọi __xongNhap() sau khi nạp hết.
  function __nhapFile(tep){const ra=[];const day=x=>{x.nam=+S.meta.nam;ra.push(x)};if(!(_touched instanceof Set))_touched=new Set();
    try{
      if(tep.duoi==="xml"){const r=parseXML(tep.xml);routeYear(kyYear(r.tk&&r.tk.ky||r.dk&&r.dk.ky||"")||(r.meta&&r.meta.nam)||__namXml(tep.xml)||tep.namGoiY);applyMeta(r.meta);
        if(r.kind==="tk"){S.tk=(S.tk||[]).filter(x=>!(x.ky===r.tk.ky&&x.lan===r.tk.lan&&x.loai===r.tk.loai));S.tk.push(r.tk);S.tk.sort(kyCmp);day({ten:tep.ten,kind:"tk",n:1,note:"Kỳ "+r.tk.ky+(r.tk.loai==="B"?" · bổ sung lần "+r.tk.lan:"")})}
        else if(r.kind==="dk"){storeDK(r.dk);day({ten:tep.ten,kind:r.dk.type,n:Object.keys(r.dk.ct).length,note:dkNote(r.dk)})}
        else if(r.kind==="bctc"){Object.assign(S.v,r.v);day({ten:tep.ten,kind:"bctc",n:Object.keys(r.v).length,note:r.note})}
        else day({ten:tep.ten,kind:"unknown",n:0,note:r.note});return ra}
      const tables=tep.bang||[];const kinds=tables.map(t=>t.kind||detectKind(t));const bctcT=tables.filter((t,i)=>kinds[i]==="bctc");
      if(bctcT.length){const sm=sniffMeta(bctcT[0].rows);routeYear(sm.nam||tep.namGoiY);applyMeta(sm);const r=parseBCTCRows(bctcT);const n=Object.keys(r.v).length;
        if(n){Object.assign(S.v,r.v);if(r.regime&&!(r.regime==="tt200"&&S.meta.cheDo==="tt99"))S.meta.cheDo=r.regime}
        day({ten:tep.ten,kind:"bctc",n,note:n?n+" chỉ tiêu · B01 "+r.hits.cd+" · B02 "+r.hits.kd+" · B03 "+r.hits.lc+" dòng":"Không thấy mã số chỉ tiêu"})}
      tables.forEach((t,i)=>{const k=kinds[i];if(k==="bctc")return;const sm=sniffMeta(t.rows);if(k!=="unknown")routeYear(sm.nam||guessYear(t,k)||tep.namGoiY);if(i===0||k!=="unknown")applyMeta(sm);
        if(k==="unknown"){day({ten:tep.ten+(tables.length>1?" › "+t.name:""),kind:"unknown",n:0,note:"Không nhận ra loại tài liệu"});return}
        const r=applyTable(t,k,tep.ten);day({ten:tep.ten+(tables.length>1?" › "+t.name:""),...r})});
    }catch(e){day({ten:tep.ten,kind:"unknown",n:0,note:"Không đọc được file: "+(e&&e.message||"lỗi không xác định")})}
    return ra}
  // Năm của XML không phải tờ khai GTGT / TNCN / TNDN (vd BCTC XML): <kyKKhai>2024</kyKKhai> hoặc ngày cuối kỳ
  function __namXml(x){const m=String(x).match(/<(?:[\w.-]+:)?kyKKhai>([^<]*)</);const y=m&&m[1].match(/(20\d\d)\s*$/);if(y)return+y[1];const d=String(x).match(/<(?:[\w.-]+:)?kyKKhaiDenNgay>([^<]*)</);const y2=d&&d[1].match(/(20\d\d)/);return y2?+y2[1]:null}
  // Gom số liệu năm đang mở vào hồ sơ; trả các năm đã nạp
  function __xongNhap(){syncYear();const ds=[...(_touched||[])].sort();_touched=new Set();return ds}

  // B15: BCTC XML — một mã số mang nghĩa khác nhau theo chế độ (200 = TS dài hạn ở TT200, = TỔNG tài sản ở TT133). Chọn chế độ
  // y như bộ đọc Excel của bản gốc (TT133 nếu có mã 500, hoặc có 200 + 300 mà không có 270), rồi chỉ lấy nghĩa của chế độ đó.
  function __chonCheDoXml(vals,theoCi,cd){const regime=cd.has(500)||(cd.has(200)&&!cd.has(270)&&cd.has(300))?1:0;
    for(const[key,o]of Object.entries(theoCi)){const[k,ci]=key.split(":");const f=FK[k];if(+ci!==regime&&!(f&&f.c[0]===f.c[1]))continue;if(vals[k]&&+ci!==regime)continue;vals[k]={t:o.t,p:o.p}}}
  // B17: vị trí 6 cột tiền của bảng cân đối tài khoản theo hàng tiêu đề "Nợ | Có" (đầu kỳ, phát sinh, cuối kỳ)
  function __cotNoCo(rows){for(const r of (rows||[]).slice(0,40)){const k=[];(r||[]).forEach((c,i)=>{if(/^(n[ợo]|c[óo]|debit|credit)$/i.test(String(c==null?"":c).trim()))k.push(i)});if(k.length>=6)return k.slice(0,6)}return null}
  // B12: bảng lương nhiều dòng cùng người cùng tháng (lương + thưởng) → gộp trước khi tính lại thuế, giảm trừ một lần
  function __gopLuong(rows){const m=new Map();for(const r of rows){const k=(r.ma||r.ten||"")+"|"+r.ym;const o=m.get(k);if(!o){m.set(k,{...r});continue}
    for(const f of ["tn","mien","tnct","bh","thue","tntt"])if(r[f]!=null||o[f]!=null)o[f]=(+o[f]||0)+(+r[f]||0);for(const f of Object.keys(r))if(o[f]==null&&r[f]!=null)o[f]=r[f]}return[...m.values()]}

  return {
    getS: () => S, setS: x => { S = x }, setCache: x => { CACHE = x }, nhapFile: __nhapFile, xongNhap: __xongNhap,
    blank, normCase, demoYears, demoCase, compute, invalidate, setYear, syncYear, applyYear, yearKeys, MODELS, DEMO_YEARS, POLICY, pol, polAt, val, raw, calcRatios, balChecks, risks, modelKPIs, tbRules, bookChecks, recon, tncnChecks, declChecks, bankChecks, linkRows, policyChecks, monthly, health, zscore, dupont, yearSummaries, withYear, pitTax, periodRange, tbGet, FK, R, parseXML, detectKind, applyTable, sniffMeta, guessYear, routeYear, applyMeta, parseBCTCRows, storeDK, kyYear, yearHasData, _touched, KIND_NAME,
  }
}
