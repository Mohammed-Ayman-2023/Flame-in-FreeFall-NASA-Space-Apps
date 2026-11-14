import { useEffect, useState } from 'react'

// Hash router with plain names (#lab, #learn-1, #investigation--PSI-159), so it works on any static host,
// opened from disk, and inside a claude.ai artifact (which only passes plain #name hashes).
const toHash = path => path.replace(/^\//, '').replace(/\//g, '--')
const toPath = hash => {
  const h = hash.replace(/^#/, '')
  if (!h) return '/'
  if (/^learn-\d$/.test(h)) return '/learn/' + h.slice(6)
  return '/' + h.replace(/--/g, '/')
}

export function useRoute() {
  const [route, setRoute] = useState(() => toPath(window.location.hash))
  useEffect(() => {
    const on = () => { setRoute(toPath(window.location.hash)); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function href(path) {
  if (path.startsWith('/learn/')) return '#learn-' + path.slice(7)
  return path === '/' ? '#' : '#' + toHash(path)
}
export function go(path) { window.location.hash = href(path).slice(1) || '' }

export function Link({ to, children, className, style, ...rest }) {
  return <a href={href(to)} className={className} style={style} {...rest}>{children}</a>
}
