// Bản rời — thay next/link: đường dẫn trang đặt sau dấu # (xem dieuHuong.js).
export default function Link({ href, children, prefetch, replace, scroll, ...khac }) {
  const dich = typeof href === 'string' ? href : (href?.pathname || '/') + (href?.query ? '?' + new URLSearchParams(href.query) : '')
  const ngoai = /^(https?:|mailto:|tel:|#)/.test(dich)
  return <a href={ngoai ? dich : '#' + dich} {...khac}>{children}</a>
}
