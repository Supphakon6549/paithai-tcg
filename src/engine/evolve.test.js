import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import { applyAction, evolveBlocker, getReadyAttackers } from './game'
import { AI, PLAYER } from './rules'
import { lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const attack = (s, player, zone, targetZone) =>
  applyAction(s, {
    type: 'attack',
    player,
    attackerUid: uidAt(s, player, zone),
    targetUid: uidAt(s, player === PLAYER ? AI : PLAYER, targetZone),
  })
// ให้มอนสเตอร์ช่อง zone มีแต้มที่ครบตั้งแต่เทิร์น readyTurn
const withXp = (s, zone, xp, readyTurn) => {
  Object.assign(s.players.player.field[zone], { xp, xpReadyTurn: readyTurn })
  return s
}

describe('ได้แต้มประสบการณ์', () => {
  it('ตีชนะ → +1 แต้ม และบันทึกบอกความคืบหน้า', () => {
    // พลทหารอาสา 900 ตีเด็กวัด 300 → ครบ 1/1 ทันที
    const s = makeState({ phase: 'battle', player: { field: ['th01-016'] }, ai: { field: ['th01-004'] } })
    const after = attack(s, PLAYER, 0, 0)
    expect(after.players.player.field[0]).toMatchObject({ xp: 1, xpReadyTurn: 3 })
    expect(lastLog(after).details).toContain(
      '⭐ พลทหารอาสา ได้ประสบการณ์ 1 แต้ม (1/1) — เลื่อนยศเป็น ทหารเสือดาบสองมือ ได้ตั้งแต่เทิร์นถัดไปของเรา'
    )
  })

  it('ตั้งรับแล้วทำลายผู้โจมตีได้ก็ได้แต้ม', () => {
    // AI เด็กวัด 300 ตีลูกพราน 800 (ท่าโจมตี) → เด็กวัดถูกทำลาย ลูกพรานได้แต้ม
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-004'] }, player: { field: ['th01-001'] } })
    const after = attack(s, AI, 0, 0)
    expect(after.players.player.field[0].xp).toBe(1)
    expect(lastLog(after).details).toContain('⭐ ลูกพราน ได้ประสบการณ์ 1 แต้ม (1/2)')
  })

  it('ตีตัวตั้งรับแล้วทำลายได้ก็ได้แต้ม', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: ['th01-017'] },
      ai: { field: [{ id: 'th01-004', position: 'defense', faceDown: false }] },
    })
    expect(attack(s, PLAYER, 0, 0).players.player.field[0].xp).toBe(1)
  })

  it('เสมอ / แพ้ / ตีไม่ผ่าน → ไม่ได้แต้ม', () => {
    const tie = makeState({ phase: 'battle', player: { field: ['th01-016'] }, ai: { field: ['th01-016'] } })
    expect(attack(tie, PLAYER, 0, 0).players.player.field[0]).toBeNull()
    const blocked = makeState({
      phase: 'battle',
      player: { field: ['th01-001'] },
      ai: { field: [{ id: 'th01-005', position: 'defense', faceDown: false }] },
    })
    expect(attack(blocked, PLAYER, 0, 0).players.player.field[0].xp).toBeUndefined()
  })

  it('การ์ดที่ไม่มีสายประสบการณ์ไม่สะสมแต้ม', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-011'] }, ai: { field: ['th01-004'] } })
    expect(attack(s, PLAYER, 0, 0).players.player.field[0].xp).toBeUndefined()
  })
})

describe('เลื่อนยศ', () => {
  it('แต้มยังไม่ครบ / ครบเทิร์นนี้ → ยังเลื่อนไม่ได้', () => {
    const s = makeState({ player: { field: ['th01-001'], deck: ['th01-002'] } })
    expect(evolveBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ประสบการณ์ 0/2 — ทำลายมอนสเตอร์ศัตรูอีก 2 ตัว')
    withXp(s, 0, 2, 3)
    expect(evolveBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('แต้มเพิ่งครบเทิร์นนี้ — เลื่อนยศได้ในเทิร์นถัดไปของเรา')
  })

  it('เทิร์นถัดไป: เลื่อนจากกองการ์ด ลงช่องเดิมท่าโจมตี ไม่ใช้สิทธิ์อัญเชิญ และโจมตีได้', () => {
    const s = withXp(makeState({ turn: 5, player: { field: ['th01-016'], deck: ['th01-001', 'th01-017'] } }), 0, 1, 3)
    const oldUid = uidAt(s, PLAYER, 0)
    const after = act(s, { type: 'evolve', uid: oldUid })
    const p = after.players.player
    expect(p.field[0]).toMatchObject({ cardId: 'th01-017', position: 'attack', faceDown: false, hasAttacked: false })
    expect(p.field[0].xp).toBeUndefined()
    expect(p.graveyard.map((c) => c.cardId)).toEqual(['th01-016'])
    expect(p.deck.map((c) => c.cardId)).toEqual(['th01-001'])
    expect(p.hasNormalSummoned).toBe(false)
    expect(lastLog(after).text).toBe('🎖️ คุณเลื่อนยศ พลทหารอาสา → ทหารเสือดาบสองมือ (ATK 1,700) จากกองการ์ด ลงช่องที่ 1')
    expect(lastLog(after).event).toMatchObject({ type: 'evolve', source: oldUid })

    const battle = act(after, { type: 'enterBattle' })
    expect(getReadyAttackers(battle, PLAYER).map((m) => m.cardId)).toEqual(['th01-017'])
  })

  it('เลือกเลื่อนจากมือได้', () => {
    const s = withXp(makeState({ turn: 5, player: { field: ['th01-001'], hand: ['th01-002'], deck: ['th01-002'] } }), 0, 2, 3)
    const after = act(s, { type: 'evolve', uid: uidAt(s, PLAYER, 0), from: 'hand' })
    expect(after.players.player.hand).toHaveLength(0)
    expect(after.players.player.deck).toHaveLength(1)
    expect(lastLog(after).text).toContain('จากมือ')
  })

  it('ร่างเก่าโจมตีไปแล้ว → ร่างใหม่โจมตีซ้ำไม่ได้', () => {
    const s = withXp(makeState({ turn: 5, phase: 'main2', player: { field: ['th01-016'], deck: ['th01-017'] } }), 0, 1, 3)
    Object.assign(s.players.player.field[0], { hasAttacked: true, attackCount: 1 })
    const after = act(s, { type: 'evolve', uid: uidAt(s, PLAYER, 0) })
    expect(after.players.player.field[0]).toMatchObject({ hasAttacked: true, attackCount: 1 })
    expect(lastLog(after).details).toContain('พลทหารอาสา โจมตีไปแล้วเทิร์นนี้ ทหารเสือดาบสองมือ จึงโจมตีไม่ได้อีก')
  })

  it('ไม่มีร่างใหม่ในมือหรือกอง → เลื่อนไม่ได้', () => {
    const s = withXp(makeState({ turn: 5, player: { field: ['th01-017'], deck: ['th01-001'] } }), 0, 2, 3)
    expect(evolveBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ไม่มี "ขุนศึกอาทมาฏ" ในมือหรือกองการ์ด')
  })

  it('เลื่อนได้เฉพาะเฟสหลักของเรา', () => {
    const s = withXp(makeState({ turn: 5, phase: 'battle', player: { field: ['th01-016'], deck: ['th01-017'] } }), 0, 1, 3)
    expect(evolveBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('เลื่อนยศได้เฉพาะเฟสหลักในตาของเรา')
  })

  it('สายพรานครบ 3 ขั้น: ลูกพราน → พรานหนุ่ม → เจ้าพรานแห่งไพร (แต้มเริ่มใหม่ทุกขั้น)', () => {
    let s = withXp(makeState({ turn: 5, player: { field: ['th01-001'], deck: ['th01-002', 'th01-003'] } }), 0, 2, 3)
    s = act(s, { type: 'evolve', uid: uidAt(s, PLAYER, 0) })
    expect(evolveBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ประสบการณ์ 0/3 — ทำลายมอนสเตอร์ศัตรูอีก 3 ตัว')
    s.turn = 7
    withXp(s, 0, 3, 5)
    s = act(s, { type: 'evolve', uid: uidAt(s, PLAYER, 0) })
    expect(s.players.player.field[0].cardId).toBe('th01-003')
  })
})

describe('AI เลื่อนยศเมื่อทำได้', () => {
  it('เลื่อนก่อนอัญเชิญ', () => {
    const s = makeState({ activePlayer: AI, turn: 6, ai: { field: ['th01-016'], hand: ['th01-001'], deck: ['th01-017'] } })
    Object.assign(s.players.ai.field[0], { xp: 1, xpReadyTurn: 4 })
    expect(getAiAction(s)).toEqual({ type: 'evolve', player: AI, uid: uidAt(s, AI, 0), from: 'deck' })
  })
})
