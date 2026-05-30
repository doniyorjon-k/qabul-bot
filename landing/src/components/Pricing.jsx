import { useState, useEffect } from 'react'
import Reveal from './Reveal'

const API_URL = import.meta.env.VITE_API_URL || ''

const scrollToContact = (e) => {
  e.preventDefault()
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
}

function fmtPrice(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const TRIAL = {
  name: 'Sinov davri',
  price: 'Bepul',
  period: "14 kun to'liq imkoniyat",
  features: [
    'Barcha funksiyalar ochiq',
    'Bot sozlash yordam',
    'Cheksiz qabul',
    'Eslatmalar tizimi',
    'Admin panel',
  ],
  cta: 'Bepul boshlash',
  btnCls: 'btn-outline',
  featured: false,
}

const FEATURES_MONTHLY = [
  'Barcha funksiyalar',
  'Cheksiz qabul va bemor',
  'Eslatmalar tizimi',
  'Baholash tizimi',
  'Admin mini panel',
  "Texnik qo'llab-quvvatlash",
]

const FEATURES_SEMI = [
  'Oylik barcha imkoniyatlar',
  '🎁 Landing page bepul',
  "Ustuvor qo'llab-quvvatlash",
  'Yangi funksiyalar birinchi',
  'Promo va chegirmalar',
]

const FEATURES_YEARLY = [
  'Oylik barcha imkoniyatlar',
  '🎁 Landing page bepul',
  "Ustuvor qo'llab-quvvatlash",
  'Yangi funksiyalar birinchi',
  'Promo va chegirmalar',
]

// Static fallback — shown while API loads or on failure
const STATIC_PLANS = [
  TRIAL,
  {
    name: 'Oylik', price: '149,000',
    currency: "so'm", period: 'oyiga / 1 klinika',
    features: FEATURES_MONTHLY,
    cta: 'Boshlash', btnCls: 'btn-outline', featured: false,
  },
  {
    name: 'Yarim yillik', price: '699,000',
    currency: "so'm", period: '6 oyga / 1 klinika',
    perMonth: '~116,500', saving: '22% tejash',
    bonus: 'Landing page bepul',
    features: FEATURES_SEMI,
    cta: 'Boshlash →', btnCls: 'btn-primary', featured: true, badge: 'Eng mashhur',
  },
  {
    name: 'Yillik', price: '1,190,000',
    currency: "so'm", period: 'yiliga',
    perMonth: '~99,200', oldPrice: '1,788,000', saving: '34% tejash',
    bonus: 'Landing page bepul',
    features: FEATURES_YEARLY,
    cta: 'Tejab boshlash', btnCls: 'btn-outline', featured: false,
  },
]

function buildCards(apiPlans) {
  const monthly   = apiPlans.find((p) => p.slug === 'monthly')
  const semi      = apiPlans.find((p) => p.slug === 'semi-yearly')
  const yearly    = apiPlans.find((p) => p.slug === 'yearly')

  const cards = [TRIAL]

  if (monthly) {
    cards.push({
      name: monthly.name,
      price: fmtPrice(monthly.price),
      currency: "so'm",
      period: 'oyiga / 1 klinika',
      features: FEATURES_MONTHLY,
      cta: monthly.isMostPopular ? 'Boshlash →' : 'Boshlash',
      btnCls: monthly.isMostPopular ? 'btn-primary' : 'btn-outline',
      featured: monthly.isMostPopular,
      badge: monthly.isMostPopular ? 'Eng mashhur' : null,
    })
  }

  if (semi) {
    const perMonth = Math.round(semi.price / 6)
    const mPrice = monthly?.price || 0
    const saving = mPrice ? `${Math.round((1 - semi.price / (mPrice * 6)) * 100)}% tejash` : null
    cards.push({
      name: semi.name,
      price: fmtPrice(semi.price),
      currency: "so'm",
      period: '6 oyga / 1 klinika',
      perMonth: perMonth ? `~${fmtPrice(perMonth)}` : null,
      saving,
      bonus: semi.bonus || null,
      features: semi.bonus
        ? [`🎁 ${semi.bonus}`, ...FEATURES_SEMI.filter((f) => !f.startsWith('🎁'))]
        : FEATURES_SEMI,
      cta: semi.isMostPopular ? 'Boshlash →' : 'Boshlash',
      btnCls: semi.isMostPopular ? 'btn-primary' : 'btn-outline',
      featured: semi.isMostPopular,
      badge: semi.isMostPopular ? 'Eng mashhur' : null,
    })
  }

  if (yearly) {
    const mPrice = monthly?.price || 0
    const oldPrice = mPrice ? fmtPrice(mPrice * 12) : null
    const saving = mPrice ? `${Math.round((1 - yearly.price / (mPrice * 12)) * 100)}% tejash` : null
    const perMonth = Math.round(yearly.price / 12)
    cards.push({
      name: yearly.name,
      price: fmtPrice(yearly.price),
      currency: "so'm",
      period: 'yiliga',
      perMonth: perMonth ? `~${fmtPrice(perMonth)}` : null,
      oldPrice,
      saving,
      bonus: yearly.bonus || null,
      features: yearly.bonus
        ? [`🎁 ${yearly.bonus}`, ...FEATURES_YEARLY.filter((f) => !f.startsWith('🎁'))]
        : FEATURES_YEARLY,
      cta: yearly.isMostPopular ? 'Boshlash →' : 'Tejab boshlash',
      btnCls: yearly.isMostPopular ? 'btn-primary' : 'btn-outline',
      featured: yearly.isMostPopular,
      badge: yearly.isMostPopular ? 'Eng mashhur' : null,
    })
  }

  return cards
}

export default function Pricing() {
  const [plans, setPlans] = useState(STATIC_PLANS)

  useEffect(() => {
    const url = API_URL ? `${API_URL}/api/public/pricing` : '/api/public/pricing'
    fetch(url)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length) setPlans(buildCards(data)) })
      .catch(() => {})
  }, [])

  return (
    <section id="pricing" className="section section-bg">
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="tag">Narxlar</div>
          <h2 className="section-title">Sodda va shaffof narxlar</h2>
          <p className="section-sub" style={{ margin: '14px auto 0' }}>
            Xavfsiz boshlang — 14 kun bepul, karta ma'lumoti shart emas.
          </p>
        </Reveal>

        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className={`price-card${plan.featured ? ' price-card-featured' : ''}`}>
                {plan.badge && <div className="price-badge">{plan.badge}</div>}
                <div className="price-name">{plan.name}</div>
                {plan.currency ? (
                  <>
                    <div className="price-amount">
                      <sup>{plan.currency}</sup> {plan.price}
                    </div>
                    <div className="price-period">
                      {plan.perMonth ? `${plan.perMonth}/oy · ` : ''}{plan.period}
                      {plan.oldPrice && (
                        <> · <s className="price-old">{plan.oldPrice}</s> — {plan.saving}</>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="price-amount">{plan.price}</div>
                    <div className="price-period">{plan.period}</div>
                  </>
                )}
                <ul className="price-features">
                  {plan.features.map((f, j) => (
                    <li key={j}><span className="price-check">✓</span> {f}</li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  onClick={scrollToContact}
                  className={`btn ${plan.btnCls}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {plan.cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
