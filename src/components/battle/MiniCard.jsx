import { useContext, useRef } from 'react'
import MonsterCard from '../cards/MonsterCard'
import { ELEMENTS } from '../../data/elements'
import { formatNumber } from '../../engine'
import { InspectContext } from './inspectContext'

const LONG_PRESS_MS = 450

// กดค้าง (มือถือ) / คลิกขวา (PC) → onLong · fired บอกว่าการแตะครั้งนี้ใช้ไปกับกดค้างแล้ว
function useLongPress(onLong) {
  const timer = useRef(null)
  const start = useRef(null)
  const fired = useRef(false)
  const cancel = () => {
    clearTimeout(timer.current)
    timer.current = null
  }
  if (!onLong) return { fired, handlers: {} }
  return {
    fired,
    handlers: {
      onPointerDown: (e) => {
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        cancel()
        timer.current = setTimeout(() => {
          fired.current = true
          onLong()
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e) => {
        e.preventDefault()
        cancel()
        if (!fired.current) onLong()
        fired.current = true
      },
    },
  }
}

// MonsterCard เดิมย่อด้วย CSS zoom (ขนาดกำหนดจาก --mini-zoom ของคอนเทนเนอร์)
// พร้อมป้าย ATK/DEF ตัวใหญ่ให้อ่านออกบนจอมือถือ
// defense = ท่าตั้งรับ (หมุนแนวนอน) · faceDown = คว่ำ · hidden = คว่ำของอีกฝ่าย (เห็นแค่หลังการ์ด)
export default function MiniCard({
  card,
  atk = card.atk,
  defense = false,
  faceDown = false,
  hidden = false,
  className = '',
  badge,
  onClick,
  label,
  uid,
  zone,
  xp, // { text: '⭐ 1/2', ready } ตัวนับแต้มสายประสบการณ์
  onPreview, // (card | null) ชี้เมาส์ค้าง → แสดงการ์ดขยาย (PC)
}) {
  const inspect = useContext(InspectContext)
  const { fired, handlers } = useLongPress(inspect && !hidden ? () => inspect(card) : null)
  const element = ELEMENTS[card.element]
  const boosted = !defense && atk > card.atk
  const weakened = !defense && atk < card.atk
  const classes = [
    'mini-card',
    defense && 'mini-card--defense',
    faceDown && !hidden && 'mini-card--own-facedown',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const isMonster = card.type === 'monster'
  // การ์ดเวท/กับดักไม่มี ATK — บอกแค่ชื่อ (ของอีกฝ่ายที่คว่ำ บอกแค่ว่าเป็นการ์ดคว่ำ)
  const stats = isMonster ? ` ${defense ? `ท่าตั้งรับ DEF ${card.def}` : `ATK ${atk}`}` : ''
  const aria = hidden
    ? isMonster
      ? 'มอนสเตอร์คว่ำ (ท่าตั้งรับ)'
      : 'การ์ดคว่ำในช่องเวท/กับดัก'
    : label ?? `${card.name}${stats}${faceDown ? ' (คว่ำ)' : ''}`
  return (
    <button
      type="button"
      className={classes}
      onClick={(e) => {
        // กดค้างดูการ์ดไปแล้ว ไม่นับเป็นการแตะเลือก
        if (fired.current) {
          fired.current = false
          return
        }
        onClick?.(e)
      }}
      {...handlers}
      onMouseEnter={onPreview && !hidden ? () => onPreview(card) : undefined}
      onMouseLeave={onPreview ? () => onPreview(null) : undefined}
      aria-label={aria}
      data-uid={uid}
      data-zone={zone}
    >
      <span className="mini-card__scale" aria-hidden="true">
        {hidden ? <span className="card-back" /> : <MonsterCard card={card} />}
      </span>
      {faceDown && !hidden && <span className="mini-card__facedown-tag">คว่ำ</span>}
      {xp && !hidden && (
        <span className={`mini-card__xp${xp.ready ? ' mini-card__xp--ready' : ''}`} title="แต้มประสบการณ์">
          {xp.text}
        </span>
      )}
      {card.type === 'monster' && !hidden && (
        <span
          className={`mini-card__atk${boosted ? ' mini-card__atk--boosted' : ''}${weakened ? ' mini-card__atk--weakened' : ''}${defense ? ' mini-card__atk--def' : ''}`}
          style={{ '--element-color': element?.color }}
          title={boosted || weakened ? `ATK ${formatNumber(card.atk)} ${boosted ? '+' : '−'} เอฟเฟกต์ ${formatNumber(Math.abs(atk - card.atk))}` : undefined}
        >
          {defense ? `🛡 ${formatNumber(card.def)}` : `${element?.symbol} ${formatNumber(atk)}`}
          {boosted && '▲'}
          {weakened && '▼'}
        </span>
      )}
      {hidden && <span className="mini-card__atk mini-card__atk--def">🛡 ?</span>}
      {badge && (
        <span className={`mini-card__badge mini-card__badge--${badge.tone}`}>
          <span>{badge.text}</span>
          {badge.detail && <span className="mini-card__badge-detail">{badge.detail}</span>}
        </span>
      )}
    </button>
  )
}
