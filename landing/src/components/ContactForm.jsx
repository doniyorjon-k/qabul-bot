import { useState } from 'react'
import Reveal from './Reveal'

const FORM_URL = import.meta.env.VITE_FORM_URL

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', clinic: '' })
  const [status, setStatus] = useState('idle') // idle | loading | success | error

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.clinic) return
    setStatus('loading')
    try {
      await fetch(FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({
          name: form.name,
          phone: form.phone,
          clinic: form.clinic,
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
              <form className="cf-form" onSubmit={handleSubmit}>
                <div className="cf-group">
                  <label className="cf-label">Ismingiz</label>
                  <input
                    className="cf-input"
                    type="text"
                    placeholder="Sardor Raximov"
                    value={form.name}
                    onChange={set('name')}
                    required
                    disabled={status === 'loading'}
                  />
                </div>
                <div className="cf-group">
                  <label className="cf-label">Telefon raqamingiz</label>
                  <input
                    className="cf-input"
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={form.phone}
                    onChange={set('phone')}
                    required
                    disabled={status === 'loading'}
                  />
                </div>
                <div className="cf-group">
                  <label className="cf-label">Klinika nomi</label>
                  <input
                    className="cf-input"
                    type="text"
                    placeholder="Smile Dental"
                    value={form.clinic}
                    onChange={set('clinic')}
                    required
                    disabled={status === 'loading'}
                  />
                </div>
                {status === 'error' && (
                  <p className="cf-error">Xatolik yuz berdi. Qayta urinib ko'ring yoki @doniyorjon_k ga yozing.</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
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
