import { useState, useEffect, useRef } from 'react'
import { ExternalLink, ChevronRight, ChevronLeft } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

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
  ownerName: {
    test: (v) => /^[\p{L}\s'.`-]{2,60}$/u.test(v.trim()),
    msg: "Kamida 2 ta harf kiriting",
  },
  phone: {
    test: (v) => /^\+998 \(\d{2}\) \d{3}-\d{2}-\d{2}$/.test(v),
    msg: "To'liq raqam kiriting: +998 (XX) XXX-XX-XX",
  },
  clinicName: {
    test: (v) => v.trim().length >= 2,
    msg: "Kamida 2 ta belgi kiriting",
  },
  botToken: {
    test: (v) => /^\d{7,12}:[A-Za-z0-9_-]{30,50}$/.test(v.trim()),
    msg: "Token noto'g'ri. Masalan: 1234567890:AAExxxxx...",
  },
  adminTelegramId: {
    test: (v) => !v.trim() || /^\d{5,12}$/.test(v.trim()),
    msg: "ID faqat raqamlardan iborat bo'lishi kerak (5–12 ta)",
  },
}

const BOTFATHER_STEPS = [
  'Telegramda @BotFather ni oching',
  "/newbot buyrug'ini yuboring",
  'Botingiz nomini kiriting (masalan: Smile Dental)',
  'Username kiriting (masalan: smile_dental_bot)',
  'BotFather yuborgan tokenni quyiga kiriting',
]

export default function DemoModal({ onClose }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ownerName: '', phone: PHONE_PREFIX, clinicName: '', botToken: '', adminTelegramId: '',
  })
  const [touched, setTouched] = useState({})
  const [submitAttempt, setSubmitAttempt] = useState(false)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const phoneRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const touch = (field) => () =>
    setTouched((t) => ({ ...t, [field]: true }))

  const handlePhoneChange = (e) => {
    const allDigits = e.target.value.replace(/\D/g, '')
    // Remove the '998' prefix digits, keep user-typed digits
    const userDigits = allDigits.startsWith('998')
      ? allDigits.slice(3)
      : allDigits.slice(Math.min(3, allDigits.length))
    setForm((f) => ({ ...f, phone: formatPhone(userDigits) }))
  }

  const handlePhoneKeyDown = (e) => {
    if (
      (e.key === 'Backspace' || e.key === 'Delete') &&
      form.phone === PHONE_PREFIX
    ) {
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
    const rule = RULES[field]
    if (!rule) return null
    const show = touched[field] || submitAttempt
    if (!show) return null
    return rule.test(form[field]) ? null : rule.msg
  }

  const step1Fields = ['ownerName', 'phone', 'clinicName']
  const step2Fields = ['botToken', 'adminTelegramId']
  const step1Valid = step1Fields.every((f) => RULES[f].test(form[f]))
  const step2Valid = step2Fields.every((f) => RULES[f].test(form[f]))

  const goToStep2 = (e) => {
    e.preventDefault()
    setSubmitAttempt(true)
    if (!step1Valid) return
    setSubmitAttempt(false)
    setTouched({})
    setStep(2)
  }

  const goBack = () => {
    setStep(1)
    setStatus('idle')
    setSubmitAttempt(false)
    setTouched({})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitAttempt(true)
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
          adminTelegramId: form.adminTelegramId.trim()
            ? Number(form.adminTelegramId.trim())
            : undefined,
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
      setErrorMsg("Tarmoq xatosi. Qayta urinib ko'ring.")
      setStatus('error')
    }
  }

  const Field = ({ id, label, optional, children, hint }) => (
    <div className="cf-group">
      <label className="cf-label">
        {label}
        {optional && <span className="cf-optional"> (ixtiyoriy)</span>}
      </label>
      {children}
      {err(id) && <span className="cf-field-error">{err(id)}</span>}
      {hint && !err(id) && hint}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card reg-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">×</button>

        {status === 'success' ? (
          <div className="cf-success">
            <div className="cf-success-icon">✓</div>
            <h3>Bot ishga tushdi!</h3>
            <p>Botingizga o'ting va ishlashni boshlang:</p>
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
                <form className="cf-form" onSubmit={goToStep2} noValidate>
                  <Field id="ownerName" label="Ismingiz">
                    <input
                      className={`cf-input${err('ownerName') ? ' cf-input-err' : ''}`}
                      type="text" placeholder="Sardor Raximov"
                      value={form.ownerName}
                      onChange={set('ownerName')}
                      onBlur={touch('ownerName')}
                    />
                  </Field>
                  <Field id="phone" label="Telefon raqam">
                    <input
                      ref={phoneRef}
                      className={`cf-input${err('phone') ? ' cf-input-err' : ''}`}
                      type="tel"
                      value={form.phone}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      onFocus={handlePhoneFocus}
                      onBlur={touch('phone')}
                    />
                  </Field>
                  <Field id="clinicName" label="Klinika nomi">
                    <input
                      className={`cf-input${err('clinicName') ? ' cf-input-err' : ''}`}
                      type="text" placeholder="Smile Dental"
                      value={form.clinicName}
                      onChange={set('clinicName')}
                      onBlur={touch('clinicName')}
                    />
                  </Field>
                  <button type="submit" className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}>
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
                    {BOTFATHER_STEPS.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="reg-guide-link">
                    @BotFather ni ochish <ExternalLink size={12} />
                  </a>
                </div>

                <form className="cf-form" onSubmit={handleSubmit} noValidate>
                  <Field id="botToken" label="Bot token">
                    <input
                      className={`cf-input${err('botToken') ? ' cf-input-err' : ''}`}
                      type="text"
                      placeholder="1234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={form.botToken}
                      onChange={set('botToken')}
                      onBlur={touch('botToken')}
                      disabled={status === 'loading'}
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    id="adminTelegramId"
                    label="Sizning Telegram ID"
                    optional
                    hint={
                      <div className="cf-admin-hint">
                        <span className="cf-admin-hint-icon">💡</span>
                        <span>
                          Botingizda <strong>/admin</strong> buyrug'ini yozganda admin paneli ochiladi —
                          buning uchun tizim sizni admin sifatida tanishi kerak.
                          ID ni bilmasangiz:{' '}
                          <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="reg-guide-link">
                            @userinfobot
                          </a>{' '}
                          ga <strong>/start</strong> yuboring, u raqamni ko'rsatadi.
                        </span>
                      </div>
                    }
                  >
                    <input
                      className={`cf-input${err('adminTelegramId') ? ' cf-input-err' : ''}`}
                      type="text" inputMode="numeric" placeholder="123456789"
                      value={form.adminTelegramId}
                      onChange={set('adminTelegramId')}
                      onBlur={touch('adminTelegramId')}
                      disabled={status === 'loading'}
                    />
                  </Field>

                  {status === 'error' && <p className="cf-error">{errorMsg}</p>}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-outline"
                      style={{ flex: 1, justifyContent: 'center' }} onClick={goBack}>
                      <ChevronLeft size={16} /> Orqaga
                    </button>
                    <button type="submit" className="btn btn-primary"
                      style={{ flex: 2, justifyContent: 'center' }}
                      disabled={status === 'loading'}>
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
