import { afterEach, describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { CARD_EFFECTS, getAttackDecay } from './effects'
import { applyAction, getFieldAtk } from './game'
import { AI, PLAYER } from './rules'
import { lastLog, makeState, uidAt } from './testUtils'

const DEMON = 'th01-011' // อสูรทศกัณฐ์จำแลง ATK 1,800

const directAttack = (s) =>
  applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: null })

// เริ่มเทิร์นต่อสู้ใหม่ของเรา (โจมตีได้อีกครั้ง)
const nextOwnBattle = (s) => {
  const next = structuredClone(s)
  next.turn += 2
  for (const m of next.players.player.field) if (m) Object.assign(m, { hasAttacked: false, attackCount: 0 })
  return next
}

describe('อสูรทศกัณฐ์จำแลง: ร่างจำแลงอ่อนแรงหลังโจมตี', () => {
  it('ตีครั้งแรกด้วย 1,800 เต็ม แล้วเหลือ 1,600', () => {
    const s = makeState({ phase: 'battle', player: { field: [DEMON] } })
    const after = directAttack(s)
    expect(after.players.ai.lp).toBe(8000 - 1800)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(1600)
    expect(lastLog(after).details.at(-1)).toBe('🌑 อสูรทศกัณฐ์จำแลง ร่างจำแลงอ่อนแรง: ATK 1,800 → 1,600')
  })

  it('ลดเป็นขั้น 1,600 → 1,500 → 1,400 แล้วค้างที่ 1,400', () => {
    let s = makeState({ phase: 'battle', player: { field: [DEMON] } })
    const atks = []
    for (let i = 0; i < 5; i++) {
      s = directAttack(s)
      atks.push(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0)))
      s = nextOwnBattle(s)
    }
    expect(atks).toEqual([1600, 1500, 1400, 1400, 1400])
    expect(s.log.at(-1).details.at(-1)).toBe('🌑 อสูรทศกัณฐ์จำแลง ร่างจำแลงอ่อนแรง: ATK ต่ำสุดแล้ว 1,400')
  })

  it('ATK ที่ลดแล้วใช้ในการต่อสู้ครั้งต่อไป และแสดงในบันทึก', () => {
    let s = makeState({ phase: 'battle', player: { field: [DEMON] } })
    s = nextOwnBattle(directAttack(s))
    s.players.ai.field[0] = { uid: 'ai-x', cardId: 'th01-017', hasAttacked: false, summonedTurn: 1, position: 'attack', faceDown: false }
    const after = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: 'ai-x' })
    // 1,600 แพ้ทหารเสือ 1,700
    expect(after.players.player.field[0]).toBeNull()
    expect(lastLog(after).details[0]).toBe(
      'ฝ่ายโจมตี — อสูรทศกัณฐ์จำแลง: ATK 1,800 − 200 (เอฟเฟกต์: ร่างจำแลงอ่อนแรง (โจมตีแล้ว 1 ครั้ง)) = 1,600'
    )
  })

  it('มีเผ่าอสูรตัวอื่นหงายบนสนาม → ไม่อ่อนแรง (ตัวคว่ำไม่นับ)', () => {
    const guarded = makeState({ phase: 'battle', player: { field: [DEMON, DEMON] } })
    const after = directAttack(guarded)
    expect(getFieldAtk(after, PLAYER, uidAt(guarded, PLAYER, 0))).toBe(1800)
    expect(lastLog(after).details.at(-1)).toBe('🌑 อสูรทศกัณฐ์จำแลง ไม่อ่อนแรง: มีมอนสเตอร์เผ่าอสูรตัวอื่นบนสนาม')

    const hidden = makeState({
      phase: 'battle',
      player: { field: [DEMON, { id: DEMON, position: 'defense', faceDown: true }] },
    })
    expect(getFieldAtk(directAttack(hidden), PLAYER, uidAt(hidden, PLAYER, 0))).toBe(1600)
  })

  describe('เวทสนามฝ่ายอสูร (รอการ์ดจริง — ทดสอบด้วยการ์ดสมมติ)', () => {
    afterEach(() => delete CARD_EFFECTS['test-demon-field'])

    it('เวทสนามที่ระบุ faction demon ป้องกันการอ่อนแรง', () => {
      CARD_EFFECTS['test-demon-field'] = { fieldSpell: { faction: 'demon' } }
      const decay = getAttackDecay(getCardById(DEMON))
      expect(decay.protectedBy({ allies: [], fieldSpell: { id: 'test-demon-field' } })).toBe('มีเวทสนามฝ่ายอสูร')
      expect(decay.protectedBy({ allies: [], fieldSpell: getCardById('th05-007') })).toBeNull()
    })
  })

  it('ถูกกับดักยกเลิกการโจมตี ก็ยังอ่อนแรง (ประกาศโจมตีไปแล้ว)', () => {
    const s = makeState({
      activePlayer: AI,
      phase: 'battle',
      ai: { field: [DEMON] },
      player: { field: ['th05-002'], spellTrap: [{ id: 'th05-008' }] },
    })
    const pending = applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: uidAt(s, PLAYER, 0) })
    const after = applyAction(pending, { type: 'respond', player: PLAYER, trapUid: pending.pendingResponse.trapUids[0] })
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1600)
  })

  it('แพ้แล้วถูกทำลาย → ไม่มีบรรทัดอ่อนแรง', () => {
    const s = makeState({ phase: 'battle', player: { field: [DEMON] }, ai: { field: ['th01-018'] } })
    const after = applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(lastLog(after).details.some((d) => d.includes('อ่อนแรง'))).toBe(false)
  })
})
