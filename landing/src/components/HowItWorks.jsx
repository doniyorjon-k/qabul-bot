import Reveal from './Reveal'

const steps = [
  {
    icon: '🛠️',
    title: 'Bot sozlanadi',
    desc: 'Biz klinikangiz botini 5 daqiqada sozlaymiz. Xizmatlar, narxlar, ish jadvali — hammasi kiritiladi.',
  },
  {
    icon: '💬',
    title: 'Bemor qabul qiladi',
    desc: 'Bemor bot linkni bosadi, xizmat tanlaydi, qulay vaqtni belgilaydi. Hammasi 2 daqiqada.',
  },
  {
    icon: '📋',
    title: 'Siz nazorat qilasiz',
    desc: 'Admin panelda barcha qabul ko\'rinadi. Tasdiqlash, bekor qilish, statistika — barchasini Telegramdan.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="section section-bg">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Qanday ishlaydi</div>
          <h2 className="section-title">3 bosqichda ishga tushadi</h2>
          <p className="section-sub" style={{ margin: '14px auto 0' }}>
            Texnik bilim kerak emas. Faqat Telegram bo'lsa yetarli.
          </p>
        </Reveal>

        <div className="how-grid">
          {steps.map((step, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="how-step">
                <div className="how-num">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
