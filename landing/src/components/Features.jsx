import { useRef } from 'react'
import Reveal from './Reveal'

function TiltCard({ children }) {
  const ref = useRef(null)

  const onMove = (e) => {
    const card = ref.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const rx = ((y - cy) / cy) * 6
    const ry = ((cx - x) / cx) * 6
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`
    card.style.transition = 'transform 0.1s ease'
  }

  const onLeave = () => {
    const card = ref.current
    if (!card) return
    card.style.transform = ''
    card.style.transition = 'transform 0.5s ease'
  }

  return (
    <div ref={ref} className="feature-card" onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  )
}

const features = [
  { icon: '📅', color: 'fi-blue',   title: 'Onlayn qabul',          desc: 'Bemor xizmatni tanlaydi, bo\'sh kunni ko\'radi, soat belgilaydi. Hech qanday to\'siq yo\'q.' },
  { icon: '🔔', color: 'fi-orange', title: 'Avtomatik eslatmalar',   desc: 'Qabul oldidan 1 kun, 2 soat va 10 daqiqa oldin bemor Telegramda eslatma oladi.' },
  { icon: '📊', color: 'fi-purple', title: 'Admin mini panel',       desc: 'Bugungi qabullar, statistika, xizmatlarni boshqarish — barchasini Telegram ichidan.' },
  { icon: '⭐', color: 'fi-green',  title: 'Baholash tizimi',        desc: 'Qabul tugagandan so\'ng bemor avtomatik baholashga chaqiriladi. Fikrlar saqlanadi.' },
  { icon: '🦷', color: 'fi-teal',   title: 'Xizmatlar katalogi',     desc: 'Har bir xizmatga nom, emoji va narx qo\'ying. Kerak bo\'lmasa o\'chirib qo\'ying.' },
  { icon: '🗓️', color: 'fi-pink',  title: 'Moslashuvchan jadval',   desc: 'Ish kunlari, soatlari, dam olish kunlari va maxsus sana bloklash — to\'liq nazorat.' },
]

export default function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Imkoniyatlar</div>
          <h2 className="section-title">Klinikangizga kerak bo'lgan hamma narsa</h2>
        </Reveal>

        <div className="features-grid">
          {features.map((f, i) => (
            <Reveal key={i} delay={(i % 3) * 100}>
              <TiltCard>
                <div className={`feature-icon ${f.color}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
