import { describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { getAiAction } from './ai'
import { applyAction, getReadyAttackers, positionChangeBlocker } from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const SET = (id) => ({ id, position: 'defense', faceDown: true })
const DEF_UP = (id) => ({ id, position: 'defense', faceDown: false })

const attack = (s, player = PLAYER, zone = 0, targetZone = 0) =>
  applyAction(s, {
    type: 'attack',
    player,
    attackerUid: uidAt(s, player, zone),
    targetUid: uidAt(s, player === PLAYER ? AI : PLAYER, targetZone),
  })

describe('วางคว่ำ (ท่าตั้งรับ)', () => {
  it('อัญเชิญแบบวางคว่ำได้ และบันทึกของเราเห็นชื่อการ์ด', () => {
    const s = makeState({ player: { hand: ['th01-005'] } })
    const s2 = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0), position: 'defense' })
    expect(s2.players.player.field[0]).toMatchObject({ position: 'defense', faceDown: true })
    expect(lastLog(s2).text).toBe('คุณวาง สามเณร (ระดับ 3 · ATK 700 / DEF 1,500) คว่ำ (ท่าตั้งรับ) ลงช่องที่ 1')
  })

  it('การ์ดคว่ำของคู่ต่อสู้ไม่เปิดเผยชื่อในบันทึก', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-005'] } })
    const s2 = applyAction(s, { type: 'summon', player: AI, uid: handUid(s, AI, 0), position: 'defense' })
    expect(lastLog(s2).text).toBe('คู่ต่อสู้วาง มอนสเตอร์ 1 ใบ คว่ำ (ท่าตั้งรับ) ลงช่องที่ 1')
    expect(lastLog(s2).text).not.toContain('สามเณร')
  })

  it('สังเวยแล้ววางคว่ำได้', () => {
    const s = makeState({ player: { hand: ['th01-006'], field: ['th01-004'] } })
    const s2 = applyAction(s, {
      type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0), tributes: [uidAt(s, PLAYER, 0)], position: 'defense',
    })
    expect(s2.players.player.field[0]).toMatchObject({ cardId: 'th01-006', position: 'defense', faceDown: true })
  })

  it('ท่าไม่ถูกต้องถูกปฏิเสธ', () => {
    const s = makeState({ player: { hand: ['th01-005'] } })
    expect(() =>
      applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0), position: 'sideways' })
    ).toThrow('ท่าไม่ถูกต้อง')
  })

  it('มอนสเตอร์ท่าตั้งรับโจมตีไม่ได้', () => {
    const s = makeState({ phase: 'battle', player: { field: [DEF_UP('th01-017')] } })
    expect(getReadyAttackers(s, PLAYER)).toEqual([])
    expect(() =>
      applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: null })
    ).toThrow('ท่าตั้งรับโจมตีไม่ได้')
  })

  it('มีตัวตั้งรับอยู่ก็โจมตีตรงไม่ได้', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: [SET('th01-004')] } })
    expect(() =>
      applyAction(s, { type: 'attack', player: PLAYER, attackerUid: uidAt(s, PLAYER, 0), targetUid: null })
    ).toThrow('โจมตีตรง')
  })
})

describe('ATK ปะทะ DEF', () => {
  it('ATK > DEF: ทำลายตัวตั้งรับ เจ้าของไม่เสีย LP และเปิดการ์ดคว่ำ', () => {
    // 1,700 vs สามเณร DEF 1,500 (คว่ำ)
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: [SET('th01-005')] } })
    const s2 = attack(s)
    expect(s2.players.ai.field[0]).toBeNull()
    expect(s2.players.ai.lp).toBe(8000)
    expect(s2.players.player.lp).toBe(8000)
    const entry = lastLog(s2)
    expect(entry.text).toBe('⚔️ ทหารเสือดาบสองมือ โจมตี สามเณร (ท่าตั้งรับ)')
    expect(entry.details).toEqual([
      'เปิดการ์ดคว่ำ: สามเณร (DEF 1,500)',
      'ฝ่ายโจมตี — ทหารเสือดาบสองมือ: ATK 1,700 (ไม่มีโบนัส) = 1,700',
      'ฝ่ายรับ — สามเณร: DEF 1,500 (ไม่มีโบนัส) = 1,500',
      'ATK 1,700 > DEF 1,500 → สามเณร ถูกทำลาย (ท่าตั้งรับ ไม่เสีย LP)',
      '⭐ ทหารเสือดาบสองมือ ได้ประสบการณ์ 1 แต้ม (1/2)',
    ])
  })

  it('ATK < DEF: ไม่มีใครถูกทำลาย ฝ่ายโจมตีเสีย LP ส่วนต่าง และการ์ดถูกเปิดหงาย', () => {
    // ลูกพราน 800 vs สามเณร DEF 1,500
    const s = makeState({ phase: 'battle', player: { field: ['th01-001'] }, ai: { field: [SET('th01-005')] } })
    const s2 = attack(s)
    expect(s2.players.player.field[0]).not.toBeNull()
    expect(s2.players.ai.field[0]).toMatchObject({ position: 'defense', faceDown: false })
    expect(s2.players.player.lp).toBe(8000 - 700)
    expect(s2.players.ai.lp).toBe(8000)
    expect(lastLog(s2).details.at(-2)).toBe(
      'ATK 800 < DEF 1,500 → ตีไม่ผ่าน ไม่มีใครถูกทำลาย (ส่วนต่าง 1,500 − 800 = 700)'
    )
  })

  it('ATK = DEF: ไม่มีอะไรเกิดขึ้น', () => {
    // ทหารเสือดาบสองมือ ATK 1,700 vs ขุนศึกอาทมาฏ DEF 1,700 (ธาตุอัคนีทั้งคู่ ไม่มีโบนัส)
    const s = makeState({ phase: 'battle', player: { field: ['th01-017'] }, ai: { field: [DEF_UP('th01-018')] } })
    const s2 = attack(s)
    expect(s2.players.player.field[0]).not.toBeNull()
    expect(s2.players.ai.field[0]).not.toBeNull()
    expect(s2.players.player.lp).toBe(8000)
    expect(s2.players.ai.lp).toBe(8000)
    expect(lastLog(s2).details.at(-1)).toBe('ATK 1,700 = DEF 1,700 → ไม่มีอะไรเกิดขึ้น')
  })

  it('โบนัสธาตุบวกเข้า DEF ได้', () => {
    // ลูกพราน (ปฐวี) ATK 800 vs ม้าศึก (วายุ ชนะปฐวี) DEF 1,000 + 300
    const s = makeState({ phase: 'battle', player: { field: ['th01-001'] }, ai: { field: [DEF_UP('th01-019')] } })
    const s2 = attack(s)
    expect(lastLog(s2).details).toContain(
      `ฝ่ายรับ — ${getCardById('th01-019').name}: DEF 1,000 + 300 (ธาตุ: ธาตุวายุ ชนะทางธาตุปฐวี) = 1,300`
    )
    expect(s2.players.player.lp).toBe(8000 - 500)
  })

  it('ซุ่มโจมตียกเลิกโบนัส DEF และบัฟ ATK ไม่บวกเข้า DEF', () => {
    // พรานหนุ่ม 1,600 ซุ่มโจมตี ม้าศึกตั้งรับ DEF 1,000 (โบนัส +300 ถูกยกเลิก)
    const s = makeState({ phase: 'battle', player: { field: ['th01-002'] }, ai: { field: [DEF_UP('th01-019')] } })
    expect(attack(s).players.ai.field[0]).toBeNull()
    // พรานหนุ่มตั้งรับ + มีเผ่าสัตว์: DEF 1,200 ไม่ได้ +400
    const d = makeState({
      activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { field: [DEF_UP('th01-002'), 'th01-019'] },
    })
    expect(lastLog(attack(d, AI)).details).toContain('ฝ่ายรับ — พรานหนุ่ม: DEF 1,200 (ไม่มีโบนัส) = 1,200')
  })

  it('การ์ดคว่ำไม่นับเป็นเงื่อนไขเอฟเฟกต์ของเพื่อนร่วมสนาม', () => {
    // ม้าศึกคว่ำอยู่ → พรานหนุ่มยังไม่ได้ +400
    const s = makeState({ phase: 'battle', player: { field: ['th01-002', SET('th01-019')] }, ai: { field: ['th01-017'] } })
    expect(attack(s).players.player.lp).toBe(8000 - 100) // 1,600 แพ้ 1,700
  })
})

describe('เปลี่ยนท่า', () => {
  it('หงายการ์ดคว่ำเป็นท่าโจมตี แล้วเปลี่ยนซ้ำในเทิร์นเดียวไม่ได้', () => {
    const s = makeState({ player: { field: [SET('th01-017')] } })
    const s2 = applyAction(s, { type: 'changePosition', player: PLAYER, uid: uidAt(s, PLAYER, 0) })
    expect(s2.players.player.field[0]).toMatchObject({ position: 'attack', faceDown: false })
    expect(lastLog(s2).text).toBe('คุณหงาย ทหารเสือดาบสองมือ เป็นท่าโจมตี (ATK 1,700)')
    expect(positionChangeBlocker(s2, PLAYER, uidAt(s2, PLAYER, 0))).toBe('เปลี่ยนท่าไปแล้วเทิร์นนี้')
  })

  it('ท่าโจมตี → ตั้งรับแบบหงาย', () => {
    const s = makeState({ player: { field: ['th01-017'] } })
    const s2 = applyAction(s, { type: 'changePosition', player: PLAYER, uid: uidAt(s, PLAYER, 0) })
    expect(s2.players.player.field[0]).toMatchObject({ position: 'defense', faceDown: false })
    expect(lastLog(s2).text).toBe('คุณเปลี่ยน ทหารเสือดาบสองมือ เป็นท่าตั้งรับ (DEF 1,100)')
  })

  it('เปลี่ยนท่าไม่ได้ในเทิร์นที่เพิ่งลง / หลังโจมตี / ในเฟสต่อสู้', () => {
    const s = makeState({ player: { hand: ['th01-001'] } })
    const s2 = applyAction(s, { type: 'summon', player: PLAYER, uid: handUid(s, PLAYER, 0) })
    expect(positionChangeBlocker(s2, PLAYER, uidAt(s2, PLAYER, 0))).toBe('เพิ่งลงสนามเทิร์นนี้ ยังเปลี่ยนท่าไม่ได้')

    const b = makeState({ phase: 'battle', player: { field: ['th01-017'] } })
    expect(positionChangeBlocker(b, PLAYER, uidAt(b, PLAYER, 0))).toBe('เปลี่ยนท่าได้เฉพาะเฟสหลัก')
    const attacked = applyAction(b, { type: 'attack', player: PLAYER, attackerUid: uidAt(b, PLAYER, 0), targetUid: null })
    const main2 = applyAction(attacked, { type: 'endBattle', player: PLAYER })
    expect(() => applyAction(main2, { type: 'changePosition', player: PLAYER, uid: uidAt(main2, PLAYER, 0) })).toThrow(
      'โจมตีไปแล้ว'
    )
  })

  it('สิทธิ์เปลี่ยนท่ากลับมาในเทิร์นถัดไปของเรา', () => {
    const s = makeState({ turn: 3, player: { field: [SET('th01-017')] } })
    const s2 = applyAction(s, { type: 'changePosition', player: PLAYER, uid: uidAt(s, PLAYER, 0) })
    s2.turn = 5
    expect(positionChangeBlocker(s2, PLAYER, uidAt(s2, PLAYER, 0))).toBeNull()
  })
})

describe('AI กับท่าตั้งรับ', () => {
  it('ไม่เข้าเฟสต่อสู้ถ้ามีแต่ตัวตั้งรับ', () => {
    const s = makeState({ activePlayer: AI, ai: { field: [DEF_UP('th01-005')], hasNormalSummoned: true }, player: { field: ['th01-011'] } })
    expect(getAiAction(s).type).toBe('endTurn')
  })

  it('วางคว่ำเมื่อสู้ตัวที่แรงที่สุดของเราไม่ได้', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: ['th01-005'] }, player: { field: ['th01-017'] } })
    expect(getAiAction(s)).toMatchObject({ type: 'summon', position: 'defense' })
  })

  it('ลงท่าโจมตีเมื่อสู้ได้ หรือฝั่งเรามีแต่การ์ดคว่ำ', () => {
    const strong = makeState({ activePlayer: AI, ai: { hand: ['th01-002'] }, player: { field: ['th01-016'] } })
    expect(getAiAction(strong)).toMatchObject({ position: 'attack' })
    const vsHidden = makeState({ activePlayer: AI, ai: { hand: ['th01-001'] }, player: { field: [SET('th01-011')] } })
    expect(getAiAction(vsHidden)).toMatchObject({ position: 'attack' })
  })

  it('หงายตัวคว่ำเมื่อสู้ได้แล้ว', () => {
    const s = makeState({ activePlayer: AI, ai: { field: [SET('th01-011')] }, player: { field: ['th01-016'] } })
    expect(getAiAction(s)).toEqual({ type: 'changePosition', player: AI, uid: uidAt(s, AI, 0) })
  })

  it('ไม่แอบดูการ์ดคว่ำ: ตีการ์ดคว่ำเมื่อ ATK ≥ 1,500 เท่านั้น', () => {
    const strong = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { field: [SET('th01-004')] } })
    expect(getAiAction(strong)).toMatchObject({ type: 'attack', targetUid: uidAt(strong, PLAYER, 0) })
    const weak = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-016'] }, player: { field: [SET('th01-004')] } })
    expect(getAiAction(weak).type).toBe('endTurn') // 900 ยังไม่กล้าตี แม้จริง ๆ จะชนะ DEF 500
  })
})
