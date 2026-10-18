import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  getFieldAtk,
  getReadyAttackers,
  handCardBlocker,
  previewBattle,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const attackAt = (s, zone, targetZone) =>
  act(s, {
    type: 'attack',
    attackerUid: uidAt(s, PLAYER, zone),
    targetUid: targetZone === null ? null : uidAt(s, AI, targetZone),
  })
const battle = (opts) => makeState({ phase: 'battle', ...opts })
const hasReason = (side, text) => side.bonuses.some((b) => b.reason.includes(text))

describe('พลโล่ลงกา: ลดความเสียหายจากการต่อสู้ของใบนี้ 300', () => {
  it('ตีไม่ผ่านตัวตั้งรับ → ส่วนต่างหัก 300', () => {
    const s = battle({ player: { field: ['th04-001'] }, ai: { field: [{ id: 'th01-018', position: 'defense' }] } })
    const diff = previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), uidAt(s, AI, 0)).damage
    const after = attackAt(s, 0, 0)
    expect(after.players.player.lp).toBe(8000 - Math.max(0, diff - 300))
    expect(lastLog(after).details.join(' ')).toContain('พลโล่ลงกา: ลดความเสียหายจากการต่อสู้ 300')
  })

  it('ถูกตีแพ้ในท่าโจมตี → เจ้าของยังได้ลด (ต่ำสุด 0) แม้ใบนี้ถูกทำลาย', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', player: { field: ['th04-001'] }, ai: { field: ['th01-016'] } })
    const diff = previewBattle(s, AI, uidAt(s, AI, 0), uidAt(s, PLAYER, 0)).damage
    const after = applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: uidAt(s, PLAYER, 0) })
    expect(after.players.player.field[0]).toBeNull()
    expect(after.players.player.lp).toBe(8000 - Math.max(0, diff - 300))
  })

  it('ไม่ช่วยตอนถูกโจมตีตรง', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-016'] } })
    const after = applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: null })
    expect(after.players.player.lp).toBe(8000 - 900)
  })
})

describe('ยักษ์คบเพลิง: ATK +300 เฉพาะตอนโจมตี', () => {
  it('โจมตีได้ +300 · ตั้งรับไม่ได้ · ค่าบนสนามไม่เปลี่ยน', () => {
    const s = battle({ player: { field: ['th04-002'] }, ai: { field: ['th01-016'] } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(800)
    expect(hasReason(previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), uidAt(s, AI, 0)).attacker, 'ยักษ์คบเพลิง')).toBe(true)
    expect(hasReason(previewBattle(s, AI, uidAt(s, AI, 0), uidAt(s, PLAYER, 0)).defender, 'ยักษ์คบเพลิง')).toBe(false)
  })

  it('โจมตีตรง = 1,100', () => {
    const s = battle({ player: { field: ['th04-002'] } })
    expect(attackAt(s, 0, null).players.ai.lp).toBe(8000 - 1100)
  })
})

describe('อสูรมนตราควัน: ลด ATK ศัตรู 200 จนจบเทิร์น ไม่ต้องทิ้งการ์ด', () => {
  it('ใช้ได้ใบละครั้ง/เทิร์น และหมดผลเมื่อจบเทิร์น', () => {
    const s = makeState({ player: { field: ['th04-003'] }, ai: { field: ['th01-018'] } })
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(2300)
    expect(after.players.player.hand).toHaveLength(0)
    expect(activationBlocker(after, PLAYER, uidAt(s, PLAYER, 0))).toBe('ใช้ความสามารถไปแล้วเทิร์นนี้')
    const next = act(after, { type: 'endTurn' })
    expect(getFieldAtk(next, AI, uidAt(s, AI, 0))).toBe(2500)
  })

  it('ไม่มีเป้าหมายหงาย → ใช้ไม่ได้', () => {
    const s = makeState({ player: { field: ['th04-003'] }, ai: { field: [{ id: 'th01-018', position: 'defense', faceDown: true }] } })
    expect(activationBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ฝ่ายตรงข้ามไม่มีมอนสเตอร์หงายหน้า')
  })
})

describe('ขุนยักษ์ดาบอัคนี: มีอสูรตัวอื่นหงาย ATK +200 (ไม่ซ้อน)', () => {
  it('นับเฉพาะเพื่อนหงาย ไม่เพิ่มตามจำนวน', () => {
    const alone = makeState({ player: { field: ['th04-004', { id: 'th04-001', position: 'defense', faceDown: true }] } })
    expect(getFieldAtk(alone, PLAYER, uidAt(alone, PLAYER, 0))).toBe(1600)
    const two = makeState({ player: { field: ['th04-004', 'th04-001', 'th04-002'] } })
    expect(getFieldAtk(two, PLAYER, uidAt(two, PLAYER, 0))).toBe(1800)
  })
})

describe('กุมภกรรณ: ตีทะลุครึ่งหนึ่ง (ปัดลง)', () => {
  it('ATK สูงกว่า DEF → ศัตรูเสียครึ่งส่วนต่าง', () => {
    const s = battle({ player: { field: ['th04-005'] }, ai: { field: [{ id: 'th01-016', position: 'defense' }] } })
    const diff = previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), uidAt(s, AI, 0)).damage
    expect(attackAt(s, 0, 0).players.ai.lp).toBe(8000 - Math.floor(diff / 2))
  })
})

describe('อินทรชิต: โจมตีตรงไม่ได้ · โจมตี 2 ครั้งเมื่อมีอสูรตัวอื่น', () => {
  it('มีเพื่อนอสูร → โจมตีได้ 2 ครั้ง', () => {
    const s = battle({ player: { field: ['th04-006', 'th04-001'] }, ai: { field: ['th01-001', 'th01-001'] } })
    const once = attackAt(s, 0, 0)
    expect(getReadyAttackers(once, PLAYER).map((m) => m.uid)).toContain(uidAt(s, PLAYER, 0))
    const twice = attackAt(once, 0, 1)
    expect(lastLog(twice).details[0]).toContain('โจมตีครั้งที่ 2')
    expect(getReadyAttackers(twice, PLAYER).map((m) => m.uid)).not.toContain(uidAt(s, PLAYER, 0))
  })

  it('ไม่มีเพื่อน → ครั้งเดียว · ศัตรูไม่มีมอนสเตอร์ → โจมตีไม่ได้', () => {
    const s = battle({ player: { field: ['th04-006'] }, ai: { field: ['th01-001', 'th01-001'] } })
    expect(getReadyAttackers(attackAt(s, 0, 0), PLAYER)).toHaveLength(0)
    const empty = battle({ player: { field: ['th04-006'] } })
    expect(getReadyAttackers(empty, PLAYER)).toHaveLength(0)
    expect(() => attackAt(empty, 0, null)).toThrow('โจมตีตรงไม่ได้')
  })
})

describe('กรุงลงกา: เวทสนามฝ่ายอสูร', () => {
  it('อสูรฝ่ายเรา ATK +200 · ทศกัณฐ์จำแลงไม่อ่อนแรง', () => {
    const s = battle({ player: { field: ['th01-011'], fieldSpell: 'th04-007' } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(2000)
    const after = attackAt(s, 0, null)
    expect(lastLog(after).details.join(' ')).toContain('ไม่อ่อนแรง: มีเวทสนามฝ่ายอสูร')
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(2000)
  })

  it('ไม่บัฟอสูรของฝ่ายตรงข้าม', () => {
    const s = makeState({ player: { fieldSpell: 'th04-007' }, ai: { field: ['th04-004'] } })
    expect(getFieldAtk(s, AI, uidAt(s, AI, 0))).toBe(1600)
  })
})

describe('มนต์ปลุกเพลิงอสูร: อสูรหงายของเรา ATK +400 จนจบเทิร์น', () => {
  it('ใช้แล้วลงสุสาน ซ้อนกันได้ และหมดผลเมื่อจบเทิร์น', () => {
    const s = makeState({ player: { hand: ['th04-008', 'th04-008'], field: ['th04-004'] } })
    const target = uidAt(s, PLAYER, 0)
    let after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), targetUid: target })
    after = act(after, { type: 'playSpell', uid: handUid(after, PLAYER, 0), targetUid: target })
    expect(getFieldAtk(after, PLAYER, target)).toBe(2400)
    expect(after.players.player.graveyard).toHaveLength(2)
    expect(after.players.player.spellTrap.every((t) => t === null)).toBe(true)
    expect(getFieldAtk(act(after, { type: 'endTurn' }), PLAYER, target)).toBe(1600)
  })

  it('ไม่มีอสูรหงาย → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th04-008'], field: ['th01-016'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('ไม่มีมอนสเตอร์เผ่าอสูรหงายหน้าบนสนามเรา')
  })
})

describe('ม่านควันลงกา: ลด ATK ผู้โจมตี 500 แล้วการโจมตีดำเนินต่อ', () => {
  const setup = (target = 'th04-004', setTurn = 1) =>
    makeState({
      activePlayer: AI,
      phase: 'battle',
      player: { field: [target], spellTrap: [{ id: 'th04-009', setTurn }] },
      ai: { field: ['th01-017'] },
    })
  const aiAttack = (s, targetUid = uidAt(s, PLAYER, 0)) =>
    applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid })

  it('เปิดแล้วผู้โจมตีอ่อนลง 500 และยังต่อสู้ต่อ', () => {
    const s = aiAttack(setup())
    expect(s.pendingResponse.options.map((o) => o.kind)).toEqual(['weaken'])
    const after = applyAction(s, { type: 'respond', player: PLAYER, trapUid: s.pendingResponse.options[0].id })
    const text = lastLog(after).details.join(' ')
    expect(text).toContain('ATK 1,700 − 500 = 1,200 · การโจมตีดำเนินต่อ')
    expect(lastLog(after).text).toBe('⚔️ ทหารเสือดาบสองมือ โจมตี ขุนยักษ์ดาบอัคนี')
    expect(after.players.player.graveyard.map((c) => c.cardId)).toContain('th04-009')
  })

  it('ไม่เปิด: เทิร์นที่วาง / เป้าไม่ใช่อสูร / เป้าคว่ำ', () => {
    expect(aiAttack(setup('th04-004', 3)).pendingResponse).toBeNull()
    expect(aiAttack(setup('th01-016')).pendingResponse).toBeNull()
    const facedown = makeState({
      activePlayer: AI,
      phase: 'battle',
      player: { field: [{ id: 'th04-004', position: 'defense', faceDown: true }], spellTrap: [{ id: 'th04-009', setTurn: 1 }] },
      ai: { field: ['th01-017'] },
    })
    expect(aiAttack(facedown).pendingResponse).toBeNull()
  })

  it('AI ฝ่ายรับเปิดม่านควัน', () => {
    const s = makeState({
      activePlayer: PLAYER,
      phase: 'battle',
      player: { field: ['th01-017'] },
      ai: { field: ['th04-004'], spellTrap: [{ id: 'th04-009', setTurn: 1 }] },
    })
    const pending = attackAt(s, 0, 0)
    expect(getAiAction(pending)).toMatchObject({ type: 'respond', trapUid: pending.pendingResponse.options[0].id })
  })
})

describe('AI ใช้การ์ด TH04', () => {
  it('ใช้มนต์ปลุกเพลิงกับอสูรท่าโจมตี และใช้ควันลด ATK โดยไม่ทิ้งการ์ด', () => {
    const buff = makeState({ activePlayer: AI, ai: { hand: ['th04-008'], field: ['th04-004'] }, player: { field: ['th01-018'] } })
    expect(getAiAction(buff)).toMatchObject({ type: 'playSpell', targetUid: uidAt(buff, AI, 0) })
    const smoke = makeState({ activePlayer: AI, ai: { field: ['th04-003', 'th04-004'] }, player: { field: ['th01-011'] } })
    const action = getAiAction(smoke)
    expect(action).toMatchObject({ type: 'activate', uid: uidAt(smoke, AI, 0), targetUid: uidAt(smoke, PLAYER, 0) })
    expect(action.discardUid).toBeUndefined()
  })
})
