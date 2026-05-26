import Reveal from './Reveal'

const scrollToContact = (e) => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }

const plans = [
  {
    name: 'Sinov davri',
    price: 'Bepul',
    period: '14 kun to\'liq imkoniyat',
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
  },
  {
    name: 'Oylik',
    price: '99,000',
    currency: 'so\'m',
    period: 'oyiga / 1 klinika',
    features: [
      'Barcha funksiyalar',
      'Cheksiz qabul va bemor',
      'Eslatmalar tizimi',
      'Baholash tizimi',
      'Admin mini panel',
      'Texnik qo\'llab-quvvatlash',
    ],
    cta: 'Boshlash →',
    btnCls: 'btn-primary',
    featured: true,
    badge: 'Eng mashhur',
  },
  {
    name: 'Yillik',
    price: '799,000',
    currency: 'so\'m',
    period: 'yiliga',
    oldPrice: '1,188,000',
    saving: '33% tejash',
    features: [
      'Oylik barcha imkoniyatlar',
      'Ustuvor qo\'llab-quvvatlash',
      'Yangi funksiyalar birinchi',
      'Promo va chegirmalar',
    ],
    cta: 'Tejab boshlash',
    btnCls: 'btn-outline',
    featured: false,
  },
]

export default function Pricing() {
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
                      {plan.period}
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
