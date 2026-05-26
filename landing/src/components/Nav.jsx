import { useEffect, useState } from 'react'

const CONTACT = 'https://t.me/doniyorjon_k'

const links = [
  { href: '#how', label: 'Qanday ishlaydi' },
  { href: '#features', label: 'Imkoniyatlar' },
  { href: '#pricing', label: 'Narxlar' },
  { href: '#contact', label: 'Boshlash' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleAnchor = (e, href) => {
    e.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className={scrolled ? 'nav scrolled' : 'nav'}>
      <div className="container">
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src="/logo-icon.png" alt="Qabulim" className="nav-logo-icon" />
            <span className="nav-logo-text">Qabulim</span>
          </a>
          <div className="nav-links">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => handleAnchor(e, l.href)}>
                {l.label}
              </a>
            ))}
          </div>
          <a href="#contact" className="btn btn-primary" onClick={(e) => handleAnchor(e, '#contact')}>
            Boshlash →
          </a>
        </div>
      </div>
    </nav>
  )
}
