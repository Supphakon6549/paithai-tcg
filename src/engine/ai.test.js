import { describe, expect, it } from 'vitest'
import { getAiAction, runAiTurn } from './ai'
import { applyAction, createGame } from './game'
import { AI, PLAYER } from './rules'
import { makeState, uidAt } from './testUtils'

describe('getAiAction', () => {
  it('ไม่ทำอะไรเมื่อไม่ใช่ตาของ AI', () => {
    expect(getAiAction(makeState({ activePlayer: PLAYER }))).toBeNull()
  })

  it('อัญเชิญตัวที่ ATK สูงสุดที่อัญเชิญปกติได้', () => {
    // th01-003 (ATK 2,400) ต้องสังเวย แต่สนามว่าง → เลือก th01-011 (1,800)
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-001', 'th01-003', 'th01-011', 'th01-017'] } })
    const action = getAiAction(s)
    expect(action.type).toBe('summon')
    expect(s.players.ai.hand.find((c) => c.uid === action.uid).cardId).toBe('th01-011')
  })

  it('สังเวยตัว ATK ต่ำสุดเมื่อคุ้ม', () => {
    // บนสนาม 1,800 กับ 300 · มือมี 2,500 (สังเวย) และ 900 → สังเวย 300 อัญเชิญ 2,500
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-016', 'th01-018'], field: ['th01-011', 'th01-004'] } })
    expect(getAiAction(s)).toEqual({
      type: 'summon', player: AI, uid: s.players.ai.hand[1].uid, tributes: [uidAt(s, AI, 1)], position: 'attack',
    })
  })

  it('ไม่สังเวยเมื่อไม่คุ้ม (ตัวที่ต้องเสียแรงกว่าหรือเท่ากับตัวใหม่)', () => {
    // บนสนามมีแต่ 1,800 · ตัวสังเวยในมือ 1,500 → อัญเชิญปกติแทน
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-006', 'th01-001'], field: ['th01-011'] } })
    expect(getAiAction(s)).toEqual({ type: 'summon', player: AI, uid: s.players.ai.hand[1].uid, position: 'attack' })
  })

  it('ไม่สังเวยเมื่อตัวอัญเชิญปกติในมือแรงกว่า', () => {
    // ตัวสังเวย 1,500 แต่มี 1,800 อัญเชิญปกติได้
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-006', 'th01-011'], field: ['th01-004'] } })
    expect(getAiAction(s)).toEqual({ type: 'summon', player: AI, uid: s.players.ai.hand[1].uid, position: 'attack' })
  })

  it('สนามเต็มและมีตัวสังเวยคุ้ม → สังเวยได้', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-003'], field: Array(5).fill('th01-016') } })
    expect(getAiAction(s)).toMatchObject({ type: 'summon', tributes: [uidAt(s, AI, 0)] })
  })

  it('โจมตีเมื่อชนะเท่านั้น และเลือกเป้าที่แข็งที่สุดที่ชนะได้', () => {
    // AI 1,700 · ผู้เล่นมี 300, 900, 2,500 → ตี 900 (ชนะ 2,500 ไม่ได้)
    const s = makeState({
      activePlayer: AI, phase: 'battle',
      ai: { field: ['th01-017'] },
      player: { field: ['th01-004', 'th01-016', 'th01-018'] },
    })
    expect(getAiAction(s)).toEqual({
      type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: uidAt(s, PLAYER, 1),
    })
  })

  it('คิดโบนัสธาตุก่อนตัดสินใจ', () => {
    // AI ลูกพราน 800 vs ผู้เล่น 1,200 ธาตุวายุ (+300) → ไม่ตี จบเทิร์น
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-001'] }, player: { field: ['th01-019'] } })
    expect(getAiAction(s).type).toBe('endTurn')
  })

  it('ไม่โจมตีเมื่อผลคือเสมอ', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-016'] }, player: { field: ['th01-016'] } })
    expect(getAiAction(s).type).toBe('endTurn')
  })

  it('โจมตีตรงเมื่อผู้เล่นไม่มีมอนสเตอร์', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-001'] } })
    expect(getAiAction(s)).toMatchObject({ type: 'attack', targetUid: null })
  })

  it('ทิ้งการ์ด ATK ต่ำสุดเมื่อการ์ดเกินมือ', () => {
    const s = makeState({ activePlayer: AI, phase: 'discard', ai: { hand: ['th01-017', 'th01-004', 'th01-011'] } })
    const action = getAiAction(s)
    expect(s.players.ai.hand.find((c) => c.uid === action.uid).cardId).toBe('th01-004')
  })
})

describe('runAiTurn', () => {
  it('อัญเชิญ → โจมตี → จบเทิร์น แล้วส่งตาให้ผู้เล่น', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-017'] }, player: { field: ['th01-016'] } })
    const after = runAiTurn(s)
    expect(after.activePlayer).toBe(PLAYER)
    expect(after.players.player.field[0]).toBeNull()
    expect(after.players.player.lp).toBe(8000 - 800)
    const kinds = after.log.map((e) => e.kind)
    expect(kinds).toEqual(['summon', 'phase', 'battle', 'turn', 'draw'])
  })

  it('AI เริ่มก่อนในเทิร์น 1: อัญเชิญแล้วจบเทิร์นโดยไม่โจมตี', () => {
    const s = createGame({ seed: 5, firstPlayer: AI })
    const after = runAiTurn(s)
    expect(after.turn).toBe(2)
    expect(after.players.ai.field.filter(Boolean)).toHaveLength(1)
    expect(after.log.some((e) => e.kind === 'battle')).toBe(false)
  })
})

describe('จำลองเกมเต็ม AI ปะทะ AI', () => {
  it.each([1, 2, 3, 42, 99, 2026])('seed %i จบเกมได้ และค่าต่าง ๆ ถูกต้อง', (seed) => {
    let s = createGame({ seed })
    for (let i = 0; i < 500 && !s.winner; i++) {
      s = applyAction(s, getAiAction(s, s.activePlayer))
      for (const id of [PLAYER, AI]) {
        const p = s.players[id]
        expect(p.lp).toBeGreaterThanOrEqual(0)
        expect(p.hand.length + p.deck.length + p.graveyard.length + p.field.filter(Boolean).length).toBe(40)
      }
    }
    expect(s.winner).not.toBeNull()
    expect(['lp', 'deckOut']).toContain(s.endReason)
    expect(s.phase).toBe('over')
  })
})
