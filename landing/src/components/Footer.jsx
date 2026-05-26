const CONTACT = 'https://t.me/doniyorjon_k'

const links = [
  { href: '#how', label: 'Qanday ishlaydi' },
  { href: '#features', label: 'Imkoniyatlar' },
  { href: '#pricing', label: 'Narxlar' },
  { href: CONTACT, label: 'Bog\'lanish', external: true },
]

export default function Footer() {
  const handleAnchor = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-logo">
            <img src="/logo.png" alt="QabulBot" className="footer-logo-img" />
          </div>
          <div className="footer-links">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={!l.external ? (e) => handleAnchor(e, l.href) : undefined}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noreferrer' : undefined}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="footer-copy">© 2025 QabulBot</div>
        </div>
      </div>
    </footer>
  )
}
