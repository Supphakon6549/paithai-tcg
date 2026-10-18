import { useEffect, useRef, useState } from 'react'

// จอมือถือ: อยู่ท้ายหน้า · จอ PC: กล่องเล็กลอยมุมขวาล่าง กดหัวข้อเพื่อพับ/กาง
export default function BattleLog({ log }) {
  const listRef = useRef(null)
  // PC จอกลาง (1000–1399px) กล่องจะทับกระดาน จึงเริ่มแบบพับไว้
  const [collapsed, setCollapsed] = useState(() => {
    const w = typeof window === 'undefined' ? 0 : window.innerWidth
    return w >= 1000 && w < 1400
  })

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log.length, collapsed])

  return (
    <section className={`battle-log${collapsed ? ' battle-log--collapsed' : ''}`} aria-label="บันทึกการต่อสู้">
      <h2 className="battle-log__title">
        <button
          type="button"
          className="battle-log__toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          📜 บันทึกการต่อสู้ <span aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
        </button>
      </h2>
      <ol className="battle-log__list" ref={listRef} aria-live="polite" hidden={collapsed}>
        {log.map((entry) => (
          <li
            key={entry.id}
            className={`log-entry log-entry--${entry.kind}${entry.actor ? ` log-entry--${entry.actor}` : ''}`}
          >
            <p className="log-entry__text">{entry.text}</p>
            {entry.details && (
              <ul className="log-entry__details">
                {entry.details.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
