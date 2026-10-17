import cardsData from './cards.json'
import { ELEMENTS, ELEMENT_ADVANTAGE_BONUS } from './elements'
import { TRIBES, TRIBE_ADVANTAGE_BONUS } from './tribes'

export const CARDS = cardsData

export const CARD_TYPES = {
  monster: { id: 'monster', symbol: '⚔️', name: 'มอนสเตอร์', nameEn: 'Monster' },
  spell: { id: 'spell', symbol: '📜', name: 'เวทมนตร์', nameEn: 'Spell' },
  trap: { id: 'trap', symbol: '🪤', name: 'กับดัก', nameEn: 'Trap' },
  ritual: { id: 'ritual', symbol: '🙏', name: 'พิธีกรรม', nameEn: 'Ritual' },
}

export const SUMMON_TYPES = {
  normal: { id: 'normal', label: 'อัญเชิญปกติ (Normal)', badge: 'อัญเชิญปกติ', desc: 'ระดับ 1–4 วางลงสนามได้ทันที' },
  tribute: { id: 'tribute', label: 'อัญเชิญสังเวย (Tribute)', badge: 'สังเวย', desc: 'ระดับ 5–6 สังเวย 1 ใบ / ระดับ 7+ สังเวย 2 ใบ' },
  ritual: { id: 'ritual', label: 'อัญเชิญพิธีกรรม (Ritual)', badge: 'พิธีกรรม', desc: 'ใช้การ์ดพิธีกรรม + เครื่องสังเวยตามระดับเลเวล' },
  fusion: { id: 'fusion', label: 'อัญเชิญผสานร่าง (Fusion)', badge: 'ผสานร่าง', desc: 'ผสานมอนสเตอร์วัตถุดิบ 2 ตัวด้วยคาถาผสาน' },
  spirit: { id: 'spirit', label: 'อัญเชิญวิญญาณ (Spirit)', badge: 'น้ำมนต์', desc: 'อัญเชิญพิเศษจากสุสานด้วยการ์ดน้ำมนต์' },
}

export const CARD_GROUPS = {
  all: { id: 'all', name: 'ทั้งหมด (15 ใบ)', icon: '🃏' },
  'xp-hunter': { id: 'xp-hunter', name: 'สายเก็บประสบการณ์ (พรานป่า)', icon: '🏹' },
  'ritual-faith': { id: 'ritual-faith', name: 'สายพิธีกรรม (พุทธคุณ)', icon: '🙏' },
  'himmapan-fusion': { id: 'himmapan-fusion', name: 'สายผสานร่าง & ตำนานหิมพานต์', icon: '⚡' },
  'spell-trap': { id: 'spell-trap', name: 'เวทมนตร์ & กับดัก', icon: '📜' },
}

export const getCardById = (id) => CARDS.find((card) => card.id === id)

/**
 * ตรวจสอบความได้เปรียบธาตุ (ATK +300) และเผ่า (ATK +200)
 */
export function getCardMatchupInfo(card) {
  const primaryElement = ELEMENTS[card.element]
  const allElementIds = [card.element, ...(card.secondaryElements || [])]

  // ธาตุที่เราชนะ (+300)
  const strongElements = allElementIds
    .map((elId) => ELEMENTS[elId]?.strongAgainst)
    .filter(Boolean)
    .map((targetId) => ELEMENTS[targetId])

  // ธาตุที่ชนะธาตุหลักของเรา
  const weakElement = Object.values(ELEMENTS).find(
    (el) => el.strongAgainst === card.element
  )

  // เผ่าที่เราชนะ (+200) และเผ่าที่ชนะเรา
  let strongTribe = null
  let weakTribe = null
  const tribe = card.tribe ? TRIBES[card.tribe] : null

  if (tribe) {
    // ใน tribes.js: weakAgainst หมายถึงเผ่าที่เผ่านี้ชนะ (เช่น นก -> แมลง -> พืช -> สัตว์เลื้อยคลาน -> สัตว์ใหญ่ -> นก)
    // ตาม GDD: นก -> แมลง -> พืช -> สัตว์เลื้อยคลาน -> สัตว์ใหญ่ -> นก และ อสูร -> วิญญาณ -> เทวดา -> อสูร
    const TRIBE_BEATS_MAP = {
      bird: 'insect',
      insect: 'plant',
      plant: 'reptile',
      reptile: 'largeBeast',
      largeBeast: 'bird',
      demon: 'ghost',
      ghost: 'deva',
      deva: 'demon',
    }
    const beatsId = TRIBE_BEATS_MAP[card.tribe]
    if (beatsId) strongTribe = TRIBES[beatsId]

    const beatenByEntry = Object.entries(TRIBE_BEATS_MAP).find(
      ([, target]) => target === card.tribe
    )
    if (beatenByEntry) weakTribe = TRIBES[beatenByEntry[0]]
  }

  return {
    primaryElement,
    strongElements,
    weakElement,
    elementBonus: ELEMENT_ADVANTAGE_BONUS,
    tribe,
    strongTribe,
    weakTribe,
    tribeBonus: TRIBE_ADVANTAGE_BONUS,
  }
}
