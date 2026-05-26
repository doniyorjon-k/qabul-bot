import Reveal from './Reveal'
import ChatMockup from './ChatMockup'

const demoMessages = [
  { side: 'bot', text: 'Qabul tugadi! Xizmatimizni baholang:', btns: ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'], delay: 400 },
  { side: 'user', text: '5 ⭐', delay: 1400 },
  { side: 'bot', text: '🙏 Rahmat! Fikringiz bizga juda muhim.\n\nYaqinda yana kutamiz! 😊', delay: 2200 },
  { side: 'bot', text: '📅 Keyingi qabul uchun /start yozing.', delay: 3100 },
]

const checkItems = [
  'Xizmat va vaqtni o\'zi tanlaydi',
  'Qabul tasdiqlanishi haqida xabar oladi',
  'Eslatmalar avtomatik keladi',
  'Qabulni bekor qilishi mumkin',
  'Qabuldan keyin baho berishi mumkin',
]

export default function Demo() {
  return (
    <section id="demo" className="demo-section">
      <div className="demo-bg-glow" />
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="demo-inner">
          <Reveal>
            <div className="demo-tag">Qabul jarayoni</div>
            <h2 className="demo-title">Bemor uchun<br />juda sodda</h2>
            <p className="demo-sub">Telefon qilish shart emas. Kutish yo'q. Faqat bot bilan 2 daqiqalik suhbat.</p>
            <ul className="demo-list">
              {checkItems.map((item, i) => (
                <li key={i}>
                  <span className="demo-check">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="phone-float">
              <ChatMockup messages={demoMessages} dark startOnView />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
