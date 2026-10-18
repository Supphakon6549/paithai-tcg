import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  fusionProblem,
  getReadyAttackers,
  getSummonableHand,
  handCardBlocker,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const SPELL = 'th01-013' // คาถาผสานธาตุจักรวาล
const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const extraUid = (s, cardId, player = PLAYER) => s.players[player].extraDeck.find((c) => c.cardId === cardId).uid
const graveIds = (s, player = PLAYER) => s.players[player].graveyard.map((c) => c.cardId)
// วางมอนสเตอร์ผสานร่างลงสนามโดยตรง (สำหรับทดสอบเอฟเฟกต์)
const placeFusion = (s, player, zone, cardId) => {
  s.players[player].field[zone] = {
    uid: `${player}-f${zone}`, cardId, hasAttacked: false, summonedTurn: 1, position: 'attack', faceDown: false,
  }
  return s
}

describe('ผสานร่างด้วยคาถาผสานธาตุจักรวาล', () => {
  it('ทหาร + ม้าศึกจากมือ → แม่ทัพขี่ม้าศึก ท่าโจมตี ไม่เสียสิทธิ์อัญเชิญ และตีได้เลย', () => {
    const s = makeState({ player: { hand: [SPELL, 'th01-016', 'th01-019', 'th01-001'] } })
    const after = act(s, {
      type: 'playSpell', uid: handUid(s, PLAYER, 0), fusionTarget: extraUid(s, 'th01-021'),
      tributes: [handUid(s, PLAYER, 1), handUid(s, PLAYER, 2)],
    })
    const p = after.players.player
    expect(p.field[0]).toMatchObject({ cardId: 'th01-021', position: 'attack', faceDown: false })
    expect(graveIds(after)).toEqual(['th01-016', 'th01-019', SPELL])
    expect(p.extraDeck.map((c) => c.cardId).filter((id) => id.startsWith('th01'))).toEqual(['th01-012', 'th01-022'])
    expect(p.hasNormalSummoned).toBe(false)
    expect(getSummonableHand(after, PLAYER).map((c) => c.cardId)).toEqual(['th01-001'])
    expect(lastLog(after).text).toBe(
      '🌀 คุณใช้ คาถาผสานธาตุจักรวาล → อัญเชิญผสานร่าง แม่ทัพขี่ม้าศึก (ระดับ 6 · ATK 2,400 / DEF 1,900) ลงช่องที่ 1'
    )
    expect(lastLog(after).details[0]).toBe('วัตถุดิบ: พลทหารอาสา (ระดับ 2 · มือ) + ม้าศึกอาชาไนย (ระดับ 3 · มือ)')
    const battle = act(after, { type: 'enterBattle' })
    expect(getReadyAttackers(battle, PLAYER).map((m) => m.cardId)).toEqual(['th01-021'])
  })

  it('ใช้วัตถุดิบจากสนามได้ (รวมการ์ดคว่ำ) และร่างผสานลงช่องที่ว่างลง', () => {
    const s = makeState({
      player: { hand: [SPELL, 'th01-019'], field: [{ id: 'th01-017', position: 'defense', faceDown: true }] },
    })
    const after = act(s, {
      type: 'playSpell', uid: handUid(s, PLAYER, 0), fusionTarget: extraUid(s, 'th01-021'),
      tributes: [uidAt(s, PLAYER, 0), handUid(s, PLAYER, 1)],
    })
    expect(after.players.player.field[0].cardId).toBe('th01-021')
  })

  it('วัตถุดิบไม่ตรงสูตร / ไม่มีวัตถุดิบ / สนามเต็ม → ใช้ไม่ได้', () => {
    // ลูกพราน + ทหารเสือ: ไม่ตรงสูตรใดเลย (ลูกพราน + ม้าศึก ผสานเป็นพรานขี่เสือ TH03 ได้)
    const wrong = makeState({ player: { hand: [SPELL, 'th01-001', 'th01-017'] } })
    expect(
      fusionProblem(wrong, PLAYER, handUid(wrong, PLAYER, 0), extraUid(wrong, 'th01-021'), [handUid(wrong, PLAYER, 1), handUid(wrong, PLAYER, 2)])
    ).toBe('วัตถุดิบไม่ตรงสูตร: มอนสเตอร์เผ่าทหารหาญ + ม้าศึกอาชาไนย')
    expect(handCardBlocker(wrong, PLAYER, handUid(wrong, PLAYER, 0))).toBe('ยังไม่มีวัตถุดิบครบสำหรับมอนสเตอร์ผสานร่างในกองพิเศษ')

    const full = makeState({ player: { hand: [SPELL, 'th01-016', 'th01-019'], field: Array(5).fill('th01-004') } })
    expect(
      fusionProblem(full, PLAYER, handUid(full, PLAYER, 0), extraUid(full, 'th01-021'), [handUid(full, PLAYER, 1), handUid(full, PLAYER, 2)])
    ).toBe('ไม่มีช่องมอนสเตอร์ว่างให้อัญเชิญ')
  })

  it('จอมทัพยุทธหัตถีต้องใช้ทหารหาญระดับ 4 ขึ้นไป + ช้างศึก', () => {
    const ok = makeState({ player: { hand: [SPELL, 'th01-017', 'th01-020'] } })
    expect(
      fusionProblem(ok, PLAYER, handUid(ok, PLAYER, 0), extraUid(ok, 'th01-022'), [handUid(ok, PLAYER, 1), handUid(ok, PLAYER, 2)])
    ).toBeNull()
    const low = makeState({ player: { hand: [SPELL, 'th01-016', 'th01-020'] } })
    expect(
      fusionProblem(low, PLAYER, handUid(low, PLAYER, 0), extraUid(low, 'th01-022'), [handUid(low, PLAYER, 1), handUid(low, PLAYER, 2)])
    ).toContain('วัตถุดิบไม่ตรงสูตร')
  })

  it('ผสานพญาครุฑ + พญานาค → ครุฑนาคา และจั่วเพิ่ม 1 ใบ', () => {
    const s = makeState({ player: { hand: [SPELL, 'th01-009', 'th01-010'], deck: ['th01-001', 'th01-002'] } })
    const after = act(s, {
      type: 'playSpell', uid: handUid(s, PLAYER, 0), fusionTarget: extraUid(s, 'th01-012'),
      tributes: [handUid(s, PLAYER, 1), handUid(s, PLAYER, 2)],
    })
    expect(after.players.player.field[0].cardId).toBe('th01-012')
    expect(after.players.player.hand.map((c) => c.cardId)).toEqual(['th01-001'])
    expect(lastLog(after).details).toContain('ผสานพญาครุฑ + พญานาค จั่วเพิ่ม 1 ใบ')
  })
})

describe('เอฟเฟกต์มอนสเตอร์ผสานร่าง', () => {
  it('แม่ทัพขี่ม้าศึก ตีทะลุเต็มจำนวน', () => {
    // 2,400 ตีสามเณรตั้งรับ DEF 1,500 → ศัตรูเสีย 900
    const s = placeFusion(
      makeState({ phase: 'battle', ai: { field: [{ id: 'th01-005', position: 'defense', faceDown: false }] } }),
      PLAYER, 0, 'th01-021'
    )
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(after.players.ai.lp).toBe(8000 - 900)
  })

  it('จอมทัพยุทธหัตถี ไม่ถูกทำลายจากการต่อสู้ แต่เจ้าของเสีย LP', () => {
    // ครุฑนาคา 3,200 ตีจอมทัพที่ถูกลด ATK ชั่วคราว 1,000: 3,000 − 1,000 + 300 (ปฐวีชนะอาสนี) = 2,300
    let s = makeState({ activePlayer: AI, phase: 'battle' })
    s = placeFusion(placeFusion(s, AI, 0, 'th01-012'), PLAYER, 0, 'th01-022')
    s.players.player.field[0].tempAtk = [{ amount: -1000, reason: 'ทดสอบ' }]
    const after = applyAction(s, { type: 'attack', player: AI, attackerUid: 'ai-f0', targetUid: 'player-f0' })
    expect(after.players.player.field[0].cardId).toBe('th01-022')
    expect(after.players.player.lp).toBe(8000 - 900)
    expect(lastLog(after).details.some((d) => d.includes('จอมทัพยุทธหัตถี คชสารศึก ไม่ถูกทำลาย (กันการทำลายจากการต่อสู้)'))).toBe(true)
  })

  it('จอมทัพยุทธหัตถี ทำลายศัตรูหงายหน้าที่ ATK ต่ำกว่า 1 ตัว เทิร์นละครั้ง', () => {
    const s = placeFusion(makeState({ ai: { field: ['th01-017', { id: 'th01-011', position: 'defense', faceDown: true }] } }), PLAYER, 0, 'th01-022')
    const after = act(s, { type: 'activate', uid: 'player-f0', targetUid: uidAt(s, AI, 0) })
    expect(after.players.ai.field[0]).toBeNull()
    expect(lastLog(after).details).toEqual(['ATK 1,700 < 3,000 → ทหารเสือดาบสองมือ ถูกทำลาย (เอฟเฟกต์)'])
    expect(activationBlocker(after, PLAYER, 'player-f0')).toBe('ใช้ความสามารถไปแล้วเทิร์นนี้')
    // การ์ดคว่ำเลือกไม่ได้
    expect(() => act(s, { type: 'activate', uid: 'player-f0', targetUid: uidAt(s, AI, 1) })).toThrow('ATK ต่ำกว่า')
  })

  it('ครุฑนาคา ทำลายเวท/กับดักของศัตรูทั้งหมด', () => {
    const s = placeFusion(
      makeState({ ai: { spellTrap: [{ id: 'th05-008' }, { id: 'th05-008' }], fieldSpell: 'th05-007' } }),
      PLAYER, 0, 'th01-012'
    )
    const after = act(s, { type: 'activate', uid: 'player-f0' })
    expect(after.players.ai.spellTrap.every((t) => t === null)).toBe(true)
    expect(after.players.ai.fieldSpell).toBeNull()
    expect(graveIds(after, AI)).toEqual(['th05-008', 'th05-008', 'th05-007'])
    const none = placeFusion(makeState(), PLAYER, 0, 'th01-012')
    expect(activationBlocker(none, PLAYER, 'player-f0')).toBe('ฝ่ายตรงข้ามไม่มีการ์ดเวท/กับดัก')
  })
})

describe('AI ผสานร่าง', () => {
  it('ผสานเมื่อมีวัตถุดิบครบ และร่างใหม่แรงกว่า', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: [SPELL, 'th01-016', 'th01-019'] } })
    expect(getAiAction(s)).toEqual({
      type: 'playSpell', player: AI, uid: handUid(s, AI, 0), fusionTarget: extraUid(s, 'th01-021', AI),
      tributes: [handUid(s, AI, 1), handUid(s, AI, 2)],
    })
  })
})
