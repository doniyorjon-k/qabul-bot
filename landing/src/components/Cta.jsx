import Reveal from './Reveal'

const CONTACT = 'https://t.me/doniyorjon_k'

export default function Cta() {
  return (
    <section id="cta" className="cta-section">
      <div className="cta-pattern" />
      <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Reveal>
          <h2 className="cta-title">Bugun boshlang —<br />14 kun bepul</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="cta-sub">Karta kerak emas. O'rnatish bepul. Xavfsiz sinab ko'ring.</p>
        </Reveal>
        <Reveal delay={200}>
          <div className="cta-btns">
            <a href={CONTACT} target="_blank" rel="noreferrer" className="btn btn-white btn-lg">
              Bepul boshlash
            </a>
            <a href={CONTACT} target="_blank" rel="noreferrer" className="btn btn-ghost btn-lg">
              Savol berish
            </a>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <p className="cta-note">Savol bo'lsa — @doniyorjon_k ga yozing</p>
        </Reveal>
      </div>
    </section>
  )
}
