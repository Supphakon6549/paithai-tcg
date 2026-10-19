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
 *   noDirectAttack         โจมตีตรงไม่ได้
 *   attackingBoost         ATK เพิ่มเฉพาะตอนเป็นฝ่ายโจมตี (รวมโจมตีตรง)
 *   battleDamageReduction  ลดความเสียหายจากการต่อสู้ที่ใบนี้ปะทะ (หักหลังตัวคูณอื่น ต่ำสุด 0)
 *   buffSpell              เวทบัฟ ATK มอนสเตอร์หงายของเรา 1 ตัวจนจบเทิร์น
 *   graveyardBoost         ATK +per ต่อมอนสเตอร์ที่ matches ในสุสานเรา (สูงสุด max)
 *   shroud                 ศัตรูเลือกใบนี้เป็นเป้าความสามารถไม่ได้ ขณะ isActive({ allies })
 *   attackGuard            ศัตรูโจมตีผีหงายตัวอื่นของเรา → ย้ายเป้ามาที่ใบนี้ (ใบละครั้ง/เทิร์น) และรอดการต่อสู้นั้น
 *   returnOnDestroy        ถูกทำลายจากสนาม → กลับท่าตั้งรับหงายตอนจบเทิร์นนั้น (ใบละครั้ง/เกม)
 *   flyOver                ศัตรูไม่มีมอนสเตอร์หงาย (มีแต่คว่ำ) → โจมตีตรงได้
 *   growth                 แต้มเติบโต: +1 ตอนจบเทิร์นเจ้าของ (สูงสุด cap) · ATK/DEF +atkPer/defPer ต่อแต้ม
 *   rootShield             จะถูกทำลายจากการต่อสู้ → ถอนแต้มเติบโต 1 แทน
 *   onSummonCall           อัญเชิญหงาย: เรียกมอนสเตอร์ที่ matches จากมือ (ชื่อละครั้ง/เทิร์น)
 *   onSummonLook           อัญเชิญหงาย: ดูบนกอง count ใบ เลือกที่ matches ขึ้นมือ ที่เหลือไว้ใต้กอง
 *   sting                  ถูกทำลายจากการต่อสู้ตอนเป็นฝ่ายรับ → ผู้โจมตี ATK amount จนจบเทิร์น
 *   deathCurse             ถูกทำลายจากการต่อสู้ → คำสาปใส่ตัวที่ทำลาย: mode 'destroy' (ทำลายตาม) | 'halve' (ATK เหลือครึ่งถาวร)
 *   ambushFlip             ถูกโจมตีจนพลิกหงาย → เปลี่ยนเป็นท่าโจมตีได้ (+bonus เมื่อมีสัตว์ต่างเผ่า)
 *   huntBonus              โจมตีมอนสเตอร์หงายที่ ATK สูงสุดฝ่ายศัตรู → ATK +amount เฉพาะการต่อสู้นั้น
 *   mount / dismount       ร่างขี่: ขึ้นขี่จากคน+สัตว์บนสนาม (ไม่ต้องใช้เวท) · ถูกทำลาย → คืนวัตถุดิบ 1 ตัว
 *   mercy                  ศัตรูเผ่าสัตว์โจมตีสัตว์ตัวอื่นของเรา → ยกเลิกได้ (ชื่อละครั้ง/เทิร์น)
 *   endTurnGrow            จบเทิร์นเรา: พืชของเรา 1 ตัวเติบโต +1 แล้วฟื้น LP heal
 *   growthSpell            เวท: พืชทุกตัวของเราเติบโต +amount แล้วจั่ว draw ใบ
 *   burnOnKill             ทำลายศัตรูจากการต่อสู้ → ผู้ควบคุมศัตรูเสีย LP amount (ความเสียหายจากเอฟเฟกต์)
 *   millOnKill             ทำลายศัตรูจากการต่อสู้ → เลือกส่งมอนสเตอร์ที่ matches จากกองลงสุสาน 1 ใบ
 *   summonOnlyBy           อัญเชิญได้ด้วยการ์ดรหัสนี้เท่านั้น (ไม่อัญเชิญสังเวย/คืนชีพ)
 *   branchSpell            เวทเปิดสายมืด: สังเวยต้นสายหงาย → อัญเชิญพิเศษร่างที่คู่กันจากมือ
 *   noBattleDamageVsTribe  เจ้าของไม่รับความเสียหายจากการต่อสู้ที่ใบนี้ปะทะเผ่านี้
 *   halveBattleDamage      เจ้าของรับความเสียหายจากการต่อสู้ครึ่งเดียว (ปัดลง)
 *   destroysTribeAfterBattle  หลังคำนวณความเสียหาย ทำลายคู่ต่อสู้เผ่านี้
 *   noTributeIf            อัญเชิญสังเวยได้โดยไม่ต้องสังเวยเมื่อเงื่อนไขเป็นจริง
 *   trapLock               เมื่อใบนี้ประกาศโจมตี ศัตรูเปิดกับดักไม่ได้
 *   attackDecay            หลังประกาศโจมตีแต่ละครั้ง ATK ลดลงสะสมตาม penalties (ค้างจนออกจากสนาม)
 *                          ไม่ลดเมื่อ protectedBy คืนเหตุผล · เวทสนามระบุฝ่ายด้วย fieldSpell.faction
 *   fusionSpell            การ์ดเวทผสานร่าง (bonusDraw: จั่วเพิ่มเมื่อผสานเป็นการ์ดที่ระบุ)
 *   fusionMaterials        มอนสเตอร์ผสานร่าง: วัตถุดิบ 2 ตัว [{ label, matches(card) }]
 *   battleIndestructible   ไม่ถูกทำลายจากการต่อสู้ (เจ้าของยังเสีย LP ตามปกติ)
 *   onSummonSearch         อัญเชิญปกติหงายหน้าสำเร็จ: ค้นการ์ดที่ matches จากกองขึ้นมือ (เลือกได้)
 *   ritualLevel            นับระดับเป็นค่าอื่นเมื่อสังเวยให้พิธีกรรมกลุ่มที่ระบุ
 *   specialSummon          อัญเชิญพิเศษจากมือโดยสังเวยการ์ดที่ระบุบนสนาม (+จั่ว)
 *   protectsFromEffects    มอนสเตอร์ฝ่ายเราไม่ถูกทำลายจากเอฟเฟกต์ · endTurnHeal ฟื้น LP เมื่อจบเทิร์นของเรา
 *   reviveOnGrave          ตกสุสานจากสนาม: เจ้าของเลือกจ่าย LP หรือทิ้งการ์ดที่ระบุ เพื่อคืนชีพ (ใบละครั้ง/เกม)
 *   reviveSpell            เวทคืนชีพมอนสเตอร์จากสุสานเรา
 *   equip                  เวทสวมใส่: บัฟ ATK, เพิ่มธาตุ, แต้มประสบการณ์เพิ่ม
 *   continuousTrap         กับดักต่อเนื่อง: เปิดหงายค้างไว้ ให้ออร่า ATK/DEF (+ drumFusion)
 *   evolve                 สายประสบการณ์: ทำลายศัตรูจากการต่อสู้ได้แต้มละ 1 · ครบ xpNeeded
 *                          แล้วเทิร์นถัดไปของเรากดเลื่อนยศเป็น into (จากมือหรือกองการ์ด)
 *   activated              ความสามารถที่ผู้เล่นกดใช้เองในเฟสหลัก (มอนสเตอร์หงายบนสนาม)
 *                          kind: 'heal' | 'debuff' | 'destroySpellsTraps' | 'destroyWeaker'
 *                                (debuff + discardCost: false = ไม่ต้องทิ้งการ์ด)
 *                                | 'bind' (ห้ามโจมตี/เปลี่ยนท่าถึงจบเทิร์นศัตรูถัดไป)
 *                                | 'drain' (เป้า −amount · ตัวเอง +amount จนจบเทิร์น)
 *                                | 'curse' (ถูกทำลายก่อนหมดอายุ → ผู้ควบคุมเสีย LP amount)
 *                                | 'vine' (ถอนแต้มเติบโต · ศัตรู ATK amount ถึงจบเทิร์นถัดไปของศัตรู)
 *                                | 'growthBuff' (ถอนแต้มพืช · สัตว์ใหญ่ของเรา ATK/DEF +amount)
 *                                | 'scout' (ดูเวท/กับดักคว่ำศัตรู · ใบนั้นเปิดตอนใบนี้โจมตีไม่ได้)
 *                                | 'lockAttack' | 'searchTrap'
 *                          oncePer: 'card' (ใบละครั้ง) | 'name' (ชื่อละครั้ง) ต่อเทิร์น
 *   fieldSpell.aura        เวทสนาม: ปรับ ATK มอนสเตอร์หงายฝ่ายเจ้าของที่เข้าเงื่อนไข
 *   ritual.substitutes     การ์ดพิธีกรรม: มอนสเตอร์ที่สังเวยใบเดียวแทนระดับรวมทั้งหมดได้
 *                          (มอนสเตอร์เป้าหมายและระดับที่ต้องใช้อ่านจาก targetMonsterId / requiredLevel)
 *   trap                   กับดัก: เงื่อนไขเปิดใช้และผล
 */

const tribesOf = (card) => [card.tribe, card.secondaryTribe].filter(Boolean)
const hasTribe = (id) => (card) => tribesOf(card).includes(id)
const inTribeGroup = (group) => (card) => tribesOf(card).some((t) => TRIBES[t]?.group === group)

const isAnimal = inTribeGroup('animal')
const isWarrior = hasTribe('warrior')
const isDeva = hasTribe('deva')
const isDemon = hasTribe('demon')
const isHunter = hasTribe('hunter')
const isLargeBeast = hasTribe('largeBeast')
const isGhost = hasTribe('ghost')
const isInsect = hasTribe('insect')
const isPlant = hasTribe('plant')
const ANIMAL_TRIBES = ['bird', 'insect', 'plant', 'reptile', 'largeBeast']
// เผ่าสัตว์ของการ์ด (เผ่ามนุษย์ไม่นับ)
export const animalSetOf = (card) => tribesOf(card).filter((t) => ANIMAL_TRIBES.includes(t))
// มีสัตว์อย่างน้อย 2 ตัวที่เผ่าสัตว์ไม่ทับกัน (ตัวเดียวสองเผ่าไม่นับ)
const hasDiverseAnimals = (cards) => {
  const sets = cards.filter((c) => c.type === 'monster').map(animalSetOf).filter((set) => set.length > 0)
  return sets.some((a, i) => sets.some((b, j) => j > i && !a.some((t) => b.includes(t))))
}
const isTiger = (c) => c.id === 'th03-006' || c.id === 'th03-007'
// คนเป็น ๆ สำหรับขึ้นขี่: มีเผ่ามนุษย์ที่กำหนด และไม่มีเผ่าผี/อสูรติดอยู่ (ปอบ กระสือ พรานไสยเวท ขี่ไม่ได้)
const livingHuman = (tribe) => (c) => hasTribe(tribe)(c) && !hasTribe('ghost')(c) && !hasTribe('demon')(c)
const hasGhostAlly = ({ allies }) => allies.some(isGhost)
const isHolyWater = (c) => c.id === 'th01-014' || (c.spellSubtypeName ?? '').includes('น้ำมนต์')

export const CARD_EFFECTS = {
  // ลูกพราน
  'th01-001': {
    evolve: { xpNeeded: 2, into: 'th01-002' },
  },
  // พรานหนุ่ม
  'th01-002': {
    evolve: { xpNeeded: 3, into: 'th01-003' },
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
    activated: { kind: 'searchTrap', label: 'ค้นหากับดัก 1 ใบจากกอง', oncePer: 'card' },
  },
  // เด็กวัด
  'th01-004': {
    onSummonSearch: {
      label: 'การ์ดพิธีกรรมหรือน้ำมนต์',
      matches: (c) => c.type === 'ritual' || isHolyWater(c),
    },
    ritualLevel: { forGroup: 'ritual-faith', level: 2 },
  },
  // พระอาจารย์
  'th01-006': {
    activated: {
      kind: 'lockAttack',
      label: 'ห้ามศัตรูเผ่าอสูร/วิญญาณโจมตีเทิร์นหน้า',
      oncePer: 'card',
      targets: (c) => hasTribe('demon')(c) || hasTribe('ghost')(c),
    },
  },
  // ครูบาศรีวิชัย
  'th01-007': {
    protectsFromEffects: { reason: 'ครูบาศรีวิชัย: มอนสเตอร์ฝ่ายเราไม่ถูกทำลายจากเอฟเฟกต์' },
    endTurnHeal: { amount: 500, reason: 'ครูบาศรีวิชัย: ฟื้น LP เมื่อจบเทิร์น' },
  },
  // พญานาคานอนบาดาล
  'th01-010': {
    reviveOnGrave: { lpCost: 500, altCostCardId: 'th01-014', position: 'defense' },
  },
  // ม้าศึกอาชาไนย
  'th01-019': {
    onSummonSearch: {
      label: 'มอนสเตอร์เผ่าทหารหาญระดับ 4 หรือต่ำกว่า',
      matches: (c) => c.type === 'monster' && isWarrior(c) && c.level <= 4,
    },
  },
  // น้ำมนต์ธรณีสาร (เวทคืนชีพ)
  'th01-014': {
    reviveSpell: { position: 'attack', excludeSummonTypes: ['fusion', 'ritual'], darkImmune: true },
  },
  // ขวากหนามอาคมพราน (กับดัก)
  'th01-015': {
    trap: {
      trigger: 'enemyAttacks',
      effect: 'thorns',
      destroyIfAlly: isHunter,
      reason: 'ขวากหนามอาคมพราน: ตัวที่โจมตีถูกเปลี่ยนเป็นท่าตั้งรับ การโจมตีถูกยกเลิก',
    },
  },
  // ดาบฟ้าฟื้นเหล็กน้ำพี้ (เวทสวมใส่)
  'th01-023': {
    equip: { appliesTo: isWarrior, atk: 500, addElement: 'lightning', xpBonus: 1, reason: 'ดาบฟ้าฟื้นเหล็กน้ำพี้' },
  },
  // กลองศึกสะท้านแผ่นดิน (กับดักต่อเนื่อง)
  'th01-024': {
    continuousTrap: {
      aura: { amount: 300, appliesTo: (c) => isWarrior(c) || isLargeBeast(c), reason: 'กลองศึกสะท้านแผ่นดิน' },
      drumFusion: { pair: [isWarrior, isLargeBeast] },
    },
  },
  // สามเณร
  'th01-005': {
    noBattleDamageVsTribe: { tribe: 'ghost', reason: 'สามเณร: ไม่รับความเสียหายจากการต่อสู้กับเผ่าวิญญาณ' },
    specialSummon: { tributeId: 'th01-004', draw: 1, label: 'สังเวยเด็กวัดบนสนาม · จั่ว 1 ใบ' },
  },
  // พญาครุฑเวนไตย
  'th01-009': {
    destroysTribeAfterBattle: { tribe: 'reptile', reason: 'พญาครุฑเวนไตยทำลายเผ่าสัตว์เลื้อยคลานหลังการต่อสู้' },
  },
  // อสูรทศกัณฐ์จำแลง: ตีแรงในจังหวะแรก แล้วร่างจำแลงค่อย ๆ อ่อนแรง
  'th01-011': {
    piercing: { ratio: 0.5, reason: 'ตีทะลุครึ่งหนึ่งของส่วนต่าง' },
    attackDecay: {
      penalties: [200, 300, 400], // ATK ที่หายไปสะสม หลังโจมตีครั้งที่ 1, 2, 3+ (1,800 → 1,600 → 1,500 → 1,400)
      reason: 'ร่างจำแลงอ่อนแรง',
      protectedBy: ({ allies, fieldSpell }) => {
        if (allies.some(isDemon)) return 'มีมอนสเตอร์เผ่าอสูรตัวอื่นบนสนาม'
        if (effectOf(fieldSpell).fieldSpell?.faction === 'demon') return 'มีเวทสนามฝ่ายอสูร'
        return null
      },
    },
  },
  // พลทหารอาสา
  'th01-016': {
    evolve: { xpNeeded: 1, into: 'th01-017' },
  },
  // ทหารเสือดาบสองมือ
  'th01-017': {
    evolve: { xpNeeded: 2, into: 'th01-018' },
    extraAttack: {
      reason: 'ศัตรูมีมอนสเตอร์มากกว่าเรา',
      isActive: ({ allyCount, enemyCount }) => enemyCount > allyCount,
    },
  },
  // ขุนศึกอาทมาฏ (ไม่รวมตัวเอง)
  'th01-018': {
    allyAura: { amount: 300, appliesTo: isWarrior, reason: 'ขุนศึกอาทมาฏ: ทหารหาญตัวอื่นฝ่ายเรา' },
    trapLock: { reason: 'ขุนศึกอาทมาฏ: ศัตรูเปิดกับดักไม่ได้เมื่อใบนี้โจมตี' },
  },
  // พิธีบรรพชาและบารมีธรรม → ครูบาศรีวิชัย (สังเวยพระอาจารย์ใบเดียวแทนได้)
  'th01-008': {
    ritual: { substitutes: ['th01-006'] },
  },
  // เทวบริบาลเมฆา: ผู้เตรียมพิธีบวงสรวง
  'th05-001': {
    ritualLevel: { forGroup: 'celestial-court', level: 4 },
  },
  // เทวทหารอาสนี: สายฟ้าฟาดซ้ำ
  'th05-002': {
    burnOnKill: { amount: 300, reason: 'เทวทหารอาสนี: สายฟ้าฟาดซ้ำ' },
  },
  // กินนรีขับลำนำฟ้า
  'th05-003': {
    activated: {
      kind: 'heal',
      amount: 300,
      label: 'ฟื้น LP 300',
      oncePer: 'card',
      isReady: ({ allies }) => allies.some(isDeva),
      notReadyReason: 'ต้องมีมอนสเตอร์เผ่าเทวดาใบอื่นหงายหน้าบนสนามเรา',
    },
  },
  // พระอินทร์ จอมอาสนี
  'th05-005': {
    activated: {
      kind: 'debuff',
      amount: -500,
      label: 'ทิ้ง 1 ใบ · ลด ATK ศัตรู 500',
      oncePer: 'name',
      reason: 'พระอินทร์ จอมอาสนี: ATK −500 จนจบเทิร์น',
    },
  },
  // พิธีบวงสรวงจอมเทวา → พระอินทร์ (สังเวยเอราวัณใบเดียวแทนได้)
  'th05-006': {
    ritual: { substitutes: ['th05-004'] },
  },
  // วิมานเหนือเมฆ (เวทสนาม)
  'th05-007': {
    fieldSpell: { aura: { amount: 200, appliesTo: isDeva, reason: 'วิมานเหนือเมฆ: เผ่าเทวดาฝ่ายเรา' } },
  },
  // ม่านอาสนีพิทักษ์ (กับดัก)
  'th05-008': {
    trap: {
      trigger: 'enemyAttacksFaceUp',
      effect: 'negate',
      appliesTo: isDeva,
      reason: 'ม่านอาสนีพิทักษ์: ยกเลิกการโจมตีมอนสเตอร์เผ่าเทวดา',
    },
  },
  // ---------- TH04 อสูรสงคราม (docs/TH04-DESIGN.md) ----------
  // พลโล่ลงกา
  'th04-001': {
    battleDamageReduction: { amount: 300, reason: 'พลโล่ลงกา: ลดความเสียหายจากการต่อสู้ 300' },
  },
  // ยักษ์คบเพลิง
  'th04-002': {
    attackingBoost: { amount: 300, reason: 'ยักษ์คบเพลิง: เป็นฝ่ายโจมตี' },
  },
  // อสูรมนตราควัน
  'th04-003': {
    activated: {
      kind: 'debuff',
      amount: -200,
      discardCost: false,
      label: 'ลด ATK ศัตรู 200',
      oncePer: 'card',
      reason: 'อสูรมนตราควัน: ATK −200 จนจบเทิร์น',
    },
  },
  // ขุนยักษ์ดาบอัคนี
  'th04-004': {
    atkBoosts: [
      { amount: 200, reason: 'มีเผ่าอสูรตัวอื่นบนสนามเรา', isActive: ({ allies }) => allies.some(isDemon) },
    ],
  },
  // กุมภกรรณ ผู้ค้ำแนวรบ
  'th04-005': {
    piercing: { ratio: 0.5, reason: 'ตีทะลุครึ่งหนึ่งของส่วนต่าง' },
  },
  // อินทรชิต ศรเพลิงลงกา
  'th04-006': {
    noDirectAttack: { reason: 'อินทรชิต: โจมตีตรงไม่ได้' },
    extraAttack: {
      reason: 'มีเผ่าอสูรตัวอื่นบนสนามเรา',
      isActive: ({ allies }) => allies.some(isDemon),
    },
  },
  // กรุงลงกา (เวทสนามฝ่ายอสูร)
  'th04-007': {
    fieldSpell: { faction: 'demon', aura: { amount: 200, appliesTo: isDemon, reason: 'กรุงลงกา: เผ่าอสูรฝ่ายเรา' } },
  },
  // มนต์ปลุกเพลิงอสูร
  'th04-008': {
    buffSpell: { amount: 400, appliesTo: isDemon, reason: 'มนต์ปลุกเพลิงอสูร: ATK +400 จนจบเทิร์น' },
  },
  // ม่านควันลงกา (กับดัก)
  'th04-009': {
    trap: {
      trigger: 'enemyAttacksFaceUp',
      effect: 'weaken',
      amount: -500,
      appliesTo: isDemon,
      reason: 'ม่านควันลงกา: ผู้โจมตี ATK −500 จนจบเทิร์น',
    },
  },
  // ---------- TH06 ผีไทย (docs/TH06-DESIGN.md) ----------
  // ผีเรือนเฝ้าชาน
  'th06-001': {
    attackGuard: { reason: 'ผีเรือนเฝ้าชาน: รับการโจมตีแทน และไม่ถูกทำลายจากการต่อสู้ครั้งนี้' },
  },
  // กุมารทองนำทาง
  'th06-002': {
    onSummonSearch: {
      label: 'มอนสเตอร์เผ่าวิญญาณระดับ 1–4 (ชื่ออื่น)',
      matches: (c) => c.type === 'monster' && isGhost(c) && c.level <= 4 && c.id !== 'th06-002',
      oncePerName: true,
      alsoOnRevive: true,
    },
  },
  // นางตานีม่านใบ
  'th06-003': {
    atkBoosts: [{ amount: 200, reason: 'มีผีตัวอื่นหงายบนสนามเรา', isActive: hasGhostAlly }],
    shroud: { isActive: hasGhostAlly, reason: 'นางตานี: ศัตรูเลือกเป็นเป้าไม่ได้ขณะมีผีตัวอื่น' },
  },
  // ผีกองกอยย่องไพร
  'th06-004': {
    graveyardBoost: { per: 100, max: 300, matches: isGhost, reason: 'ผีกองกอย: ผีในสุสานเรา' },
  },
  // นางตะเคียนพิทักษ์ไพร
  'th06-005': {
    activated: { kind: 'bind', label: 'รากพันธนาการ: ห้ามโจมตี/เปลี่ยนท่า', oncePer: 'card' },
  },
  // แม่นาคคำมั่นนิรันดร์
  'th06-006': {
    shroud: { isActive: hasGhostAlly, reason: 'แม่นาค: ศัตรูเลือกเป็นเป้าไม่ได้ขณะมีผีตัวอื่น' },
    returnOnDestroy: { reason: 'แม่นาค: คำมั่นที่กลับมา' },
  },
  // ปอบเงาสิง
  'th06-007': {
    activated: { kind: 'drain', amount: 300, label: 'ดูดพลัง ATK 300', oncePer: 'card' },
  },
  // กระสือแสงหลง
  'th06-008': {
    flyOver: { reason: 'กระสือบินผ่านความมืด: ศัตรูไม่มีมอนสเตอร์หงาย' },
  },
  // พรานไสยเวท
  'th06-009': {
    summonOnlyBy: 'th06-012',
    millOnKill: { matches: (c) => c.type === 'monster' && isGhost(c), label: 'มอนสเตอร์เผ่าวิญญาณ' },
  },
  // อาจารย์ไสยดำ
  'th06-010': {
    summonOnlyBy: 'th06-012',
    activated: { kind: 'curse', amount: 500, label: 'สาปศัตรู (ตาย = เสีย 500 LP)', oncePer: 'card' },
  },
  // ป่าช้าวัดร้าง (เวทสนามฝ่ายผี)
  'th06-011': {
    fieldSpell: { faction: 'ghost', aura: { amount: 200, appliesTo: isGhost, reason: 'ป่าช้าวัดร้าง: ผีฝ่ายเรา' } },
  },
  // คำสาปพันธะเงา
  'th06-012': {
    branchSpell: {
      pairs: [
        { from: 'th01-002', to: 'th06-009' },
        { from: 'th01-006', to: 'th06-010' },
      ],
    },
  },
  // ---------- TH03 ไพรมหาวัน (docs/TH03-DESIGN.md) ----------
  // ต้นไทรเดินดิน
  'th03-001': {
    growth: { cap: 3, atkPer: 200, defPer: 200 },
    rootShield: { reason: 'ต้นไทร: รากลึก ถอนแต้มเติบโตแทนการถูกทำลาย' },
  },
  // เถาหวายร้อยรัด
  'th03-002': {
    growth: { cap: 2, atkPer: 0, defPer: 200 },
    activated: { kind: 'vine', amount: -300, label: 'ถอนแต้ม · รัดศัตรู ATK −300', oncePer: 'card' },
  },
  // ด้วงกว่างเกราะไพร (ออร่าไม่ซ้อนจากหลายใบ)
  'th03-003': {
    allyAura: { amount: 200, appliesTo: isInsect, unique: true, reason: 'ด้วงกว่างเกราะไพร: แมลงตัวอื่นฝ่ายเรา' },
  },
  // ฝูงต่อหัวเสือ
  'th03-004': {
    onSummonCall: {
      label: 'แมลงระดับ 1–2',
      matches: (c) => c.type === 'monster' && isInsect(c) && c.level <= 2,
    },
    sting: { amount: -300, reason: 'ฝูงต่อ: เหล็กใน' },
  },
  // นกเงือกผู้หว่านไพร
  'th03-005': {
    onSummonLook: { count: 3, matches: (c) => c.type === 'monster' && animalSetOf(c).length > 0, label: 'สัตว์' },
  },
  // พญาเสือโคร่งมหาวัน: จ่าฝูง นับเผ่าสัตว์ของเพื่อนที่ต่างจากใบนี้
  'th03-006': {
    atkBoosts: [
      {
        reason: 'จ่าฝูง: เผ่าสัตว์ต่างกันบนสนามเรา',
        isActive: () => true,
        amountFn: ({ allies }) => {
          const kinds = new Set(allies.flatMap(animalSetOf).filter((t) => t !== 'largeBeast'))
          return 200 * Math.min(3, kinds.size)
        },
      },
    ],
  },
  // เสือสมิงเงาพฤกษ์
  'th03-007': {
    ambushFlip: { bonus: 200, reason: 'เสือสมิง: พลิกซุ่มพร้อมสัตว์ต่างเผ่า' },
  },
  // หมอช้างพันธะไพร
  'th03-008': {
    activated: { kind: 'growthBuff', amount: 300, label: 'ถอนแต้มพืช · สัตว์ใหญ่ ATK/DEF +300', oncePer: 'name' },
  },
  // พรานผู้ผูกมิตร: คืนลูกพรานขึ้นมือ → อัญเชิญพิเศษ แล้วเรียกสัตว์เล็กเผ่าที่ยังไม่มี
  'th03-009': {
    specialSummon: {
      returnId: 'th01-001',
      oncePerName: true,
      label: 'คืนลูกพรานขึ้นมือ · เรียกสัตว์เล็กมาช่วย',
      callAfter: {
        label: 'สัตว์ระดับ 1–2 เผ่าที่ยังไม่มีบนสนาม',
        matches: (c) => c.type === 'monster' && animalSetOf(c).length > 0 && c.level <= 2,
        newTribeOnly: true,
      },
    },
  },
  // ไพรมหาวัน (เวทสนามฝ่ายป่า)
  'th03-010': {
    fieldSpell: {
      faction: 'forest',
      aura: {
        amount: 200,
        appliesTo: (c) => animalSetOf(c).length > 0,
        isActive: ({ team }) => hasDiverseAnimals(team),
        reason: 'ไพรมหาวัน: สัตว์ต่างเผ่าอยู่ร่วมกัน',
      },
    },
  },
  // ฝนแรกผลิใบ
  'th03-011': {
    growthSpell: { amount: 1, draw: 1 },
  },
  // สับแนวพงไพร (กับดัก)
  'th03-012': {
    trap: {
      trigger: 'enemyAttacksFaceUp',
      effect: 'swap',
      appliesTo: (c) => animalSetOf(c).length > 0,
      reason: 'สับแนวพงไพร: ถอนสัตว์ขึ้นมือ ส่งตัวใหม่ลงแทน การโจมตีจบลง',
    },
  },
  // พรานขี่เสือ
  'th03-013': {
    fusionMaterials: [
      { label: 'มนุษย์เผ่าพรานป่า (ไม่ใช่ผี/อสูร)', matches: livingHuman('hunter') },
      { label: 'สัตว์ใหญ่', matches: hasTribe('largeBeast') },
    ],
    mount: true,
    dismount: true,
    huntBonus: { amount: 300, reason: 'พรานขี่เสือ: ไล่ล่าจ่าฝูง' },
  },
  // หลวงตาธุดงค์ทรงพยัคฆ์ (ตัวละครสมมุติ)
  'th03-014': {
    fusionMaterials: [
      { label: 'สายศรัทธา (เด็กวัด/สามเณร/พระอาจารย์/ครูบา)', matches: (c) => c.groupTag === 'ritual-faith' && c.type === 'monster' },
      { label: 'เสือ (พญาเสือ/เสือสมิง)', matches: isTiger },
    ],
    mount: true,
    dismount: true,
    mercy: { reason: 'หลวงตาธุดงค์: เมตตาหยุดเขี้ยว' },
  },
  // หมอช้างทรงคชสาร
  'th03-015': {
    fusionMaterials: [
      { label: 'มนุษย์เผ่าหมอยา (ไม่ใช่ผี/อสูร)', matches: livingHuman('healer') },
      { label: 'สัตว์ใหญ่', matches: hasTribe('largeBeast') },
    ],
    mount: true,
    dismount: true,
    endTurnGrow: { amount: 1, heal: 200, reason: 'หมอช้างทรงคชสาร: ฟื้นราก' },
  },
  // โหราจารย์ทรงนกเงือก
  'th03-016': {
    fusionMaterials: [
      { label: 'มนุษย์เผ่าโหราจารย์ (ไม่ใช่ผี/อสูร)', matches: livingHuman('astrologer') },
      { label: 'นก', matches: hasTribe('bird') },
    ],
    mount: true,
    dismount: true,
    activated: { kind: 'scout', label: 'ดูกับดักคว่ำศัตรู 1 ใบ', oncePer: 'name' },
  },
  // ช้างศึกไอยรา
  'th01-020': {
    noTributeIf: { reason: 'มีมอนสเตอร์เผ่าทหารหาญบนสนาม', isActive: ({ allies }) => allies.some(isWarrior) },
    halveBattleDamage: { reason: 'ช้างศึกไอยรา: ลดความเสียหายจากการต่อสู้ครึ่งหนึ่ง' },
  },
  // คาถาผสานธาตุจักรวาล (เวทผสานร่าง)
  'th01-013': {
    fusionSpell: { bonusDraw: { forFusion: 'th01-012', count: 1, reason: 'ผสานพญาครุฑ + พญานาค จั่วเพิ่ม 1 ใบ' } },
  },
  // ครุฑนาคา มหาเทพประสาน (ธาตุรองอัคนี/วารีอยู่ในข้อมูลการ์ดแล้ว)
  'th01-012': {
    fusionMaterials: [
      { label: 'พญาครุฑเวนไตย', matches: (c) => c.id === 'th01-009' },
      { label: 'พญานาคานอนบาดาล', matches: (c) => c.id === 'th01-010' },
    ],
    activated: {
      kind: 'destroySpellsTraps',
      label: 'ทำลายเวท/กับดักศัตรูทั้งหมด',
      oncePer: 'card',
    },
  },
  // แม่ทัพขี่ม้าศึก
  'th01-021': {
    fusionMaterials: [
      { label: 'มอนสเตอร์เผ่าทหารหาญ', matches: (c) => isWarrior(c) },
      { label: 'ม้าศึกอาชาไนย', matches: (c) => c.id === 'th01-019' },
    ],
    piercing: { ratio: 1, reason: 'ตีทะลุเต็มจำนวน' },
  },
  // จอมทัพยุทธหัตถี คชสารศึก (นับเป็นเผ่าทหารหาญและสัตว์ใหญ่ — อยู่ในข้อมูลการ์ดแล้ว)
  'th01-022': {
    fusionMaterials: [
      { label: 'ขุนศึกอาทมาฏ หรือทหารหาญระดับ 4 ขึ้นไป', matches: (c) => isWarrior(c) && c.level >= 4 },
      { label: 'ช้างศึกไอยรา', matches: (c) => c.id === 'th01-020' },
    ],
    battleIndestructible: true,
    activated: {
      kind: 'destroyWeaker',
      label: 'ทำลายศัตรูที่ ATK ต่ำกว่า 1 ตัว',
      oncePer: 'card',
    },
  },
}

const effectOf = (card) => CARD_EFFECTS[card?.id] ?? {}

/**
 * ตัวปรับ ATK ทั้งหมดที่ทำงานอยู่กับ card: บัฟตัวเอง + ออร่าจากเพื่อน + ออร่าจากศัตรู
 * (ใช้ทั้งตอนโจมตี ตั้งรับด้วย ATK และโจมตีตรง — ไม่บวกเข้า DEF)
 */
/*
 * extras = {
 *   fieldSpell: การ์ดเวทสนามของเจ้าของ (หรือ null),
 *   temp: [{ amount, reason }] ตัวปรับบนตัวมอนสเตอร์ (ชั่วคราว/อ่อนแรง),
 *   equips: [การ์ดเวทสวมใส่ที่ติดอยู่], continuous: [กับดักต่อเนื่องหงายของเจ้าของ],
 * }
 */
const toModifier = ({ amount, reason }) => ({ kind: 'effect', label: 'เอฟเฟกต์', amount, reason })

// ออร่าที่บวกได้ทั้ง ATK และ DEF (กับดักต่อเนื่อง)
const continuousAuras = (card, extras) =>
  (extras.continuous ?? []).map((t) => effectOf(t).continuousTrap?.aura).filter((aura) => aura?.appliesTo(card))

export function getAtkBoosts(card, allies = [], enemies = [], extras = {}) {
  const own = (effectOf(card).atkBoosts ?? [])
    .filter((b) => b.isActive({ allies, enemies }))
    .map((b) => (b.amountFn ? { ...b, amount: b.amountFn({ allies, enemies }) } : b))
    .filter((b) => b.amount !== 0)
  // ออร่า unique (เช่น ด้วงกว่าง) ให้ผลครั้งเดียวแม้มีหลายใบ
  const seenUnique = new Set()
  const fromAllies = allies
    .map((a) => effectOf(a).allyAura && { ...effectOf(a).allyAura, sourceId: a.id })
    .filter((aura) => aura?.appliesTo(card))
    .filter((aura) => !aura.unique || (!seenUnique.has(aura.sourceId) && seenUnique.add(aura.sourceId)))
  const fromEnemies = enemies.map((e) => effectOf(e).enemyAura).filter((aura) => aura?.appliesTo(card))
  const fieldAura = effectOf(extras.fieldSpell).fieldSpell?.aura
  const fieldActive = !fieldAura?.isActive || fieldAura.isActive({ team: [card, ...allies] })
  const fromField = fieldAura?.appliesTo(card) && fieldActive ? [fieldAura] : []
  const growth = effectOf(card).growth
  const fromGrowth =
    growth?.atkPer && extras.growth ? [{ amount: growth.atkPer * extras.growth, reason: `แต้มเติบโต ${extras.growth}` }] : []
  const fromEquips = (extras.equips ?? [])
    .map((e) => effectOf(e).equip)
    .filter((eq) => eq?.appliesTo(card))
    .map((eq) => ({ amount: eq.atk, reason: eq.reason }))
  const gy = effectOf(card).graveyardBoost
  const gyCount = gy ? (extras.graveyard ?? []).filter((c) => c.type === 'monster' && gy.matches(c)).length : 0
  const fromGraveyard = gyCount
    ? [{ amount: Math.min(gy.max, gy.per * gyCount), reason: `${gy.reason} ${gyCount} ใบ` }]
    : []
  return [
    ...own,
    ...fromGrowth,
    ...fromGraveyard,
    ...fromAllies,
    ...fromEnemies,
    ...fromField,
    ...fromEquips,
    ...continuousAuras(card, extras),
    ...(extras.temp ?? []),
  ].map(toModifier)
}

// ตัวปรับ DEF จากเอฟเฟกต์: กับดักต่อเนื่อง + แต้มเติบโต + ตัวปรับ DEF บนตัวมอนสเตอร์
export function getDefBoosts(card, extras = {}) {
  const growth = effectOf(card).growth
  const fromGrowth =
    growth?.defPer && extras.growth ? [{ amount: growth.defPer * extras.growth, reason: `แต้มเติบโต ${extras.growth}` }] : []
  return [...continuousAuras(card, extras), ...fromGrowth, ...(extras.defTemp ?? [])].map(toModifier)
}

// ธาตุที่ได้เพิ่มจากเวทสวมใส่
export function getEquipElements(extras = {}) {
  return (extras.equips ?? []).map((e) => effectOf(e).equip?.addElement).filter(Boolean)
}

export function getEffectiveAtk(card, allies = [], enemies = [], extras = {}) {
  const total = getAtkBoosts(card, allies, enemies, extras).reduce((sum, b) => sum + b.amount, 0)
  return Math.max(0, card.atk + total)
}

export function getActivated(card) {
  return effectOf(card).activated ?? null
}

export function hasTrapLock(card) {
  return effectOf(card).trapLock ?? null
}

export function getTrapEffect(card) {
  return effectOf(card).trap ?? null
}

export function isFieldSpell(card) {
  return Boolean(effectOf(card).fieldSpell)
}

// ข้อมูลพิธีกรรม: { target, requiredLevel, substitutes } หรือ null ถ้าไม่ใช่การ์ดพิธีกรรม
export function getRitualInfo(card) {
  if (card?.type !== 'ritual' || !card.targetMonsterId) return null
  return {
    target: card.targetMonsterId,
    requiredLevel: card.requiredLevel ?? 8,
    substitutes: effectOf(card).ritual?.substitutes ?? [],
  }
}

// การ์ดเวท/กับดัก/พิธีกรรมที่ระบบเกมรองรับแล้ว (ใบอื่นยังกดใช้ไม่ได้)
export function getOnSummonSearch(card) {
  return effectOf(card).onSummonSearch ?? null
}

// ระดับที่นับเมื่อใช้ card เป็นเครื่องสังเวยให้การ์ดพิธีกรรม ritualCard
export function getRitualLevel(card, ritualCard) {
  const override = effectOf(card).ritualLevel
  return override && ritualCard?.groupTag === override.forGroup ? override.level : card.level
}

export function getSpecialSummon(card) {
  return effectOf(card).specialSummon ?? null
}

export function getEffectProtection(card) {
  return effectOf(card).protectsFromEffects ?? null
}

export function getEndTurnHeal(card) {
  return effectOf(card).endTurnHeal ?? null
}

export function getReviveOnGrave(card) {
  return effectOf(card).reviveOnGrave ?? null
}

export function getReviveSpell(card) {
  return effectOf(card).reviveSpell ?? null
}

export function getEquip(card) {
  return effectOf(card).equip ?? null
}

export function getContinuousTrap(card) {
  return effectOf(card).continuousTrap ?? null
}

export function getBuffSpell(card) {
  return effectOf(card).buffSpell ?? null
}

export function getAttackingBoost(card) {
  return effectOf(card).attackingBoost ?? null
}

export function hasNoDirectAttack(card) {
  return Boolean(effectOf(card).noDirectAttack)
}

export const cardHasTribe = (card, tribe) => hasTribe(tribe)(card)

export function getShroud(card) {
  return effectOf(card).shroud ?? null
}

export function getAttackGuard(card) {
  return effectOf(card).attackGuard ?? null
}

export function getReturnOnDestroy(card) {
  return effectOf(card).returnOnDestroy ?? null
}

export function getFlyOver(card) {
  return effectOf(card).flyOver ?? null
}

export function getBurnOnKill(card) {
  return effectOf(card).burnOnKill ?? null
}

export function getMillOnKill(card) {
  return effectOf(card).millOnKill ?? null
}

export function getSummonOnlyBy(card) {
  return effectOf(card).summonOnlyBy ?? null
}

export const getGrowth = (card) => effectOf(card).growth ?? null
export const hasRootShield = (card) => effectOf(card).rootShield ?? null
export const getOnSummonCall = (card) => effectOf(card).onSummonCall ?? null
export const getOnSummonLook = (card) => effectOf(card).onSummonLook ?? null
export const getSting = (card) => effectOf(card).sting ?? null
export const getDeathCurse = (card) => effectOf(card).deathCurse ?? null
export const getAmbushFlip = (card) => effectOf(card).ambushFlip ?? null
export const getHuntBonus = (card) => effectOf(card).huntBonus ?? null
export const canMount = (card) => effectOf(card).mount === true
export const canDismount = (card) => effectOf(card).dismount === true
export const getMercy = (card) => effectOf(card).mercy ?? null
export const getEndTurnGrow = (card) => effectOf(card).endTurnGrow ?? null
export const getGrowthSpell = (card) => effectOf(card).growthSpell ?? null
export const isPlantCard = isPlant
export const hasDiverseAnimalTeam = hasDiverseAnimals

export function getBranchSpell(card) {
  return effectOf(card).branchSpell ?? null
}

export function isPlayableNonMonster(card) {
  if (card?.type === 'spell') {
    return (
      isFieldSpell(card) ||
      Boolean(
        getFusionSpell(card) ||
          getReviveSpell(card) ||
          getEquip(card) ||
          getBuffSpell(card) ||
          getBranchSpell(card) ||
          getGrowthSpell(card)
      )
    )
  }
  if (card?.type === 'trap') return Boolean(getTrapEffect(card) || getContinuousTrap(card))
  if (card?.type === 'ritual') return Boolean(getRitualInfo(card))
  return false
}

export function hasAmbush(card) {
  return effectOf(card).ambush === true
}

export function getPiercing(card) {
  return effectOf(card).piercing ?? null
}

export function getFusionSpell(card) {
  return effectOf(card).fusionSpell ?? null
}

export function getFusionMaterials(card) {
  return effectOf(card).fusionMaterials ?? null
}

// วัตถุดิบ 2 ใบ (การ์ดข้อมูล) ตรงกับสูตรของมอนสเตอร์ผสานร่างไหม (สลับลำดับได้)
export function matchesFusion(fusionCard, materialCards) {
  const recipe = getFusionMaterials(fusionCard)
  if (!recipe || materialCards.length !== 2) return false
  const [a, b] = materialCards
  return (recipe[0].matches(a) && recipe[1].matches(b)) || (recipe[0].matches(b) && recipe[1].matches(a))
}

export function isBattleIndestructible(card) {
  return effectOf(card).battleIndestructible === true
}

export function getAttackDecay(card) {
  return effectOf(card).attackDecay ?? null
}

export function getEvolve(card) {
  return effectOf(card).evolve ?? null
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
  const fmt = (n) => n.toLocaleString('en-US')
  const halver = ownFieldCards.map((c) => effectOf(c).halveBattleDamage).find(Boolean)
  if (halver && amount > 0) {
    const halved = Math.floor(amount / 2)
    steps.push(`${halver.reason}: ${fmt(amount)} ÷ 2 = ${fmt(halved)}`)
    amount = halved
  }
  const flat = ownMonster && effectOf(ownMonster).battleDamageReduction
  if (flat && amount > 0) {
    const reduced = Math.max(0, amount - flat.amount)
    steps.push(`${flat.reason}: ${fmt(amount)} − ${fmt(flat.amount)} = ${fmt(reduced)}`)
    amount = reduced
  }
  return { amount, steps }
}
