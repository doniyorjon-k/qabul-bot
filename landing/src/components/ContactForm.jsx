import { useState, useRef } from 'react'
import Reveal from './Reveal'

const FORM_URL = import.meta.env.VITE_FORM_URL

const PHONE_PREFIX = '+998 ('

function formatPhone(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 9)
  if (d.length === 0) return PHONE_PREFIX
  let r = PHONE_PREFIX + d.slice(0, 2)
  if (d.length <= 2) return r
  r += ') ' + d.slice(2, 5)
  if (d.length <= 5) return r
  r += '-' + d.slice(5, 7)
  if (d.length <= 7) return r
  return r + '-' + d.slice(7, 9)
}

const RULES = {
  name:   { test: (v) => /^[\p{L}\s'.`-]{2,60}$/u.test(v.trim()), msg: "Kamida 2 ta harf kiriting" },
  phone:  { test: (v) => /^\+998 \(\d{2}\) \d{3}-\d{2}-\d{2}$/.test(v),  msg: "To'liq raqam kiriting: +998 (XX) XXX-XX-XX" },
  clinic: { test: (v) => v.trim().length >= 2, msg: "Kamida 2 ta belgi kiriting" },
}

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: PHONE_PREFIX, clinic: '' })
  const [touched, setTouched] = useState({})
  const [submitAttempt, setSubmitAttempt] = useState(false)
  const [status, setStatus] = useState('idle')
  const phoneRef = useRef(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const touch = (field) => () => setTouched((t) => ({ ...t, [field]: true }))

  const handlePhoneChange = (e) => {
    const allDigits = e.target.value.replace(/\D/g, '')
    const userDigits = allDigits.startsWith('998') ? allDigits.slice(3) : allDigits.slice(Math.min(3, allDigits.length))
    setForm((f) => ({ ...f, phone: formatPhone(userDigits) }))
  }

  const handlePhoneKeyDown = (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && form.phone === PHONE_PREFIX) {
      e.preventDefault()
    }
  }

  const handlePhoneFocus = () => {
    setTimeout(() => {
      if (phoneRef.current) {
        const len = phoneRef.current.value.length
        phoneRef.current.setSelectionRange(len, len)
      }
    }, 0)
  }

  const err = (field) => {
    if (!touched[field] && !submitAttempt) return null
    return RULES[field].test(form[field]) ? null : RULES[field].msg
  }

  const allValid = Object.keys(RULES).every((f) => RULES[f].test(form[f]))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitAttempt(true)
    if (!allValid) return
    setStatus('loading')
    try {
      await fetch(FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({
          name: form.name.trim(),
          phone: form.phone,
          clinic: form.clinic.trim(),
          date: new Date().toLocaleString('uz-UZ'),
        }),
      })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="section section-bg">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Bepul boshlash</div>
          <h2 className="section-title">Klinikangizni ro'yxatdan o'tkazing</h2>
          <p className="section-sub" style={{ margin: '14px auto 0' }}>
            Ma'lumotlaringizni qoldiring — biz siz bilan bog'lanamiz va botni 5 daqiqada sozlab beramiz.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="cf-card">
            {status === 'success' ? (
              <div className="cf-success">
                <div className="cf-success-icon">✓</div>
                <h3>So'rovingiz qabul qilindi!</h3>
                <p>Tez orada siz bilan bog'lanamiz. Odatda 1–2 soat ichida javob beramiz.</p>
              </div>
            ) : (
              <form className="cf-form" onSubmit={handleSubmit} noValidate>
                <div className="cf-group">
                  <label className="cf-label">Ismingiz</label>
                  <input
                    className={`cf-input${err('name') ? ' cf-input-err' : ''}`}
                    type="text" placeholder="Sardor Raximov"
                    value={form.name} onChange={set('name')} onBlur={touch('name')}
                    disabled={status === 'loading'}
                  />
                  {err('name') && <span className="cf-field-error">{err('name')}</span>}
                </div>
                <div className="cf-group">
                  <label className="cf-label">Telefon raqamingiz</label>
                  <input
                    ref={phoneRef}
                    className={`cf-input${err('phone') ? ' cf-input-err' : ''}`}
                    type="tel"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    onKeyDown={handlePhoneKeyDown}
                    onFocus={handlePhoneFocus}
                    onBlur={touch('phone')}
                    disabled={status === 'loading'}
                  />
                  {err('phone') && <span className="cf-field-error">{err('phone')}</span>}
                </div>
                <div className="cf-group">
                  <label className="cf-label">Klinika nomi</label>
                  <input
                    className={`cf-input${err('clinic') ? ' cf-input-err' : ''}`}
                    type="text" placeholder="Smile Dental"
                    value={form.clinic} onChange={set('clinic')} onBlur={touch('clinic')}
                    disabled={status === 'loading'}
                  />
                  {err('clinic') && <span className="cf-field-error">{err('clinic')}</span>}
                </div>
                {status === 'error' && (
                  <p className="cf-error">Xatolik yuz berdi. Qayta urinib ko'ring yoki @doniyorjon_k ga yozing.</p>
                )}
                <button
                  type="submit" className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Yuborilmoqda...' : 'Bepul boshlash'}
                </button>
                <p className="cf-note">Karta kerak emas. Hech qanday majburiyat yo'q.</p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
