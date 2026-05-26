import ChatMockup from './ChatMockup'

const CONTACT = 'https://t.me/doniyorjon_k'

const heroMessages = [
  { side: 'bot', text: 'Salom! 👋 Qaysi xizmatni tanlaysiz?', btns: ['🦷 Tish tekshiruvi', '✨ Oqlash', '🔧 Plomba'], delay: 500 },
  { side: 'user', text: '🦷 Tish tekshiruvi', delay: 1600 },
  { side: 'bot', text: 'Qaysi kun qulay?', btns: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba'], delay: 2400 },
  { side: 'user', text: 'Chorshanba', delay: 3400 },
  { side: 'bot', text: 'Soatni tanlang:', btns: ['09:00', '10:00', '11:00', '14:00'], delay: 4200 },
  { side: 'user', text: '10:00', delay: 5200 },
  { side: 'bot', text: '✅ Qabulingiz tasdiqlandi!\n📅 Chorshanba · 10:00\n🦷 Tish tekshiruvi', delay: 6000 },
]

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-blob hero-blob-1" />
      <div className="hero-blob hero-blob-2" />
      <div className="hero-blob hero-blob-3" />
      <div className="container">
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Hozir 14 kun bepul sinov mavjud
            </div>
            <h1 className="hero-title">
              Klinikangizga<br />
              <span className="hero-accent">Telegram orqali</span><br />
              24/7 qabul tizimi
            </h1>
            <p className="hero-desc">
              Bemorlar o'zlari vaqt belgilaydi. Eslatmalar avtomatik boradi.
              Siz faqat qabulga tayyorlanasiz.
            </p>
            <div className="hero-ctas">
              <a
                href="#contact"
                className="btn btn-primary btn-lg"
                onClick={(e) => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                Bepul boshlash
              </a>
              <a
                href="#demo"
                className="btn btn-outline btn-lg"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Demo ko'rish
              </a>
            </div>
            <div className="hero-trust">
              <span className="hero-stars">★★★★★</span>
              <span>Ishonchli, sodda, samarali</span>
            </div>
          </div>
          <div className="hero-right">
            <div className="phone-float">
              <ChatMockup messages={heroMessages} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
