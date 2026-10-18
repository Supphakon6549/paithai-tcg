import { describe, expect, it } from 'vitest'
import { applyAction } from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

// entry.event คือข้อมูลที่ชั้นแอนิเมชัน (src/components/battle/fx) ใช้
const eventOf = (state, kind) => state.log.findLast((e) => e.kind === kind)?.event

describe('ข้อมูลเหตุการณ์สำหรับแอนิเมชัน', () => {
  it('อัญเชิญ: placed บอกช่องและท่า', () => {
    const s = makeState({ player: { hand: ['th01-001'] } })
    const uid = handUid(s, PLAYER, 0)
    const after = applyAction(s, { type: 'summon', player: PLAYER, uid, position: 'defense' })
    expect(eventOf(after, 'summon')).toEqual({
      type: 'summon',
      player: PLAYER,
      source: uid,
      target: null,
      trap: null,
      placed: [{ player: PLAYER, uid, cardId: 'th01-001', zone: 0, faceDown: true, position: 'defense' }],
      destroyed: [],
      revealed: [],
      damage: [],
      heal: [],
      spellPlaced: [],
      spellRemoved: [],
    })
  })

  it('อัญเชิญสังเวย: ตัวสังเวยอยู่ใน destroyed', () => {
    const s = makeState({ player: { hand: ['th01-003'], field: ['th01-001'] } })
    const tribute = uidAt(s, PLAYER, 0)
    const after = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0), tributes: [tribute] })
    const ev = eventOf(after, 'summon')
    expect(ev.destroyed).toEqual([{ player: PLAYER, uid: tribute, cardId: 'th01-001', zone: 0 }])
    expect(ev.placed[0]).toMatchObject({ cardId: 'th01-003', zone: 0 })
  })

  it('โจมตี: เป้าหมาย ตัวที่ถูกทำลาย และความเสียหาย', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: [null, 'th01-001'] } })
    const attacker = uidAt(s, PLAYER, 0)
    const target = uidAt(s, AI, 1)
    const after = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: attacker, targetUid: target })
    expect(lastLog(after).event).toEqual({
      type: 'attack',
      player: PLAYER,
      source: attacker,
      target,
      trap: null,
      placed: [],
      destroyed: [{ player: AI, uid: target, cardId: 'th01-001', zone: 1 }],
      revealed: [],
      damage: [{ player: AI, amount: 900, lpBefore: 8000, lpAfter: 7100 }],
      heal: [],
      spellPlaced: [],
      spellRemoved: [],
    })
  })

  it('ตีการ์ดคว่ำ: revealed', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: ['th01-001'] },
      ai: { field: [{ id: 'th01-005', position: 'defense', faceDown: true }] },
    })
    const after = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    const ev = lastLog(after).event
    expect(ev.revealed).toEqual([{ player: AI, uid: uidAt(s, AI, 0), cardId: 'th01-005', zone: 0 }])
    expect(ev.damage).toEqual([{ player: PLAYER, amount: 700, lpBefore: 8000, lpAfter: 7300 }])
  })

  it('โจมตีตรง: target เป็น null', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] } })
    const after = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: null })
    expect(lastLog(after).event).toMatchObject({ type: 'attack', target: null, damage: [{ player: AI, amount: 1700 }] })
  })

  it('บันทึกที่ไม่ใช่แอ็กชันหลัก (เฟส/เทิร์น/จั่ว) ไม่มี event', () => {
    const s = makeState()
    const after = applyAction(s, { type: 'endTurn', player: PLAYER })
    expect(after.log.every((e) => e.event === undefined)).toBe(true)
  })
})
