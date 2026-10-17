import MiniCard from './MiniCard'
import { cardOf } from '../../engine'

/*
 * กระดานฝ่ายเดียว: ช่องมอนสเตอร์ 5 + ช่องเวท/กับดัก 5 + ช่องเวทสนาม + กองหลัก + สุสาน + กองพิเศษ
 * มือถือ: กองต่าง ๆ เป็นแถบปุ่มเล็ก · จอกว้าง ≥ 720px: วางเป็นช่องข้างสนามแบบกระดานจริง
 * ฝ่ายตรงข้ามกลับด้าน (หมุน 180° แบบนั่งตรงข้ามกัน)
 */
export default function BoardSide({ player, isOpponent, monsterRow, onOpenPile, onInspect }) {
  const owner = isOpponent ? 'คู่ต่อสู้' : 'คุณ'
  return (
    <section className={`board-side board-side--${isOpponent ? 'opp' : 'me'}`} aria-label={`กระดานของ${owner}`}>
      <div className="board-side__monsters">{monsterRow}</div>

      <div className="zone-row zone-row--st" aria-label={`ช่องเวทมนตร์/กับดักของ${owner}`}>
        {player.spellTrap.map((inst, i) =>
          inst ? (
            <MiniCard
              key={inst.uid}
              card={cardOf(inst)}
              className="mini-card--st"
              onClick={() => onInspect(cardOf(inst))}
            />
          ) : (
            <div key={`st-${i}`} className="zone-slot zone-slot--st" aria-label={`ช่องเวท/กับดัก ${i + 1} ว่าง`}>
              <span aria-hidden="true">📜</span>
            </div>
          )
        )}
      </div>

      <div className="pile-row">
        <div className="pile pile--field">
          {player.fieldSpell ? (
            <MiniCard
              card={cardOf(player.fieldSpell)}
              className="mini-card--st"
              onClick={() => onInspect(cardOf(player.fieldSpell))}
            />
          ) : (
            <div className="pile__body" aria-label="ช่องเวทสนาม ว่าง">
              <span className="pile__icon" aria-hidden="true">🏞️</span>
              <span className="pile__label">เวทสนาม</span>
              <span className="pile__count">ว่าง</span>
            </div>
          )}
        </div>

        <button type="button" className="pile pile--grave" onClick={() => onOpenPile(player.id, 'graveyard')}>
          <span className="pile__body">
            <span className="pile__icon" aria-hidden="true">🪦</span>
            <span className="pile__label">สุสาน</span>
            <span className="pile__count">{player.graveyard.length}</span>
          </span>
        </button>

        <button type="button" className="pile pile--extra pile--back" onClick={() => onOpenPile(player.id, 'extraDeck')}>
          <span className="pile__body">
            <span className="pile__icon" aria-hidden="true">✦</span>
            <span className="pile__label">กองพิเศษ</span>
            <span className="pile__count">{player.extraDeck.length}</span>
          </span>
        </button>

        <div className="pile pile--deck pile--back" aria-label={`กองการ์ดของ${owner} เหลือ ${player.deck.length} ใบ`}>
          <span className="pile__body">
            <span className="pile__icon" aria-hidden="true">🂠</span>
            <span className="pile__label">กองการ์ด</span>
            <span className="pile__count">{player.deck.length}</span>
          </span>
        </div>
      </div>
    </section>
  )
}

// ดูการ์ดในสุสาน / กองพิเศษ (กองพิเศษของคู่ต่อสู้เป็นการ์ดคว่ำ ดูไม่ได้)
export function PileViewer({ player, kind, isOpponent, onInspect, onClose }) {
  const cards = player[kind]
  const title = `${kind === 'graveyard' ? 'สุสาน' : 'กองพิเศษ'}ของ${isOpponent ? 'คู่ต่อสู้' : 'คุณ'} (${cards.length} ใบ)`
  const hidden = kind === 'extraDeck' && isOpponent
  return (
    <div className="battle-modal" onClick={onClose} role="dialog" aria-label={title}>
      <div className="pile-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="pile-viewer__head">
          <h2 className="pile-viewer__title">{title}</h2>
          <button type="button" className="btn" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        {hidden ? (
          <p className="pile-viewer__empty">กองพิเศษของคู่ต่อสู้เป็นการ์ดคว่ำ ดูไม่ได้</p>
        ) : cards.length === 0 ? (
          <p className="pile-viewer__empty">ยังไม่มีการ์ด</p>
        ) : (
          <div className="pile-viewer__grid">
            {[...cards].reverse().map((inst) => (
              <MiniCard key={inst.uid} card={cardOf(inst)} onClick={() => onInspect(cardOf(inst))} />
            ))}
          </div>
        )}
        {kind === 'extraDeck' && !hidden && (
          <p className="pile-viewer__note">มอนสเตอร์ผสานร่างรออยู่ที่นี่ — ระบบอัญเชิญผสานร่างจะมาในขั้นถัดไป</p>
        )}
      </div>
    </div>
  )
}
