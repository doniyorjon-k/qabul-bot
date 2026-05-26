import { useEffect, useRef, useState } from 'react'
import { useInView } from '../hooks/useInView'

function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  const [ref, inView] = useInView(0.5)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let cur = 0
    const step = Math.ceil(target / 30)
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target)
      setCount(cur)
      if (cur >= target) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [inView, target])

  return <span ref={ref}>{count}{suffix}</span>
}

const items = [
  { target: 24, suffix: '/7', label: "⏰ Soat ishlaydi — to'xtovsiz" },
  { target: 3, suffix: '', label: '🔔 Bosqichda eslatma boradi' },
  { target: 5, suffix: '', label: '⚡ Daqiqada bot sozlanadi' },
]

export default function Stats() {
  return (
    <section className="stats">
      <div className="container">
        <div className="stats-grid">
          {items.map((item, i) => (
            <div key={i} className="stat-item" style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="stat-num">
                <Counter target={item.target} suffix={item.suffix} />
              </div>
              <div className="stat-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
