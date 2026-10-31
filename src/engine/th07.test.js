import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  canAttackDirectly,
  fusionProblem,
  getAttackableTargets,
  getFieldAtk,
  handCardBlocker,
  specialSummonBlocker,
  trapActivationBlocker,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const choose = (s, optionId, player = PLAYER) => applyAction(s, { type: 'choose', player, optionId })
const ids = (list) => list.map((c) => c?.cardId ?? null)
const aiAttack = (s, zone, targetZone) =>
  applyAction(s, {
    type: 'attack',
    player: AI,
    attackerUid: uidAt(s, AI, zone),
    targetUid: targetZone === null ? null : uidAt(s, PLAYER, targetZone),
  })
const aiBattle = (opts) => makeState({ activePlayer: AI, phase: 'battle', ...opts })
const respondKind = (s, kind, pick = () => true) => {
  const option = s.pendingResponse.options.find((o) => o.kind === kind && pick(o))
  return applyAction(s, { type: 'respond', player: PLAYER, trapUid: option.id })
}
// เวทต่อเนื่องหงาย (makeState วางช่องเวท/กับดักแบบคว่ำเสมอ)
const faceUp = (s, playerId, zone) => {
  s.players[playerId].spellTrap[zone].faceDown = false
  return s
}

describe('นาคาผู้พิทักษ์มณีธาร (002): อัญเชิญจากมือแบบหงายแล้วค้นนาคาระดับ 1–4 ชื่ออื่น', () => {
  it('ค้นได้ ไม่นับชื่อตัวเอง/ระดับ 6/สัตว์เลื้อยคลานต่างชุด', () => {
    const s = makeState({ player: { hand: ['th07-002'], deck: ['th07-002', 'th07-004', 'th01-010', 'th07-009', 'th07-001'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice.options.map((o) => o.id)).toEqual(['th07-009', 'th07-001'])
    const picked = choose(after, 'th07-009')
    expect(ids(picked.players.player.hand)).toEqual(['th07-009'])
  })

  it('วางคว่ำไม่ค้น · ใช้แล้วลงใหม่เทิร์นเดียวกันไม่ค้นซ้ำ', () => {
    const s = makeState({ player: { hand: ['th07-002'], deck: ['th07-009', 'th07-001'] } })
    const set = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0), position: 'defense' })
    expect(set.pendingChoice).toBeNull()
    const used = makeState({ player: { hand: ['th07-002'], deck: ['th07-009'] } })
    used.players.player.usedEffects['name:th07-002'] = used.turn
    expect(act(used, { type: 'summon', uid: handUid(used, PLAYER, 0) }).players.player.hand).toHaveLength(0)
  })
})

describe('นาคาผู้รักษาศีล (001): เกราะหนึ่ง charge', () => {
  it('รอดการต่อสู้ครั้งแรกแทน แล้วเกราะหมด · LP ยังเสียตามปกติ', () => {
    const s = makeState({ player: { field: ['th07-001', 'th07-010'] } })
    const opened = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    expect(opened.pendingChoice.kind).toBe('nagaShield')
    const shielded = choose(opened, uidAt(s, PLAYER, 1))
    expect(shielded.players.player.field[1].nagaShield).toEqual({ until: s.turn + 1 })
    expect(activationBlocker(shielded, PLAYER, uidAt(s, PLAYER, 0))).toMatch(/ไปแล้วเทิร์นนี้/)

    const battle = { ...structuredClone(shielded), activePlayer: AI, phase: 'battle', turn: s.turn + 1 }
    battle.players.ai.field[0] = { uid: 'ai-x', cardId: 'th01-018', hasAttacked: false, summonedTurn: 1, position: 'attack', faceDown: false }
    // ตี 010 ที่มีเกราะ (ไม่มีนาคาเพื่อนตัวอื่นหงายนอกจาก 001 → บัวแก้วยังทำงาน) — ลบ 001 ออกเพื่อทดสอบเกราะล้วน
    battle.players.player.field[0] = null
    const hit = applyAction(battle, { type: 'attack', player: AI, attackerUid: 'ai-x', targetUid: uidAt(s, PLAYER, 1) })
    const after = hit.pendingResponse ? applyAction(hit, { type: 'respond', player: PLAYER, trapUid: null }) : hit
    expect(after.players.player.field[1]?.cardId).toBe('th07-010')
    expect(after.players.player.field[1].nagaShield).toBeUndefined()
    expect(after.players.player.lp).toBeLessThan(8000)
  })

  it('เลือกตัวเอง/ตัวที่มีเกราะอยู่แล้วไม่ได้ · ไม่มีเป้าห้ามเปิด', () => {
    const s = makeState({ player: { field: ['th07-001'] } })
    expect(activationBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ต้องมีมอนสเตอร์นาคาหงายตัวอื่นที่ยังไม่มีเกราะ')
  })
})

describe('นาคาผู้คุ้มครองสายสัมพันธ์ (003) + ประตูวังวน (007) + ผู้ตามคลื่น (008)', () => {
  it('คืนเพื่อนแล้วยกเลิกการโจมตี → 007 จั่ว 1 → 008 ในมือเรียกตัวเองและเพื่อนท่าตั้งรับ', () => {
    const s = aiBattle({
      player: { field: ['th07-003', 'th07-002'], hand: ['th07-008'], spellTrap: [{ id: 'th07-007' }], deck: ['th01-001', 'th07-009'] },
      ai: { field: ['th01-018'] },
    })
    faceUp(s, PLAYER, 0)
    const pending = aiAttack(s, 0, 1)
    const after = respondKind(pending, 'nagaRescue')
    expect(after.log.some((e) => e.text.includes('ถูกยกเลิก (นาคาคุ้มครอง)'))).toBe(true)
    expect(after.players.player.lp).toBe(8000)
    expect(after.players.player.hand.map((h) => h.cardId)).toEqual(['th07-008', 'th07-002', 'th01-001'])
    expect(after.pendingChoice.kind).toBe('nagaFollow')
    const follow = choose(after, uidAt(s, PLAYER, 1))
    expect(ids(follow.players.player.field).filter(Boolean).sort()).toEqual(['th07-002', 'th07-003', 'th07-008'])
    for (const m of follow.players.player.field.filter((x) => x && x.cardId !== 'th07-003')) {
      expect(m).toMatchObject({ position: 'defense', faceDown: false, cannotAttackTurn: s.turn })
    }
    // 002 ลงจากมือในเทิร์นศัตรู → ค้นได้ (โควต้าของเทิร์นนี้ยังว่าง)
    expect(follow.players.player.hand.map((h) => h.cardId)).toContain('th07-009')
  })

  it('ไม่มีให้ตีตัวเอง/โจมตีตรง · เป้าคว่ำไม่เปิด', () => {
    const self = aiBattle({ player: { field: ['th07-003'] }, ai: { field: ['th01-018'] } })
    expect(aiAttack(self, 0, 0).pendingResponse).toBeNull()
    const hidden = aiBattle({
      player: { field: ['th07-003', { id: 'th07-002', position: 'defense', faceDown: true }] },
      ai: { field: ['th01-018'] },
    })
    expect(aiAttack(hidden, 0, 1).pendingResponse).toBeNull()
  })

  it('008 ที่เพิ่งจั่วจาก 007 ไม่ย้อนหลัง trigger', () => {
    const s = aiBattle({
      player: { field: ['th07-003', 'th07-002'], spellTrap: [{ id: 'th07-007' }], deck: ['th07-008'] },
      ai: { field: ['th01-018'] },
    })
    faceUp(s, PLAYER, 0)
    const after = respondKind(aiAttack(s, 0, 1), 'nagaRescue')
    expect(after.players.player.hand.map((h) => h.cardId)).toEqual(['th07-002', 'th07-008'])
    expect(after.pendingChoice).toBeNull()
  })
})

describe('นาคาธิบดี (004): สงบศึก', () => {
  it('ศัตรูโจมตีไม่ได้ เราเลือกโจมตีมันไม่ได้ · ครบกำหนดทั้งคู่ยังอยู่ ฟื้น 500', () => {
    const s = makeState({ player: { field: ['th07-004', 'th01-018'] }, ai: { field: ['th01-017', 'th01-016'] } })
    const opened = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    const pacted = choose(opened, uidAt(s, AI, 0))
    expect(pacted.players.ai.field[0].cannotAttackUntil).toBe(s.turn + 1)
    pacted.phase = 'battle'
    expect(getAttackableTargets(pacted, PLAYER).map((m) => m.cardId)).toEqual(['th01-016'])
    let t = act(pacted, { type: 'endTurn' })
    expect(t.players.player.lp).toBe(8000)
    t = applyAction(t, { type: 'endTurn', player: AI })
    expect(t.players.player.lp).toBe(8500)
    t = act(t, { type: 'endTurn' })
    t = applyAction(t, { type: 'endTurn', player: AI })
    expect(t.players.player.lp).toBe(8500)
  })

  it('เป้าออกจากสนามก่อนครบกำหนด → ไม่ฟื้น', () => {
    const s = makeState({ player: { field: ['th07-004'] }, ai: { field: ['th01-017'] } })
    let t = choose(act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) }), uidAt(s, AI, 0))
    t = act(t, { type: 'endTurn' })
    t.players.ai.field[0] = null
    t = applyAction(t, { type: 'endTurn', player: AI })
    expect(t.players.player.lp).toBe(8000)
  })
})

describe('นาคาผู้ตื่นแห่งกาลกัป (005): แต้มกาล', () => {
  it('จบเทิร์นทั้งสองฝ่าย +1 สูงสุด 3 · ATK 2400/2600/2800/3000 · ถอน 3 จั่ว 2', () => {
    let s = makeState({ player: { field: ['th07-005'], deck: ['th01-001', 'th01-001', 'th01-001', 'th01-001'] }, ai: { deck: Array(6).fill('th01-001') } })
    const atk = (st) => getFieldAtk(st, PLAYER, uidAt(s, PLAYER, 0))
    expect(atk(s)).toBe(2400)
    s = act(s, { type: 'endTurn' })
    expect(atk(s)).toBe(2600)
    s = applyAction(s, { type: 'endTurn', player: AI })
    expect(atk(s)).toBe(2800)
    expect(activationBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('ต้องมีแต้มกาล 3 (ตอนนี้ 2)')
    s = act(s, { type: 'endTurn' })
    s = applyAction(s, { type: 'endTurn', player: AI })
    expect(s.players.player.field[0].kala).toBe(3)
    expect(atk(s)).toBe(3000)
    const hand = s.players.player.hand.length
    const drawn = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    expect(drawn.players.player.hand.length).toBe(hand + 2)
    expect(atk(drawn)).toBe(2400)
  })
})

describe('นาคาผู้ผนึกความลับ (006)', () => {
  it('ATK +300 ต่อการ์ดคว่ำ (สูงสุด 3) · ส่งการ์ดคว่ำลดผู้โจมตี 500 เฉพาะการต่อสู้นั้น', () => {
    const s = aiBattle({
      player: {
        field: ['th07-006', { id: 'th07-002', position: 'defense', faceDown: true }],
        spellTrap: [{ id: 'th07-013' }, { id: 'th07-013' }, { id: 'th07-014' }],
      },
      ai: { field: ['th01-018'] },
    })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(2300)
    const pending = aiAttack(s, 0, 0)
    const after = respondKind(pending, 'nagaSecret', (o) => o.costUid === s.players.player.spellTrap[0].uid)
    // คว่ำ 4 → 3 โบนัสยัง 900 · ผู้โจมตี 2,200 − 500 = 1,700 แพ้ 2,300
    expect(after.players.player.field[0]?.cardId).toBe('th07-006')
    expect(after.players.ai.field[0]).toBeNull()
    expect(after.players.player.graveyard.map((g) => g.cardId)).toEqual(['th07-013'])
  })
})

describe('นาคาน้อยนำกระแส (009) และล็อกอัญเชิญพิเศษนาคา', () => {
  it('ต้องมีนาคาชื่ออื่นหงาย · ลงแล้วอัญเชิญพิเศษต่างชุดไม่ได้', () => {
    const s = makeState({ player: { field: ['th07-002'], hand: ['th07-009', 'th01-005'] } })
    expect(specialSummonBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBeNull()
    const after = act(s, { type: 'specialSummon', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.field[1]).toMatchObject({ cardId: 'th07-009', position: 'defense', faceDown: false })
    expect(after.players.player.hasNormalSummoned).toBe(false)
    after.players.player.field[2] = { uid: 'x', cardId: 'th01-004', position: 'attack', faceDown: false }
    expect(specialSummonBlocker(after, PLAYER, handUid(s, PLAYER, 1))).toMatch(/เฉพาะการ์ดราชสำนักนาคา/)
    const only = makeState({ player: { field: ['th07-009'], hand: ['th07-009'] } })
    expect(specialSummonBlocker(only, PLAYER, handUid(only, PLAYER, 0))).toBe('ต้องมีมอนสเตอร์นาคาชื่ออื่นหงายบนสนามเรา')
  })
})

describe('นาคาอารักขาบัวแก้ว (010)', () => {
  it('ถูกตีมีเพื่อนนาคาหงาย → รอด ไม่เสีย LP · ครั้งที่สองในเทิร์นไม่กัน', () => {
    const s = aiBattle({ player: { field: ['th07-010', 'th07-002'] }, ai: { field: ['th01-018', 'th01-018'] } })
    const first = aiAttack(s, 0, 0)
    expect(first.players.player.field[0]?.cardId).toBe('th07-010')
    expect(first.players.player.lp).toBe(8000)
    const second = aiAttack(first, 1, 0)
    expect(second.players.player.field[0]).toBeNull()
  })
  it('ไม่มีเพื่อน → ไม่กัน', () => {
    const s = aiBattle({ player: { field: ['th07-010'] }, ai: { field: ['th01-018'] } })
    expect(aiAttack(s, 0, 0).players.player.field[0]).toBeNull()
  })
})

describe('นาคาผู้ขานเสียงสังข์ (011)', () => {
  it('ทิ้ง 1 แล้วค้นเวท/กับดักนาคา ไม่ค้นเวทต่างชุด', () => {
    const s = makeState({ player: { hand: ['th07-011', 'th01-001'], deck: ['th07-013', 'th01-015'] } })
    const opened = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(opened.pendingChoice.kind).toBe('nagaDiscard')
    const after = choose(opened, handUid(s, PLAYER, 1))
    expect(after.players.player.hand.map((h) => h.cardId)).toEqual(['th07-013'])
    expect(after.players.player.graveyard.map((g) => g.cardId)).toEqual(['th01-001'])
  })
  it('มือว่างหรือไม่มีเป้า → ไม่เปิด', () => {
    const s = makeState({ player: { hand: ['th07-011'], deck: ['th07-013'] } })
    expect(act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) }).pendingChoice).toBeNull()
  })
})

describe('ม่านน้ำคืนวัง (012)', () => {
  it('คืน 002 แล้วเรียก 002 กลับ → ค้นได้ถ้ายังไม่ใช้ · 008 ในมือไม่เรียก 002 ซ้ำ', () => {
    const s = makeState({ player: { field: ['th07-002'], hand: ['th07-012', 'th07-008'], deck: ['th07-009'] } })
    let t = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0) })
    t = choose(t, uidAt(s, PLAYER, 0))
    expect(t.pendingChoice.kind).toBe('nagaVeilSummon')
    t = choose(t, uidAt(s, PLAYER, 0))
    expect(t.players.player.field[0]).toMatchObject({ cardId: 'th07-002', position: 'defense', cannotAttackTurn: s.turn })
    // ค้น 009 ได้ (ตัวเลือกเดียว ค้นทันที) แล้ว 008 ทำงาน แต่ไม่มีเพื่อนให้เรียก
    expect(t.players.player.hand.map((h) => h.cardId)).toEqual(['th07-008', 'th07-009'])
    expect(t.pendingChoice.kind).toBe('nagaFollow')
    expect(t.pendingChoice.options.map((o) => o.id)).toEqual(['only', 'skip'])
  })
  it('ไม่มีนาคาหงาย หรือมีแต่ร่างผสาน → ใช้ไม่ได้', () => {
    const s = makeState({ player: { field: ['th07-016'], hand: ['th07-012'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toMatch(/ให้คืนขึ้นมือ/)
  })
})

describe('คลื่นย้อนรอย (013) และผนึกสังข์ (014)', () => {
  it('013 คืนนาคาที่ไม่ได้เป็นเป้า แล้วยกเลิกการโจมตี', () => {
    const s = aiBattle({ player: { field: ['th07-002', 'th07-010'], spellTrap: [{ id: 'th07-013' }] }, ai: { field: ['th01-017'] } })
    const after = respondKind(aiAttack(s, 0, 1), 'nagaTide', (o) => o.returnUid === uidAt(s, PLAYER, 0))
    expect(after.players.player.hand.map((h) => h.cardId)).toEqual(['th07-002'])
    expect(after.players.player.field[1]?.cardId).toBe('th07-010')
    expect(lastLog(after).event.type).toBe('attackNegated')
  })

  it('014 ทำลายเวท/กับดักตอนถูกโจมตี (การโจมตีดำเนินต่อ) และในเฟสหลักเรา', () => {
    const s = aiBattle({
      player: { field: ['th07-002'], spellTrap: [{ id: 'th07-014' }] },
      ai: { field: ['th01-017'], spellTrap: [{ id: 'th05-008' }] },
    })
    const enemyTrap = s.players.ai.spellTrap[0].uid
    const after = respondKind(aiAttack(s, 0, 0), 'nagaSeal', (o) => o.targetUid === enemyTrap)
    expect(after.players.ai.spellTrap[0]).toBeNull()
    expect(after.players.ai.graveyard.map((g) => g.cardId)).toEqual(['th05-008'])

    const main = makeState({ player: { field: ['th07-002'], spellTrap: [{ id: 'th07-014' }] }, ai: { fieldSpell: 'th04-007' } })
    expect(trapActivationBlocker(main, PLAYER, main.players.player.spellTrap[0].uid)).toBeNull()
    const opened = act(main, { type: 'activateTrap', uid: main.players.player.spellTrap[0].uid })
    const done = choose(opened, main.players.ai.fieldSpell.uid)
    expect(done.players.ai.fieldSpell).toBeNull()
    const noNaga = makeState({ player: { spellTrap: [{ id: 'th07-014' }] }, ai: { fieldSpell: 'th04-007' } })
    expect(trapActivationBlocker(noNaga, PLAYER, noNaga.players.player.spellTrap[0].uid)).toBe('ต้องมีมอนสเตอร์นาคาหงายบนสนามเรา')
  })
})

describe('สายธารประสานนาคา (015) → พญานาคราชมณีบาดาล (016)', () => {
  const fuseState = (hand, field = []) =>
    makeState({ player: { hand: ['th07-015', ...hand], field } })

  it('3 ชื่อต่างกันจากมือ/สนาม ผสานได้ · ชื่อซ้ำ/ต่างชุดไม่ได้', () => {
    const s = fuseState(['th07-002', 'th07-009'], ['th07-010'])
    s.players.player.extraDeck = [{ uid: 'player-x1', cardId: 'th07-016' }]
    const mats = [handUid(s, PLAYER, 1), handUid(s, PLAYER, 2), uidAt(s, PLAYER, 0)]
    expect(fusionProblem(s, PLAYER, handUid(s, PLAYER, 0), 'player-x1', mats)).toBeNull()
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), fusionTarget: 'player-x1', tributes: mats })
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th07-016', position: 'attack' })
    expect(after.players.player.nagaLockTurn).toBe(s.turn)

    const dup = fuseState(['th07-002', 'th07-002', 'th07-009'])
    dup.players.player.extraDeck = [{ uid: 'player-x1', cardId: 'th07-016' }]
    expect(fusionProblem(dup, PLAYER, handUid(dup, PLAYER, 0), 'player-x1', [1, 2, 3].map((i) => handUid(dup, PLAYER, i)))).toMatch(/ไม่ตรงสูตร/)
    const other = fuseState(['th07-002', 'th07-009', 'th01-010'])
    other.players.player.extraDeck = [{ uid: 'player-x1', cardId: 'th07-016' }]
    expect(fusionProblem(other, PLAYER, handUid(other, PLAYER, 0), 'player-x1', [1, 2, 3].map((i) => handUid(other, PLAYER, i)))).toMatch(/ไม่ตรงสูตร/)
  })

  it('016 คืนเพื่อนก่อน คืนศัตรูตาม (ร่างผสานศัตรูกลับกองพิเศษ) แล้วโจมตีตรงไม่ได้เทิร์นนี้', () => {
    const s = makeState({ player: { field: ['th07-016', 'th07-002'] }, ai: { field: ['th01-012'] } })
    let t = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    t = choose(t, uidAt(s, PLAYER, 1))
    expect(t.pendingChoice.kind).toBe('nagaKingEnemy')
    t = choose(t, uidAt(s, AI, 0))
    expect(t.players.ai.field.filter(Boolean)).toHaveLength(0)
    expect(t.players.ai.extraDeck.map((c) => c.cardId)).toContain('th01-012')
    expect(t.players.player.hand.map((h) => h.cardId)).toEqual(['th07-002'])
    t.phase = 'battle'
    expect(canAttackDirectly(t, PLAYER, uidAt(s, PLAYER, 0))).toBe(false)
  })
})

describe('AI เล่นสำรับนาคาได้', () => {
  it('ตัวเลือกนาคาทุกแบบ AI ตอบได้ไม่ค้าง', () => {
    const s = makeState({ activePlayer: AI, ai: { field: ['th07-016', 'th07-002'], hand: ['th07-012'] }, player: { field: ['th01-018'] } })
    let t = s
    for (let i = 0; i < 30 && t.activePlayer === AI && !t.winner; i++) t = applyAction(t, getAiAction(t, AI))
    expect(t.log.some((e) => e.text.includes('คืนนาคาเพื่อนขึ้นมือ'))).toBe(true)
  })
})
