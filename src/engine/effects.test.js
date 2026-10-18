import { describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { getAiAction } from './ai'
import { describeSide, resolveBattle } from './battle'
import { getAtkBoosts, hasAmbush, reduceBattleDamage } from './effects'
import { applyAction, getFieldAtk, getReadyAttackers, getTributeCost } from './game'
import { AI, PLAYER } from './rules'
import { lastLog, makeState, uidAt } from './testUtils'

const card = (id) => getCardById(id)
const HUNTER = 'th01-002' // พรานหนุ่ม ATK 1,600 ธาตุปฐวี
const BEAST = 'th01-019' // เผ่าสัตว์ใหญ่ ATK 1,200 ธาตุวายุ (ชนะปฐวี)

const attack = (s, player = PLAYER, zone = 0, targetZone = 0) =>
  applyAction(s, {
    type: 'attack',
    player,
    attackerUid: uidAt(s, player, zone),
    targetUid: targetZone === null ? null : uidAt(s, player === PLAYER ? AI : PLAYER, targetZone),
  })

describe('พรานหนุ่ม: ATK +400 เมื่อมีเผ่าสัตว์บนสนามเรา', () => {
  it('ไม่มีเผ่าสัตว์ → ไม่ได้บัฟ', () => {
    expect(getAtkBoosts(card(HUNTER), [])).toEqual([])
    expect(getAtkBoosts(card(HUNTER), [card('th01-016')])).toEqual([]) // ทหารหาญเป็นเผ่ามนุษย์
  })

  it('มีเผ่าสัตว์ → +400', () => {
    expect(getAtkBoosts(card(HUNTER), [card(BEAST)])).toEqual([
      { kind: 'effect', label: 'เอฟเฟกต์', amount: 400, reason: 'มีมอนสเตอร์เผ่าสัตว์บนสนามเรา' },
    ])
  })

  it('การ์ดอื่นไม่มีเอฟเฟกต์นี้', () => {
    expect(getAtkBoosts(card('th01-001'), [card(BEAST)])).toEqual([])
    expect(hasAmbush(card('th01-001'))).toBe(false)
  })

  it('บัฟพลิกผล: 1,600 แพ้ 1,700 แต่ 2,000 ชนะ', () => {
    const alone = makeState({ phase: 'battle', player: { field: [HUNTER] }, ai: { field: ['th01-017'] } })
    expect(attack(alone).players.player.lp).toBe(8000 - 100)

    const paired = makeState({ phase: 'battle', player: { field: [HUNTER, BEAST] }, ai: { field: ['th01-017'] } })
    expect(getFieldAtk(paired, PLAYER, uidAt(paired, PLAYER, 0))).toBe(2000)
    const after = attack(paired)
    expect(after.players.ai.lp).toBe(8000 - 300)
    expect(lastLog(after).details[0]).toBe(
      'ฝ่ายโจมตี — พรานหนุ่ม: ATK 1,600 + 400 (เอฟเฟกต์: มีมอนสเตอร์เผ่าสัตว์บนสนามเรา) = 2,000'
    )
  })

  it('บัฟทำงานตอนตั้งรับด้วย', () => {
    const s = makeState({ phase: 'battle', ai: { field: ['th01-011'] }, player: { field: [HUNTER, BEAST] } })
    const after = attack({ ...s, activePlayer: AI }, AI)
    expect(after.players.ai.field[0]).toBeNull() // 1,800 แพ้ 2,000
    expect(after.players.ai.lp).toBe(8000 - 200)
  })

  it('บัฟหายเมื่อเผ่าสัตว์ออกจากสนาม', () => {
    const s = makeState({ phase: 'battle', player: { field: [HUNTER, BEAST] }, ai: { field: ['th01-011'] } })
    // ส่งเผ่าสัตว์ไปตีตัว 1,800 แล้วถูกทำลาย
    const after = attack(s, PLAYER, 1, 0)
    expect(after.players.player.field[1]).toBeNull()
    expect(getFieldAtk(after, PLAYER, uidAt(after, PLAYER, 0))).toBe(1600)
  })

  it('โจมตีตรงใช้ ATK ที่รวมบัฟแล้ว', () => {
    const s = makeState({ phase: 'battle', player: { field: [HUNTER, BEAST] } })
    const after = attack(s, PLAYER, 0, null)
    expect(after.players.ai.lp).toBe(6000)
    expect(lastLog(after).details[0]).toBe(
      'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ → โจมตีตรงด้วย ATK 1,600 + 400 (เอฟเฟกต์: มีมอนสเตอร์เผ่าสัตว์บนสนามเรา) = 2,000'
    )
  })
})

describe('พรานหนุ่ม: ซุ่มโจมตี', () => {
  it('ตอนโจมตี ฝ่ายรับไม่ได้โบนัสธาตุ (ปกติวายุได้ +300 เมื่อเจอปฐวี)', () => {
    const r = resolveBattle(card(HUNTER), card(BEAST))
    expect(r.ambush).toBe(true)
    expect(r.defender.final).toBe(1200)
    expect(r.defender.cancelled).toEqual([expect.objectContaining({ kind: 'element', amount: 300 })])
    expect(describeSide(r.defender)).toBe(
      `${card(BEAST).name}: ATK 1,200 [ซุ่มโจมตียกเลิกธาตุ +300: ธาตุวายุ ชนะทางธาตุปฐวี] = 1,200`
    )
  })

  it('ไม่มีผลตอนถูกโจมตี', () => {
    const r = resolveBattle(card(BEAST), card(HUNTER))
    expect(r.ambush).toBe(false)
    expect(r.attacker.final).toBe(1500)
  })

  it('ไม่ยกเลิกโบนัสของฝ่ายโจมตีเอง และบันทึกแจ้งการซุ่มโจมตี', () => {
    const s = makeState({ phase: 'battle', player: { field: [HUNTER] }, ai: { field: [BEAST] } })
    const after = attack(s)
    expect(after.players.ai.lp).toBe(8000 - 400) // 1,600 − 1,200 (ไม่ใช่ 100)
    expect(lastLog(after).details[0]).toBe(
      `🏹 พรานหนุ่ม ซุ่มโจมตี! ${card(BEAST).name} ไม่ได้รับโบนัสธาตุ/เผ่า`
    )
  })

  it('ไม่แสดงบรรทัดซุ่มโจมตีเมื่อไม่มีโบนัสให้ยกเลิก', () => {
    const s = makeState({ phase: 'battle', player: { field: [HUNTER] }, ai: { field: ['th01-001'] } })
    expect(lastLog(attack(s)).details[0]).toMatch(/^ฝ่ายโจมตี/)
  })
})

describe('AI คิดเอฟเฟกต์ด้วย', () => {
  it('AI ใช้พรานหนุ่มที่ได้บัฟไปตีตัว 1,800', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: [HUNTER, BEAST] }, player: { field: ['th01-011'] } })
    expect(getAiAction(s)).toMatchObject({ type: 'attack', attackerUid: uidAt(s, AI, 0) })
  })

  it('AI รู้ว่าซุ่มโจมตีชนะเผ่าวายุได้', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: [HUNTER] }, player: { field: [BEAST] } })
    expect(getAiAction(s)).toMatchObject({ type: 'attack', targetUid: uidAt(s, PLAYER, 0) })
  })
})

const UP_DEF = (id) => ({ id, position: 'defense', faceDown: false })
const SET_DEF = (id) => ({ id, position: 'defense', faceDown: true })

describe('เจ้าพรานแห่งไพร: เผ่าสัตว์ของศัตรู ATK −300', () => {
  it('ลด ATK ม้าศึกฝั่งศัตรู และแสดงในบันทึก', () => {
    // พลทหารอาสา (อัคนี 900 +300) ตีม้าศึก (วายุ 1,200 −300)
    const s = makeState({ phase: 'battle', player: { field: ['th01-016', 'th01-003'] }, ai: { field: [BEAST] } })
    expect(getFieldAtk(s, AI, uidAt(s, AI, 0))).toBe(900)
    const after = attack(s)
    expect(lastLog(after).details[1]).toBe(
      `ฝ่ายรับ — ${card(BEAST).name}: ATK 1,200 − 300 (เอฟเฟกต์: เจ้าพรานแห่งไพร ลด ATK เผ่าสัตว์ของศัตรู) = 900`
    )
    expect(after.players.ai.lp).toBe(8000 - 300)
  })

  it('ไม่มีผลเมื่อเจ้าพรานคว่ำอยู่ หรือกับเผ่าที่ไม่ใช่สัตว์', () => {
    const hidden = makeState({ player: { field: [SET_DEF('th01-003')] }, ai: { field: [BEAST, 'th01-016'] } })
    expect(getFieldAtk(hidden, AI, uidAt(hidden, AI, 0))).toBe(1200)
    const up = makeState({ player: { field: ['th01-003'] }, ai: { field: ['th01-016'] } })
    expect(getFieldAtk(up, AI, uidAt(up, AI, 0))).toBe(900)
  })
})

describe('สามเณร: ไม่รับความเสียหายจากการต่อสู้กับเผ่าวิญญาณ', () => {
  it('ปะทะเผ่าวิญญาณ → 0', () => {
    const r = reduceBattleDamage(800, { ownMonster: card('th01-005'), opposingMonster: { tribe: 'ghost' } })
    expect(r).toEqual({ amount: 0, steps: ['สามเณร: ไม่รับความเสียหายจากการต่อสู้กับเผ่าวิญญาณ → 0'] })
  })

  it('ปะทะเผ่าอื่นรับความเสียหายปกติ', () => {
    expect(reduceBattleDamage(800, { ownMonster: card('th01-005'), opposingMonster: card('th01-011') }).amount).toBe(800)
  })
})

describe('พญาครุฑเวนไตย: ทำลายเผ่าสัตว์เลื้อยคลานหลังการต่อสู้', () => {
  it('แม้ครุฑแพ้ (2,300 vs นาค 2,100 +300) ก็ยังทำลายนาค', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-009'] }, ai: { field: ['th01-010'] } })
    const after = attack(s)
    expect(after.players.player.field[0]).toBeNull()
    expect(after.players.ai.field[0]).toBeNull()
    expect(after.players.player.lp).toBe(8000 - 100)
    const battle = after.log.findLast((e) => e.kind === 'battle')
    expect(battle.details.at(-1)).toBe('พญาครุฑเวนไตยทำลายเผ่าสัตว์เลื้อยคลานหลังการต่อสู้: พญานาคานอนบาดาล ถูกทำลาย')
    // พญานาคตกสุสาน → AI (เจ้าของ) ถูกถามว่าจะคืนชีพไหม
    expect(after.pendingChoice).toMatchObject({ player: AI, kind: 'revive' })
  })

  it('ทำงานตอนครุฑเป็นฝ่ายถูกโจมตีด้วย', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-010'] }, player: { field: ['th01-009'] } })
    const after = attack(s, AI)
    expect(after.players.ai.field[0]).toBeNull()
  })
})

describe('อสูรทศกัณฐ์จำแลง: ตีทะลุครึ่งหนึ่งของส่วนต่าง', () => {
  it('1,800 ตี DEF 600 → ศัตรูเสีย (1,800 − 600) ÷ 2 = 600', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-011'] }, ai: { field: [UP_DEF('th01-001')] } })
    const after = attack(s)
    expect(after.players.ai.field[0]).toBeNull()
    expect(after.players.ai.lp).toBe(8000 - 600)
    expect(lastLog(after).details).toContain('อสูรทศกัณฐ์จำแลง ตีทะลุครึ่งหนึ่งของส่วนต่าง: (1,800 − 600) ÷ 2 = 600')
  })

  it('ตัวอื่นตีตั้งรับไม่ทะลุ', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: [UP_DEF('th01-001')] } })
    expect(attack(s).players.ai.lp).toBe(8000)
  })
})

describe('ทหารเสือดาบสองมือ: โจมตี 2 ครั้งเมื่อศัตรูมีมอนสเตอร์มากกว่า', () => {
  it('ตีได้ครั้งที่ 2 ถ้าหลังครั้งแรกศัตรูยังมีมากกว่า และไม่เกิน 2 ครั้ง', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: ['th01-004', 'th01-005', 'th01-016'] } })
    const once = attack(s, PLAYER, 0, 0)
    expect(getReadyAttackers(once, PLAYER).map((m) => m.cardId)).toEqual(['th01-017'])
    const twice = attack(once, PLAYER, 0, 1)
    expect(lastLog(twice).details[0]).toBe('⚔️ โจมตีครั้งที่ 2: ศัตรูมีมอนสเตอร์มากกว่าเรา')
    expect(getReadyAttackers(twice, PLAYER)).toEqual([])
    expect(twice.players.ai.field.filter(Boolean)).toHaveLength(1)
  })

  it('เช็กเงื่อนไขตอนประกาศ: หลังครั้งแรกจำนวนเท่ากันแล้ว → ตีครั้งที่ 2 ไม่ได้', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: ['th01-004', 'th01-005'] } })
    const once = attack(s, PLAYER, 0, 0)
    expect(getReadyAttackers(once, PLAYER)).toEqual([])
    expect(() => attack(once, PLAYER, 0, 1)).toThrow('โจมตีไปแล้ว')
  })

  it('AI ใช้การโจมตีครั้งที่ 2 ด้วย', () => {
    let s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { field: ['th01-004', 'th01-005', 'th01-016'] } })
    s = applyAction(s, getAiAction(s))
    s = applyAction(s, getAiAction(s))
    expect(s.players.player.field.filter(Boolean)).toHaveLength(1)
  })
})

describe('ขุนศึกอาทมาฏ: ทหารหาญตัวอื่นฝ่ายเรา ATK +300', () => {
  it('บัฟพลทหารอาสา แต่ไม่บัฟตัวเอง และไม่บัฟเผ่าอื่น', () => {
    const s = makeState({ player: { field: ['th01-018', 'th01-016', 'th01-001'] } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(2500)
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 1))).toBe(1200)
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 2))).toBe(800)
  })
})

describe('ช้างศึกไอยรา', () => {
  it('มีทหารหาญบนสนาม → อัญเชิญได้โดยไม่ต้องสังเวย', () => {
    const s = makeState({ player: { hand: ['th01-020'], field: ['th01-016'] } })
    expect(getTributeCost(s, PLAYER, card('th01-020'))).toBe(0)
    const after = applyAction(s, { type: 'summon', player: PLAYER, uid: s.players.player.hand[0].uid })
    expect(after.players.player.field.map((m) => m?.cardId ?? null)).toEqual(['th01-016', 'th01-020', null, null, null])
    expect(lastLog(after).text).toContain('(ไม่ต้องสังเวย: มีมอนสเตอร์เผ่าทหารหาญบนสนาม)')
  })

  it('ไม่มีทหารหาญ (หรือทหารหาญคว่ำอยู่) → ต้องสังเวยตามปกติ', () => {
    const s = makeState({ player: { hand: ['th01-020'], field: ['th01-001', SET_DEF('th01-016')] } })
    expect(getTributeCost(s, PLAYER, card('th01-020'))).toBe(1)
  })

  it('ลดความเสียหายจากการต่อสู้ที่เจ้าของได้รับครึ่งหนึ่ง', () => {
    // AI 1,700 ตีลูกพราน 800 → ส่วนต่าง 900 → รับจริง 450
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { field: ['th01-001', 'th01-020'] } })
    const after = attack(s, AI)
    expect(after.players.player.lp).toBe(8000 - 450)
    expect(lastLog(after).details).toContain('ช้างศึกไอยรา: ลดความเสียหายจากการต่อสู้ครึ่งหนึ่ง: 900 ÷ 2 = 450')
  })

  it('คว่ำอยู่ไม่ลดความเสียหาย', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { field: ['th01-001', SET_DEF('th01-020')] } })
    expect(attack(s, AI).players.player.lp).toBe(8000 - 900)
  })
})
