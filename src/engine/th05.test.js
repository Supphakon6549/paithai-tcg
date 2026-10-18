import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  createGame,
  currentActor,
  getFieldAtk,
  getSummonableHand,
  handCardBlocker,
  ritualTributeProblem,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const SET = (id) => ({ id, position: 'defense', faceDown: true })
const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const graveIds = (s, id = PLAYER) => s.players[id].graveyard.map((c) => c.cardId)

describe('TH05-003 กินนรีขับลำนำฟ้า: ฟื้น LP 300', () => {
  it('มีเทวดาใบอื่นหงายอยู่ → ฟื้น LP (เกิน 8,000 ได้) และใช้ได้ใบละครั้งต่อเทิร์น', () => {
    const s = makeState({ player: { field: ['th05-003', 'th05-001'] } })
    const uid = uidAt(s, PLAYER, 0)
    expect(activationBlocker(s, PLAYER, uid)).toBeNull()
    const after = act(s, { type: 'activate', uid })
    expect(after.players.player.lp).toBe(8300)
    expect(lastLog(after).details).toEqual(['LP 8,000 + 300 = 8,300'])
    expect(lastLog(after).event.heal).toEqual([{ player: PLAYER, amount: 300, lpBefore: 8000, lpAfter: 8300 }])
    expect(activationBlocker(after, PLAYER, uid)).toBe('ใช้ความสามารถไปแล้วเทิร์นนี้')
    // เทิร์นถัดไปของเราใช้ได้อีก
    after.turn += 2
    expect(activationBlocker(after, PLAYER, uid)).toBeNull()
  })

  it('ไม่มีเทวดาใบอื่น หรือเทวดาคว่ำอยู่ → ใช้ไม่ได้', () => {
    const none = makeState({ player: { field: ['th05-003', 'th01-001'] } })
    expect(activationBlocker(none, PLAYER, uidAt(none, PLAYER, 0))).toBe('ต้องมีมอนสเตอร์เผ่าเทวดาใบอื่นหงายหน้าบนสนามเรา')
    const hidden = makeState({ player: { field: ['th05-003', SET('th05-001')] } })
    expect(activationBlocker(hidden, PLAYER, uidAt(hidden, PLAYER, 0))).not.toBeNull()
  })

  it('ตัวเองคว่ำอยู่ หรือไม่ใช่เฟสหลัก → ใช้ไม่ได้', () => {
    const facedown = makeState({ player: { field: [SET('th05-003'), 'th05-001'] } })
    expect(activationBlocker(facedown, PLAYER, uidAt(facedown, PLAYER, 0))).toBe('การ์ดคว่ำอยู่ ใช้ความสามารถไม่ได้')
    const battle = makeState({ phase: 'battle', player: { field: ['th05-003', 'th05-001'] } })
    expect(activationBlocker(battle, PLAYER, uidAt(battle, PLAYER, 0))).toBe('ใช้ความสามารถได้เฉพาะเฟสหลัก')
  })
})

describe('TH05-005 พระอินทร์ จอมอาสนี: ทิ้ง 1 ใบ ลด ATK ศัตรู 500 จนจบเทิร์น', () => {
  const setup = (aiField = ['th01-011']) =>
    makeState({ player: { field: ['th05-005', 'th01-017'], hand: ['th01-001'] }, ai: { field: aiField } })

  it('ทิ้งการ์ด ลด ATK และตีชนะได้ แล้วหมดผลเมื่อจบเทิร์น', () => {
    const s = setup()
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), discardUid: handUid(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1300)
    expect(after.players.player.hand).toHaveLength(0)
    expect(graveIds(after)).toEqual(['th01-001'])
    expect(lastLog(after).details).toEqual(['คุณทิ้ง ลูกพราน ลงสุสาน', 'อสูรทศกัณฐ์จำแลง: ATK 1,800 − 500 = 1,300'])

    // ทหารเสือ 1,700 ตีอสูรที่เหลือ 1,300 ชนะ
    let battle = act(after, { type: 'enterBattle' })
    battle = act(battle, { type: 'attack', attackerUid: uidAt(s, PLAYER, 1), targetUid: uidAt(s, AI, 0) })
    expect(battle.players.ai.lp).toBe(8000 - 400)

    const nextTurn = act(after, { type: 'endTurn' })
    expect(getFieldAtk(nextTurn, AI, uidAt(s, AI, 0))).toBe(1800)
  })

  it('ATK ต่ำสุด 0', () => {
    const s = setup(['th01-004'])
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), discardUid: handUid(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(0)
    expect(lastLog(after).details.at(-1)).toBe('เด็กวัด: ATK 300 − 500 = 0 (ต่ำสุด 0)')
  })

  it('ใช้ได้ 1 ครั้งต่อชื่อการ์ดต่อเทิร์น แม้มีพระอินทร์ 2 ใบ', () => {
    const s = makeState({ player: { field: ['th05-005', 'th05-005'], hand: ['th01-001', 'th01-001'] }, ai: { field: ['th01-011'] } })
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), discardUid: handUid(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(activationBlocker(after, PLAYER, uidAt(s, PLAYER, 1))).toBe('ใช้ความสามารถของ "พระอินทร์ จอมอาสนี" ไปแล้วเทิร์นนี้')
  })

  it('ต้องมีการ์ดในมือ เป้าต้องหงายหน้า', () => {
    const empty = makeState({ player: { field: ['th05-005'] }, ai: { field: ['th01-011'] } })
    expect(activationBlocker(empty, PLAYER, uidAt(empty, PLAYER, 0))).toBe('ต้องมีการ์ดในมือให้ทิ้ง 1 ใบ')
    const hiddenOnly = makeState({ player: { field: ['th05-005'], hand: ['th01-001'] }, ai: { field: [SET('th01-011')] } })
    expect(activationBlocker(hiddenOnly, PLAYER, uidAt(hiddenOnly, PLAYER, 0))).toBe('ฝ่ายตรงข้ามไม่มีมอนสเตอร์หงายหน้า')
    const mixed = makeState({ player: { field: ['th05-005'], hand: ['th01-001'] }, ai: { field: ['th01-001', SET('th01-011')] } })
    expect(() =>
      act(mixed, { type: 'activate', uid: uidAt(mixed, PLAYER, 0), discardUid: handUid(mixed, PLAYER, 0), targetUid: uidAt(mixed, AI, 1) })
    ).toThrow('หงายหน้า')
  })
})

describe('TH05-006 พิธีบวงสรวงจอมเทวา (พิธีกรรม)', () => {
  it('สังเวยจากมือรวมระดับ 8 → อัญเชิญพระอินทร์ท่าโจมตี ไม่เสียสิทธิ์อัญเชิญปกติ', () => {
    const s = makeState({ player: { hand: ['th05-006', 'th05-005', 'th01-017', 'th01-002', 'th01-001'] } })
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), tributes: [handUid(s, PLAYER, 2), handUid(s, PLAYER, 3)] })
    const p = after.players.player
    expect(p.field[0]).toMatchObject({ cardId: 'th05-005', position: 'attack', faceDown: false })
    expect(graveIds(after)).toEqual(['th01-017', 'th01-002', 'th05-006'])
    expect(p.hand.map((c) => c.cardId)).toEqual(['th01-001'])
    expect(p.hasNormalSummoned).toBe(false)
    expect(getSummonableHand(after, PLAYER).map((c) => c.cardId)).toEqual(['th01-001'])
    expect(lastLog(after).text).toBe(
      '🙏 คุณใช้ พิธีบวงสรวงจอมเทวา → อัญเชิญพิธีกรรม พระอินทร์ จอมอาสนี (ระดับ 8 · ATK 2,800 / DEF 2,600) ลงช่องที่ 1'
    )
    expect(lastLog(after).details[0]).toBe('สังเวย: ทหารเสือดาบสองมือ (ระดับ 4 · มือ) + พรานหนุ่ม (ระดับ 4 · มือ)')
  })

  it('ผสมมือกับสนาม และสนามที่ว่างหลังสังเวยใช้วางพระอินทร์ได้', () => {
    const full = ['th01-016', 'th01-001', 'th01-001', 'th01-001', 'th01-001']
    const s = makeState({ player: { hand: ['th05-006', 'th05-005', 'th01-017'], field: full } })
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), tributes: [handUid(s, PLAYER, 2), uidAt(s, PLAYER, 1), uidAt(s, PLAYER, 2)] })
    expect(after.players.player.field[1].cardId).toBe('th05-005')
  })

  it('เอราวัณใบเดียวแทนระดับ 8 ได้ ทั้งจากมือและบนสนาม (แม้คว่ำอยู่)', () => {
    const fromHand = makeState({ player: { hand: ['th05-006', 'th05-005', 'th05-004'] } })
    expect(ritualTributeProblem(fromHand, PLAYER, handUid(fromHand, PLAYER, 0), [handUid(fromHand, PLAYER, 2)])).toBeNull()
    const fromField = makeState({ player: { hand: ['th05-006', 'th05-005'], field: [SET('th05-004')] } })
    const after = act(fromField, { type: 'playSpell', uid: handUid(fromField, PLAYER, 0), tributes: [uidAt(fromField, PLAYER, 0)] })
    expect(after.players.player.field[0].cardId).toBe('th05-005')
    expect(graveIds(after)).toEqual(['th05-004', 'th05-006'])
  })

  it('เอราวัณรวมกับใบอื่นนับเป็นระดับ 6 ตามปกติ', () => {
    const s = makeState({ player: { hand: ['th05-006', 'th05-005', 'th05-004', 'th01-004'] } })
    expect(ritualTributeProblem(s, PLAYER, handUid(s, PLAYER, 0), [handUid(s, PLAYER, 2), handUid(s, PLAYER, 3)])).toBe(
      'ระดับรวม 7 ยังไม่ถึง 8'
    )
  })

  it('ใช้ไม่ได้เมื่อไม่มีพระอินทร์ในมือ ระดับรวมไม่พอ หรือไม่มีช่องว่าง', () => {
    const noTarget = makeState({ player: { hand: ['th05-006', 'th01-017', 'th01-002'] } })
    expect(handCardBlocker(noTarget, PLAYER, handUid(noTarget, PLAYER, 0))).toBe('ต้องมี "พระอินทร์ จอมอาสนี" อยู่ในมือ')
    const weak = makeState({ player: { hand: ['th05-006', 'th05-005', 'th01-001'], field: ['th01-016'] } })
    expect(handCardBlocker(weak, PLAYER, handUid(weak, PLAYER, 0))).toBe('มอนสเตอร์ในมือและบนสนามมีระดับรวม 4 ยังไม่ถึง 8')
    const full = makeState({ player: { hand: ['th05-006', 'th05-005', 'th05-004'], field: Array(5).fill('th01-001') } })
    expect(ritualTributeProblem(full, PLAYER, handUid(full, PLAYER, 0), [handUid(full, PLAYER, 2)])).toBe('ไม่มีช่องมอนสเตอร์ว่างให้อัญเชิญ')
  })

  it('พระอินทร์อัญเชิญปกติหรือสังเวยไม่ได้', () => {
    const s = makeState({ player: { hand: ['th05-005'], field: ['th01-001', 'th01-001'] } })
    expect(getSummonableHand(s, PLAYER)).toEqual([])
    expect(() => act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })).toThrow('อัญเชิญปกติไม่ได้')
  })

  it('ระบบเดียวกันใช้กับพิธี TH01: พระอาจารย์ใบเดียวแทนระดับ 8 → ครูบาศรีวิชัย', () => {
    const s = makeState({ player: { hand: ['th01-008', 'th01-007'], field: ['th01-006'] } })
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), tributes: [uidAt(s, PLAYER, 0)] })
    expect(after.players.player.field[0].cardId).toBe('th01-007')
  })
})

describe('TH05-007 วิมานเหนือเมฆ (เวทสนาม)', () => {
  it('เทวดาหงายฝ่ายเรา ATK +200 เท่านั้น', () => {
    const s = makeState({ player: { hand: ['th05-007'], field: ['th05-001', 'th01-001'] }, ai: { field: ['th05-001'] } })
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.fieldSpell.cardId).toBe('th05-007')
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(1000)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 1))).toBe(800)
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(800)
    expect(lastLog(after).event.spellPlaced).toEqual([
      { player: PLAYER, uid: handUid(s, PLAYER, 0), cardId: 'th05-007', zoneType: 'field', zone: 0, faceDown: false },
    ])
  })

  it('ลงใบใหม่ → ใบเดิมลงสุสาน', () => {
    const s = makeState({ player: { hand: ['th05-007'], fieldSpell: 'th05-007' } })
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0) })
    expect(graveIds(after)).toEqual(['th05-007'])
    expect(lastLog(after).details).toEqual(['ส่งเวทสนามเดิม วิมานเหนือเมฆ ลงสุสาน'])
  })

  it('บัฟแสดงในบันทึกการต่อสู้', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th05-002'], fieldSpell: 'th05-007' }, ai: { field: ['th01-011'] } })
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    // เทวทหารอาสนี (เทวดา) ได้ +200 จากเวทสนาม และ +200 จากเผ่าเทวดาชนะเผ่าอสูร
    expect(lastLog(after).details[0]).toBe(
      'ฝ่ายโจมตี — เทวทหารอาสนี: ATK 1,700 + 200 (เอฟเฟกต์: วิมานเหนือเมฆ: เผ่าเทวดาฝ่ายเรา) + 200 (เผ่า: เผ่าเทวดา ชนะทางเผ่าอสูร) = 2,100'
    )
  })
})

describe('TH05-008 ม่านอาสนีพิทักษ์ (กับดัก)', () => {
  // AI ตีเทวดาหงายของผู้เล่น ขณะผู้เล่นมีกับดักที่วางไว้ก่อนเทิร์นนี้
  const attackOnDeva = (overrides = {}) =>
    makeState({
      activePlayer: AI,
      phase: 'battle',
      ai: { field: [overrides.attacker ?? 'th01-011'] },
      player: { field: [overrides.target ?? 'th05-002'], spellTrap: [{ id: 'th05-008', setTurn: overrides.setTurn ?? 1 }] },
    })
  const aiAttack = (s) => applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: uidAt(s, PLAYER, 0) })

  it('วางคว่ำได้ บันทึกของ AI ไม่บอกชื่อการ์ด', () => {
    const s = makeState({ player: { hand: ['th05-008'] } })
    const after = act(s, { type: 'setTrap', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.spellTrap[0]).toMatchObject({ cardId: 'th05-008', faceDown: true, setTurn: 3 })
    expect(lastLog(after).text).toBe('🪤 คุณวางกับดัก ม่านอาสนีพิทักษ์คว่ำในช่องเวท/กับดักที่ 1')
    const ai = makeState({ activePlayer: AI, ai: { hand: ['th05-008'] } })
    expect(lastLog(applyAction(ai, { type: 'setTrap', player: AI, uid: handUid(ai, AI, 0) })).text).toBe(
      '🪤 คู่ต่อสู้วางการ์ด 1 ใบคว่ำในช่องเวท/กับดักที่ 1'
    )
  })

  it('ถูกโจมตี → รอฝ่ายรับตัดสินใจ ฝ่ายโจมตีทำอะไรต่อไม่ได้', () => {
    const pending = aiAttack(attackOnDeva())
    expect(pending.pendingResponse).toMatchObject({ responder: PLAYER, trapUids: [pending.players.player.spellTrap[0].uid] })
    expect(currentActor(pending)).toBe(PLAYER)
    expect(lastLog(pending).kind).toBe('pending')
    expect(() => applyAction(pending, { type: 'endTurn', player: AI })).toThrow('รอฝ่ายรับ')
    expect(() => act(pending, { type: 'endTurn' })).toThrow('ต้องตัดสินใจก่อน')
  })

  it('เปิดกับดัก → ยกเลิกการโจมตี ไม่มีความเสียหาย ผู้โจมตีใช้สิทธิ์แล้ว กับดักลงสุสาน', () => {
    const pending = aiAttack(attackOnDeva())
    const trapUid = pending.pendingResponse.trapUids[0]
    const after = act(pending, { type: 'respond', trapUid })
    expect(after.pendingResponse).toBeNull()
    expect(after.players.player.field[0]).not.toBeNull()
    expect(after.players.player.lp).toBe(8000)
    expect(after.players.player.spellTrap[0]).toBeNull()
    expect(graveIds(after)).toEqual(['th05-008'])
    expect(after.players.ai.field[0].hasAttacked).toBe(true)
    expect(lastLog(after).text).toBe('⚔️ อสูรทศกัณฐ์จำแลง โจมตี เทวทหารอาสนี — ถูกยกเลิกด้วยกับดัก')
    expect(lastLog(after).event).toMatchObject({ type: 'attackNegated', player: AI, trap: trapUid })
  })

  it('ไม่เปิด → ต่อสู้ตามปกติ', () => {
    // ช้างศึก 2,000 (ปฐวี ชนะอาสนี +300) ตีเทวทหารอาสนี 1,700
    const pending = aiAttack(attackOnDeva({ attacker: 'th01-020' }))
    const after = act(pending, { type: 'respond', trapUid: null })
    expect(after.players.player.field[0]).toBeNull()
    expect(after.players.player.lp).toBe(8000 - 600)
    expect(after.players.player.spellTrap[0]).not.toBeNull()
    expect(lastLog(after).details).toContain('คุณไม่เปิดกับดัก')
    expect(lastLog(after).event.type).toBe('attack')
  })

  it('ไม่เข้าเงื่อนไข: เป้าไม่ใช่เทวดา / เป้าคว่ำ / กับดักเพิ่งวางเทิร์นนี้ / ขุนศึกอาทมาฏโจมตี', () => {
    for (const s of [
      attackOnDeva({ target: 'th01-001' }),
      attackOnDeva({ target: SET('th05-002') }),
      attackOnDeva({ setTurn: 3 }),
      attackOnDeva({ attacker: 'th01-018' }),
    ]) {
      expect(aiAttack(s).pendingResponse).toBeNull()
    }
  })

  it('AI เป็นฝ่ายรับ → เปิดกับดักเอง', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: ['th01-011'] },
      ai: { field: ['th05-002'], spellTrap: [{ id: 'th05-008' }] },
    })
    const pending = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    const response = getAiAction(pending)
    expect(response).toEqual({ type: 'respond', player: AI, trapUid: pending.players.ai.spellTrap[0].uid })
    expect(applyAction(pending, response).players.ai.field[0]).not.toBeNull()
  })

  it('ช่องเวท/กับดักเต็ม → วางไม่ได้', () => {
    const s = makeState({ player: { hand: ['th05-008'], spellTrap: Array(5).fill({ id: 'th05-008' }) } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('ช่องเวท/กับดักเต็มแล้ว')
  })

  it('การ์ดเวท/กับดักที่ยังไม่รองรับ ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th01-013'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('การ์ดใบนี้ยังใช้ไม่ได้ในเกมขั้นนี้')
  })
})

describe('AI ใช้การ์ด TH05', () => {
  const aiMain = (spec) => makeState({ activePlayer: AI, ...spec })

  it('ลงเวทสนาม / ทำพิธีด้วยเอราวัณ / ฟื้น LP / วางกับดัก', () => {
    expect(getAiAction(aiMain({ ai: { hand: ['th05-007'] } }))).toMatchObject({ type: 'playSpell' })
    const ritual = aiMain({ ai: { hand: ['th05-006', 'th05-005', 'th05-004'] } })
    expect(getAiAction(ritual)).toEqual({ type: 'playSpell', player: AI, uid: handUid(ritual, AI, 0), tributes: [handUid(ritual, AI, 2)] })
    expect(getAiAction(aiMain({ ai: { field: ['th05-003', 'th05-001'] } }))).toMatchObject({ type: 'activate' })
    expect(getAiAction(aiMain({ ai: { hand: ['th05-008'] } }))).toMatchObject({ type: 'setTrap' })
  })

  it('ลด ATK เฉพาะเมื่อทำให้ตีชนะได้ และทิ้งใบที่มีค่าน้อยที่สุด', () => {
    // จอมทัพ 3,000 แรงกว่าพระอินทร์ 2,800 → ลดเหลือ 2,500 แล้วตีชนะ
    const s = aiMain({
      ai: { field: ['th05-005'], hand: ['th01-017', 'th01-004'], hasNormalSummoned: true },
      player: { field: ['th01-022'] },
    })
    expect(getAiAction(s)).toEqual({
      type: 'activate', player: AI, uid: uidAt(s, AI, 0), discardUid: handUid(s, AI, 1), targetUid: uidAt(s, PLAYER, 0),
    })
    // ขุนศึก 2,500 อ่อนกว่าอยู่แล้ว → ไม่ต้องใช้
    const easy = aiMain({ ai: { field: ['th05-005'], hand: ['th01-004'], hasNormalSummoned: true }, player: { field: ['th01-018'] } })
    expect(getAiAction(easy).type).not.toBe('activate')
  })
})

describe('จำลองเกม AI ปะทะ AI ด้วยสำรับเทวา', () => {
  const CELESTIAL = [
    ['th05-001', 4], ['th05-002', 4], ['th05-003', 4], ['th05-004', 2], ['th05-005', 2],
    ['th05-006', 2], ['th05-007', 2], ['th05-008', 3],
    ['th01-001', 4], ['th01-016', 4], ['th01-019', 3], ['th01-011', 3], ['th01-005', 3],
  ]
  const countCards = (p) =>
    p.deck.length + p.hand.length + p.graveyard.length + p.field.filter(Boolean).length +
    p.spellTrap.filter(Boolean).length + (p.fieldSpell ? 1 : 0)

  it.each([1, 7, 21, 99, 314, 2026])('seed %i จบเกมได้ การ์ดครบ 40 ใบ', (seed) => {
    let s = createGame({ seed, deckList: CELESTIAL, aiDeckList: CELESTIAL })
    const seen = new Set()
    for (let i = 0; i < 800 && !s.winner; i++) {
      const action = getAiAction(s, currentActor(s))
      seen.add(action.type)
      s = applyAction(s, action)
      for (const id of [PLAYER, AI]) expect(countCards(s.players[id])).toBe(40)
    }
    expect(s.winner).not.toBeNull()
  })
})
