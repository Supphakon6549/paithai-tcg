import { CARDS } from './cards'

// การ์ดมอนสเตอร์ทั้งหมดจากชุดปฐมบท (TH01) + การ์ดโปรโมดั้งเดิม (NAB-001)
export const PROMO_MONSTERS = [
  {
    id: 'nab-001',
    setCode: 'NAB-001',
    name: 'พญานาคราช',
    nameEn: 'Phaya Naga Raj',
    type: 'monster',
    level: 7,
    element: 'water',
    tribe: 'reptile',
    summonType: 'tribute',
    tributeCount: 2,
    atk: 2600,
    def: 2200,
    rarity: 'emerald',
    image: '/cards/th01-010.jpg',
    groupTag: 'promo',
    effectText:
      '(สังเวย 2 ใบ) เมื่ออัญเชิญสำเร็จ: มอนสเตอร์ธาตุอัคนี 🔥 ของศัตรูทั้งหมดสูญเสีย ATK 500 • เทิร์นละครั้ง: อัญเชิญพิเศษมอนสเตอร์ธาตุวารี Lv 4 หรือต่ำกว่าจากสุสาน',
    flavorText:
      'จอมราชันแห่งบาดาล ผู้ปกครองสายน้ำทุกสายใต้ปฐพี เกล็ดของมันแวววาวราวมรกตที่ไม่เคยผ่านการเจียระไน กล่าวกันว่าเมื่อพญานาคราชโบกหาง คลื่นทะเลทั้งเจ็ดจะสงบนิ่งด้วยความเกรงกลัว',
  },
]

export const MONSTERS = [
  ...CARDS.filter((c) => c.type === 'monster'),
  ...PROMO_MONSTERS,
]

export const getMonsterById = (id) => MONSTERS.find((card) => card.id === id)
