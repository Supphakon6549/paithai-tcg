import { formatNumber, getBranchSpell, getBuffSpell, getEquip, getFusionSpell, getReviveSpell } from '../../engine'

const nonMonsterAction = (card) => {
  if (card.type === 'ritual') return '🙏 ทำพิธี'
  if (card.type === 'trap') return '🪤 วางคว่ำ'
  if (getFusionSpell(card)) return '🌀 ผสานร่าง'
  if (card.spellSubtype === 'field') return '🏞️ ใช้เวทสนาม'
  if (getReviveSpell(card)) return '💧 คืนชีพ'
  if (getEquip(card)) return '🗡️ สวมใส่'
  if (getBuffSpell(card)) return '🔥 ใช้'
  if (getBranchSpell(card)) return '🌑 เปิดสายมืด'
  return 'ใช้'
}

function SheetButtons({ children, onInspect, onClose }) {
  return (
    <div className="hand-sheet__buttons">
      {children}
      <button type="button" className="btn" onClick={onInspect} aria-label="ดูการ์ดขนาดเต็ม">
        🔍 ดูการ์ด
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
 *   special = { label, blocker, onUse } อัญเชิญพิเศษ (หรือ null)
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
  special,
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
        {special && !canDiscard && (
          <span className={special.blocker ? 'hand-sheet__reason' : 'hand-sheet__ok'}>
            อัญเชิญพิเศษ: {special.blocker ?? special.label}
          </span>
        )}
      </div>
      <SheetButtons onInspect={onInspect} onClose={onClose}>
        {canDiscard ? (
          <button type="button" className="btn btn--danger" onClick={onDiscard}>
            🗑 ทิ้ง
          </button>
        ) : isMonster ? (
          <>
            {special && !special.blocker && (
              <button type="button" className="btn btn--primary" onClick={special.onUse}>
                ✨ อัญเชิญพิเศษ
              </button>
            )}
            <button type="button" className="btn btn--primary" disabled={!canSummon} onClick={() => onSummon('attack')}>
              {tributeCost > 0 ? `✨ สังเวย ${tributeCost} ตัว` : '⚔️ โจมตี'}
            </button>
            <button type="button" className="btn" disabled={!canSummon} onClick={() => onSummon('defense')}>
              🛡 วางคว่ำ
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" disabled={Boolean(blocker)} onClick={onPlay}>
            {nonMonsterAction(card)}
          </button>
        )}
      </SheetButtons>
    </div>
  )
}

/*
 * เมนูมอนสเตอร์ของเราบนสนาม (เฟสหลัก): เลื่อนยศ + ใช้ความสามารถ + เปลี่ยนท่า
 * effect = { label, blocker, onUse } หรือ null
 * evolve = { intoName, blocker, fromHand, fromDeck, onEvolve(from) } หรือ null
 */
export function FieldActionSheet({ card, monster, blocker, onChange, effect, evolve, onInspect, onClose }) {
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
        {evolve?.blocker && <span className="hand-sheet__reason">เลื่อนยศ: {evolve.blocker}</span>}
        {evolve && !evolve.blocker && <span className="hand-sheet__ok">🎖️ เลื่อนยศเป็น {evolve.intoName} ได้แล้ว</span>}
      </div>
      <SheetButtons onInspect={onInspect} onClose={onClose}>
        {evolve && !evolve.blocker && evolve.fromDeck && (
          <button type="button" className="btn btn--primary" onClick={() => evolve.onEvolve('deck')}>
            🎖️ เลื่อนยศ{evolve.fromHand ? ' · จากกอง' : ''}
          </button>
        )}
        {evolve && !evolve.blocker && evolve.fromHand && (
          <button type="button" className={evolve.fromDeck ? 'btn' : 'btn btn--primary'} onClick={() => evolve.onEvolve('hand')}>
            🎖️ {evolve.fromDeck ? 'จากมือ' : 'เลื่อนยศ'}
          </button>
        )}
        {effect && (
          <button type="button" className="btn btn--primary" disabled={Boolean(effect.blocker)} onClick={effect.onUse}>
            ✨ {effect.label}
          </button>
        )}
        <button
          type="button"
          className={effect || (evolve && !evolve.blocker) ? 'btn' : 'btn btn--primary'}
          disabled={Boolean(blocker)}
          onClick={onChange}
        >
          {action}
        </button>
      </SheetButtons>
    </div>
  )
}

// เมนูกับดักต่อเนื่องที่วางคว่ำของเรา: เปิดหงายในเฟสหลัก
export function TrapActionSheet({ card, blocker, onActivate, onInspect, onClose }) {
  return (
    <div className="hand-sheet">
      <div className="hand-sheet__info">
        <strong>{card.name}</strong>
        <span>{card.trapSubtypeName ?? 'กับดัก'} · วางคว่ำอยู่</span>
        {blocker && <span className="hand-sheet__reason">{blocker}</span>}
      </div>
      <SheetButtons onInspect={onInspect} onClose={onClose}>
        <button type="button" className="btn btn--primary" disabled={Boolean(blocker)} onClick={onActivate}>
          {card.trapSubtype === 'continuous' ? '🥁 เปิดหงาย' : '🪤 เปิดใช้'}
        </button>
      </SheetButtons>
    </div>
  )
}
