import { formatNumber } from '../../engine'

const NON_MONSTER_ACTION = {
  spell: '🏞️ ใช้เวทสนาม',
  ritual: '🙏 ทำพิธี',
  trap: '🪤 วางคว่ำ',
}

function SheetButtons({ children, onInspect, onClose }) {
  return (
    <div className="hand-sheet__buttons">
      {children}
      <button type="button" className="btn" onClick={onInspect} aria-label="ดูการ์ดขนาดเต็ม">
        🔍
      </button>
      <button type="button" className="btn" onClick={onClose} aria-label="ปิด">
        ✕
      </button>
    </div>
  )
}

/*
 * เมนูการ์ดในมือ
 * - ช่วงทิ้งการ์ดเกินมือ: ปุ่มทิ้ง
 * - มอนสเตอร์: อัญเชิญท่าโจมตี / วางคว่ำ (summonReason = เหตุผลที่ทำไม่ได้)
 * - เวท/พิธีกรรม/กับดัก: ปุ่มใช้ตามชนิด (blocker = เหตุผลที่ใช้ไม่ได้)
 */
export function HandActionSheet({
  card,
  canDiscard,
  canSummon,
  summonReason,
  tributeCost,
  blocker,
  onSummon,
  onPlay,
  onDiscard,
  onInspect,
  onClose,
}) {
  const isMonster = card.type === 'monster'
  const reason = canDiscard ? null : isMonster ? summonReason : blocker
  const stats = isMonster
    ? `ระดับ ${card.level} · ATK ${formatNumber(card.atk)} / DEF ${formatNumber(card.def)}`
    : card.spellSubtypeName ?? card.trapSubtypeName ?? (card.type === 'ritual' ? 'การ์ดพิธีกรรม' : '')
  return (
    <div className="hand-sheet">
      <div className="hand-sheet__info">
        <strong>{card.name}</strong>
        {stats && <span>{stats}</span>}
        {reason && <span className="hand-sheet__reason">{reason}</span>}
      </div>
      <SheetButtons onInspect={onInspect} onClose={onClose}>
        {canDiscard ? (
          <button type="button" className="btn btn--danger" onClick={onDiscard}>
            🗑 ทิ้ง
          </button>
        ) : isMonster ? (
          <>
            <button type="button" className="btn btn--primary" disabled={!canSummon} onClick={() => onSummon('attack')}>
              {tributeCost > 0 ? `✨ สังเวย ${tributeCost} ตัว` : '⚔️ โจมตี'}
            </button>
            <button type="button" className="btn" disabled={!canSummon} onClick={() => onSummon('defense')}>
              🛡 วางคว่ำ
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" disabled={Boolean(blocker)} onClick={onPlay}>
            {NON_MONSTER_ACTION[card.type] ?? 'ใช้'}
          </button>
        )}
      </SheetButtons>
    </div>
  )
}

/*
 * เมนูมอนสเตอร์ของเราบนสนาม (เฟสหลัก): เปลี่ยนท่า + ใช้ความสามารถ (ถ้ามี)
 * effect = { label, blocker, onUse } หรือ null
 */
export function FieldActionSheet({ card, monster, blocker, onChange, effect, onInspect, onClose }) {
  const inDefense = monster.position === 'defense'
  const status = inDefense ? (monster.faceDown ? 'ท่าตั้งรับ (คว่ำ)' : 'ท่าตั้งรับ') : 'ท่าโจมตี'
  const action = inDefense
    ? monster.faceDown
      ? '⚔️ หงายเป็นท่าโจมตี'
      : '⚔️ เปลี่ยนเป็นท่าโจมตี'
    : '🛡 เปลี่ยนเป็นท่าตั้งรับ'
  return (
    <div className="hand-sheet">
      <div className="hand-sheet__info">
        <strong>{card.name}</strong>
        <span>
          {status} · ATK {formatNumber(card.atk)} / DEF {formatNumber(card.def)}
        </span>
        {blocker && <span className="hand-sheet__reason">เปลี่ยนท่า: {blocker}</span>}
        {effect?.blocker && <span className="hand-sheet__reason">ความสามารถ: {effect.blocker}</span>}
      </div>
      <SheetButtons onInspect={onInspect} onClose={onClose}>
        {effect && (
          <button type="button" className="btn btn--primary" disabled={Boolean(effect.blocker)} onClick={effect.onUse}>
            ✨ {effect.label}
          </button>
        )}
        <button type="button" className={effect ? 'btn' : 'btn btn--primary'} disabled={Boolean(blocker)} onClick={onChange}>
          {action}
        </button>
      </SheetButtons>
    </div>
  )
}
