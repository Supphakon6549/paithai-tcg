import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  applyAction,
  getActivationTargets,
  getFieldAtk,
  getReadyAttackers,
  handCardBlocker,
  previewBattle,
  ritualTributeProblem,
  specialSummonBlocker,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const ids = (list) => list.map((c) => c?.cardId ?? null)
const SET_TRAP = (id) => ({ id, setTurn: 1 })
const aiAttack = (s, zone = 0, targetZone = 0) =>
  applyAction(s, {
    type: 'attack',
    player: AI,
    attackerUid: uidAt(s, AI, zone),
    targetUid: targetZone === null ? null : uidAt(s, PLAYER, targetZone),
  })

describe('เด็กวัด / ม้าศึก: อัญเชิญหงายหน้าแล้วค้นการ์ดจากกอง', () => {
  it('มีให้เลือกหลายแบบ → ถามผู้เล่น แล้วค้นใบที่เลือก', () => {
    const s = makeState({ player: { hand: ['th01-004'], deck: ['th01-008', 'th01-014', 'th01-001'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice).toMatchObject({ player: PLAYER, kind: 'search' })
    expect(after.pendingChoice.options.map((o) => o.id)).toEqual(['th01-008', 'th01-014'])
    expect(() => act(after, { type: 'endTurn' })).toThrow('ต้องเลือกก่อน')
    const chosen = act(after, { type: 'choose', optionId: 'th01-014' })
    expect(ids(chosen.players.player.hand)).toEqual(['th01-014'])
    expect(ids(chosen.players.player.deck)).toEqual(['th01-008', 'th01-001'])
    expect(lastLog(chosen).text).toBe('🔎 เด็กวัด: คุณค้น น้ำมนต์ธรณีสาร จากกองขึ้นมือ')
  })

  it('มีแบบเดียว → ค้นให้ทันที', () => {
    const s = makeState({ player: { hand: ['th01-019'], deck: ['th01-017', 'th01-018', 'th01-017'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice).toBeNull()
    expect(ids(after.players.player.hand)).toEqual(['th01-017'])
  })

  it('วางคว่ำ → ไม่ค้น · ไม่มีในกอง → บันทึกบอก', () => {
    const set = makeState({ player: { hand: ['th01-019'], deck: ['th01-017'] } })
    expect(act(set, { type: 'summon', uid: handUid(set, PLAYER, 0), position: 'defense' }).players.player.hand).toHaveLength(0)
    const none = makeState({ player: { hand: ['th01-019'], deck: ['th01-001'] } })
    expect(lastLog(act(none, { type: 'summon', uid: handUid(none, PLAYER, 0) })).text).toBe(
      '🔎 ม้าศึกอาชาไนย: ไม่มีมอนสเตอร์เผ่าทหารหาญระดับ 4 หรือต่ำกว่าเหลือในกอง'
    )
  })
})

describe('เด็กวัดนับเป็น 2 ระดับในพิธีสายศรัทธา', () => {
  it('พิธีบรรพชาฯ: เด็กวัด 2 + ทหารเสือ 4 + พลทหาร 2 = 8 ผ่าน', () => {
    const s = makeState({ player: { hand: ['th01-008', 'th01-007'], field: ['th01-004', 'th01-017', 'th01-016'] } })
    const tributes = [uidAt(s, PLAYER, 0), uidAt(s, PLAYER, 1), uidAt(s, PLAYER, 2)]
    expect(ritualTributeProblem(s, PLAYER, handUid(s, PLAYER, 0), tributes)).toBeNull()
  })

  it('พิธีของเทวา (ไม่ใช่สายศรัทธา): เด็กวัดนับ 1 ตามปกติ', () => {
    const s = makeState({ player: { hand: ['th05-006', 'th05-005'], field: ['th01-004', 'th01-017', 'th01-016'] } })
    const tributes = [uidAt(s, PLAYER, 0), uidAt(s, PLAYER, 1), uidAt(s, PLAYER, 2)]
    expect(ritualTributeProblem(s, PLAYER, handUid(s, PLAYER, 0), tributes)).toBe('ระดับรวม 7 ยังไม่ถึง 8')
  })
})

describe('สามเณร: สังเวยเด็กวัดเพื่ออัญเชิญพิเศษ แล้วจั่ว 1 ใบ', () => {
  it('อัญเชิญลงช่องเดิม ไม่ใช้สิทธิ์อัญเชิญปกติ และจั่วการ์ด', () => {
    const s = makeState({ player: { hand: ['th01-005'], field: ['th01-004'], deck: ['th01-016'] } })
    const after = act(s, { type: 'specialSummon', uid: handUid(s, PLAYER, 0) })
    const p = after.players.player
    expect(ids(p.field)[0]).toBe('th01-005')
    expect(ids(p.graveyard)).toEqual(['th01-004'])
    expect(ids(p.hand)).toEqual(['th01-016'])
    expect(p.hasNormalSummoned).toBe(false)
  })

  it('ไม่มีเด็กวัดบนสนาม → ทำไม่ได้', () => {
    const s = makeState({ player: { hand: ['th01-005'], field: ['th01-001'] } })
    expect(specialSummonBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('ต้องมี "เด็กวัด" บนสนามให้สังเวย')
  })
})

describe('พระอาจารย์: ห้ามศัตรูเผ่าอสูร/วิญญาณโจมตีเทิร์นหน้า', () => {
  it('เลือกได้เฉพาะเผ่าอสูร/วิญญาณ และตัวนั้นโจมตีไม่ได้ในเทิร์นถัดไป', () => {
    const s = makeState({ player: { field: ['th01-006'] }, ai: { field: ['th01-011', 'th01-017'] } })
    expect(getActivationTargets(s, PLAYER, uidAt(s, PLAYER, 0)).map((m) => m.cardId)).toEqual(['th01-011'])
    let after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(lastLog(after).text).toBe('✨ พระอาจารย์: อสูรทศกัณฐ์จำแลง โจมตีไม่ได้ในเทิร์นถัดไป')
    after = act(after, { type: 'endTurn' })
    after = applyAction(after, { type: 'enterBattle', player: AI })
    expect(getReadyAttackers(after, AI).map((m) => m.cardId)).toEqual(['th01-017'])
  })
})

describe('ครูบาศรีวิชัย', () => {
  it('ฟื้น LP 500 เมื่อจบเทิร์นของเรา (เทิร์นศัตรูไม่ได้)', () => {
    const s = makeState({ player: { field: ['th01-007'] } })
    const after = act(s, { type: 'endTurn' })
    expect(after.players.player.lp).toBe(8500)
    const back = applyAction(after, { type: 'endTurn', player: AI })
    expect(back.players.player.lp).toBe(8500)
  })

  it('มอนสเตอร์ฝ่ายเราไม่ถูกทำลายจากเอฟเฟกต์ (จอมทัพทำลายไม่ได้)', () => {
    const s = makeState({ activePlayer: AI, ai: { field: [] }, player: { field: ['th01-007', 'th01-016'] } })
    s.players.ai.field[0] = { uid: 'ai-f0', cardId: 'th01-022', hasAttacked: false, summonedTurn: 1, position: 'attack', faceDown: false }
    const after = applyAction(s, { type: 'activate', player: AI, uid: 'ai-f0', targetUid: uidAt(s, PLAYER, 1) })
    expect(after.players.player.field[1]).not.toBeNull()
    expect(lastLog(after).details).toEqual(['ครูบาศรีวิชัย: มอนสเตอร์ฝ่ายเราไม่ถูกทำลายจากเอฟเฟกต์ → พลทหารอาสา ไม่ถูกทำลาย'])
  })
})

describe('พญานาคานอนบาดาล: ตกสุสานแล้วคืนชีพ', () => {
  const naga = (ai = {}) =>
    makeState({ phase: 'battle', player: { field: ['th01-018'] }, ai: { field: ['th01-010'], hand: ai.hand ?? [], lp: ai.lp } })
  const kill = (s) => act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })

  it('ถูกทำลาย → เจ้าของเลือกจ่าย 500 LP แล้วกลับมาท่าตั้งรับ (ใบละครั้งต่อเกม)', () => {
    const after = kill(naga())
    expect(after.pendingChoice).toMatchObject({ player: AI, kind: 'revive' })
    expect(after.pendingChoice.options.map((o) => o.id)).toEqual(['pay', 'skip'])
    const revived = applyAction(after, { type: 'choose', player: AI, optionId: 'pay' })
    // ขุนศึก 2,500 vs นาค 2,100 + 300 (วารีชนะอัคนี) → AI เสีย 100 แล้วจ่ายอีก 500
    expect(revived.players.ai.lp).toBe(8000 - 100 - 500)
    expect(revived.players.ai.field[0]).toMatchObject({ cardId: 'th01-010', position: 'defense', faceDown: false })
    // ตายอีกรอบ → ไม่ถามแล้ว
    revived.players.player.field[0].hasAttacked = false
    revived.players.player.field[0].attackCount = 0
    revived.players.ai.field[0].position = 'attack'
    const again = kill(revived)
    expect(again.pendingChoice).toBeNull()
  })

  it('ใช้น้ำมนต์จากมือแทนการจ่าย LP ได้ · LP ไม่พอจ่าย → ไม่มีตัวเลือกจ่าย', () => {
    const withWater = kill(naga({ hand: ['th01-014'], lp: 400 }))
    expect(withWater.pendingChoice.options.map((o) => o.id)).toEqual(['water', 'skip'])
    const revived = applyAction(withWater, { type: 'choose', player: AI, optionId: 'water' })
    expect(revived.players.ai.hand).toHaveLength(0)
    expect(revived.players.ai.field[0].cardId).toBe('th01-010')
  })

  it('AI ตัดสินใจเอง: LP มากพอ → จ่าย', () => {
    const after = kill(naga())
    expect(getAiAction(after, AI)).toEqual({ type: 'choose', player: AI, optionId: 'pay' })
  })
})

describe('น้ำมนต์ธรณีสาร: คืนชีพจากสุสาน', () => {
  it('คืนชีพมอนสเตอร์ทั่วไปท่าโจมตี (ยกเว้นผสานร่าง/พิธีกรรม)', () => {
    const s = makeState({ player: { hand: ['th01-014'] } })
    s.players.player.graveyard = [{ uid: 'g1', cardId: 'th01-012' }, { uid: 'g2', cardId: 'th01-017' }]
    expect(() => act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), targetUid: 'g1' })).toThrow('เลือกมอนสเตอร์ในสุสาน')
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), targetUid: 'g2' })
    expect(after.players.player.field[0]).toMatchObject({ cardId: 'th01-017', position: 'attack', darkImmuneTurn: 3 })
    expect(ids(after.players.player.graveyard)).toEqual(['th01-012', 'th01-014'])
  })

  it('สุสานไม่มีตัวที่คืนชีพได้ → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th01-014'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('ไม่มีมอนสเตอร์ในสุสานที่คืนชีพได้')
  })
})

describe('ขวากหนามอาคมพราน (กับดัก)', () => {
  it('ศัตรูโจมตี → ตัวที่โจมตีเป็นท่าตั้งรับ การโจมตีถูกยกเลิก · มีพรานป่า → ทำลายด้วย', () => {
    const s = makeState({
      activePlayer: AI, phase: 'battle',
      ai: { field: ['th01-017'] },
      player: { field: ['th01-001'], spellTrap: [SET_TRAP('th01-015')] },
    })
    const pending = aiAttack(s)
    expect(pending.pendingResponse.options[0]).toMatchObject({ kind: 'thorns' })
    const after = act(pending, { type: 'respond', trapUid: pending.pendingResponse.trapUids[0] })
    expect(after.players.ai.field[0]).toBeNull()
    expect(after.players.player.field[0]).not.toBeNull()
    expect(after.players.player.lp).toBe(8000)
  })

  it('ไม่มีพรานป่า → แค่เปลี่ยนเป็นตั้งรับ · ใช้กับการโจมตีตรงได้', () => {
    const s = makeState({
      activePlayer: AI, phase: 'battle',
      ai: { field: ['th01-017'] },
      player: { spellTrap: [SET_TRAP('th01-015')] },
    })
    const pending = aiAttack(s, 0, null)
    const after = act(pending, { type: 'respond', trapUid: pending.pendingResponse.trapUids[0] })
    expect(after.players.ai.field[0]).toMatchObject({ position: 'defense' })
    expect(after.players.player.lp).toBe(8000)
  })

  it('ไม่เปิด → โจมตีตรงตามปกติ', () => {
    const s = makeState({ activePlayer: AI, phase: 'battle', ai: { field: ['th01-017'] }, player: { spellTrap: [SET_TRAP('th01-015')] } })
    const after = act(aiAttack(s, 0, null), { type: 'respond', trapUid: null })
    expect(after.players.player.lp).toBe(8000 - 1700)
  })
})

describe('ดาบฟ้าฟื้นเหล็กน้ำพี้ (เวทสวมใส่)', () => {
  const equipped = () => {
    const s = makeState({ phase: 'main1', player: { hand: ['th01-023'], field: ['th01-016'] }, ai: { field: ['th01-004'] } })
    return act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), targetUid: uidAt(s, PLAYER, 0) })
  }

  it('สวมให้ทหารหาญ: ATK +500 และได้ธาตุอาสนี', () => {
    const s = equipped()
    expect(s.players.player.spellTrap[0]).toMatchObject({ cardId: 'th01-023', faceDown: false, equippedTo: uidAt(s, PLAYER, 0) })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(1400)
    // อาสนีชนะวารี
    s.players.ai.field[0] = { uid: 'ai-w', cardId: 'th01-010', position: 'attack', faceDown: false }
    const r = previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), 'ai-w')
    expect(r.attacker.bonuses.map((b) => b.reason)).toContain('ธาตุอาสนี ชนะทางธาตุวารี')
  })

  it('ทำลายศัตรูได้แต้มประสบการณ์เพิ่ม · มอนสเตอร์ออกจากสนาม ดาบลงสุสาน', () => {
    let s = act(equipped(), { type: 'enterBattle' })
    s = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(s.players.player.field[0].xp).toBe(2)
    // ทำให้พลทหารตาย → ดาบลงสุสาน
    s.players.player.field[0] = null
    const next = act(s, { type: 'endBattle' })
    expect(next.players.player.spellTrap[0]).toBeNull()
    expect(ids(next.players.player.graveyard)).toContain('th01-023')
  })

  it('ไม่มีทหารหาญ → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th01-023'], field: ['th01-001'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toBe('ไม่มีมอนสเตอร์ที่สวมใส่ได้ (ทหารหาญหงายหน้า)')
  })
})

describe('กลองศึกสะท้านแผ่นดิน (กับดักต่อเนื่อง)', () => {
  it('เปิดหงาย: ทหารหาญ/สัตว์ใหญ่ฝ่ายเรา ATK และ DEF +300', () => {
    const s = makeState({ player: { field: ['th01-016', 'th01-019', 'th01-001'], spellTrap: [SET_TRAP('th01-024')] } })
    const after = act(s, { type: 'activateTrap', uid: s.players.player.spellTrap[0].uid })
    expect(after.players.player.spellTrap[0].faceDown).toBe(false)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(1200)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 1))).toBe(1500)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 2))).toBe(800)
  })

  it('วางเทิร์นนี้ → ยังเปิดไม่ได้', () => {
    const s = makeState({ player: { spellTrap: [{ id: 'th01-024', setTurn: 3 }] } })
    expect(() => act(s, { type: 'activateTrap', uid: s.players.player.spellTrap[0].uid })).toThrow('เปิดได้ตั้งแต่เทิร์นหน้า')
  })

  it('เทิร์นศัตรู: ศัตรูโจมตี → ส่งกลองลงสุสานเพื่อผสานทหารหาญ + ม้าศึกบนสนามทันที', () => {
    const s = makeState({
      activePlayer: AI, phase: 'battle',
      ai: { field: ['th01-011'] }, // (ขุนศึกอาทมาฏห้ามเปิดกับดัก จึงใช้อสูรทศกัณฐ์)
      player: { field: ['th01-016', 'th01-019'], spellTrap: [SET_TRAP('th01-024')] },
    })
    s.players.player.spellTrap[0].faceDown = false
    const pending = aiAttack(s, 0, 0)
    const drum = pending.pendingResponse.options.find((o) => o.kind === 'drum')
    expect(drum.label).toBe('🥁 ส่งกลองศึกสะท้านแผ่นดินลงสุสาน ผสานเป็น แม่ทัพขี่ม้าศึก')
    const after = act(pending, { type: 'respond', trapUid: drum.id })
    const p = after.players.player
    expect(ids(p.field)).toContain('th01-021')
    expect(ids(p.graveyard)).toEqual(['th01-024', 'th01-016', 'th01-019']) // กลองลงก่อน (เป็นค่าใช้จ่าย)
    expect(p.lp).toBe(8000) // เป้าหมายเดิมเป็นวัตถุดิบ → การโจมตีถูกยกเลิก
  })
})

describe('เจ้าพรานแห่งไพร: ค้นหากับดักจากกอง', () => {
  it('เทิร์นละครั้ง ค้นกับดักขึ้นมือ', () => {
    const s = makeState({ player: { field: ['th01-003'], deck: ['th01-001', 'th01-015'] } })
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0) })
    expect(ids(after.players.player.hand)).toEqual(['th01-015'])
  })
})
