import { describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { GameRuleError, applyAction, createGame, getSummonableHand } from './game'
import { AI, PLAYER, RULES } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const countCards = (p) =>
  p.deck.length + p.hand.length + p.graveyard.length + p.field.filter(Boolean).length

describe('createGame', () => {
  it('ตั้งค่าเริ่มต้นตาม GDD: LP 8,000 มือ 5 ใบ กอง 35 ใบ', () => {
    const s = createGame({ seed: 42 })
    for (const id of [PLAYER, AI]) {
      const p = s.players[id]
      expect(p.lp).toBe(8000)
      expect(p.hand).toHaveLength(5)
      expect(p.deck).toHaveLength(35)
      expect(p.field).toEqual([null, null, null, null, null])
      expect(p.spellTrap).toEqual([null, null, null, null, null])
      expect(p.fieldSpell).toBeNull()
      expect(p.extraDeck.map((c) => c.cardId)).toEqual(['th01-012', 'th01-021', 'th01-022'])
    }
    expect(s.turn).toBe(1)
    expect(s.activePlayer).toBe(PLAYER)
    expect(s.phase).toBe('main1')
  })

  it('seed เดียวกันได้ลำดับไพ่เดิม', () => {
    expect(createGame({ seed: 7 }).players).toEqual(createGame({ seed: 7 }).players)
    expect(createGame({ seed: 7 }).players.player.hand).not.toEqual(
      createGame({ seed: 8 }).players.player.hand
    )
  })
})

describe('การจั่วและเทิร์น', () => {
  it('ผู้เล่นที่เริ่มก่อนไม่จั่วในเทิร์น 1 แต่อีกฝ่ายจั่วในเทิร์น 2', () => {
    const s = createGame({ seed: 1 })
    expect(s.players.player.hand).toHaveLength(5)
    const s2 = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(s2.turn).toBe(2)
    expect(s2.activePlayer).toBe(AI)
    expect(s2.players.ai.hand).toHaveLength(6)
    expect(s2.players.ai.deck).toHaveLength(34)
    expect(lastLog(s2).text).toContain('เหลือในกอง 34 ใบ')
  })

  it('ไม่ให้ผู้เล่นทำแอ็กชันนอกเทิร์นตัวเอง', () => {
    const s = createGame({ seed: 1 })
    expect(() => applyAction(s, { type: 'endTurn', player: AI })).toThrow(GameRuleError)
  })

  it('ไม่แก้สถานะเดิม (immutable)', () => {
    const s = createGame({ seed: 1 })
    const snapshot = structuredClone(s)
    applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    expect(s).toEqual(snapshot)
  })

  it('แพ้เมื่อต้องจั่วแต่การ์ดหมดกอง', () => {
    const s = makeState({ ai: { deck: [] } })
    const s2 = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(s2.winner).toBe(PLAYER)
    expect(s2.endReason).toBe('deckOut')
    expect(s2.phase).toBe('over')
    expect(() => applyAction(s2, { type: 'endTurn', player: AI })).toThrow('เกมจบแล้ว')
  })

  it('จั่วใบสุดท้ายได้ ยังไม่แพ้', () => {
    const s = makeState({ ai: { deck: ['th01-001'] } })
    const s2 = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(s2.winner).toBeNull()
    expect(s2.players.ai.deck).toHaveLength(0)
  })
})

describe('การอัญเชิญปกติ', () => {
  it('อัญเชิญระดับ 1–4 ลงช่องว่างแรก', () => {
    const s = makeState({ player: { hand: ['th01-002'], field: ['th01-001'] } })
    const s2 = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    expect(s2.players.player.field[1].cardId).toBe('th01-002')
    expect(s2.players.player.hand).toHaveLength(0)
    expect(lastLog(s2).text).toBe('คุณอัญเชิญ พรานหนุ่ม (ระดับ 4 · ATK 1,600) ลงช่องที่ 2')
  })

  it('อัญเชิญได้เทิร์นละ 1 ตัว', () => {
    const s = makeState({ player: { hand: ['th01-001', 'th01-016'] } })
    const s2 = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    expect(getSummonableHand(s2, PLAYER)).toEqual([])
    expect(() =>
      applyAction(s2, { type: 'summon', player: PLAYER, uid: handUid(s2, PLAYER, 0) })
    ).toThrow('เทิร์นละ 1 ครั้ง')
  })

  it('สิทธิ์อัญเชิญรีเซ็ตเมื่อขึ้นเทิร์นใหม่', () => {
    const s = makeState({ activePlayer: AI, player: { hasNormalSummoned: true } })
    const s2 = applyAction(s, { type: 'endTurn', player: AI })
    expect(s2.players.player.hasNormalSummoned).toBe(false)
  })

  it('อัญเชิญระดับ 5 ขึ้นไป หรือการ์ดที่ไม่ใช่มอนสเตอร์ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th01-003', 'th01-013', 'th01-001'] } })
    expect(getSummonableHand(s, PLAYER).map((c) => c.cardId)).toEqual(['th01-001'])
    expect(() =>
      applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    ).toThrow('ระดับ 1–4')
    expect(() =>
      applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 1) })
    ).toThrow(GameRuleError)
  })

  it('อัญเชิญไม่ได้เมื่อสนามเต็ม 5 ช่อง หรืออยู่ในเฟสต่อสู้', () => {
    const full = Array(5).fill('th01-001')
    const s = makeState({ player: { hand: ['th01-016'], field: full } })
    expect(getSummonableHand(s, PLAYER)).toEqual([])
    const battle = makeState({ phase: 'battle', player: { hand: ['th01-016'] } })
    expect(() =>
      applyAction(battle, { type: 'summon', player: PLAYER, uid: handUid(battle, PLAYER, 0) })
    ).toThrow('เฟสหลัก')
  })

  it('อัญเชิญในเฟสหลัก 2 ได้ถ้ายังไม่ได้ใช้สิทธิ์', () => {
    const s = makeState({ phase: 'main2', player: { hand: ['th01-016'] } })
    const s2 = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    expect(s2.players.player.field[0].cardId).toBe('th01-016')
  })
})

describe('การโจมตี', () => {
  it('ผู้เล่นที่เริ่มก่อนโจมตีไม่ได้ในเทิร์น 1', () => {
    const s = makeState({ turn: 1, player: { field: ['th01-001'] } })
    expect(() => applyAction(s, { type: 'enterBattle', player: PLAYER })).toThrow('เทิร์นแรก')
  })

  it('ชนะการต่อสู้: ทำลายเป้าหมาย และอีกฝ่ายเสีย LP เท่าส่วนต่าง', () => {
    // วายุ 1,200 (+300) vs ปฐวี 800
    const s = makeState({ phase: 'battle', player: { field: ['th01-019'] }, ai: { field: ['th01-001'] } })
    const s2 = applyAction(s, {
      type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0),
    })
    expect(s2.players.ai.field[0]).toBeNull()
    expect(s2.players.ai.graveyard.map((c) => c.cardId)).toEqual(['th01-001'])
    expect(s2.players.ai.lp).toBe(7300)
    expect(s2.players.player.field[0].hasAttacked).toBe(true)

    const entry = lastLog(s2)
    expect(entry.kind).toBe('battle')
    expect(entry.details).toEqual([
      `ฝ่ายโจมตี — ${getCardById('th01-019').name}: ATK 1,200 + 300 (ธาตุ: ธาตุวายุ ชนะทางธาตุปฐวี) = 1,500`,
      'ฝ่ายรับ — ลูกพราน: ATK 800 (ไม่มีโบนัส) = 800',
      '1,500 > 800 → ลูกพราน ถูกทำลาย (ส่วนต่าง 1,500 − 800 = 700)',
      'คู่ต่อสู้เสีย LP 700: 8,000 − 700 = 7,300',
    ])
  })

  it('แพ้การต่อสู้: มอนสเตอร์ที่โจมตีถูกทำลาย และผู้โจมตีเสีย LP', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-001'] }, ai: { field: ['th01-017'] } })
    const s2 = applyAction(s, {
      type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0),
    })
    expect(s2.players.player.field[0]).toBeNull()
    expect(s2.players.ai.field[0]).not.toBeNull()
    expect(s2.players.player.lp).toBe(8000 - 900)
    expect(s2.players.ai.lp).toBe(8000)
  })

  it('เสมอ: ทำลายทั้งคู่ ไม่มีใครเสีย LP', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-016'] }, ai: { field: ['th01-016'] } })
    const s2 = applyAction(s, {
      type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0),
    })
    expect(s2.players.player.field[0]).toBeNull()
    expect(s2.players.ai.field[0]).toBeNull()
    expect(s2.players.player.lp).toBe(8000)
    expect(s2.players.ai.lp).toBe(8000)
    expect(lastLog(s2).details.at(-1)).toBe('900 = 900 → เสมอ ทำลายทั้งคู่ ไม่มีใครเสีย LP')
  })

  it('โจมตีตรงได้เฉพาะเมื่ออีกฝ่ายไม่มีมอนสเตอร์', () => {
    const blocked = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: ['th01-004'] } })
    expect(() =>
      applyAction(blocked, { type: 'attack', player: PLAYER, attackerUid: uidAt(blocked, PLAYER, 0), targetUid: null })
    ).toThrow('โจมตีตรง')

    const open = makeState({ phase: 'battle', player: { field: ['th01-017'] } })
    const s2 = applyAction(open, { type: 'attack', player: PLAYER, attackerUid: uidAt(open, PLAYER, 0), targetUid: null })
    expect(s2.players.ai.lp).toBe(6300)
    expect(lastLog(s2).details).toEqual([
      'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ → โจมตีตรงด้วย ATK 1,700',
      'คู่ต่อสู้เสีย LP 1,700: 8,000 − 1,700 = 6,300',
    ])
  })

  it('มอนสเตอร์แต่ละตัวโจมตีได้เทิร์นละครั้ง', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] } })
    const attackerUid = uidAt(s, PLAYER, 0)
    const s2 = applyAction(s, { type: 'attack', player: PLAYER, attackerUid, targetUid: null })
    expect(() => applyAction(s2, { type: 'attack', player: PLAYER, attackerUid, targetUid: null })).toThrow(
      'โจมตีไปแล้ว'
    )
  })

  it('LP เหลือ 0 → จบเกม (LP ไม่ติดลบ)', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { lp: 500 } })
    const s2 = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: null })
    expect(s2.players.ai.lp).toBe(0)
    expect(s2.winner).toBe(PLAYER)
    expect(s2.endReason).toBe('lp')
    expect(lastLog(s2).kind).toBe('gameover')
    expect(lastLog(s2).details).toBeUndefined()
    expect(s2.log.at(-2).details.at(-1)).toBe('คู่ต่อสู้เสีย LP 1,700: 500 − 1,700 = 0')
  })

  it('จบเฟสต่อสู้แล้วไปเฟสหลัก 2', () => {
    const s = makeState({ phase: 'battle' })
    expect(applyAction(s, { type: 'endBattle', player: PLAYER }).phase).toBe('main2')
  })
})

describe('จำกัดการ์ดในมือ 6 ใบ', () => {
  it('จบเทิร์นโดยมีการ์ดเกินต้องทิ้งก่อน แล้วจึงส่งเทิร์น', () => {
    const hand = ['th01-001', 'th01-002', 'th01-004', 'th01-005', 'th01-011', 'th01-016', 'th01-017', 'th01-019']
    const s = makeState({ player: { hand } })
    const s2 = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(s2.phase).toBe('discard')
    expect(s2.activePlayer).toBe(PLAYER)
    expect(() => applyAction(s2, { type: 'endTurn', player: PLAYER })).toThrow(GameRuleError)

    const s3 = applyAction(s2, { type: 'discard', player: PLAYER, uid: handUid(s2, PLAYER, 0) })
    expect(s3.phase).toBe('discard')
    const s4 = applyAction(s3, { type: 'discard', player: PLAYER, uid: handUid(s3, PLAYER, 0) })
    expect(s4.players.player.hand).toHaveLength(RULES.handLimit)
    expect(s4.players.player.graveyard).toHaveLength(2)
    expect(s4.activePlayer).toBe(AI)
    expect(s4.phase).toBe('main1')
  })
})

describe('ความคงที่ของจำนวนการ์ด', () => {
  it('การ์ดฝ่ายละ 40 ใบเสมอหลังแอ็กชันต่าง ๆ', () => {
    let s = createGame({ seed: 3 })
    s = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    s = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(countCards(s.players.player)).toBe(40)
    expect(countCards(s.players.ai)).toBe(40)
  })
})
