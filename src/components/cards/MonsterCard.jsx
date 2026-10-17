import { useRef, useState } from 'react'
import { ELEMENTS } from '../../data/elements'
import { TRIBES } from '../../data/tribes'
import { RARITIES } from '../../data/rarities'
import { CARD_TYPES, SUMMON_TYPES } from '../../data/cards'
import {
  ElementSeal,
  HolofoilStamp,
  LevelCrystal,
  RarityGem,
} from './ThaiIcons'
import './MonsterCard.css'

const FOIL_RARITIES = new Set(['gold', 'emerald', 'divine'])

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

  const isNormalMonster =
    card.type === 'monster' &&
    (!card.effectText || card.effectText.startsWith('มอนสเตอร์ปกติ'))

  const handleMouseMove = (event) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--rx', `${(0.5 - py) * 7}deg`)
    el.style.setProperty('--ry', `${(px - 0.5) * 7}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }

  const handleMouseLeave = () => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  // สร้างข้อความแถบประเภทตรงกลาง (Typeline Pill)
  let typeLineText = ''
  if (card.type === 'monster') {
    const tribePart = tribe
      ? `เผ่า${tribe.name}${secondaryTribe ? `·${secondaryTribe.name}` : ''}`
      : 'มอนสเตอร์'
    const summonPart = summonInfo ? summonInfo.badge : 'ปกติ'
    const stagePart = card.evolution?.stage
      ? `ขั้น ${card.evolution.stage}/${card.evolution.maxStage}`
      : null
    typeLineText = [tribePart, summonPart, stagePart].filter(Boolean).join(' — ')
  } else if (card.type === 'spell') {
    typeLineText = `การ์ดเวทมนตร์ — ${card.spellSubtypeName || 'คาถาปกติ'}`
  } else if (card.type === 'trap') {
    typeLineText = `การ์ดกับดัก — ${card.trapSubtypeName || 'กับดักอาคม'}`
  } else if (card.type === 'ritual') {
    typeLineText = `การ์ดพิธีกรรม — สังเวยระดับ ${card.requiredLevel}+`
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
      {/* พื้นหลังบรรยากาศภาพเต็มใบ (Full-Bleed Ambient Art Backdrop) */}
      {card.image && !imgError && (
        <div
          className="tc__ambient-bg"
          style={{ backgroundImage: `url(${card.image})` }}
          aria-hidden="true"
        />
      )}
      <div className="tc__ambient-shade" aria-hidden="true" />

      {isFoil && <div className="tc__foil-glare" aria-hidden="true" />}

      <div className="tc__inner">
        {/* 1. ป้ายชื่อทรงมงกุฎทองด้านบน (Crowned Gold Filigree Title Bar) */}
        <header className="tc__namebar">
          <h2 className="tc__title">{card.name}</h2>
          <div className="tc__seals">
            {card.secondaryElements?.map((secElId) => {
              const secEl = ELEMENTS[secElId]
              return secEl ? (
                <ElementSeal
                  key={secElId}
                  elementId={secElId}
                  size={17}
                  title={`ธาตุรอง: ธาตุ${secEl.name}`}
                />
              ) : null
            })}
            <ElementSeal
              elementId={card.element}
              size={22}
              title={`ธาตุ${element.name} (${element.nameEn})`}
            />
          </div>
        </header>

        {/* 2. หน้าต่างภาพประกอบ 4:3 (1200x896) เห็นตัวละครหัวจรดเท้าครบ */}
        <div className={`tc__art-frame${isPortrait ? ' tc__art-frame--portrait' : ''}`}>
          {card.image && !imgError ? (
            <>
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
            <div className="tc__art-fallback">
              <span>รอภาพประกอบ</span>
            </div>
          )}
          <div className="tc__art-vignette" aria-hidden="true" />

          {/* ป้ายแคปซูลรหัสการ์ดมุมซ้ายล่าง + เพชรทรงหยดน้ำบอกระดับมุมขวาล่าง */}
          <div className="tc__capsule-row">
            <span className="tc__code-pill">{card.setCode}</span>
            {card.type === 'monster' && (
              <div className="tc__level-pill">
                <LevelCrystal level={card.level} />
              </div>
            )}
          </div>
        </div>

        {/* 3. แถบประเภทปลายมนขอบทอง (Gold-Rimmed Rounded Typeline Pill) */}
        <div className="tc__typeline">
          <span className="tc__typeline-text">{typeLineText}</span>
          <span className="tc__typeline-gem" title={`ระดับ${rarity.name}`}>
            <RarityGem rarityId={card.rarity} size={13} title={`ระดับ${rarity.name}`} />
          </span>
        </div>

        {/* 4. กล่องข้อความสีนิลโปร่งแสงเส้นทอง (Dark Translucent Gold-Framed Text Box) */}
        <div className="tc__textbox">
          <div className="tc__text-scroll">
            {isNormalMonster ? (
              <p className="tc__flavor tc__flavor--main">“{card.flavorText}”</p>
            ) : (
              <>
                {card.effectText && <p className="tc__effect">{card.effectText}</p>}
                {card.flavorText && <p className="tc__flavor">“{card.flavorText}”</p>}
              </>
            )}
          </div>

          {/* ตราสามเหลี่ยมโฮโลแกรมกึ่งกลางเส้นขอบล่าง (แบบการ์ดในภาพแนบ) */}
          <div className="tc__holo-slot">
            <HolofoilStamp rarityId={card.rarity} />
          </div>
        </div>

        {/* 5. แถบฐานการ์ดสีดำด้านล่างสุด + ป้ายค่าพลัง ATK / DEF ขอบทอง */}
        <footer className="tc__footer">
          <div className="tc__collector-info">
            <span>{card.setCode} • ธาตุ{element.name}</span>
            <span className="tc__collector-sub">ไพ่ไทย TCG • ระดับ{rarity.name}</span>
          </div>

          {card.type === 'monster' ? (
            <div className="tc__pt-box" title={`โจมตี ${card.atk} / ป้องกัน ${card.def}`}>
              <span className="tc__pt-atk">{card.atk}</span>
              <span className="tc__pt-slash">/</span>
              <span className="tc__pt-def">{card.def}</span>
            </div>
          ) : (
            <div className="tc__pt-box tc__pt-box--spell">
              <span>{cardType.name}</span>
            </div>
          )}
        </footer>
      </div>
    </article>
  )
}
