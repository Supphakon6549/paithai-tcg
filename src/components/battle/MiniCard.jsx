import MonsterCard from '../cards/MonsterCard'
import { ELEMENTS } from '../../data/elements'
import { formatNumber } from '../../engine'

// MonsterCard เดิมย่อด้วย CSS zoom (ขนาดกำหนดจาก --mini-zoom ของคอนเทนเนอร์)
// พร้อมป้าย ATK ตัวใหญ่ให้อ่านออกบนจอมือถือ
export default function MiniCard({ card, atk = card.atk, className = '', badge, onClick, label }) {
  const element = ELEMENTS[card.element]
  const boosted = atk > card.atk
  return (
    <button
      type="button"
      className={`mini-card ${className}`}
      onClick={onClick}
      aria-label={label ?? `${card.name} ATK ${atk}`}
    >
      <span className="mini-card__scale" aria-hidden="true">
        <MonsterCard card={card} />
      </span>
      {card.type === 'monster' && (
        <span
          className={`mini-card__atk${boosted ? ' mini-card__atk--boosted' : ''}`}
          style={{ '--element-color': element?.color }}
          title={boosted ? `ATK ${formatNumber(card.atk)} + เอฟเฟกต์ ${formatNumber(atk - card.atk)}` : undefined}
        >
          {element?.symbol} {formatNumber(atk)}{boosted && '▲'}
        </span>
      )}
      {badge && (
        <span className={`mini-card__badge mini-card__badge--${badge.tone}`}>
          <span>{badge.text}</span>
          {badge.detail && <span className="mini-card__badge-detail">{badge.detail}</span>}
        </span>
      )}
    </button>
  )
}
