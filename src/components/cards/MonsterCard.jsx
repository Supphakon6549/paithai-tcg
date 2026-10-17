import { useRef, useState } from 'react'
import { ELEMENTS } from '../../data/elements'
import { TRIBES } from '../../data/tribes'
import { RARITIES } from '../../data/rarities'
import { CARD_TYPES, SUMMON_TYPES } from '../../data/cards'
import {
  ElementSeal,
  LevelCrystal,
  RarityGem,
  ShieldIcon,
  SwordIcon,
} from './ThaiIcons'
import './MonsterCard.css'

const FOIL_RARITIES = new Set(['gold', 'emerald', 'divine'])

const PATH_LABELS = {
  xp: 'สายเก็บประสบการณ์',
  ritual: 'สายพิธีกรรม',
  fusion: 'สายผสานร่าง',
  branch: 'แตกสายได้',
}

export default function MonsterCard({ card, onClick, isSelected = false }) {
  const cardRef = useRef(null)
  const [imgError, setImgError] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)

  const element = ELEMENTS[card.element] || ELEMENTS.void
  const tribe = card.tribe ? TRIBES[card.tribe] : null
  const secondaryTribe = card.secondaryTribe ? TRIBES[card.secondaryTribe] : null
  const rarity = RARITIES[card.rarity] || RARITIES.common
  const cardType = CARD_TYPES[card.type] || CARD_TYPES.monster
  const summonInfo = card.summonType ? SUMMON_TYPES[card.summonType] : null
  const isFoil = FOIL_RARITIES.has(card.rarity)
  const pathText = card.evolution?.path ? PATH_LABELS[card.evolution.path] : null

  const handleMouseMove = (event) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--rx', `${(0.5 - py) * 8}deg`)
    el.style.setProperty('--ry', `${(px - 0.5) * 8}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }

  const handleMouseLeave = () => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  // สร้างข้อความแถบประเภทและเผ่าแบบไม่ต้องพึ่งอีโมจิ
  let typeLineLeft = 'การ์ดมอนสเตอร์'
  let typeLineCenter = ''
  let typeLineRight = ''

  if (card.type === 'monster') {
    typeLineLeft = summonInfo ? summonInfo.badge : 'มอนสเตอร์'
    if (tribe) {
      typeLineCenter = `เผ่า${tribe.name}${secondaryTribe ? ` / ${secondaryTribe.name}` : ''}`
    }
    if (card.evolution?.stage) {
      typeLineRight = `ขั้น ${card.evolution.stage}/${card.evolution.maxStage}`
    } else if (pathText) {
      typeLineRight = pathText
    }
  } else if (card.type === 'spell') {
    typeLineLeft = 'การ์ดเวทมนตร์'
    typeLineCenter = card.spellSubtypeName || 'คาถาปกติ'
  } else if (card.type === 'trap') {
    typeLineLeft = 'การ์ดกับดัก'
    typeLineCenter = card.trapSubtypeName || 'กับดักอาคม'
  } else if (card.type === 'ritual') {
    typeLineLeft = 'การ์ดพิธีกรรม'
    typeLineCenter = `สังเวยระดับ ${card.requiredLevel}+`
  }

  return (
    <article
      ref={cardRef}
      className={`tc tc--${card.rarity} tc--type-${card.type}${
        card.summonType === 'fusion' ? ' tc--fusion' : ''
      }${isFoil ? ' tc--foil' : ''}${isSelected ? ' tc--selected' : ''}${
        onClick ? ' tc--interactive' : ''
      }`}
      style={{ '--element-color': element.color, '--element-glow': element.glow }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick ? () => onClick(card) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(card)
              }
            }
          : undefined
      }
    >
      {isFoil && <div className="tc__foil-glare" aria-hidden="true" />}

      {/* โครงสร้างกรอบการ์ดพิมพ์จริงพร้อมเส้นลายไทยย่อมุม */}
      <div className="tc__inner">
        {/* 1. ป้ายชื่อหัวการ์ด (Nameplate) + ตราธาตุ SVG */}
        <header className="tc__namebar">
          <h2 className="tc__title">{card.name}</h2>
          <div className="tc__seals">
            {card.secondaryElements?.map((secElId) => {
              const secEl = ELEMENTS[secElId]
              return secEl ? (
                <ElementSeal
                  key={secElId}
                  elementId={secElId}
                  size={20}
                  title={`ธาตุรอง: ธาตุ${secEl.name}`}
                />
              ) : null
            })}
            <ElementSeal
              elementId={card.element}
              size={28}
              title={`ธาตุ${element.name} (${element.nameEn})`}
            />
          </div>
        </header>

        {/* 2. แถบดาวระดับ / ชนิดการ์ด และรหัสชุด */}
        <div className="tc__subbar">
          {card.type === 'monster' ? (
            <div className="tc__level-wrap">
              <LevelCrystal level={card.level} />
              <span className="tc__level-text">ระดับ {card.level}</span>
            </div>
          ) : (
            <span className="tc__kind-tag">ประเภท: การ์ด{cardType.name}</span>
          )}
          <span className="tc__code">{card.setCode}</span>
        </div>

        {/* 3. กรอบภาพประกอบ (Art Box) แบบย่อมุม */}
        <div className={`tc__art-frame${isPortrait ? ' tc__art-frame--portrait' : ''}`}>
          {card.image && !imgError ? (
            <>
              {/* รูปแนวตั้ง: แสดงเต็มรูปไม่ตัด และเติมด้านข้างด้วยภาพเดียวกันแบบเบลอ */}
              {isPortrait && (
                <div
                  className="tc__art-backdrop"
                  style={{ backgroundImage: `url(${card.image})` }}
                  aria-hidden="true"
                />
              )}
              <img
                className="tc__art-img"
                src={card.image}
                alt={card.name}
                loading="lazy"
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                  setIsPortrait(h > w)
                }}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <div className="tc__art-fallback" />
          )}
          <div className="tc__art-vignette" aria-hidden="true" />
        </div>

        {/* 4. แถบระบุเผ่าและสายการเล่น (Typeline Banner) */}
        <div className="tc__typeline">
          <span>{typeLineLeft}</span>
          {typeLineCenter && (
            <>
              <span className="tc__diamond" aria-hidden="true">◆</span>
              <span>{typeLineCenter}</span>
            </>
          )}
          {typeLineRight && (
            <>
              <span className="tc__diamond" aria-hidden="true">◆</span>
              <span className="tc__typeline-evo">{typeLineRight}</span>
            </>
          )}
        </div>

        {/* 5. กล่องข้อความสมุดข่อย (Parchment Rule Box) — อ่านง่ายคมชัดเหมือนการ์ดพิมพ์จริง */}
        <div className="tc__textbox">
          {card.effectText && <p className="tc__effect">{card.effectText}</p>}
          {card.flavorText && (
            <>
              <div className="tc__divider" aria-hidden="true">
                <span className="tc__divider-line" />
                <span className="tc__divider-gem">❖</span>
                <span className="tc__divider-line" />
              </div>
              <p className="tc__flavor">{card.flavorText}</p>
            </>
          )}
        </div>

        {/* 6. แถบค่าพลังโจมตี / ความหายาก / ป้องกัน */}
        {card.type === 'monster' ? (
          <footer className="tc__footer">
            <div className="tc__stat-plate tc__stat-plate--atk">
              <SwordIcon />
              <span className="tc__stat-lbl">โจมตี</span>
              <span className="tc__stat-num">{card.atk}</span>
            </div>

            <div className="tc__rarity-slot" title={`ความหายาก: ${rarity.name}`}>
              <RarityGem rarityId={card.rarity} size={20} title={`ระดับ${rarity.name}`} />
            </div>

            <div className="tc__stat-plate tc__stat-plate--def">
              <ShieldIcon />
              <span className="tc__stat-lbl">ป้องกัน</span>
              <span className="tc__stat-num">{card.def}</span>
            </div>
          </footer>
        ) : (
          <footer className="tc__footer tc__footer--non-monster">
            <div className="tc__stat-plate">
              <span className="tc__stat-lbl">ธาตุ{element.name}</span>
            </div>
            <div className="tc__rarity-slot" title={`ความหายาก: ${rarity.name}`}>
              <RarityGem rarityId={card.rarity} size={20} title={`ระดับ${rarity.name}`} />
            </div>
            <div className="tc__stat-plate">
              <span className="tc__stat-lbl">ระดับ{rarity.name}</span>
            </div>
          </footer>
        )}
      </div>
    </article>
  )
}
