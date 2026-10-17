// เผ่า (Tribes) — GDD.md § 🏹 ระบบเผ่า (Tribe System)
// weakAgainst: เผ่าที่เผ่านี้เสียเปรียบ (ATK +200 ให้ฝั่งตรงข้ามเมื่อปะทะ)
export const ANIMAL_TRIBES = {
  bird: { id: 'bird', symbol: '🦅', name: 'นก', group: 'animal', weakAgainst: 'largeBeast' },
  largeBeast: { id: 'largeBeast', symbol: '🐘', name: 'สัตว์ใหญ่', group: 'animal', weakAgainst: 'reptile' },
  reptile: { id: 'reptile', symbol: '🐍', name: 'สัตว์เลื้อยคลาน', group: 'animal', weakAgainst: 'plant' },
  plant: { id: 'plant', symbol: '🌿', name: 'พืช', group: 'animal', weakAgainst: 'insect' },
  insect: { id: 'insect', symbol: '🦟', name: 'แมลง', group: 'animal', weakAgainst: 'bird' },
}

export const SPIRIT_TRIBES = {
  demon: { id: 'demon', symbol: '👹', name: 'อสูร', group: 'spirit', weakAgainst: 'ghost' },
  ghost: { id: 'ghost', symbol: '💀', name: 'วิญญาณ', group: 'spirit', weakAgainst: 'deva' },
  deva: { id: 'deva', symbol: '👼', name: 'เทวดา', group: 'spirit', weakAgainst: 'demon' },
}

// เผ่ามนุษย์ — Neutral แต่มี Synergy (ไม่มีวงจร weakness)
export const HUMAN_TRIBES = {
  warrior: { id: 'warrior', symbol: '⚔️', name: 'ทหารหาญ', group: 'human' },
  astrologer: { id: 'astrologer', symbol: '🔮', name: 'โหราจารย์', group: 'human' },
  healer: { id: 'healer', symbol: '🌿', name: 'หมอยา', group: 'human' },
  royalty: { id: 'royalty', symbol: '👑', name: 'ราชวงศ์', group: 'human' },
  performer: { id: 'performer', symbol: '🎭', name: 'โขน', group: 'human' },
  hunter: { id: 'hunter', symbol: '🏹', name: 'พรานป่า', group: 'human' },
  merchant: { id: 'merchant', symbol: '⛵', name: 'พ่อค้าสำเภา', group: 'human' },
  artisan: { id: 'artisan', symbol: '🔨', name: 'ช่างหลวง', group: 'human' },
}

export const TRIBES = { ...ANIMAL_TRIBES, ...SPIRIT_TRIBES, ...HUMAN_TRIBES }

export const TRIBE_ADVANTAGE_BONUS = 200
