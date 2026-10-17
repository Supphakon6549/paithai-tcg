import { TRIBES } from '../data/tribes'

/*
 * เอฟเฟกต์การ์ดที่ระบบต่อสู้รองรับแล้ว — อ้างอิงกติกาใน docs/GDD.md
 * เอฟเฟกต์ทำงานเฉพาะการ์ดที่หงายอยู่บนสนาม (การ์ดคว่ำไม่นับ)
 *
 * ctx ที่ใช้เช็กเงื่อนไข:
 *   allies  = การ์ดมอนสเตอร์หงายตัวอื่นบนสนามฝ่ายเดียวกัน (ไม่รวมตัวเอง)
 *   enemies = การ์ดมอนสเตอร์หงายบนสนามฝ่ายตรงข้าม
 *
 * ชนิดเอฟเฟกต์:
 *   atkBoosts[]            บัฟ ATK ของตัวเองเมื่อเงื่อนไขเป็นจริง
 *   allyAura               ปรับ ATK มอนสเตอร์ตัวอื่นฝ่ายเราที่เข้าเงื่อนไข
 *   enemyAura              ปรับ ATK มอนสเตอร์ฝ่ายตรงข้ามที่เข้าเงื่อนไข
 *   ambush                 เมื่อโจมตี ฝ่ายรับไม่ได้โบนัสธาตุ/เผ่า
 *   piercing               ตีมอนสเตอร์ตั้งรับที่ DEF ต่ำกว่า → ความเสียหายทะลุ (สัดส่วนของส่วนต่าง)
 *   extraAttack            โจมตีเพิ่มได้อีก 1 ครั้งเมื่อเงื่อนไขเป็นจริง (เช็กตอนประกาศโจมตี)
 *   noBattleDamageVsTribe  เจ้าของไม่รับความเสียหายจากการต่อสู้ที่ใบนี้ปะทะเผ่านี้
 *   halveBattleDamage      เจ้าของรับความเสียหายจากการต่อสู้ครึ่งเดียว (ปัดลง)
 *   destroysTribeAfterBattle  หลังคำนวณความเสียหาย ทำลายคู่ต่อสู้เผ่านี้
 *   noTributeIf            อัญเชิญสังเวยได้โดยไม่ต้องสังเวยเมื่อเงื่อนไขเป็นจริง
 */

const tribesOf = (card) => [card.tribe, card.secondaryTribe].filter(Boolean)
const hasTribe = (id) => (card) => tribesOf(card).includes(id)
const inTribeGroup = (group) => (card) => tribesOf(card).some((t) => TRIBES[t]?.group === group)

const isAnimal = inTribeGroup('animal')
const isWarrior = hasTribe('warrior')

export const CARD_EFFECTS = {
  // พรานหนุ่ม
  'th01-002': {
    atkBoosts: [
      {
        amount: 400,
        reason: 'มีมอนสเตอร์เผ่าสัตว์บนสนามเรา',
        isActive: ({ allies }) => allies.some(isAnimal),
      },
    ],
    ambush: true,
  },
  // เจ้าพรานแห่งไพร
  'th01-003': {
    enemyAura: { amount: -300, appliesTo: isAnimal, reason: 'เจ้าพรานแห่งไพร ลด ATK เผ่าสัตว์ของศัตรู' },
  },
  // สามเณร
  'th01-005': {
    noBattleDamageVsTribe: { tribe: 'ghost', reason: 'สามเณร: ไม่รับความเสียหายจากการต่อสู้กับเผ่าวิญญาณ' },
  },
  // พญาครุฑเวนไตย
  'th01-009': {
    destroysTribeAfterBattle: { tribe: 'reptile', reason: 'พญาครุฑเวนไตยทำลายเผ่าสัตว์เลื้อยคลานหลังการต่อสู้' },
  },
  // อสูรทศกัณฐ์จำแลง
  'th01-011': {
    piercing: { ratio: 0.5, reason: 'ตีทะลุครึ่งหนึ่งของส่วนต่าง' },
  },
  // ทหารเสือดาบสองมือ
  'th01-017': {
    extraAttack: {
      reason: 'ศัตรูมีมอนสเตอร์มากกว่าเรา',
      isActive: ({ allyCount, enemyCount }) => enemyCount > allyCount,
    },
  },
  // ขุนศึกอาทมาฏ (ไม่รวมตัวเอง)
  'th01-018': {
    allyAura: { amount: 300, appliesTo: isWarrior, reason: 'ขุนศึกอาทมาฏ: ทหารหาญตัวอื่นฝ่ายเรา' },
  },
  // ช้างศึกไอยรา
  'th01-020': {
    noTributeIf: { reason: 'มีมอนสเตอร์เผ่าทหารหาญบนสนาม', isActive: ({ allies }) => allies.some(isWarrior) },
    halveBattleDamage: { reason: 'ช้างศึกไอยรา: ลดความเสียหายจากการต่อสู้ครึ่งหนึ่ง' },
  },
  // แม่ทัพขี่ม้าศึก (ผสานร่าง — พร้อมใช้เมื่อเปิดระบบผสานร่าง)
  'th01-021': {
    piercing: { ratio: 1, reason: 'ตีทะลุเต็มจำนวน' },
  },
}

const effectOf = (card) => CARD_EFFECTS[card?.id] ?? {}

/**
 * ตัวปรับ ATK ทั้งหมดที่ทำงานอยู่กับ card: บัฟตัวเอง + ออร่าจากเพื่อน + ออร่าจากศัตรู
 * (ใช้ทั้งตอนโจมตี ตั้งรับด้วย ATK และโจมตีตรง — ไม่บวกเข้า DEF)
 */
export function getAtkBoosts(card, allies = [], enemies = []) {
  const toModifier = ({ amount, reason }) => ({ kind: 'effect', label: 'เอฟเฟกต์', amount, reason })
  const own = (effectOf(card).atkBoosts ?? []).filter((b) => b.isActive({ allies, enemies }))
  const fromAllies = allies.map((a) => effectOf(a).allyAura).filter((aura) => aura?.appliesTo(card))
  const fromEnemies = enemies.map((e) => effectOf(e).enemyAura).filter((aura) => aura?.appliesTo(card))
  return [...own, ...fromAllies, ...fromEnemies].map(toModifier)
}

export function getEffectiveAtk(card, allies = [], enemies = []) {
  const total = getAtkBoosts(card, allies, enemies).reduce((sum, b) => sum + b.amount, 0)
  return Math.max(0, card.atk + total)
}

export function hasAmbush(card) {
  return effectOf(card).ambush === true
}

export function getPiercing(card) {
  return effectOf(card).piercing ?? null
}

export function getExtraAttack(card) {
  return effectOf(card).extraAttack ?? null
}

export function getAfterBattleDestroy(card, opponent) {
  const effect = effectOf(card).destroysTribeAfterBattle
  return effect && hasTribe(effect.tribe)(opponent) ? effect : null
}

export function getNoTributeCondition(card) {
  return effectOf(card).noTributeIf ?? null
}

/**
 * ความเสียหายจากการต่อสู้ที่เจ้าของจะได้รับ หลังผ่านเอฟเฟกต์ป้องกัน
 * ownFieldCards = การ์ดหงายบนสนามของผู้รับความเสียหาย
 * ownMonster / opposingMonster = คู่ที่ต่อสู้กัน (null เมื่อถูกโจมตีตรง)
 * คืน { amount, steps: [ข้อความอธิบายแต่ละขั้น] }
 */
export function reduceBattleDamage(amount, { ownFieldCards = [], ownMonster = null, opposingMonster = null }) {
  const steps = []
  const negate = ownMonster && effectOf(ownMonster).noBattleDamageVsTribe
  if (negate && opposingMonster && hasTribe(negate.tribe)(opposingMonster)) {
    steps.push(`${negate.reason} → 0`)
    return { amount: 0, steps }
  }
  const halver = ownFieldCards.map((c) => effectOf(c).halveBattleDamage).find(Boolean)
  if (halver && amount > 0) {
    const halved = Math.floor(amount / 2)
    steps.push(`${halver.reason}: ${amount.toLocaleString('en-US')} ÷ 2 = ${halved.toLocaleString('en-US')}`)
    return { amount: halved, steps }
  }
  return { amount, steps }
}
