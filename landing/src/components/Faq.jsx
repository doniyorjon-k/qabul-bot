import { useState } from 'react'
import Reveal from './Reveal'

const faqs = [
  {
    q: 'Telegram bo\'lmagan bemorlar qabul qila oladimi?',
    a: 'Hozirgi kunda O\'zbekistonda Telegram eng keng tarqalgan ilova. Bemorda Telegram bo\'lmasa, qabul telefon orqali qilinaveradi — bot faqat qo\'shimcha kanal sifatida ishlaydi.',
  },
  {
    q: 'Sozlash qiyin emasmi? Texnik bilim kerakmi?',
    a: 'Yo\'q. Biz botni siz uchun sozlaymiz. Siz faqat klinika nomini, xizmatlar va ish jadvali ma\'lumotlarini berasiz — qolganni biz qilamiz. 5 daqiqada tayyor.',
  },
  {
    q: 'Bir nechta shifokor yoki kabinet bo\'lsa qanday?',
    a: 'Har bir xizmatni alohida belgilash mumkin. Masalan "Dr. Aliyev — tish plombasi", "Dr. Karimova — oqlash" kabi. Har bir xizmat uchun alohida jadval ham sozlanadi.',
  },
  {
    q: 'Bot qabul qilgan vaqtni kim tasdiqlaydi?',
    a: 'Siz — admin paneldan. Bemor vaqt tanlaydi, siz tasdiqlaysiz (yoki rad etasiz). Tasdiqlagach, bemorga avtomatik xabar boradi. Bot siz tomonidan nazorat qilinadi.',
  },
  {
    q: 'To\'lov qanday usulda amalga oshiriladi?',
    a: 'To\'lov Telegram ichida admin bot orqali amalga oshiriladi. Karta raqamiga pul o\'tkazilib, skrinshot yuboriladi. Super admin tasdiqlagach obuna faollashadi.',
  },
]

export default function Faq() {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq" className="section">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Savol-javob</div>
          <h2 className="section-title">Ko'p so'raladigan savollar</h2>
        </Reveal>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className={`faq-item${open === i ? ' faq-open' : ''}`}>
                <button
                  className="faq-q"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span>{faq.q}</span>
                  <span className="faq-icon">{open === i ? '−' : '+'}</span>
                </button>
                <div
                  className="faq-a"
                  style={{ maxHeight: open === i ? 200 : 0 }}
                >
                  <p>{faq.a}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
