import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import { applyAction, deckProblems, getFieldAtk, handCardBlocker, isBorrowed, previewBattle, validateDeck } from './game'
import { AI, PLAYER } from './rules'
import { handUid, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const play = (s, index = 0, extra = {}) => act(s, { type: 'playSpell', uid: handUid(s, PLAYER, index), ...extra })
const choose = (s, optionId, player = PLAYER) => applyAction(s, { type: 'choose', player, optionId })
const ids = (list) => list.map((c) => c?.cardId ?? null)
const aiAttack = (s, zone, targetZone) =>
  applyAction(s, {
    type: 'attack',
    player: AI,
    attackerUid: uidAt(s, AI, zone),
    targetUid: targetZone === null ? null : uidAt(s, PLAYER, targetZone),
  })
const respondKind = (s, kind) => {
  const option = s.pendingResponse.options.find((o) => o.kind === kind)
  return applyAction(s, { type: 'respond', player: PLAYER, trapUid: option.id })
}
const aiBattle = (opts) => makeState({ activePlayer: AI, phase: 'battle', ...opts })

describe('TH08-001 ยันต์เสริมดวง', () => {
  it('เปิดมอนสเตอร์ → ขึ้นมือแล้วจั่วเพิ่ม 1', () => {
    const s = makeState({ player: { hand: ['th08-001'], deck: ['th01-002', 'th01-005', 'th01-019'] } })
    const after = play(s)
    expect(ids(after.players.player.hand)).toEqual(['th01-002', 'th01-005'])
    expect(ids(after.players.player.graveyard)).toEqual(['th08-001'])
  })
  it('เปิดเวท → ขึ้นมือ ไม่จั่วเพิ่ม · กองเหลือใบเดียวไม่แพ้ · กองว่างใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th08-001'], deck: ['th08-007', 'th01-005'] } })
    expect(ids(play(s).players.player.hand)).toEqual(['th08-007'])
    const last = makeState({ player: { hand: ['th08-001'], deck: ['th01-002'] } })
    const after = play(last)
    expect(ids(after.players.player.hand)).toEqual(['th01-002'])
    expect(after.winner).toBeNull()
    const empty = makeState({ player: { hand: ['th08-001'], deck: [] } })
    expect(handCardBlocker(empty, PLAYER, handUid(empty, PLAYER, 0))).toBe('กองการ์ดหมดแล้ว')
  })
})

describe('TH08-002 วิปัสสนากรรมฐาน', () => {
  it('ดู 3 เลือก 1 ขึ้นมือ ที่เหลือวางใต้กอง', () => {
    const s = makeState({ player: { hand: ['th08-002'], deck: ['th01-001', 'th01-002', 'th01-005', 'th01-019'] } })
    const opened = play(s)
    expect(opened.pendingChoice.options.map((o) => o.label)).toEqual(['ลูกพราน', 'พรานหนุ่ม', 'สามเณร'])
    const picked = choose(opened, opened.pendingChoice.options[1].id)
    expect(ids(picked.players.player.hand)).toEqual(['th01-002'])
    expect(ids(picked.players.player.deck)).toEqual(['th01-019', 'th01-001', 'th01-005'])
    expect(picked.pendingChoice).toBeNull()
  })
  it('กองเหลือ 1 ใบดูเท่าที่มี', () => {
    const s = makeState({ player: { hand: ['th08-002'], deck: ['th01-002'] } })
    const opened = play(s)
    expect(opened.pendingChoice.options).toHaveLength(1)
  })
})

describe('TH08-003 นิมิตเรียกคู่หู', () => {
  it('ค้นได้เฉพาะวัตถุดิบระดับ 1–4 ของร่างขึ้นขี่ในกองพิเศษ แล้วสับกอง', () => {
    const s = makeState({ player: { hand: ['th08-003'], deck: ['th03-006', 'th01-002', 'th01-005', 'th01-019', 'th06-001'] } })
    s.players.player.extraDeck = [{ uid: 'player-x1', cardId: 'th03-013' }]
    const opened = play(s)
    // พรานขี่เสือ: พรานป่า (คน) + สัตว์ใหญ่ — พญาเสือระดับ 7 ไม่นับ · สามเณร/ผีไม่ใช่วัตถุดิบ
    expect(opened.pendingChoice.options.map((o) => o.id).sort()).toEqual(['th01-002', 'th01-019'])
    const picked = choose(opened, 'th01-019')
    expect(ids(picked.players.player.hand)).toEqual(['th01-019'])
    expect(picked.players.player.deck).toHaveLength(4)
  })
  it('ไม่มีร่างขึ้นขี่ในกองพิเศษ → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th08-003'], deck: ['th01-002'] } })
    s.players.player.extraDeck = []
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toMatch('ไม่มีวัตถุดิบ')
  })
})

describe('TH08-004 เมตตามหานิยม / 005 ข้าวสารเสก', () => {
  it('ศัตรูโจมตีไม่ได้ในเทิร์นถัดไปของศัตรู แล้วหมดผล', () => {
    const s = makeState({ player: { hand: ['th08-004'] }, ai: { field: ['th01-002'] } })
    const opened = play(s)
    const locked = choose(opened, uidAt(s, AI, 0))
    const m = locked.players.ai.field[0]
    expect(m.cannotAttackUntil).toBe(s.turn + 1)
  })
  it('ลด ATK 500 จนจบเทิร์น · ต่ำสุด 0 · เลือกตัวคว่ำไม่ได้', () => {
    const s = makeState({ player: { hand: ['th08-005'] }, ai: { field: ['th01-002', { id: 'th01-005', faceDown: true, position: 'defense' }] } })
    const opened = play(s)
    expect(opened.pendingChoice.options).toHaveLength(1)
    const after = choose(opened, uidAt(s, AI, 0))
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1100)
    const low = makeState({ player: { hand: ['th08-005'] }, ai: { field: ['th04-001'] } })
    expect(getFieldAtk(choose(play(low), uidAt(low, AI, 0)), AI, uidAt(low, AI, 0))).toBe(0)
  })
  it('ศัตรูไม่มีตัวหงาย → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th08-004'] }, ai: { field: [{ id: 'th01-002', faceDown: true, position: 'defense' }] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toMatch('ไม่มีมอนสเตอร์ศัตรู')
  })
})

describe('TH08-006 เสื้อยันต์', () => {
  it('สวมได้เฉพาะมนุษย์ที่ไม่ใช่ผี/อสูร · ATK +300', () => {
    const s = makeState({ player: { hand: ['th08-006'], field: ['th01-002', 'th06-001', 'th01-019'] } })
    const before = getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))
    const opened = play(s, 0, { targetUid: uidAt(s, PLAYER, 0) })
    expect(getFieldAtk(opened, PLAYER, uidAt(s, PLAYER, 0))).toBe(before + 300)
    expect(() => play(s, 0, { targetUid: uidAt(s, PLAYER, 1) })).toThrow()
    expect(() => play(s, 0, { targetUid: uidAt(s, PLAYER, 2) })).toThrow()
  })
  it('DEF +300 มีผลตอนตั้งรับ', () => {
    const s = aiBattle({ player: { field: [{ id: 'th01-002', position: 'defense' }] }, ai: { field: ['th01-019'] } })
    const plain = previewBattle(s, AI, uidAt(s, AI, 0), uidAt(s, PLAYER, 0)).defender.final
    s.players.player.spellTrap[0] = { uid: 'eq', cardId: 'th08-006', faceDown: false, equippedTo: uidAt(s, PLAYER, 0) }
    expect(previewBattle(s, AI, uidAt(s, AI, 0), uidAt(s, PLAYER, 0)).defender.final).toBe(plain + 300)
  })
})

describe('TH08-007 บายศรีสู่ขวัญ / 008 ประทีปคืนขวัญ', () => {
  it('ฟื้น LP 800', () => {
    const s = makeState({ player: { hand: ['th08-007'], lp: 5000 } })
    expect(play(s).players.player.lp).toBe(5800)
  })
  it('คืนชีพท่าโจมตี ไม่แถมภูมิคุ้มกันธาตุมืด · ร่างผสานคืนไม่ได้', () => {
    const s = makeState({ player: { hand: ['th08-008'] } })
    s.players.player.graveyard = [{ uid: 'g1', cardId: 'th01-002' }, { uid: 'g2', cardId: 'th03-013' }]
    const after = play(s, 0, { targetUid: 'g1' })
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th01-002', position: 'attack' })
    expect(after.players.player.field[0].darkImmuneTurn).toBeUndefined()
    expect(() => play(s, 0, { targetUid: 'g2' })).toThrow()
  })
})

describe('TH08-009 เบี้ยแก้', () => {
  it('ผู้สวมไม่ถูกเลือกเป็นเป้าเวทศัตรู แต่ยังถูกโจมตีได้', () => {
    const s = makeState({ player: { hand: ['th08-005'] }, ai: { field: ['th01-002', 'th01-019'] } })
    s.players.ai.spellTrap[0] = { uid: 'bk', cardId: 'th08-009', faceDown: false, equippedTo: uidAt(s, AI, 0) }
    const opened = play(s)
    expect(opened.pendingChoice.options.map((o) => o.id)).toEqual([uidAt(s, AI, 1)])
    // ตัวเดียวที่มี และสวมเบี้ยแก้ → ใช้เวทไม่ได้
    const only = makeState({ player: { hand: ['th08-004'] }, ai: { field: ['th01-002'] } })
    only.players.ai.spellTrap[0] = { uid: 'bk', cardId: 'th08-009', faceDown: false, equippedTo: uidAt(only, AI, 0) }
    expect(handCardBlocker(only, PLAYER, handUid(only, PLAYER, 0))).toMatch('ไม่มีมอนสเตอร์ศัตรู')
  })
})

describe('TH08-010 ตะกรุดคู่ชีวิต', () => {
  it('จะถูกทำลายจากการต่อสู้ → ส่งตะกรุดลงสุสานแทน แต่ยังเสีย LP', () => {
    const s = aiBattle({ player: { field: ['th01-001'] }, ai: { field: ['th01-002'] } })
    s.players.player.spellTrap[0] = { uid: 'tk', cardId: 'th08-010', faceDown: false, equippedTo: uidAt(s, PLAYER, 0) }
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]?.cardId).toBe('th01-001')
    expect(after.players.player.spellTrap[0]).toBeNull()
    expect(ids(after.players.player.graveyard)).toEqual(['th08-010'])
    expect(after.players.player.lp).toBe(8000 - 800)
    // ครั้งถัดไปไม่มีตะกรุดแล้ว → ถูกทำลาย
    after.players.ai.field[0].hasAttacked = false
    after.players.ai.field[0].attackCount = 0
    const again = aiAttack(after, 0, 0)
    expect(again.players.player.field[0]).toBeNull()
  })
})

describe('TH08-011 มนต์สะกดวิญญาณ', () => {
  const setup = () => {
    const s = makeState({ player: { hand: ['th08-011', 'th03-006'], field: ['th01-001'] } })
    s.players.ai.graveyard = [{ uid: 'ai-g1', cardId: 'th01-002' }, { uid: 'ai-g2', cardId: 'th01-009' }]
    return s
  }
  it('ยืมระดับ 1–4 จากสุสานศัตรู (ระดับ 6 ไม่ได้)', () => {
    const s = setup()
    const opened = play(s)
    expect(opened.pendingChoice.options.map((o) => o.id)).toEqual(['ai-g1'])
    const after = choose(opened, 'ai-g1')
    const borrowed = after.players.player.field[1]
    expect(borrowed).toMatchObject({ cardId: 'th01-002', position: 'attack' })
    expect(isBorrowed(borrowed)).toBe(true)
    expect(after.players.ai.graveyard.map((c) => c.uid)).toEqual(['ai-g2'])
  })
  it('ถูกทำลาย → กลับสุสานเจ้าของ ไม่ใช่สุสานเรา', () => {
    const s = choose(play(setup()), 'ai-g1')
    s.activePlayer = AI
    s.phase = 'battle'
    s.players.ai.field[0] = { uid: 'ai-atk', cardId: 'th03-006', hasAttacked: false, summonedTurn: 1, position: 'attack', faceDown: false }
    const after = applyAction(s, { type: 'attack', player: AI, attackerUid: 'ai-atk', targetUid: 'ai-g1' })
    expect(after.players.player.graveyard.map((c) => c.uid)).not.toContain('ai-g1')
    expect(after.players.ai.graveyard.map((c) => c.uid)).toContain('ai-g1')
  })
  it('ใช้เป็นเครื่องสังเวยไม่ได้', () => {
    const s = choose(play(setup()), 'ai-g1')
    s.players.player.field[0] = null
    // เหลือแค่ตัวที่ยืม → ลงพญาเสือ (ระดับ 7 ต้องสังเวย 2) ไม่ได้ และสังเวยตัวยืมไม่ได้
    expect(() => act(s, { type: 'summon', uid: s.players.player.hand.find((c) => c.cardId === 'th03-006').uid, tributes: ['ai-g1'] })).toThrow()
  })
  it('จำกัด 1 ใบต่อสำรับ', () => {
    expect(validateDeck([['th08-011', 2], ['th01-001', 20]])).toEqual(['มนต์สะกดวิญญาณ ใส่ได้ไม่เกิน 1 ใบต่อสำรับ'])
    expect(deckProblems([['th08-011', 2], ['th01-001', 3]]).join(' ')).toMatch('ไม่เกิน 1 ใบ')
  })
})

describe('TH08-012–014 กับดัก', () => {
  it('แคล้วคลาด: ยกเลิกการโจมตี และเปลี่ยนเป็นท่าป้องกัน · โจมตีตรงไม่ขึ้น', () => {
    const s = aiBattle({ player: { field: ['th01-001'], spellTrap: [{ id: 'th08-012' }] }, ai: { field: ['th01-002'] } })
    const pending = aiAttack(s, 0, 0)
    const after = respondKind(pending, 'evade')
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th01-001', position: 'defense' })
    expect(after.players.player.lp).toBe(8000)
    const direct = aiBattle({ player: { spellTrap: [{ id: 'th08-012' }] }, ai: { field: ['th01-002'] } })
    expect(aiAttack(direct, 0, null).pendingResponse).toBeNull()
  })
  it('นะจังงัง: ผู้โจมตี −500 เฉพาะการต่อสู้นี้ (รวมโจมตีตรง)', () => {
    const s = aiBattle({ player: { field: ['th01-019'], spellTrap: [{ id: 'th08-013' }] }, ai: { field: ['th01-002'] } })
    const after = respondKind(aiAttack(s, 0, 0), 'weaken')
    // 1,600 − 500 = 1,100 < 1,200 → ผู้โจมตีถูกทำลาย
    expect(after.players.ai.field[0]).toBeNull()
    const direct = aiBattle({ player: { spellTrap: [{ id: 'th08-013' }] }, ai: { field: ['th01-002'] } })
    const hit = respondKind(aiAttack(direct, 0, null), 'weaken')
    expect(hit.players.player.lp).toBe(8000 - 1100)
    expect(hit.players.ai.field[0].tempAtk ?? []).toEqual([])
  })
  it('มหาอุตม์: ไม่ถูกทำลายและไม่เสีย LP จากการต่อสู้นั้น', () => {
    const s = aiBattle({ player: { field: ['th01-001'], spellTrap: [{ id: 'th08-014' }] }, ai: { field: ['th03-006'] } })
    const after = respondKind(aiAttack(s, 0, 0), 'invulnerable')
    expect(after.players.player.field[0]?.cardId).toBe('th01-001')
    expect(after.players.player.lp).toBe(8000)
    expect(after.players.player.field[0].trapWard).toBeUndefined()
  })
})

describe('TH08-015 มนต์ถอนอาคม', () => {
  it('ทำลายเวท/กับดัก 1 ใบ (ของศัตรูหรือของเรา) ไม่กวาดทั้งหมด', () => {
    const s = makeState({
      player: { hand: ['th08-015'], spellTrap: [{ id: 'th08-012' }] },
      ai: { spellTrap: [{ id: 'th08-013' }, { id: 'th08-014' }] },
    })
    const opened = play(s)
    expect(opened.pendingChoice.options).toHaveLength(3)
    const enemy = opened.pendingChoice.options.find((o) => o.enemy)
    // การ์ดคว่ำของศัตรูไม่เปิดชื่อตอนเลือก
    expect(enemy.label).toMatch('การ์ดคว่ำ')
    const after = choose(opened, enemy.id)
    expect(after.players.ai.spellTrap.filter(Boolean)).toHaveLength(1)
    expect(after.players.player.spellTrap.filter(Boolean)).toHaveLength(1)
  })
})

describe('AI ใช้ TH08', () => {
  it('AI ใช้ข้าวสารเสกเมื่อทำให้ตีชนะได้ และเลือกเป้าเอง', () => {
    const s = makeState({ activePlayer: AI, ai: { hand: ['th08-005'], field: ['th01-002'] }, player: { field: ['th01-019', 'th03-007'] } })
    s.players.ai.hasNormalSummoned = true
    const action = getAiAction(s, AI)
    expect(action).toMatchObject({ type: 'playSpell' })
    const opened = applyAction(s, action)
    const picked = applyAction(opened, getAiAction(opened, AI))
    // เสือสมิง 1,600 → 1,100 < พรานหนุ่ม 1,600
    expect(getFieldAtk(picked, PLAYER, uidAt(s, PLAYER, 1))).toBe(1100)
  })
})
