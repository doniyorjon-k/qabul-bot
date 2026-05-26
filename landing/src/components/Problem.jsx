import Reveal from './Reveal'
import { XCircle, CheckCircle2 } from 'lucide-react'

const before = [
  { icon: '×', text: 'Telefon qo\'ng\'iroqlari kunboyi to\'xtamaydi — resepsionist band' },
  { icon: '×', text: 'Qo\'lda yozilgan daftar — tartibsiz, chalkash, yo\'qolib qoladi' },
  { icon: '×', text: 'Ish soatlaridan keyin qabul yo\'q — bemorlar raqobatga ketadi' },
  { icon: '×', text: 'Bemor unutadi, kelmaydi — vaqt va pul yo\'qotiladi' },
  { icon: '×', text: 'Statistika yo\'q — qancha qabul, qaysi xizmat — noma\'lum' },
]

const after = [
  { icon: '✓', text: 'Bot o\'zi qabul qiladi — siz telefonda o\'tirishingiz shart emas' },
  { icon: '✓', text: 'Hamma ma\'lumot Telegram da — tartibli, qulay, istalgan joydan' },
  { icon: '✓', text: '24/7 ishlaydi — tunda ham, dam olish kunlari ham qabul oladi' },
  { icon: '✓', text: 'Eslatmalar avtomatik boradi — bemor unutmaydi, keladi' },
  { icon: '✓', text: 'Admin panelda statistika — qabul, xizmat, baholash hammasi ko\'rinadi' },
]

export default function Problem() {
  return (
    <section id="problem" className="section">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Muammo va yechim</div>
          <h2 className="section-title">Eski usul klinikangizni charchatmoqda</h2>
          <p className="section-sub" style={{ margin: '14px auto 0' }}>
            Har kuni bir xil muammolar — telefon, daftar, unutilgan qabullar.
          </p>
        </Reveal>

        <div className="problem-grid">
          <Reveal>
            <div className="problem-card problem-before">
              <h3 className="problem-card-title problem-title-red">
                <XCircle size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                Hozirgi holat
              </h3>
              <ul className="problem-list">
                {before.map((item, i) => (
                  <li key={i}>
                    <span className="problem-icon">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="problem-card problem-after">
              <h3 className="problem-card-title problem-title-green">
                <CheckCircle2 size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                Qabulim boti bilan
              </h3>
              <ul className="problem-list">
                {after.map((item, i) => (
                  <li key={i}>
                    <span className="problem-icon">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
