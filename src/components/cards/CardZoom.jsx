import MonsterCard from './MonsterCard'
import { ELEMENTS } from '../../data/elements'
import { TRIBES } from '../../data/tribes'
import { CARD_TYPES, SUMMON_TYPES } from '../../data/cards'
import { formatNumber } from '../../engine/rules'
import './CardZoom.css'

// ดูการ์ดขนาดใหญ่ + กล่องข้อความเอฟเฟกต์เต็ม (ตัวการ์ดตัดข้อความยาว จึงแสดงซ้ำแบบอ่านง่าย)
// แตะพื้นหลังหรือปุ่ม ✕ เพื่อปิด · แตะ/เลื่อนในกล่องไม่ปิด
export default function CardZoom({ card, onClose }) {
  const element = ELEMENTS[card.element]
  const tribe = card.tribe ? TRIBES[card.tribe] : null
  const summon = card.summonType ? SUMMON_TYPES[card.summonType] : null
  const meta =
    card.type === 'monster'
      ? [
          `ระดับ ${card.level}`,
          tribe && `เผ่า${tribe.name}`,
          element && `ธาตุ${element.name}`,
          summon ? summon.badge : 'อัญเชิญปกติ',
        ]
      : [`การ์ด${CARD_TYPES[card.type]?.name ?? ''}`, element && `ธาตุ${element.name}`]

  return (
    <div className="card-zoom" onClick={onClose} role="dialog" aria-modal="true" aria-label={card.name}>
      <div className="card-zoom__panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="card-zoom__close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
        <div className="card-zoom__card">
          <MonsterCard card={card} />
        </div>
        <div className="card-zoom__info">
          <h2 className="card-zoom__name">{card.name}</h2>
          <p className="card-zoom__meta">{meta.filter(Boolean).join(' · ')}</p>
          {card.type === 'monster' && (
            <p className="card-zoom__stats">
              <span className="card-zoom__atk">ATK {formatNumber(card.atk)}</span>
              <span className="card-zoom__def">DEF {formatNumber(card.def)}</span>
            </p>
          )}
          <section className="card-zoom__effect">
            <h3>ความสามารถ</h3>
            <p>{card.effectText || 'ไม่มีความสามารถพิเศษ'}</p>
          </section>
          {card.flavorText && <p className="card-zoom__flavor">“{card.flavorText}”</p>}
        </div>
      </div>
    </div>
  )
}
