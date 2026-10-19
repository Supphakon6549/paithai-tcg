import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  forestLocked,
  getFieldAtk,
  getMountOptions,
  mountBlocker,
  positionChangeBlocker,
  previewBattle,
  specialSummonBlocker,
} from './game'
import { getCardById } from '../data/cards'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const ids = (list) => list.map((c) => c?.cardId ?? null)
const SET = (id) => ({ id, position: 'defense', faceDown: true })
const aiAttack = (s, zone, targetZone) =>
  applyAction(s, {
    type: 'attack',
    player: AI,
    attackerUid: uidAt(s, AI, zone),
    targetUid: targetZone === null ? null : uidAt(s, PLAYER, targetZone),
  })
const aiBattle = (opts) => makeState({ activePlayer: AI, phase: 'battle', ...opts })
const grow = (s, zone, n, playerId = PLAYER) => {
  s.players[playerId].field[zone].growth = n
  return s
}
const endBoth = (s) => applyAction(act(s, { type: 'endTurn' }), { type: 'endTurn', player: AI })

describe('ระบบเติบโต + ต้นไทร (รากประสาน)', () => {
  it('จบเทิร์นเรา +1 แต้ม (สูงสุด 3) · ATK/DEF +200 ต่อแต้ม', () => {
    let s = makeState({ player: { field: ['th03-001'] } })
    const uid = uidAt(s, PLAYER, 0)
    s = act(s, { type: 'endTurn' })
    expect(s.players.player.field[0].growth).toBe(1)
    expect(getFieldAtk(s, PLAYER, uid)).toBe(800)
    s = applyAction(s, { type: 'endTurn', player: AI })
    s = endBoth(s)
    s = endBoth(s)
    expect(s.players.player.field[0].growth).toBe(3)
    expect(getFieldAtk(s, PLAYER, uid)).toBe(1200)
  })

  it('รากประสาน: มีพืชป่าหงายตัวอื่น → รอดการต่อสู้และไม่เสีย LP (ครั้งแรกต่อเทิร์น)', () => {
    const s = aiBattle({ player: { field: ['th03-001', 'th03-002'] }, ai: { field: ['th01-022'] } })
    const hit = aiAttack(s, 0, 0)
    expect(hit.players.player.field[0]).toMatchObject({ cardId: 'th03-001' })
    expect(hit.players.player.lp).toBe(8000)
    expect(lastLog(hit).details.join(' ')).toContain('รากประสาน')
    hit.players.ai.field[0].hasAttacked = false
    hit.players.ai.field[0].attackCount = 0
    expect(aiAttack(hit, 0, 0).players.player.field[0]).toBeNull()
  })

  it('อยู่ตัวเดียว → ไม่มีเกราะ', () => {
    const s = aiBattle({ player: { field: ['th03-001'] }, ai: { field: ['th01-022'] } })
    expect(aiAttack(s, 0, 0).players.player.field[0]).toBeNull()
  })
})

describe('เถาหวาย: เรียกต้นไทรจากกอง/มือ', () => {
  it('อัญเชิญหงาย → เรียกต้นไทรจากกองท่าตั้งรับ · ล็อกอัญเชิญพิเศษเฉพาะการ์ดป่า', () => {
    const s = makeState({ player: { hand: ['th03-002', 'th01-009'], deck: ['th01-001', 'th03-001', 'th03-001'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice.options.map((o) => o.label)).toEqual(['ต้นไทรเดินดิน (จากกอง)', 'ไม่เรียก'])
    const called = act(after, { type: 'choose', optionId: after.pendingChoice.options[0].id })
    expect(called.players.player.field[1]).toMatchObject({ cardId: 'th03-001', position: 'defense', cannotAttackTurn: 3 })
    expect(called.players.player.deck).toHaveLength(2)
    expect(called.players.player.forestLockTurn).toBe(3)
    expect(forestLocked(called, PLAYER, getCardById('th01-009'))).toBe(true)
    expect(forestLocked(called, PLAYER, getCardById('th03-008'))).toBe(false)
  })
})

describe('ด้วงกว่าง: แมลงตัวอื่น +200 ไม่ซ้อน + เกราะร่วมรัง', () => {
  it('ด้วง 2 ใบก็ยัง +200 · ด้วงได้จากด้วงอีกใบ', () => {
    const s = makeState({ player: { field: ['th03-003', 'th03-003', 'th03-004'] } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 2))).toBe(1000)
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(1600)
    const alone = makeState({ player: { field: ['th03-003'] } })
    expect(getFieldAtk(alone, PLAYER, uidAt(alone, PLAYER, 0))).toBe(1400)
  })

  it('แมลงป่าที่มีแมลงป่าตัวอื่น รอดการโจมตีแรกและไม่เสีย LP', () => {
    const s = aiBattle({ player: { field: ['th03-004', 'th03-003'] }, ai: { field: ['th01-022'] } })
    const hit = aiAttack(s, 0, 0)
    expect(hit.players.player.field[0]).toMatchObject({ cardId: 'th03-004' })
    expect(hit.players.player.lp).toBe(8000)
    expect(lastLog(hit).details.join(' ')).toContain('เกราะร่วมรัง')
  })
})

describe('ฝูงต่อ: เรียกพวก + เหล็กใน', () => {
  it('อัญเชิญหงาย → เรียกฝูงต่อจากกอง/มือ ท่าโจมตี โจมตีได้ (ชื่อละครั้ง)', () => {
    const s = makeState({ player: { hand: ['th03-004', 'th03-004'], deck: ['th03-004', 'th03-004'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice).toMatchObject({ kind: 'summonFromHand', player: PLAYER })
    expect(after.pendingChoice.options).toHaveLength(3)
    const fromDeck = after.pendingChoice.options.find((o) => o.label.includes('กอง'))
    const called = act(after, { type: 'choose', optionId: fromDeck.id })
    expect(ids(called.players.player.field).filter(Boolean)).toEqual(['th03-004', 'th03-004'])
    expect(called.players.player.field[1].position).toBe('attack')
    expect(called.players.player.field[1].cannotAttackTurn).toBeUndefined()
    expect(called.pendingChoice).toBeNull()
  })

  it('ถูกทำลายตอนเป็นฝ่ายรับ → ผู้โจมตี ATK −300 จนจบเทิร์น', () => {
    const s = aiBattle({ player: { field: ['th03-004'] }, ai: { field: ['th01-017'] } })
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]).toBeNull()
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1400)
    expect(lastLog(after).details.join(' ')).toContain('เหล็กใน')
  })
})

describe('นกเงือก: ดูบนกอง 3 ใบ', () => {
  it('ไม่มีพืช → เลือก 1 · ที่เหลือไว้ใต้กอง', () => {
    const s = makeState({
      player: { hand: ['th03-005'], field: ['th01-016'], deck: ['th01-001', 'th03-007', 'th01-019', 'th01-002'] },
    })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0), tributes: [uidAt(s, PLAYER, 0)] })
    expect(after.pendingChoice.options.map((o) => o.label)).toEqual(['เสือสมิงเงาพฤกษ์', 'ม้าศึกอาชาไนย'])
    const done = act(after, { type: 'choose', optionId: after.pendingChoice.options[0].id })
    expect(ids(done.players.player.hand)).toEqual(['th03-007'])
    expect(ids(done.players.player.deck)).toEqual(['th01-002', 'th01-001', 'th01-019'])
  })

  it('มีพืชหงาย → เลือกได้ 2 ใบ', () => {
    const s = makeState({
      player: { hand: ['th03-005'], field: ['th01-016', 'th03-001'], deck: ['th03-007', 'th01-019', 'th01-001'] },
    })
    let next = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0), tributes: [uidAt(s, PLAYER, 0)] })
    next = act(next, { type: 'choose', optionId: next.pendingChoice.options[0].id })
    expect(next.pendingChoice.kind).toBe('look')
    next = act(next, { type: 'choose', optionId: next.pendingChoice.options[0].id })
    expect(ids(next.players.player.hand)).toEqual(['th03-007', 'th01-019'])
  })
})

describe('พญาเสือ: จ่าฝูงนับเผ่าสัตว์ที่ต่างกัน', () => {
  it('พืช + แมลง + นก = +600 · สัตว์ใหญ่ไม่นับ', () => {
    const s = makeState({ player: { field: ['th03-006', 'th03-001', 'th03-004', 'th03-005', 'th03-007'] } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(3300)
    const big = makeState({ player: { field: ['th03-006', 'th03-007'] } })
    expect(getFieldAtk(big, PLAYER, uidAt(big, PLAYER, 0))).toBe(2700)
  })
})

describe('เสือสมิง: พลิกซุ่ม', () => {
  it('ถูกตีจนพลิก และจะชนะ → เปลี่ยนเป็นท่าโจมตี ทำลายผู้โจมตี', () => {
    const s = aiBattle({ player: { field: [SET('th03-007'), 'th03-004'] }, ai: { field: ['th01-016'] } })
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th03-007', position: 'attack' })
    expect(after.players.ai.field[0]).toBeNull()
    expect(lastLog(after).details.join(' ')).toContain('พลิกซุ่ม: เปลี่ยนเป็นท่าโจมตี (+200 มีสัตว์ต่างเผ่า)')
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(1600)
  })

  it('สู้ไม่ได้ → คงท่าตั้งรับ (ไม่เสีย LP)', () => {
    const s = aiBattle({ player: { field: [SET('th03-007')] }, ai: { field: ['th01-022'] } })
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]).toBeNull()
    expect(after.players.player.lp).toBe(8000)
  })
})

describe('หมอช้างพันธะไพร: อัญเชิญพิเศษ + เรียกสัตว์ป่า', () => {
  it('มีพืชป่าหงาย → อัญเชิญพิเศษจากมือท่าตั้งรับ · ไม่มีพืชทำไม่ได้', () => {
    const s = makeState({ player: { hand: ['th03-008'], field: ['th03-002'] } })
    const after = act(s, { type: 'specialSummon', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.field[1]).toMatchObject({ cardId: 'th03-008', position: 'defense' })
    expect(after.players.player.hasNormalSummoned).toBe(false)
    const none = makeState({ player: { hand: ['th03-008'] } })
    expect(specialSummonBlocker(none, PLAYER, handUid(none, PLAYER, 0))).toBe('ต้องมีพืชไพรมหาวันหงายบนสนามเรา')
  })

  it('ถอนแต้มพืช → เรียกสัตว์ป่าระดับ 1–4 จากมือ ท่าตั้งรับ', () => {
    const s = grow(makeState({ player: { hand: ['th03-007', 'th01-001'], field: ['th03-008', 'th03-001'] } }), 1, 1)
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    expect(after.players.player.field[1].growth).toBe(0)
    expect(after.pendingChoice.options.map((o) => o.label)).toEqual([getCardById('th03-007').name])
    const called = act(after, { type: 'choose', optionId: after.pendingChoice.options[0].id })
    expect(called.players.player.field[2]).toMatchObject({ cardId: 'th03-007', position: 'defense', cannotAttackTurn: 3 })
    const dry = makeState({ player: { hand: ['th03-007'], field: ['th03-008', 'th03-001'] } })
    expect(activationBlocker(dry, PLAYER, uidAt(dry, PLAYER, 0))).toBe('ต้องมีพืชไพรมหาวันหงายที่มีแต้มเติบโต')
  })
})

describe('ผู้ดูแลรังไพร / ไทรใหญ่ / ราชินีต่อ', () => {
  it('ผู้ดูแลรัง: อัญเชิญพิเศษเมื่อมีแมลงป่า แล้วเรียกฝูงต่อเพิ่มจากกอง', () => {
    const s = makeState({ player: { hand: ['th03-018'], field: ['th03-004'], deck: ['th03-004', 'th01-001'] } })
    let next = act(s, { type: 'specialSummon', uid: handUid(s, PLAYER, 0) })
    expect(next.players.player.field[1]).toMatchObject({ cardId: 'th03-018', position: 'defense' })
    next = act(next, { type: 'activate', uid: next.players.player.field[1].uid })
    expect(next.pendingChoice.options.map((o) => o.label)).toEqual(['ฝูงต่อหัวเสือ (จากกอง)'])
    next = act(next, { type: 'choose', optionId: next.pendingChoice.options[0].id })
    expect(next.players.player.field[2]).toMatchObject({ cardId: 'th03-004', position: 'defense' })
  })

  it('ไทรใหญ่: รวมร่างพืชป่า 2 ตัวบนสนาม', () => {
    const s = makeState({ player: { field: ['th03-001', 'th03-002'] } })
    s.players.player.extraDeck = [{ uid: 'x-tree', cardId: 'th03-017' }]
    const options = getMountOptions(s, PLAYER)
    expect(options).toHaveLength(1)
    const after = act(s, { type: 'mount', fusionUid: 'x-tree', materials: options[0].pairs[0] })
    expect(ids(after.players.player.field).filter(Boolean)).toEqual(['th03-017'])
    expect(lastLog(after).text).toContain('รวมร่าง')
  })

  it('ไทรใหญ่: ถอนแต้มยกเลิกการโจมตีพืช/แมลงป่าตัวอื่น', () => {
    const s = grow(aiBattle({ player: { field: ['th03-017', 'th03-004'] }, ai: { field: ['th01-022'] } }), 0, 1)
    const attacked = aiAttack(s, 0, 1)
    const option = attacked.pendingResponse.options.find((o) => o.kind === 'canopy')
    expect(option).toBeTruthy()
    const after = act(attacked, { type: 'respond', trapUid: option.id })
    expect(after.players.player.field[1]).toMatchObject({ cardId: 'th03-004' })
    expect(after.players.player.field[0].growth).toBe(0)
    expect(after.players.player.lp).toBe(8000)
  })

  it('ราชินีต่อ: รวมร่างฝูงต่อ 3 ตัว · จบเทิร์นเรียกฝูงต่อจากกอง', () => {
    const s = makeState({ player: { field: ['th03-004', 'th03-004', 'th03-004'], deck: ['th03-004', 'th01-001'] } })
    s.players.player.extraDeck = [{ uid: 'x-queen', cardId: 'th03-019' }]
    const [option] = getMountOptions(s, PLAYER)
    expect(option.pairs[0]).toHaveLength(3)
    let next = act(s, { type: 'mount', fusionUid: 'x-queen', materials: option.pairs[0] })
    expect(ids(next.players.player.field).filter(Boolean)).toEqual(['th03-019'])
    next = act(next, { type: 'endTurn' })
    expect(ids(next.players.player.field).filter(Boolean)).toEqual(['th03-019', 'th03-004'])
  })
})

describe('พรานผู้ผูกมิตร: คืนลูกพรานขึ้นมือ → อัญเชิญพิเศษ แล้วเรียกสัตว์เล็ก', () => {
  it('ลูกพรานกลับมือ · เรียกสัตว์เผ่าที่ยังไม่มีบนสนาม', () => {
    const s = makeState({ player: { hand: ['th03-009', 'th03-004'], field: ['th01-001'] } })
    const after = act(s, { type: 'specialSummon', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.field[0].cardId).toBe('th03-009')
    expect(ids(after.players.player.hand)).toEqual(['th03-004', 'th01-001'])
    expect(after.pendingChoice).toMatchObject({ kind: 'summonFromHand' })
    const called = act(after, { type: 'choose', optionId: after.pendingChoice.options[0].id })
    expect(called.players.player.field[1]).toMatchObject({ cardId: 'th03-004', position: 'defense' })
  })
})

describe('ไพรมหาวัน / ฝนแรกผลิใบ', () => {
  it('สัตว์ต่างเผ่า 2 ตัว → สัตว์ฝ่ายเรา ATK +200 · ตัวเดียวไม่ได้', () => {
    const s = makeState({ player: { field: ['th03-004', 'th03-007'], fieldSpell: 'th03-010' } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(1000)
    const alone = makeState({ player: { field: ['th03-004'], fieldSpell: 'th03-010' } })
    expect(getFieldAtk(alone, PLAYER, uidAt(alone, PLAYER, 0))).toBe(800)
  })

  it('ฝนแรก: พืชทุกตัว +1 ไม่เกินเพดาน แล้วจั่ว 1', () => {
    const s = grow(makeState({ player: { hand: ['th03-011'], field: ['th03-001', 'th03-002'] } }), 1, 2)
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.field[0].growth).toBe(1)
    expect(after.players.player.field[1].growth).toBe(2)
    expect(after.players.player.hand).toHaveLength(1)
  })
})

describe('สับแนวพงไพร (กับดัก)', () => {
  it('ถอนสัตว์ที่ถูกโจมตีขึ้นมือ ส่งตัวใหม่ลงแทน การโจมตีจบ', () => {
    const s = aiBattle({
      player: { hand: ['th03-004'], field: ['th03-007'], spellTrap: [{ id: 'th03-012', setTurn: 1 }] },
      ai: { field: ['th01-017'] },
    })
    const pending = aiAttack(s, 0, 0)
    const option = pending.pendingResponse.options.find((o) => o.kind === 'swap')
    expect(option.label).toBe('🪤 สับแนวพงไพร: ส่ง ฝูงต่อหัวเสือ แทน')
    const after = applyAction(pending, { type: 'respond', player: PLAYER, trapUid: option.id })
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th03-004', position: 'defense' })
    expect(ids(after.players.player.hand)).toEqual(['th03-007'])
    expect(after.players.player.lp).toBe(8000)
    expect(lastLog(after).event.type).toBe('attackNegated')
  })
})

describe('ขึ้นขี่ / ลงจากหลัง', () => {
  it('ลูกพราน + ม้าศึก → พรานขี่เสือ ช่องเดิมของคน · เทิร์นละครั้ง', () => {
    const s = makeState({ player: { field: ['th01-001', 'th01-019', 'th01-004', 'th03-008'] } })
    const option = getMountOptions(s, PLAYER).find((o) => s.players.player.extraDeck.find((c) => c.uid === o.fusionUid).cardId === 'th03-013')
    const after = act(s, { type: 'mount', fusionUid: option.fusionUid, materials: option.pairs[0] })
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th03-013', position: 'attack' })
    expect(ids(after.players.player.graveyard)).toEqual(['th01-001', 'th01-019'])
    expect(mountBlocker(after, PLAYER)).toBe('ขึ้นขี่ไปแล้วเทิร์นนี้ (เทิร์นละ 1 ครั้ง)')
  })

  it('ร่างขี่ถูกทำลาย → เลือกคืนวัตถุดิบ 1 ตัวท่าตั้งรับ (ใบละครั้ง)', () => {
    let s = makeState({ player: { field: ['th01-001', 'th01-019'] } })
    const option = getMountOptions(s, PLAYER)[0]
    s = act(s, { type: 'mount', fusionUid: option.fusionUid, materials: option.pairs[0] })
    s.activePlayer = AI
    s.phase = 'battle'
    s.players.ai.field[0] = { uid: 'ai-big', cardId: 'th01-022', position: 'attack', faceDown: false, hasAttacked: false, summonedTurn: 1 }
    const hit = aiAttack(s, 0, 0)
    expect(hit.pendingChoice).toMatchObject({ kind: 'dismount', player: PLAYER })
    expect(hit.pendingChoice.options.map((o) => o.label)).toEqual(['ลูกพราน', 'ม้าศึกอาชาไนย', 'ไม่คืน'])
    const back = act(hit, { type: 'choose', optionId: hit.pendingChoice.options[1].id })
    expect(lastLog(back).event.showcase).toMatchObject({ kind: 'dismount', cardId: 'th03-013', resultCardId: 'th01-019' })
    expect(back.players.player.field.find(Boolean)).toMatchObject({ cardId: 'th01-019', position: 'defense' })
  })

  it('พรานขี่เสือ: โจมตีตัว ATK สูงสุดของศัตรู +300 · ตัวอื่นไม่ได้', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: [{ id: 'th03-013' }] },
      ai: { field: ['th01-017', 'th01-001'] },
    })
    const reasons = (zone) => previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), uidAt(s, AI, zone)).attacker.bonuses.map((b) => b.reason)
    expect(reasons(0)).toContain('พรานขี่เสือ: ไล่ล่าจ่าฝูง')
    expect(reasons(1)).not.toContain('พรานขี่เสือ: ไล่ล่าจ่าฝูง')
  })

  it('หลวงตาธุดงค์: สัตว์ศัตรูโจมตีสัตว์ตัวอื่นของเรา → ยกเลิกได้ · ผู้โจมตีไม่ใช่สัตว์ใช้ไม่ได้', () => {
    const s = aiBattle({ player: { field: ['th03-014', 'th03-007'] }, ai: { field: ['th01-019', 'th01-017'] } })
    const pending = aiAttack(s, 0, 1)
    const mercy = pending.pendingResponse.options.find((o) => o.kind === 'mercy')
    const after = applyAction(pending, { type: 'respond', player: PLAYER, trapUid: mercy.id })
    expect(lastLog(after).text).toContain('ถูกยกเลิก (เมตตา)')
    expect(after.players.player.field[1].cardId).toBe('th03-007')
    expect(aiAttack(s, 1, 1).pendingResponse).toBeNull()
  })

  it('หมอช้างทรงคชสาร: จบเทิร์น พืชเติบโตเพิ่ม 1 แล้วฟื้น LP 200', () => {
    const s = makeState({ player: { field: [{ id: 'th03-015' }, 'th03-001'] } })
    const after = act(s, { type: 'endTurn' })
    expect(after.players.player.field[1].growth).toBe(2)
    expect(after.players.player.lp).toBe(8200)
  })

  it('โหราจารย์ทรงนกเงือก: ดูกับดักแล้ว ใบนั้นเปิดตอนใบนี้โจมตีไม่ได้ (ตัวอื่นยังโดน)', () => {
    const s = makeState({
      player: { field: [{ id: 'th03-016' }, 'th01-017'] },
      ai: { field: ['th01-001'], spellTrap: [{ id: 'th01-015', setTurn: 1 }] },
    })
    let next = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    expect(next.pendingChoice).toMatchObject({ kind: 'scout' })
    next = act(next, { type: 'choose', optionId: next.pendingChoice.options[0].id })
    expect(lastLog(next).details[0]).toContain('ขวากหนามอาคมพราน')
    next = act(next, { type: 'enterBattle' })
    expect(act(next, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) }).pendingResponse).toBeNull()
    expect(act(next, { type: 'attack', attackerUid: uidAt(s, PLAYER, 1), targetUid: uidAt(s, AI, 0) }).pendingResponse).not.toBeNull()
  })
})

describe('AI ใช้การ์ด TH03', () => {
  it('AI ขึ้นขี่เมื่อร่างขี่แรงกว่าวัตถุดิบ', () => {
    const s = makeState({ activePlayer: AI, ai: { field: ['th01-001', 'th01-019'] } })
    expect(getAiAction(s)).toMatchObject({ type: 'mount' })
  })

  it('ตะเคียนยังห้ามเปลี่ยนท่า (ข้อความเดิม)', () => {
    const s = makeState({ player: { field: ['th06-005'] }, ai: { field: ['th01-017'] } })
    const next = act(act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) }), { type: 'endTurn' })
    expect(positionChangeBlocker(next, AI, uidAt(s, AI, 0))).toBe('ถูกรากตะเคียนพันไว้ เปลี่ยนท่าไม่ได้')
  })
})

describe('ขึ้นขี่: คนที่เป็นผี/อสูรขี่ไม่ได้', () => {
  it('ปอบ / พรานไสยเวท / อาจารย์ไสยดำ ไม่เข้าสูตร · หมอช้างเป็นคนจริงเข้าได้', () => {
    const ghosts = makeState({ player: { field: ['th06-007', 'th06-009', 'th06-010', 'th01-020', 'th03-005'] } })
    expect(getMountOptions(ghosts, PLAYER)).toEqual([])
    const living = makeState({ player: { field: ['th01-004', 'th01-020'] } })
    const riders = getMountOptions(living, PLAYER).map((o) => living.players.player.extraDeck.find((c) => c.uid === o.fusionUid).cardId)
    expect(riders).toEqual(['th03-015'])
  })
})
