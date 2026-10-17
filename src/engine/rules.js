// กติกาหน้าต่อสู้ขั้นที่ 1 — อ้างอิง GDD.md § ⚙️ กฎเกมหลัก
// ส่วนที่ GDD ไม่ระบุ (ตกลงกับผู้ออกแบบแล้ว):
// - ต่อสู้แบบ ATK ปะทะ ATK เท่านั้น (ยังไม่มีท่าป้องกัน)
// - โบนัสธาตุ/เผ่าได้ทั้งฝ่ายโจมตีและฝ่ายรับ ซ้อนกันได้
// - ผู้เล่นที่เริ่มก่อนไม่จั่วและโจมตีไม่ได้ในเทิร์นแรก
// - แพ้เมื่อต้องจั่วแต่กองการ์ดหมด
export const RULES = {
  startingLP: 8000,
  startingHand: 5,
  drawPerTurn: 1,
  monsterZones: 5,
  spellTrapZones: 5,
  handLimit: 6,
  maxNormalSummonLevel: 4,
}

// สำรับเริ่มต้น 40 ใบ: มอนสเตอร์ระดับ 1–4 ทั้ง 8 แบบ แบบละ 5 ใบ
export const STARTER_DECK_LIST = [
  ['th01-001', 5], // ลูกพราน 800
  ['th01-002', 5], // พรานหนุ่ม 1600
  ['th01-004', 5], // 300
  ['th01-005', 5], // 700
  ['th01-011', 5], // 1800
  ['th01-016', 5], // 900
  ['th01-017', 5], // 1700
  ['th01-019', 5], // 1200
]

// กองพิเศษ: มอนสเตอร์ผสานร่าง เก็บแยกจากกองหลัก ไม่ต้องจั่ว (ยังอัญเชิญไม่ได้ในขั้นนี้)
export const EXTRA_DECK_LIST = [
  ['th01-012', 1], // ครุฑนาคา มหาเทพประสาน
  ['th01-021', 1], // แม่ทัพขี่ม้าศึก
  ['th01-022', 1], // จอมทัพยุทธหัตถี
]

export const PLAYER = 'player'
export const AI = 'ai'

export const PLAYER_NAMES = {
  [PLAYER]: 'คุณ',
  [AI]: 'คู่ต่อสู้',
}

export const PHASE_NAMES = {
  main1: 'เฟสหลัก 1',
  battle: 'เฟสต่อสู้',
  main2: 'เฟสหลัก 2',
  discard: 'ทิ้งการ์ดเกินมือ',
  over: 'จบเกม',
}

export const opponentOf = (playerId) => (playerId === PLAYER ? AI : PLAYER)

export const formatNumber = (n) => n.toLocaleString('en-US')
