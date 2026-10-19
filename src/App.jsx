import { useMemo, useState } from 'react'
import MonsterCard from './components/cards/MonsterCard'
import BattleScreen from './components/battle/BattleScreen'
import DeckBuilder from './components/deck/DeckBuilder'
import { PRESET_DECKS, findDeck, loadDeckStore, saveDeckStore } from './data/decks'
import { ElementSeal, RarityGem } from './components/cards/ThaiIcons'
import {
  CARDS,
  CARD_GROUPS,
  CARD_TYPES,
  SUMMON_TYPES,
  getCardById,
  getCardMatchupInfo,
} from './data/cards'
import { ELEMENTS } from './data/elements'
import { RARITIES } from './data/rarities'
import './App.css'

function CardInspectorModal({ card, onClose, onSelectCard }) {
  if (!card) return null

  const element = ELEMENTS[card.element]
  const rarity = RARITIES[card.rarity]
  const cardType = CARD_TYPES[card.type]
  const summonInfo = card.summonType ? SUMMON_TYPES[card.summonType] : null
  const matchup = getCardMatchupInfo(card)

  const evoFromCards = (card.evolution?.evolvesFrom || [])
    .map((id) => getCardById(id))
    .filter(Boolean)
  const rawEvoTo = card.evolution?.evolvesTo
  const evoToIds = Array.isArray(rawEvoTo)
    ? rawEvoTo
    : rawEvoTo
    ? [rawEvoTo]
    : []
  const evoToCards = evoToIds.map((id) => getCardById(id)).filter(Boolean)
  const ritualCard = card.evolution?.ritualCardId
    ? getCardById(card.evolution.ritualCardId)
    : null
  const fusionSpell = card.evolution?.fusionSpellId
    ? getCardById(card.evolution.fusionSpellId)
    : null
  const ritualTarget = card.targetMonsterId
    ? getCardById(card.targetMonsterId)
    : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ '--element-color': element.color, '--element-glow': element.glow }}
      >
        <button className="modal-close" onClick={onClose} aria-label="ปิดหน้าต่าง">
          ✕
        </button>

        <div className="modal-grid">
          <div className="modal-card-preview">
            <MonsterCard card={card} />
          </div>

          <div className="modal-details">
            <div className="modal-badges">
              <span className="pill pill--code">{card.setCode}</span>
              <span className="pill pill--type">การ์ด{cardType.name}</span>
              <span className="pill pill--rarity">
                <RarityGem rarityId={card.rarity} size={14} />
                <span>
                  ระดับ{rarity.name} (โอกาสออก {(rarity.dropRate * 100).toFixed(1)}%)
                </span>
              </span>
              {summonInfo && (
                <span className="pill pill--summon">{summonInfo.label}</span>
              )}
            </div>

            <h2 className="modal-title">
              {card.name} <span className="modal-title-en">{card.nameEn}</span>
            </h2>

            {card.type === 'monster' && (
              <div className="modal-stat-strip">
                <div className="stat-box">
                  <span className="stat-box__label">ระดับดาว</span>
                  <span className="stat-box__val">ระดับ {card.level}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">พลังโจมตี</span>
                  <span className="stat-box__val stat-box__val--atk">{card.atk}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">พลังป้องกัน</span>
                  <span className="stat-box__val stat-box__val--def">{card.def}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">การอัญเชิญ</span>
                  <span className="stat-box__sub">
                    {summonInfo ? summonInfo.badge : 'อัญเชิญปกติ'}
                  </span>
                </div>
              </div>
            )}

            <section className="modal-section">
              <h3 className="modal-section__title">ความสามารถประจำการ์ด</h3>
              <p className="modal-section__effect">{card.effectText}</p>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">ตำนานและเรื่องราว</h3>
              <p className="modal-section__flavor">“{card.flavorText}”</p>
            </section>

            <div className="modal-matchups">
              <div className="matchup-card">
                <div className="matchup-card__header">
                  <span className="matchup-card__title-inline">
                    <ElementSeal elementId={card.element} size={20} />
                    <span>ธาตุหลัก: ธาตุ{element.name}</span>
                  </span>
                  <span className="matchup-bonus">โจมตี +{matchup.elementBonus}</span>
                </div>
                <div className="matchup-card__body">
                  <div>
                    <strong>ชนะทาง (+300):</strong>{' '}
                    {matchup.strongElements.map((el) => `ธาตุ${el.name}`).join(', ')}
                  </div>
                  {matchup.weakElement && (
                    <div>
                      <strong>แพ้ทาง:</strong> ธาตุ{matchup.weakElement.name}
                    </div>
                  )}
                </div>
              </div>

              {matchup.tribe && (
                <div className="matchup-card">
                  <div className="matchup-card__header">
                    <span>เผ่าพันธุ์: เผ่า{matchup.tribe.name}</span>
                    <span className="matchup-bonus">
                      {matchup.tribe.group === 'human'
                        ? 'เผ่ามนุษย์ (สมดุล)'
                        : `โจมตี +${matchup.tribeBonus}`}
                    </span>
                  </div>
                  <div className="matchup-card__body">
                    {matchup.tribe.group === 'human' ? (
                      <div>
                        เผ่ามนุษย์ไม่มีจุดอ่อนเผ่าพันธุ์ และเน้นคอมโบร่วมกับการ์ดอาวุธ สัตว์ป่า หรือคาถา
                      </div>
                    ) : (
                      <>
                        {matchup.strongTribe && (
                          <div>
                            <strong>ชนะเผ่า (+200):</strong> เผ่า{matchup.strongTribe.name}
                          </div>
                        )}
                        {matchup.weakTribe && (
                          <div>
                            <strong>แพ้เผ่า:</strong> เผ่า{matchup.weakTribe.name}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(card.evolution || ritualTarget) && (
              <section className="modal-section modal-section--evo">
                <h3 className="modal-section__title">
                  เส้นทางวิวัฒนาการและการอัญเชิญต่อเนื่อง
                </h3>
                {card.evolution?.conditionText && (
                  <p className="evo-condition">{card.evolution.conditionText}</p>
                )}

                <div className="evo-links">
                  {evoFromCards.map((prev) => (
                    <button
                      key={prev.id}
                      type="button"
                      className="evo-chip"
                      onClick={() => onSelectCard(prev)}
                    >
                      <span>ร่างก่อนหน้า / วัตถุดิบ:</span>
                      <strong>
                        {prev.setCode} {prev.name}
                      </strong>
                    </button>
                  ))}

                  {ritualCard && (
                    <button
                      type="button"
                      className="evo-chip evo-chip--ritual"
                      onClick={() => onSelectCard(ritualCard)}
                    >
                      <span>การ์ดพิธีกรรมที่ใช้:</span>
                      <strong>
                        {ritualCard.setCode} {ritualCard.name}
                      </strong>
                    </button>
                  )}

                  {fusionSpell && (
                    <button
                      type="button"
                      className="evo-chip evo-chip--fusion"
                      onClick={() => onSelectCard(fusionSpell)}
                    >
                      <span>คาถาผสานที่ใช้:</span>
                      <strong>
                        {fusionSpell.setCode} {fusionSpell.name}
                      </strong>
                    </button>
                  )}

                  {evoToCards.map((nextCard) => (
                    <button
                      key={nextCard.id}
                      type="button"
                      className="evo-chip evo-chip--next"
                      onClick={() => onSelectCard(nextCard)}
                    >
                      <span>
                        {nextCard.summonType === 'fusion'
                          ? 'สายผสานร่างสู่:'
                          : 'เลื่อนขั้นสู่:'}
                      </span>
                      <strong>
                        {nextCard.setCode} {nextCard.name}
                      </strong>
                    </button>
                  ))}

                  {ritualTarget && (
                    <button
                      type="button"
                      className="evo-chip evo-chip--next"
                      onClick={() => onSelectCard(ritualTarget)}
                    >
                      <span>ใช้สำหรับอัญเชิญ:</span>
                      <strong>
                        {ritualTarget.setCode} {ritualTarget.name}
                      </strong>
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const VIEWS = [
  { id: 'gallery', label: '🃏 คลังการ์ด' },
  { id: 'deck', label: '🗂️ จัดสำรับ' },
  { id: 'battle', label: '⚔️ ต่อสู้' },
]

function App() {
  const [view, setView] = useState('gallery')
  // เปิดหน้าต่อสู้ครั้งแรกแล้วให้ค้างไว้ สลับแท็บกลับมาเกมยังอยู่
  const [battleOpened, setBattleOpened] = useState(false)
  // สำรับที่จัดไว้ (เก็บในเบราว์เซอร์) · battleKey เปลี่ยน = เริ่มเกมใหม่ด้วยสำรับที่เลือก
  const [deckStore, setDeckStore] = useState(loadDeckStore)
  const [battleKey, setBattleKey] = useState(0)
  const activeDeck = findDeck(deckStore, deckStore.activeId)

  const updateDecks = (next) => {
    setDeckStore(next)
    saveDeckStore(next)
  }

  const switchView = (id) => {
    setView(id)
    if (id === 'battle') setBattleOpened(true)
  }

  const playDeck = (id) => {
    updateDecks({ ...deckStore, activeId: id })
    setBattleKey((k) => k + 1)
    switchView('battle')
  }

  return (
    <div className={`app${view === 'battle' ? ' app--battle' : ''}`}>
      <nav className="view-tabs" aria-label="เลือกหน้า">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`view-tabs__btn${view === v.id ? ' view-tabs__btn--active' : ''}`}
            aria-current={view === v.id ? 'page' : undefined}
            onClick={() => switchView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {battleOpened && (
        <div className="view-panel" hidden={view !== 'battle'}>
          <BattleScreen
            key={battleKey}
            active={view === 'battle'}
            deckList={activeDeck.main}
            extraDeckList={activeDeck.extra}
            aiDecks={PRESET_DECKS}
          />
        </div>
      )}
      {view === 'gallery' && <GalleryView />}
      {view === 'deck' && <DeckBuilder store={deckStore} onChange={updateDecks} onPlay={playDeck} />}
    </div>
  )
}

function GalleryView() {
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedElement, setSelectedElement] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCard, setActiveCard] = useState(null)

  const filteredCards = useMemo(() => {
    return CARDS.filter((card) => {
      if (selectedGroup !== 'all') {
        if (selectedGroup === 'spell-trap') {
          const isSpellOrTrap =
            card.groupTag === 'spell-trap' ||
            card.type === 'spell' ||
            card.type === 'trap' ||
            card.type === 'ritual'
          if (!isSpellOrTrap) return false
        } else if (card.groupTag !== selectedGroup) {
          return false
        }
      }
      if (selectedType !== 'all' && card.type !== selectedType) return false
      if (selectedElement !== 'all') {
        const matchesPrimary = card.element === selectedElement
        const matchesSecondary = card.secondaryElements?.includes(selectedElement)
        if (!matchesPrimary && !matchesSecondary) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const haystack = `${card.name} ${card.nameEn} ${card.setCode} ${card.effectText} ${card.flavorText}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [selectedGroup, selectedType, selectedElement, searchQuery])

  return (
    <>
      <header className="app__header">
        <p className="app__eyebrow">ไพ่ไทย TCG · คลังการ์ดต้นแบบ</p>
        <h1 className="app__title">ชุดปฐมบท: ตำนานหิมพานต์และกองทัพอยุธยา</h1>
        <p className="app__subtitle">
          การ์ดต้นแบบ {CARDS.length} ใบ · 4 ประเภทการ์ด · 8 ธาตุ · ระบบแตกสายวิวัฒนาการและผสานร่างข้ามเผ่า
        </p>
      </header>

      <section className="gallery-controls" aria-label="ตัวกรองคลังการ์ด">
        <div className="filter-row">
          {Object.values(CARD_GROUPS).map((grp) => (
            <button
              key={grp.id}
              type="button"
              className={`filter-btn${selectedGroup === grp.id ? ' filter-btn--active' : ''}`}
              onClick={() => setSelectedGroup(grp.id)}
            >
              <span>{grp.name} ({CARDS.filter((card) => grp.id === 'all' || (grp.id === 'spell-trap' ? card.type !== 'monster' : card.groupTag === grp.id)).length})</span>
            </button>
          ))}
        </div>

        <div className="filter-subrow">
          <div className="filter-group">
            <span className="filter-label">ประเภท:</span>
            <button
              type="button"
              className={`chip-btn${selectedType === 'all' ? ' chip-btn--active' : ''}`}
              onClick={() => setSelectedType('all')}
            >
              ทั้งหมด
            </button>
            {Object.values(CARD_TYPES).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip-btn${selectedType === t.id ? ' chip-btn--active' : ''}`}
                onClick={() => setSelectedType(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-label">ธาตุ:</span>
            <button
              type="button"
              className={`chip-btn${selectedElement === 'all' ? ' chip-btn--active' : ''}`}
              onClick={() => setSelectedElement('all')}
            >
              ทุกธาตุ
            </button>
            {Object.values(ELEMENTS).map((el) => (
              <button
                key={el.id}
                type="button"
                className={`chip-btn chip-btn--element${
                  selectedElement === el.id ? ' chip-btn--active' : ''
                }`}
                onClick={() => setSelectedElement(el.id)}
                title={`ธาตุ${el.name}`}
              >
                <ElementSeal elementId={el.id} size={15} />
                <span>{el.name}</span>
              </button>
            ))}
          </div>

          <div className="search-box">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อการ์ด, รหัส TH01, ความสามารถ..."
              className="search-input"
            />
          </div>
        </div>
      </section>

      <div className="gallery-status">
        <span>
          แสดงการ์ด <strong>{filteredCards.length}</strong> จาก <strong>{CARDS.length}</strong> ใบ
          (คลิกที่การ์ดเพื่อดูรายละเอียดระบบธาตุ/เผ่าและสายวิวัฒนาการ)
        </span>
        {(selectedGroup !== 'all' ||
          selectedType !== 'all' ||
          selectedElement !== 'all' ||
          searchQuery) && (
          <button
            type="button"
            className="reset-btn"
            onClick={() => {
              setSelectedGroup('all')
              setSelectedType('all')
              setSelectedElement('all')
              setSearchQuery('')
            }}
          >
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>

      <main className="app__stage">
        {filteredCards.map((card) => (
          <MonsterCard
            key={card.id}
            card={card}
            onClick={(c) => setActiveCard(c)}
            isSelected={activeCard?.id === card.id}
          />
        ))}
      </main>

      <CardInspectorModal
        card={activeCard}
        onClose={() => setActiveCard(null)}
        onSelectCard={(c) => setActiveCard(c)}
      />
    </>
  )
}

export default App

