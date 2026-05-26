import { useState, useEffect } from 'react'
import { ExternalLink, ChevronRight, ChevronLeft } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

const BOTFATHER_STEPS = [
  'Telegramda @BotFather ni oching',
  '/newbot buyrug\'ini yuboring',
  'Botingiz nomini kiriting (masalan: Smile Dental)',
  'Username kiriting (masalan: smile_dental_bot)',
  'BotFather token beradi — quyiga kiriting',
]

export default function DemoModal({ onClose }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ownerName: '', phone: '', clinicName: '', botToken: '', adminTelegramId: '',
  })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [botUsername, setBotUsername] = useState('')

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

  const step1Valid = form.ownerName.trim() && form.phone.trim() && form.clinicName.trim()
  const step2Valid = form.botToken.trim()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!step2Valid) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`${API_URL}/api/public/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          phone: form.phone.trim(),
          clinicName: form.clinicName.trim(),
          botToken: form.botToken.trim(),
          adminTelegramId: form.adminTelegramId ? Number(form.adminTelegramId) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.message || 'Xatolik yuz berdi.')
        setStatus('error')
        return
      }
      setBotUsername(data.botUsername)
      setStatus('success')
    } catch {
      setErrorMsg('Tarmoq xatosi. Qayta urinib ko\'ring.')
      setStatus('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card reg-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">×</button>

        {status === 'success' ? (
          <div className="cf-success">
            <div className="cf-success-icon">✓</div>
            <h3>Bot ishga tushdi!</h3>
            <p>
              Botingizga o'ting va ishlashni boshlang:
            </p>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ marginTop: 16, display: 'inline-flex', gap: 8, alignItems: 'center' }}
            >
              @{botUsername} <ExternalLink size={15} />
            </a>
            <p className="reg-note" style={{ marginTop: 16 }}>
              14 kun bepul sinov. Savollar uchun{' '}
              <a href="https://t.me/doniyorjon_k" target="_blank" rel="noreferrer" className="reg-guide-link">
                @doniyorjon_k
              </a>
            </p>
          </div>
        ) : (
          <>
            <div className="reg-steps">
              <div className={`reg-step-dot${step >= 1 ? ' active' : ''}`}>1</div>
              <div className={`reg-step-line${step >= 2 ? ' active' : ''}`} />
              <div className={`reg-step-dot${step >= 2 ? ' active' : ''}`}>2</div>
            </div>

            {step === 1 && (
              <>
                <h3 className="modal-title">Ro'yxatdan o'tish</h3>
                <p className="modal-sub">Ma'lumotlaringizni kiriting</p>
                <form className="cf-form" onSubmit={(e) => { e.preventDefault(); if (step1Valid) setStep(2) }}>
                  <div className="cf-group">
                    <label className="cf-label">Ismingiz</label>
                    <input className="cf-input" type="text" placeholder="Sardor Raximov"
                      value={form.ownerName} onChange={set('ownerName')} required />
                  </div>
                  <div className="cf-group">
                    <label className="cf-label">Telefon raqam</label>
                    <input className="cf-input" type="tel" placeholder="+998 90 123 45 67"
                      value={form.phone} onChange={set('phone')} required />
                  </div>
                  <div className="cf-group">
                    <label className="cf-label">Klinika nomi</label>
                    <input className="cf-input" type="text" placeholder="Smile Dental"
                      value={form.clinicName} onChange={set('clinicName')} required />
                  </div>
                  <button type="submit" className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }} disabled={!step1Valid}>
                    Keyingisi <ChevronRight size={16} />
                  </button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="modal-title">Bot token</h3>
                <p className="modal-sub">Telegram botingiz tokenini kiriting</p>

                <div className="reg-guide">
                  <p className="reg-guide-title">@BotFather dan qanday olish:</p>
                  <ol className="reg-guide-list">
                    {BOTFATHER_STEPS.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="reg-guide-link"
                  >
                    @BotFather ni ochish <ExternalLink size={12} />
                  </a>
                </div>

                <form className="cf-form" onSubmit={handleSubmit}>
                  <div className="cf-group">
                    <label className="cf-label">Bot token</label>
                    <input className="cf-input" type="text"
                      placeholder="1234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={form.botToken} onChange={set('botToken')}
                      required disabled={status === 'loading'} />
                  </div>
                  <div className="cf-group">
                    <label className="cf-label">
                      Telegram ID <span className="cf-optional">(ixtiyoriy)</span>
                    </label>
                    <input className="cf-input" type="number"
                      placeholder="123456789"
                      value={form.adminTelegramId} onChange={set('adminTelegramId')}
                      disabled={status === 'loading'} />
                    <span className="cf-hint">
                      @userinfobot ga /start yuboring — raqam ko'rinadi
                    </span>
                  </div>

                  {status === 'error' && (
                    <p className="cf-error">{errorMsg}</p>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-outline"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => { setStep(1); setStatus('idle') }}>
                      <ChevronLeft size={16} /> Orqaga
                    </button>
                    <button type="submit" className="btn btn-primary"
                      style={{ flex: 2, justifyContent: 'center' }}
                      disabled={!step2Valid || status === 'loading'}>
                      {status === 'loading' ? 'Tekshirilmoqda...' : 'Botni ishga tushirish'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
