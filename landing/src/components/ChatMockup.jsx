import { useEffect, useRef, useState, useCallback } from 'react'
import { useInView } from '../hooks/useInView'

function ChatMessage({ msg, dark }) {
  return (
    <div className={`msg msg-${msg.side}`} style={{ animation: 'msgIn .35s ease forwards' }}>
      <div className={`msg-bubble${dark && msg.side === 'bot' ? ' msg-bubble-dark' : ''}`}>
        {msg.text.split('\n').map((line, i) => (
          <span key={i}>{line}{i < msg.text.split('\n').length - 1 && <br />}</span>
        ))}
      </div>
      <div className={`msg-time${msg.side === 'user' ? ' msg-time-user' : ''}`}>
        {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}
      </div>
      {msg.btns && (
        <div className="kb-btns">
          {msg.btns.map((b) => (
            <button key={b} className={`kb-btn${dark ? ' kb-btn-dark' : ''}`}>{b}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatMockup({ messages, dark = false, startOnView = false, name = 'Smile Dental Bot' }) {
  const [visible, setVisible] = useState([])
  const started = useRef(false)
  const bodyRef = useRef(null)
  const [wrapRef, inView] = useInView(0.3)

  const startAnim = useCallback(() => {
    if (started.current) return
    started.current = true
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setVisible((prev) => [...prev, i])
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
      }, msg.delay)
    })
  }, [messages])

  useEffect(() => {
    if (!startOnView) { startAnim(); return }
  }, [startOnView, startAnim])

  useEffect(() => {
    if (startOnView && inView) startAnim()
  }, [inView, startOnView, startAnim])

  return (
    <div ref={wrapRef} className={`phone${dark ? ' phone-dark' : ''}`}>
      <div className={`phone-top${dark ? ' phone-top-dark' : ''}`}>
        <div className="phone-avatar">🦷</div>
        <div className="phone-info">
          <div className={`phone-name${dark ? ' phone-name-dark' : ''}`}>{name}</div>
          <div className="phone-status">● Online</div>
        </div>
      </div>
      <div ref={bodyRef} className={`chat-body${dark ? ' chat-body-dark' : ''}`}>
        {messages.map((msg, i) =>
          visible.includes(i) ? <ChatMessage key={i} msg={msg} dark={dark} /> : null,
        )}
      </div>
    </div>
  )
}
