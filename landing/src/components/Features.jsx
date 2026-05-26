import Reveal from './Reveal'

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
          <div className="tag">⚡ Imkoniyatlar</div>
          <h2 className="section-title">Klinikangizga kerak bo'lgan hamma narsa</h2>
        </Reveal>

        <div className="features-grid">
          {features.map((f, i) => (
            <Reveal key={i} delay={(i % 3) * 100}>
              <div className="feature-card">
                <div className={`feature-icon ${f.color}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
