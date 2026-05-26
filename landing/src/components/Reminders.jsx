import Reveal from './Reveal'
import { CalendarCheck, Clock, Zap, Timer, CheckCircle2, AlarmClock, Bell } from 'lucide-react'
import { parseTextWithBold } from '../utils/twemoji'

const timeline = [
  { Icon: CalendarCheck, iconColor: '#2563eb', cls: 'd1', badge: 'Qabul belgilanganda', badgeCls: 'rb-blue',   title: 'Tasdiqlash xabari',      desc: 'Bemor qabul qilganda darhol tasdiqlovchi xabar keladi — sana, vaqt va xizmat ko\'rsatiladi.' },
  { Icon: Clock,         iconColor: '#ea580c', cls: 'd2', badge: '1 kun oldin',         badgeCls: 'rb-orange', title: 'Ertangi qabul eslatmasi', desc: 'Kechqurun ertangi qabulini eslatadi. Bemor tayyorlanadi.' },
  { Icon: Zap,           iconColor: '#059669', cls: 'd3', badge: '2 soat oldin',        badgeCls: 'rb-green',  title: 'Qabul yaqinlashdi',      desc: 'Klinikaga yo\'lga chiqish vaqtini eslatadi.' },
  { Icon: Timer,         iconColor: '#7c3aed', cls: 'd4', badge: '10 daqiqa oldin',     badgeCls: 'rb-purple', title: 'Deyarli vaqt bo\'ldi',   desc: '"Kechikib qolmang!" — oxirgi eslatma. Kelishini ta\'minlaydi.' },
]

const cards = [
  {
    Icon: CheckCircle2, iconColor: '#059669', label: 'Tasdiqlash xabari',
    text: '✅ **Qabulingiz tasdiqlandi!**\n\n📅 Chorshanba, 18-may\n⏰ Soat 10:00\n🦷 Tish tekshiruvi\n\nSog\'lomlik — eng katta boylik! 😊',
  },
  {
    Icon: AlarmClock, iconColor: '#ea580c', label: '1 kun oldin',
    text: '⏰ **Eslatma!**\n\nErtaga — 10:00 — sizning qabulingiz bor.\n🦷 Tish tekshiruvi\n\nKlinikamizga keling! 😊',
  },
  {
    Icon: Bell, iconColor: '#2563eb', label: '2 soat oldin',
    text: '🔔 **2 soatdan keyin qabulingiz!**\n\n⏰ 10:00 — Tish tekshiruvi\n\nKechikib qolmang 😊',
  },
  {
    Icon: Timer, iconColor: '#7c3aed', label: '10 daqiqa oldin',
    text: '⏰ **10 daqiqadan keyin qabulingiz!**\n\n🦷 Tish tekshiruvi\n⏰ Soat: 10:00\n\nKechikib qolmang! 🏃',
  },
]

export default function Reminders() {
  return (
    <section id="reminders" className="section">
      <div className="container">
        <div className="reminders-inner">
          <Reveal>
            <div className="tag">Eslatmalar tizimi</div>
            <h2 className="section-title">Bemor hech qachon<br />unutmaydi</h2>
            <p className="section-sub">
              Qabul belgilangandan tasdiqlangungacha va qabul kunigacha — bot o'zi kuzatib boradi.
            </p>
            <div className="reminder-timeline">
              {timeline.map((item, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="reminder-item">
                    <div className={`reminder-dot ${item.cls}`}>
                      <item.Icon size={20} color={item.iconColor} strokeWidth={1.75} />
                    </div>
                    <div className="reminder-content">
                      <span className={`reminder-badge ${item.badgeCls}`}>{item.badge}</span>
                      <h4>{item.title}</h4>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          <div className="reminders-right">
            {cards.map((card, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="reminder-msg-card">
                  <div className="rmc-top">
                    <span className="rmc-icon">
                      <card.Icon size={18} color={card.iconColor} strokeWidth={1.75} />
                    </span>
                    <span className="rmc-label">{card.label}</span>
                  </div>
                  <div className="rmc-text" dangerouslySetInnerHTML={{ __html: parseTextWithBold(card.text) }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
