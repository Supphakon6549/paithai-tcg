import { useMemo, useState } from 'react'
import MonsterCard from '../cards/MonsterCard'
import CardZoom from '../cards/CardZoom'
import { CARDS, CARD_GROUPS, CARD_TYPES } from '../../data/cards'
import { PRESET_DECKS, allDecks, findDeck, newDeckId, toCounts, toList } from '../../data/decks'
import { DECK_RULES, deckProblems, formatNumber } from '../../engine'
import './DeckBuilder.css'

const isExtraCard = (card) => card.summonType === 'fusion'
const TYPE_ORDER = { monster: 0, ritual: 1, spell: 2, trap: 3 }
const byDeckOrder = (a, b) =>
  (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || (a.level ?? 0) - (b.level ?? 0) || a.id.localeCompare(b.id)

/*
 * หน้าจัดสำรับ
 * - เลือกสำรับ (ทดสอบ / สำเร็จรูป / ของฉัน) · สร้าง คัดลอก ลบ เปลี่ยนชื่อ
 * - คลังการ์ด: กรองตามชุด/ค้นหา · แตะ ＋/− เพิ่มลด · แตะภาพดูการ์ดเต็ม
 * - สำรับสำเร็จรูปแก้ไม่ได้ (กดคัดลอกเพื่อแก้)
 */
// เติมสำรับให้ครบ 40 ใบ: เลือกการ์ดชุดเดียวกับที่ใส่ไว้มากที่สุดก่อน แล้วไล่มอนสเตอร์ตัวเล็ก ATK สูง
function autoFill(main) {
  const counts = { ...main }
  const total = () => Object.values(counts).reduce((a, b) => a + b, 0)
  const groupScore = {}
  for (const [id, n] of Object.entries(counts)) {
    const g = CARDS.find((c) => c.id === id)?.groupTag
    if (g) groupScore[g] = (groupScore[g] ?? 0) + n
  }
  const rank = (c) =>
    (groupScore[c.groupTag] ?? 0) * 10000 +
    (c.type === 'monster' && c.level <= 4 ? 3000 + c.atk : c.type === 'monster' ? 1000 + c.atk / 2 : 1500)
  // ชุดเดียวกันใส่เต็มจำนวนก่อน (สูงสุดใบละ 3) แล้วค่อยเติมการ์ดชุดอื่น
  const candidates = CARDS.filter((c) => !isExtraCard(c)).sort((a, b) => rank(b) - rank(a))
  for (const c of candidates) {
    const room = DECK_RULES.mainSize - total()
    if (room <= 0) break
    counts[c.id] = (counts[c.id] ?? 0) + Math.min(room, DECK_RULES.maxCopies - (counts[c.id] ?? 0))
  }
  return counts
}

export default function DeckBuilder({ store, onChange, onPlay }) {
  const [selectedId, setSelectedId] = useState(store.activeId)
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [mobileTab, setMobileTab] = useState('pool')
  const [preview, setPreview] = useState(null)

  const deck = findDeck(store, selectedId)
  const editable = !deck.preset
  const main = toCounts(deck.main)
  const extra = toCounts(deck.extra)
  const mainSize = Object.values(main).reduce((a, b) => a + b, 0)
  const extraSize = Object.values(extra).reduce((a, b) => a + b, 0)
  const problems = deck.test ? [] : deckProblems(deck.main, deck.extra)
  const countOf = (id) => (main[id] ?? 0) + (extra[id] ?? 0)

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CARDS.filter((c) => {
      if (group === 'spell-trap') return c.type !== 'monster'
      if (group !== 'all' && c.groupTag !== group) return false
      return !q || c.name.toLowerCase().includes(q) || (c.nameEn ?? '').toLowerCase().includes(q)
    })
  }, [group, query])

  const deckCards = [...toList(main), ...toList(extra)]
    .map(([id, n]) => ({ card: CARDS.find((c) => c.id === id), n }))
    .filter((x) => x.card)
    .sort((a, b) => byDeckOrder(a.card, b.card))

  // ---------- แก้สำรับ ----------
  const saveDeck = (next) => onChange({ ...store, decks: store.decks.map((d) => (d.id === next.id ? next : d)) })

  function addCard(card) {
    if (!editable) return
    const toExtra = isExtraCard(card)
    const counts = toExtra ? { ...extra } : { ...main }
    if (countOf(card.id) >= DECK_RULES.maxCopies) return
    if (toExtra ? extraSize >= DECK_RULES.extraMax : mainSize >= DECK_RULES.mainSize) return
    counts[card.id] = (counts[card.id] ?? 0) + 1
    saveDeck({ ...deck, [toExtra ? 'extra' : 'main']: toList(counts) })
  }

  function removeCard(card) {
    if (!editable) return
    const toExtra = isExtraCard(card)
    const counts = toExtra ? { ...extra } : { ...main }
    if (!counts[card.id]) return
    counts[card.id] -= 1
    saveDeck({ ...deck, [toExtra ? 'extra' : 'main']: toList(counts) })
  }

  const addBlocker = (card) => {
    if (!editable) return 'สำรับนี้แก้ไม่ได้'
    if (countOf(card.id) >= DECK_RULES.maxCopies) return `ใส่ได้ไม่เกิน ${DECK_RULES.maxCopies} ใบ`
    if (isExtraCard(card) && extraSize >= DECK_RULES.extraMax) return 'กองพิเศษเต็ม'
    if (!isExtraCard(card) && mainSize >= DECK_RULES.mainSize) return 'กองหลักครบ 40 ใบแล้ว'
    return null
  }

  // ---------- จัดการสำรับ ----------
  function createDeck(from) {
    const id = newDeckId()
    const base = from ?? { main: [], extra: [] }
    const name = from ? `${from.name} (สำเนา)` : `สำรับใหม่ ${store.decks.length + 1}`
    onChange({ ...store, decks: [...store.decks, { id, name, main: base.main, extra: base.extra }] })
    setSelectedId(id)
  }

  function deleteDeck() {
    if (!editable || !window.confirm(`ลบสำรับ "${deck.name}"?`)) return
    const decks = store.decks.filter((d) => d.id !== deck.id)
    const activeId = store.activeId === deck.id ? allDecks({ decks })[0].id : store.activeId
    onChange({ ...store, decks, activeId })
    setSelectedId(activeId)
  }

  const isActive = store.activeId === deck.id
  const readyToPlay = problems.length === 0

  return (
    <div className="deck-builder">
      {PRESET_DECKS.length > 0 && (
        <section className="deck-presets" aria-label="สำรับแนะนำ">
          <h2 className="deck-presets__title">⭐ สำรับแนะนำ — เลือกแล้วเล่นได้ทันที</h2>
          <div className="deck-presets__row">
            {PRESET_DECKS.map((d) => (
              <article key={d.id} className={`deck-preset${selectedId === d.id ? ' deck-preset--selected' : ''}`}>
                <button type="button" className="deck-preset__head" onClick={() => setSelectedId(d.id)}>
                  <span className="deck-preset__icon" aria-hidden="true">
                    {d.icon}
                  </span>
                  <strong>{d.name}</strong>
                  {d.difficulty && <span className="deck-preset__level">ความยาก: {d.difficulty}</span>}
                </button>
                <p className="deck-preset__desc">{d.description}</p>
                <div className="deck-preset__actions">
                  <button type="button" className="deck-btn deck-btn--primary" onClick={() => onPlay(d.id)}>
                    ⚔️ เล่นเลย
                  </button>
                  <button type="button" className="deck-btn" onClick={() => createDeck(d)}>
                    📄 คัดลอกไปแก้
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="deck-bar" aria-label="เลือกสำรับ">
        <select className="deck-bar__select" value={deck.id} onChange={(e) => setSelectedId(e.target.value)}>
          <optgroup label="สำรับสำเร็จรูป">
            {allDecks({ decks: [] }).map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon ?? '🗂️'} {d.name}
              </option>
            ))}
          </optgroup>
          {store.decks.length > 0 && (
            <optgroup label="สำรับของฉัน">
              {store.decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="deck-bar__buttons">
          <button type="button" className="deck-btn" onClick={() => createDeck(null)}>
            ＋ สำรับใหม่
          </button>
          <button type="button" className="deck-btn" onClick={() => createDeck(deck)}>
            📄 คัดลอก
          </button>
          {editable && (
            <button type="button" className="deck-btn deck-btn--danger" onClick={deleteDeck}>
              🗑 ลบ
            </button>
          )}
        </div>
      </section>

      <section className="deck-summary" aria-label="สรุปสำรับ">
        {editable ? (
          <input
            className="deck-summary__name"
            value={deck.name}
            maxLength={40}
            aria-label="ชื่อสำรับ"
            onChange={(e) => saveDeck({ ...deck, name: e.target.value })}
          />
        ) : (
          <h2 className="deck-summary__title">
            {deck.icon ?? '🗂️'} {deck.name}
          </h2>
        )}
        {deck.description && <p className="deck-summary__desc">{deck.description}</p>}
        <div className="deck-summary__counts">
          <span className={mainSize === DECK_RULES.mainSize || deck.test ? 'ok' : 'warn'}>
            กองหลัก {mainSize}
            {!deck.test && `/${DECK_RULES.mainSize}`}
          </span>
          <span className={extraSize <= DECK_RULES.extraMax || deck.test ? 'ok' : 'warn'}>
            กองพิเศษ {extraSize}
            {!deck.test && `/${DECK_RULES.extraMax}`}
          </span>
          {isActive && <span className="deck-summary__active">⚔️ ใช้อยู่</span>}
        </div>
        {problems.length > 0 && (
          <ul className="deck-summary__problems">
            {problems.map((p) => (
              <li key={p}>⚠️ {p}</li>
            ))}
          </ul>
        )}
        {editable && mainSize < DECK_RULES.mainSize && (
          <button
            type="button"
            className="deck-btn"
            onClick={() => saveDeck({ ...deck, main: toList(autoFill(main)) })}
            title="เติมการ์ดชุดเดียวกับที่ใส่ไว้ให้ครบ 40 ใบ"
          >
            ✨ เติมให้ครบ 40 ใบอัตโนมัติ
          </button>
        )}
        {!editable && <p className="deck-summary__note">สำรับสำเร็จรูปแก้ไขไม่ได้ — กด "📄 คัดลอก" เพื่อแก้เป็นของตัวเอง</p>}
        <button
          type="button"
          className="deck-btn deck-btn--primary"
          disabled={!readyToPlay}
          title={readyToPlay ? undefined : problems[0]}
          onClick={() => onPlay(deck.id)}
        >
          ⚔️ ใช้สำรับนี้ เริ่มเกมใหม่
        </button>
      </section>

      <div className="deck-tabs" role="tablist" aria-label="มุมมอง">
        <button type="button" role="tab" aria-selected={mobileTab === 'pool'} onClick={() => setMobileTab('pool')}>
          🃏 การ์ดทั้งหมด
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === 'deck'} onClick={() => setMobileTab('deck')}>
          🗂️ ในสำรับ ({mainSize + extraSize})
        </button>
      </div>

      <div className={`deck-body deck-body--${mobileTab}`}>
        <section className="deck-pool" aria-label="คลังการ์ด">
          <div className="deck-filters">
            <input
              className="deck-filters__search"
              type="search"
              placeholder="ค้นหาชื่อการ์ด…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="deck-filters__groups">
              {[CARD_GROUPS.all, ...Object.values(CARD_GROUPS).filter((g) => g.id !== 'all')].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`deck-chip${group === g.id ? ' deck-chip--active' : ''}`}
                  onClick={() => setGroup(g.id)}
                >
                  {g.icon} {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="deck-pool__grid">
            {pool.map((card) => {
              const n = countOf(card.id)
              const blocker = addBlocker(card)
              return (
                <div key={card.id} className={`deck-card${n ? ' deck-card--in' : ''}`}>
                  <button type="button" className="deck-card__art" onClick={() => setPreview(card)} aria-label={`ดู ${card.name}`}>
                    <span className="deck-card__scale">
                      <MonsterCard card={card} />
                    </span>
                    {isExtraCard(card) && <span className="deck-card__tag">กองพิเศษ</span>}
                    {n > 0 && <span className="deck-card__count">×{n}</span>}
                  </button>
                  {editable && (
                    <div className="deck-card__controls">
                      <button type="button" disabled={!n} onClick={() => removeCard(card)} aria-label={`เอา ${card.name} ออก 1 ใบ`}>
                        −
                      </button>
                      <button type="button" disabled={Boolean(blocker)} title={blocker ?? undefined} onClick={() => addCard(card)} aria-label={`ใส่ ${card.name} 1 ใบ`}>
                        ＋
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="deck-list" aria-label="การ์ดในสำรับ">
          {deckCards.length === 0 && <p className="deck-list__empty">ยังไม่มีการ์ด — แตะ ＋ ที่การ์ดเพื่อใส่</p>}
          {deckCards.map(({ card, n }) => (
            <div key={card.id} className="deck-row">
              <button type="button" className="deck-row__name" onClick={() => setPreview(card)}>
                <span aria-hidden="true">{CARD_TYPES[card.type]?.symbol}</span> {card.name}
                {card.type === 'monster' && (
                  <small>
                    ระดับ {card.level} · ATK {formatNumber(card.atk)}
                    {isExtraCard(card) ? ' · กองพิเศษ' : ''}
                  </small>
                )}
              </button>
              {editable && (
                <button type="button" className="deck-row__btn" onClick={() => removeCard(card)} aria-label={`เอา ${card.name} ออก 1 ใบ`}>
                  −
                </button>
              )}
              <span className="deck-row__count">×{n}</span>
              {editable && (
                <button
                  type="button"
                  className="deck-row__btn"
                  disabled={Boolean(addBlocker(card))}
                  onClick={() => addCard(card)}
                  aria-label={`ใส่ ${card.name} เพิ่ม 1 ใบ`}
                >
                  ＋
                </button>
              )}
            </div>
          ))}
        </section>
      </div>

      {preview && <CardZoom card={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
