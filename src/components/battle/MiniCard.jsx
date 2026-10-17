import MonsterCard from '../cards/MonsterCard'
import { ELEMENTS } from '../../data/elements'
import { formatNumber } from '../../engine'

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
}) {
  const element = ELEMENTS[card.element]
  const boosted = !defense && atk > card.atk
  const classes = [
    'mini-card',
    defense && 'mini-card--defense',
    faceDown && !hidden && 'mini-card--own-facedown',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const aria = hidden
    ? 'มอนสเตอร์คว่ำ (ท่าตั้งรับ)'
    : label ?? `${card.name} ${defense ? `ท่าตั้งรับ DEF ${card.def}` : `ATK ${atk}`}${faceDown ? ' (คว่ำ)' : ''}`
  return (
    <button type="button" className={classes} onClick={onClick} aria-label={aria}>
      <span className="mini-card__scale" aria-hidden="true">
        {hidden ? <span className="card-back" /> : <MonsterCard card={card} />}
      </span>
      {faceDown && !hidden && <span className="mini-card__facedown-tag">คว่ำ</span>}
      {card.type === 'monster' && !hidden && (
        <span
          className={`mini-card__atk${boosted ? ' mini-card__atk--boosted' : ''}${defense ? ' mini-card__atk--def' : ''}`}
          style={{ '--element-color': element?.color }}
          title={boosted ? `ATK ${formatNumber(card.atk)} + เอฟเฟกต์ ${formatNumber(atk - card.atk)}` : undefined}
        >
          {defense ? `🛡 ${formatNumber(card.def)}` : `${element?.symbol} ${formatNumber(atk)}`}
          {boosted && '▲'}
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
