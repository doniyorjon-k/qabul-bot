import { useState, useEffect } from 'react'

const FORM_URL = import.meta.env.VITE_FORM_URL

export default function DemoModal({ onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', clinic: '' })
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">×</button>

        {status === 'success' ? (
          <div className="cf-success">
            <div className="cf-success-icon">✓</div>
            <h3>So'rovingiz qabul qilindi!</h3>
            <p>Tez orada siz bilan bog'lanamiz.</p>
          </div>
        ) : (
          <>
            <h3 className="modal-title">Bepul demo olish</h3>
            <p className="modal-sub">Ma'lumotlaringizni qoldiring — biz siz bilan bog'lanamiz.</p>
            <form className="cf-form" onSubmit={handleSubmit}>
              <div className="cf-group">
                <label className="cf-label">Ismingiz</label>
                <input className="cf-input" type="text" placeholder="Sardor Raximov"
                  value={form.name} onChange={set('name')} required disabled={status === 'loading'} />
              </div>
              <div className="cf-group">
                <label className="cf-label">Telefon raqamingiz</label>
                <input className="cf-input" type="tel" placeholder="+998 90 123 45 67"
                  value={form.phone} onChange={set('phone')} required disabled={status === 'loading'} />
              </div>
              <div className="cf-group">
                <label className="cf-label">Klinika nomi</label>
                <input className="cf-input" type="text" placeholder="Smile Dental"
                  value={form.clinic} onChange={set('clinic')} required disabled={status === 'loading'} />
              </div>
              {status === 'error' && (
                <p className="cf-error">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
              )}
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }} disabled={status === 'loading'}>
                {status === 'loading' ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
