import { TRIBES } from '../data/tribes'

// เอฟเฟกต์การ์ดที่ระบบต่อสู้รองรับแล้ว — อ้างอิงกติกาใน GDD.md § XP Path "คำอธิบายความสามารถ"
// allies = การ์ดมอนสเตอร์ตัวอื่นบนสนามฝ่ายเดียวกัน (ไม่รวมตัวเอง)

const isAnimal = (card) => TRIBES[card.tribe]?.group === 'animal'

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
}

// บัฟ ATK ต่อเนื่องที่ทำงานอยู่ (ใช้ทั้งตอนโจมตี ตั้งรับ และโจมตีตรง)
export function getAtkBoosts(card, allies = []) {
  const boosts = CARD_EFFECTS[card.id]?.atkBoosts ?? []
  return boosts
    .filter((b) => b.isActive({ allies }))
    .map((b) => ({ kind: 'effect', label: 'เอฟเฟกต์', amount: b.amount, reason: b.reason }))
}

export function getEffectiveAtk(card, allies = []) {
  return card.atk + getAtkBoosts(card, allies).reduce((sum, b) => sum + b.amount, 0)
}

// ซุ่มโจมตี: เมื่อเป็นฝ่ายโจมตี ฝ่ายรับไม่ได้รับโบนัสธาตุ/เผ่า
export function hasAmbush(card) {
  return CARD_EFFECTS[card.id]?.ambush === true
}
