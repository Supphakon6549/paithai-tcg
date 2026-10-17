import { useEffect, useRef } from 'react'

export default function BattleLog({ log }) {
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log.length])

  return (
    <section className="battle-log" aria-label="บันทึกการต่อสู้">
      <h2 className="battle-log__title">📜 บันทึกการต่อสู้</h2>
      <ol className="battle-log__list" ref={listRef} aria-live="polite">
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
