import { describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { getAiAction } from './ai'
import { describeSide, resolveBattle } from './battle'
import { getAtkBoosts, hasAmbush } from './effects'
import { applyAction, getFieldAtk } from './game'
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
