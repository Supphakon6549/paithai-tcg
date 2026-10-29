import { useState } from 'react'
import { ELEMENTS } from '../../data/elements'
import { TRIBES } from '../../data/tribes'
import { RARITIES } from '../../data/rarities'
import { CARD_GROUPS, CARD_TYPES, SUMMON_TYPES } from '../../data/cards'
import './NagaShowcaseCard.css'

// Shared across sets. Bespoke artwork may integrate the subject with the frame.
const TEMPLATES = {
  'th04-001': '/cards/showcase/th04-001-template-v1.webp',
  'th04-002': '/cards/showcase/th04-002-template-v2.webp',
  'th04-003': '/cards/showcase/th04-003-template-v1.webp',
  'th04-006': '/cards/showcase/th04-006-template-v1.webp',
  'th04-007': '/cards/showcase/th04-007-template-v1.webp',
  'th04-008': '/cards/showcase/th04-008-template-v1.webp',
  'th04-009': '/cards/showcase/th04-009-template-v1.webp',
  'th04-005': '/cards/showcase/th04-005-template-v2.webp',
  'th04-004': '/cards/showcase/th04-004-template-v3.webp',
  'th07-016': '/cards/showcase/th07-016-template-v2.webp',
  'th06-006': '/cards/showcase/th06-006-template-v1.webp',
  'th03-006': '/cards/showcase/th03-006-template-v2.webp',
  'th03-019': '/cards/showcase/th03-019-template-v2.webp',
  'th03-017': '/cards/showcase/th03-017-template-v1.webp',
  'th03-002': '/cards/showcase/th03-002-template-v1.webp',
  'th03-013': '/cards/showcase/th03-013-template-v2.webp',
  'th03-001': '/cards/showcase/th03-001-template-v1.webp',
  'th03-003': '/cards/showcase/th03-003-template-v1.webp',
  'th03-004': '/cards/showcase/th03-004-template-v1.webp',
  'th03-005': '/cards/showcase/th03-005-template-v1.webp',
  'th03-007': '/cards/showcase/th03-007-template-v1.webp',
  'th03-008': '/cards/showcase/th03-008-template-v1.webp',
  'th03-009': '/cards/showcase/th03-009-template-v1.webp',
  'th03-010': '/cards/showcase/th03-010-template-v1.webp',
  'th03-011': '/cards/showcase/th03-011-template-v2.webp',
  'th03-012': '/cards/showcase/th03-012-template-v2.webp',
  'th03-014': '/cards/showcase/th03-014-template-v2.webp',
  'th03-015': '/cards/showcase/th03-015-template-v2.webp',
  'th03-016': '/cards/showcase/th03-016-template-v2.webp',
  'th03-018': '/cards/showcase/th03-018-template-v1.webp',
  'th06-013': '/cards/showcase/th06-013-template-v3.webp',
  'th06-001': '/cards/showcase/th06-001-template-v1.webp',
  'th06-002': '/cards/showcase/th06-002-template-v1.webp',
  'th06-003': '/cards/showcase/th06-003-template-v1.webp',
  'th06-004': '/cards/showcase/th06-004-template-v1.webp',
  'th06-005': '/cards/showcase/th06-005-template-v1.webp',
  'th06-007': '/cards/showcase/th06-007-template-v1.webp',
  'th06-008': '/cards/showcase/th06-008-template-v1.webp',
  'th06-009': '/cards/showcase/th06-009-template-v1.webp',
  'th06-010': '/cards/showcase/th06-010-template-v1.webp',
  'th06-011': '/cards/showcase/th06-011-template-v1.webp',
  'th06-012': '/cards/showcase/th06-012-template-v1.webp',
  'th06-014': '/cards/showcase/th06-014-template-v2.webp',
  'th06-015': '/cards/showcase/th06-015-template-v2.webp',
}

export default function NagaShowcaseCard({ card, onClick, isSelected = false }) {
  const [imageError, setImageError] = useState(false)
  const [frameError, setFrameError] = useState(false)
  const bespoke = Boolean(TEMPLATES[card.id]) && !frameError
  const monster = card.type === 'monster'
  const typeName = CARD_TYPES[card.type]?.name || ''
  const subtype = monster ? SUMMON_TYPES[card.summonType]?.badge : card.spellSubtypeName || card.trapSubtypeName || typeName
  const element = ELEMENTS[card.element] || ELEMENTS.water
  const rarity = RARITIES[card.rarity] || RARITIES.common
  const tribe = TRIBES[card.tribe]
  const tribeLabel = [tribe?.name, TRIBES[card.secondaryTribe]?.name].filter(Boolean).join('/')
  const activate = () => onClick?.(card)

  return (
    <article
      className={`tc naga-card${imageError ? ' naga-card--fallback' : ''}${isSelected ? ' tc--selected' : ''}${onClick ? ' tc--interactive' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={monster ? `${card.name} ระดับ ${card.level} ATK ${card.atk} DEF ${card.def}` : `${card.name} ${typeName}`}
      onClick={onClick ? activate : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      } : undefined}
    >
      {!bespoke && !imageError && <>
        <img className="naga-card__ambient" src={card.image} alt="" aria-hidden="true" />
        <img className="naga-card__art" src={card.image} alt={card.name} loading="lazy" onError={() => setImageError(true)} />
      </>}
      {imageError && <div className="naga-card__missing">ไม่พบภาพการ์ด</div>}
      {!frameError && <img className="naga-card__template" src={bespoke ? TEMPLATES[card.id] : '/cards/showcase/shared-frame-v1.webp'}
        alt={bespoke ? card.name : ''} loading="lazy" onError={() => setFrameError(true)} />}
      <header className="naga-card__namebar"><h2>{card.name}</h2></header>
      <div className="naga-card__identity">
        {monster ? <><span>ระดับ {card.level}</span><span aria-hidden="true">•</span>
        <span>{element.name}</span><span aria-hidden="true">•</span><span title={tribeLabel}>{tribeLabel}</span></> : <span>{typeName}</span>}
      </div>
      <div className="naga-card__summon">{subtype}</div>
      <div className="naga-card__stats">
        {monster ? <><span><small>ATK</small> <strong>{card.atk}</strong></span>
        <span><small>DEF</small> <strong>{card.def}</strong></span></> : <span className="naga-card__type-label">{typeName}</span>}
      </div>
      <div className="naga-card__rules"><p>{card.effectText}</p></div>
      <p className="naga-card__flavor">{card.flavorText ? `“${card.flavorText}”` : ''}</p>
      <footer className="naga-card__footer">
        <span>{card.setCode}</span><span title={CARD_GROUPS[card.groupTag]?.name}>{CARD_GROUPS[card.groupTag]?.name}</span><span>{rarity.name}</span>
      </footer>
    </article>
  )
}

