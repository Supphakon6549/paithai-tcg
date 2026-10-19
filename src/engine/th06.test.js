import { describe, expect, it } from 'vitest'
import { getAiAction } from './ai'
import {
  activationBlocker,
  applyAction,
  canAttackDirectly,
  getActivationTargets,
  getFieldAtk,
  getReadyAttackers,
  getSummonableHand,
  handCardBlocker,
  positionChangeBlocker,
  previewBattle,
} from './game'
import { AI, PLAYER } from './rules'
import { handUid, lastLog, makeState, uidAt } from './testUtils'

const act = (s, action) => applyAction(s, { player: PLAYER, ...action })
const ids = (list) => list.map((c) => c?.cardId ?? null)
const grave = (s, playerId, cardIds) => {
  s.players[playerId].graveyard = cardIds.map((cardId, i) => ({ uid: `${playerId}-g${i}`, cardId }))
  return s
}
const aiAttack = (s, zone, targetZone) =>
  applyAction(s, {
    type: 'attack',
    player: AI,
    attackerUid: uidAt(s, AI, zone),
    targetUid: targetZone === null ? null : uidAt(s, PLAYER, targetZone),
  })
const aiBattle = (opts) => makeState({ activePlayer: AI, phase: 'battle', ...opts })

describe('ผีเรือนเฝ้าชาน: รับการโจมตีแทนผีตัวอื่น', () => {
  it('ย้ายเป้ามาที่ผีเรือน รอดการต่อสู้ แต่ยังเสีย LP · ใบละครั้งต่อเทิร์น', () => {
    const s = aiBattle({ player: { field: ['th06-004', 'th06-001'] }, ai: { field: ['th01-017'] } })
    const pending = aiAttack(s, 0, 0)
    const guard = pending.pendingResponse.options.find((o) => o.kind === 'guard')
    expect(guard.label).toBe('🏠 ผีเรือนเฝ้าชาน รับการโจมตีแทน')
    const diff = previewBattle(s, AI, uidAt(s, AI, 0), uidAt(s, PLAYER, 1)).damage
    const after = applyAction(pending, { type: 'respond', player: PLAYER, trapUid: guard.id })
    expect(ids(after.players.player.field).slice(0, 2)).toEqual(['th06-004', 'th06-001'])
    expect(after.players.player.lp).toBe(8000 - diff)
    expect(lastLog(after).text).toBe('⚔️ ทหารเสือดาบสองมือ โจมตี ผีเรือนเฝ้าชาน')
    expect(lastLog(after).event.type).toBe('attack')
    // ทหารเสือโจมตีครั้งที่ 2 (ศัตรูมีมอนสเตอร์มากกว่า) → ผีเรือนใช้ซ้ำไม่ได้
    const again = aiAttack(after, 0, 0)
    expect(again.pendingResponse).toBeNull()
  })

  it('ไม่ใช้กับโจมตีตรง / เป้าไม่ใช่ผี / เป้าคว่ำ', () => {
    const notGhost = aiBattle({ player: { field: ['th01-016', 'th06-001'] }, ai: { field: ['th01-017'] } })
    expect(aiAttack(notGhost, 0, 0).pendingResponse).toBeNull()
    const facedown = aiBattle({
      player: { field: [{ id: 'th06-004', position: 'defense', faceDown: true }, 'th06-001'] },
      ai: { field: ['th01-017'] },
    })
    expect(aiAttack(facedown, 0, 0).pendingResponse).toBeNull()
  })
})

describe('กุมารทองนำทาง: อัญเชิญแล้วค้นผีระดับต่ำชื่ออื่น', () => {
  it('ไม่นับชื่อตัวเอง', () => {
    const s = makeState({ player: { hand: ['th06-002'], deck: ['th06-002', 'th06-001', 'th06-004', 'th06-006'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.pendingChoice.options.map((o) => o.id)).toEqual(['th06-001', 'th06-004'])
  })

  it('ไม่มีให้ค้น → ไม่ใช้สิทธิ์ชื่อ', () => {
    const s = makeState({ player: { hand: ['th06-002'], deck: ['th01-001'] } })
    const after = act(s, { type: 'summon', uid: handUid(s, PLAYER, 0) })
    expect(after.players.player.usedEffects['search:th06-002']).toBeUndefined()
  })
})

describe('นางตานีม่านใบ: มีผีตัวอื่น +200 และกันเลือกเป้า', () => {
  it('ไม่มีเพื่อน 1,000 / เพื่อนคว่ำ 1,000 / เพื่อนหงาย 1,200', () => {
    const alone = makeState({ player: { field: ['th06-003'] } })
    expect(getFieldAtk(alone, PLAYER, uidAt(alone, PLAYER, 0))).toBe(1200)
    const hidden = makeState({ player: { field: ['th06-003', { id: 'th06-001', position: 'defense', faceDown: true }] } })
    expect(getFieldAtk(hidden, PLAYER, uidAt(hidden, PLAYER, 0))).toBe(1200)
    const friend = makeState({ player: { field: ['th06-003', 'th06-001'] } })
    expect(getFieldAtk(friend, PLAYER, uidAt(friend, PLAYER, 0))).toBe(1400)
  })

  it('ความสามารถศัตรูเลือกนางตานีไม่ได้เมื่อมีเพื่อนผี (แต่ยังเลือกเพื่อนได้)', () => {
    const s = makeState({ player: { field: ['th04-003'] }, ai: { field: ['th06-003', 'th06-001'] } })
    expect(getActivationTargets(s, PLAYER, uidAt(s, PLAYER, 0)).map((m) => m.cardId)).toEqual(['th06-001'])
    const alone = makeState({ player: { field: ['th04-003'] }, ai: { field: ['th06-003'] } })
    expect(getActivationTargets(alone, PLAYER, uidAt(alone, PLAYER, 0)).map((m) => m.cardId)).toEqual(['th06-003'])
  })

  it('ทุกเป้าถูกกัน → กดใช้ไม่ได้', () => {
    const s = makeState({ player: { field: ['th04-003'] }, ai: { field: ['th06-003', 'th06-006'] } })
    expect(activationBlocker(s, PLAYER, uidAt(s, PLAYER, 0))).toBe('มอนสเตอร์ศัตรูทุกตัวเลือกเป็นเป้าไม่ได้')
  })
})

describe('ผีกองกอย: +100 ต่อผีในสุสานเรา สูงสุด +300', () => {
  it.each([
    [[], 1500],
    [['th06-001', 'th06-007'], 1700],
    [['th06-001', 'th06-002', 'th06-003', 'th06-005', 'th06-006'], 1800],
    [['th06-011', 'th01-001', 'th06-012'], 1500],
  ])('สุสาน %j → ATK %i', (cards, atk) => {
    const s = grave(makeState({ player: { field: ['th06-004'] } }), PLAYER, cards)
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(atk)
  })

  it('ไม่นับสุสานศัตรู', () => {
    const s = grave(makeState({ player: { field: ['th06-004'] } }), AI, ['th06-001', 'th06-002'])
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(1500)
  })
})

describe('นางตะเคียน: รากพันธนาการ', () => {
  it('เป้าโจมตีและเปลี่ยนท่าไม่ได้ตลอดเทิร์นถัดไปของศัตรู แล้วหลุด', () => {
    const s = makeState({ player: { field: ['th06-005'] }, ai: { field: ['th01-017'] } })
    const target = uidAt(s, AI, 0)
    let next = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: target })
    next = act(next, { type: 'endTurn' })
    expect(positionChangeBlocker(next, AI, target)).toBe('ถูกรากตะเคียนพันไว้ เปลี่ยนท่าไม่ได้')
    next = applyAction(next, { type: 'enterBattle', player: AI })
    expect(getReadyAttackers(next, AI)).toHaveLength(0)
    next = applyAction(next, { type: 'endTurn', player: AI })
    next = act(next, { type: 'endTurn' })
    expect(positionChangeBlocker(next, AI, target)).toBeNull()
  })
})

describe('แม่นาค: ถูกทำลายแล้วกลับมาตอนจบเทิร์น (ใบละครั้ง/เกม)', () => {
  const setup = () => aiBattle({ player: { field: ['th06-006'] }, ai: { field: ['th01-022'] } })

  it('ถูกทำลายเทิร์นศัตรู → จบเทิร์นกลับท่าตั้งรับหงาย', () => {
    const hit = aiAttack(setup(), 0, 0)
    expect(hit.players.player.field[0]).toBeNull()
    expect(lastLog(hit).details.join(' ')).toContain('แม่นาค: คำมั่นที่กลับมา: แม่นาคคำมั่นนิรันดร์ จะกลับมาท่าตั้งรับตอนจบเทิร์นนี้')
    const back = applyAction(hit, { type: 'endTurn', player: AI })
    expect(back.players.player.field[0]).toMatchObject({ cardId: 'th06-006', position: 'defense', faceDown: false })
    expect(back.players.player.graveyard).toHaveLength(0)
  })

  it('กลับมาแล้วตายอีกไม่กลับ', () => {
    const back = applyAction(aiAttack(setup(), 0, 0), { type: 'endTurn', player: AI })
    const s = back
    s.activePlayer = AI
    s.phase = 'battle'
    s.players.ai.field[0].hasAttacked = false
    s.players.ai.field[0].attackCount = 0
    const hit = applyAction(s, { type: 'attack', player: AI, attackerUid: uidAt(s, AI, 0), targetUid: s.players.player.field[0].uid })
    const end = applyAction(hit, { type: 'endTurn', player: AI })
    expect(end.players.player.field.every((m) => m === null)).toBe(true)
  })

  it('สนามเต็มตอนจบเทิร์น → ไม่กลับ', () => {
    const hit = aiAttack(setup(), 0, 0)
    hit.players.player.field = hit.players.player.field.map((m, i) => m ?? { uid: `fill-${i}`, cardId: 'th01-001', position: 'attack' })
    const end = applyAction(hit, { type: 'endTurn', player: AI })
    expect(end.players.player.graveyard.map((c) => c.cardId)).toEqual(['th06-006'])
  })
})

describe('ปอบเงาสิง: ดูดพลัง 300', () => {
  it('เป้า −300 ตัวเอง +300 จนจบเทิร์น', () => {
    const s = makeState({ player: { field: ['th06-007'] }, ai: { field: ['th01-017'] } })
    const after = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1400)
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 0))).toBe(1600)
    const next = act(after, { type: 'endTurn' })
    expect(getFieldAtk(next, PLAYER, uidAt(s, PLAYER, 0))).toBe(1300)
  })
})

describe('กระสือแสงหลง: บินข้ามการ์ดคว่ำ', () => {
  it('ศัตรูมีแต่การ์ดคว่ำ → โจมตีตรงได้ 1,600', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: ['th06-008'] },
      ai: { field: [{ id: 'th01-018', position: 'defense', faceDown: true }] },
    })
    expect(canAttackDirectly(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(true)
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: null })
    expect(after.players.ai.lp).toBe(8000 - 1600)
    expect(lastLog(after).details[0]).toContain('บินข้ามการ์ดคว่ำ')
  })

  it('ศัตรูมีมอนสเตอร์หงาย 1 ตัว → โจมตีตรงไม่ได้', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th06-008'] }, ai: { field: ['th01-001'] } })
    expect(canAttackDirectly(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(false)
    expect(() => act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: null })).toThrow()
  })

  it('AI เลือกบินข้ามโจมตีตรง', () => {
    const s = aiBattle({ ai: { field: ['th06-008'] }, player: { field: [{ id: 'th01-018', position: 'defense', faceDown: true }] } })
    expect(getAiAction(s)).toMatchObject({ type: 'attack', targetUid: null })
  })
})

describe('คำสาปพันธะเงา + สายมืด', () => {
  const setup = () =>
    makeState({ player: { hand: ['th06-012', 'th06-009', 'th06-010'], field: ['th01-002', 'th01-006'] } })

  it('พรานไสยเวท/อาจารย์ไสยดำ อัญเชิญปกติไม่ได้', () => {
    const s = makeState({ player: { hand: ['th06-009'], field: ['th01-001'] } })
    expect(getSummonableHand(s, PLAYER)).toHaveLength(0)
    expect(() => act(s, { type: 'summon', uid: handUid(s, PLAYER, 0), tributes: [uidAt(s, PLAYER, 0)] })).toThrow(
      'พรานไสยเวท อัญเชิญได้ด้วย "คำสาปพันธะเงา" เท่านั้น'
    )
  })

  it('สังเวยพรานหนุ่ม → พรานไสยเวทลงช่องเดิม · ชื่อละครั้งต่อเทิร์น', () => {
    const s = setup()
    const after = act(s, { type: 'playSpell', uid: handUid(s, PLAYER, 0), targetUid: uidAt(s, PLAYER, 0) })
    expect(ids(after.players.player.field).slice(0, 2)).toEqual(['th06-009', 'th01-006'])
    expect(ids(after.players.player.graveyard)).toEqual(['th06-012', 'th01-002'])
    expect(after.players.player.hasNormalSummoned).toBe(false)
    after.players.player.hand.push({ uid: 'extra-spell', cardId: 'th06-012' })
    expect(handCardBlocker(after, PLAYER, 'extra-spell')).toBe('ใช้ "คำสาปพันธะเงา" ไปแล้วเทิร์นนี้')
  })

  it('ไม่มีร่างคู่ในมือ → ใช้ไม่ได้', () => {
    const s = makeState({ player: { hand: ['th06-012', 'th06-010'], field: ['th01-002'] } })
    expect(handCardBlocker(s, PLAYER, handUid(s, PLAYER, 0))).toContain('ต้องมีต้นสาย')
  })

  it('พรานไสยเวททำลายศัตรู → เลือกส่งผีจากกองลงสุสาน', () => {
    const s = makeState({
      phase: 'battle',
      player: { field: ['th06-009'], deck: ['th06-001', 'th01-001', 'th06-004'] },
      ai: { field: ['th01-016'] },
    })
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(after.pendingChoice).toMatchObject({ kind: 'mill', player: PLAYER })
    expect(after.pendingChoice.options.map((o) => o.id)).toEqual(['th06-001', 'th06-004', 'skip'])
    const milled = act(after, { type: 'choose', optionId: 'th06-004' })
    expect(ids(milled.players.player.graveyard)).toEqual(['th06-004'])
    expect(ids(milled.players.player.deck)).toEqual(['th06-001', 'th01-001'])
  })

  it('อาจารย์ไสยดำ: สาปแล้วถูกทำลาย → ผู้ควบคุมเสีย 500 เพิ่ม (ครั้งเดียว)', () => {
    const s = makeState({ player: { field: ['th06-010', 'th01-022'] }, ai: { field: ['th01-016'] } })
    const target = uidAt(s, AI, 0)
    let next = act(s, { type: 'activate', uid: uidAt(s, PLAYER, 0), targetUid: target })
    expect(next.players.ai.field[0].curse).toEqual({ until: 4, amount: 500 })
    next = act(next, { type: 'enterBattle' })
    const diff = previewBattle(next, PLAYER, uidAt(s, PLAYER, 1), target).damage
    next = act(next, { type: 'attack', attackerUid: uidAt(s, PLAYER, 1), targetUid: target })
    expect(next.players.ai.lp).toBe(8000 - diff - 500)
    expect(lastLog(next).details.join(' ')).toContain('🕯️ คำสาป: พลทหารอาสา ถูกทำลาย → คู่ต่อสู้เสีย LP 500')
  })

  it('คำสาปหมดอายุแล้วไม่มีผล', () => {
    const s = makeState({ player: { field: ['th01-022'] }, ai: { field: ['th01-016'] }, phase: 'battle' })
    s.players.ai.field[0].curse = { until: 2, amount: 500 }
    const diff = previewBattle(s, PLAYER, uidAt(s, PLAYER, 0), uidAt(s, AI, 0)).damage
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(after.players.ai.lp).toBe(8000 - diff)
  })
})

describe('ป่าช้าวัดร้าง: เวทสนามฝ่ายผี', () => {
  it('ผีฝ่ายเรา +200 · ไม่ใช่สนามอสูร (ทศกัณฐ์ยังอ่อนแรง)', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th06-004', 'th01-011'], fieldSpell: 'th06-011' } })
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 0))).toBe(1700)
    expect(getFieldAtk(s, PLAYER, uidAt(s, PLAYER, 1))).toBe(1800)
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 1), targetUid: null })
    expect(getFieldAtk(after, PLAYER, uidAt(s, PLAYER, 1))).toBe(1600)
  })
})

describe('AI ไม่เลือกเป้าที่กันเลือกเป้า', () => {
  it('อสูรมนตราควันของ AI ไม่เลือกนางตานีที่มีผีตัวอื่น', () => {
    const s = makeState({ activePlayer: AI, ai: { field: ['th04-003', 'th04-004'] }, player: { field: ['th06-003', 'th06-001'] } })
    s.players.player.field[0].tempAtk = [{ amount: 1000, reason: 'ทดสอบ' }]
    const action = getAiAction(s)
    if (action?.type === 'activate') expect(action.targetUid).not.toBe(uidAt(s, PLAYER, 0))
    expect(() => applyAction(s, action)).not.toThrow()
  })
})

describe('ผีคำสาปตอนตาย (013–015)', () => {
  it('ผีพรายถูกตีตาย → ผู้โจมตีถูกทำลายตาม', () => {
    const s = aiBattle({ player: { field: ['th06-014'] }, ai: { field: ['th01-022'] } })
    s.players.ai.field[0].hasAttacked = false
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]).toBeNull()
    // จอมทัพไม่ตายจากการต่อสู้ แต่คำสาปเป็นเอฟเฟกต์ จึงตายตาม
    expect(after.players.ai.field[0]).toBeNull()
    expect(lastLog(after).details.join(' ')).toContain('ผีพรายทวงสัญญา: ทวงชีวิตคืน: จอมทัพยุทธหัตถี คชสารศึก ถูกทำลายตาม')
  })

  it('ผีตายโหงถูกตีตาย → ผู้โจมตี ATK เหลือครึ่งถาวร', () => {
    const s = aiBattle({ player: { field: ['th06-013'] }, ai: { field: ['th01-022'] } })
    const after = aiAttack(s, 0, 0)
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1500)
    const later = applyAction(applyAction(after, { type: 'endTurn', player: AI }), { type: 'endTurn', player: PLAYER })
    expect(getFieldAtk(later, AI, uidAt(s, AI, 0))).toBe(1500)
  })

  it('ผีเป็นฝ่ายโจมตีแล้วตาย → ฝ่ายรับโดนคำสาปด้วย', () => {
    const s = makeState({ phase: 'battle', player: { field: ['th06-013'] }, ai: { field: ['th01-018'] } })
    const after = act(s, { type: 'attack', attackerUid: uidAt(s, PLAYER, 0), targetUid: uidAt(s, AI, 0) })
    expect(after.players.player.field[0]).toBeNull()
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(1250)
  })
})

describe('ผีอาฆาตเฝ้าทาง: เฝ้าทาง + สาปห้ามโจมตี', () => {
  const guarded = () =>
    aiBattle({ player: { field: [{ id: 'th06-015', position: 'defense' }, 'th06-004'] }, ai: { field: ['th01-022', 'th01-017'] } })

  it('ท่าตั้งรับหงาย → ศัตรูต้องตีผีอาฆาตก่อน', () => {
    const s = guarded()
    expect(() => aiAttack(s, 0, 1)).toThrow('ต้องโจมตี ผีอาฆาตเฝ้าทาง ก่อน')
    expect(getAiAction(s)).toMatchObject({ type: 'attack', targetUid: uidAt(s, PLAYER, 0) })
  })

  it('ท่าโจมตี → ไม่บังคับ', () => {
    const s = aiBattle({ player: { field: ['th06-015', 'th06-004'] }, ai: { field: ['th01-022'] } })
    expect(() => aiAttack(s, 0, 1)).not.toThrow()
  })

  it('ถูกทำลาย → ตัวที่ทำลายโจมตีไม่ได้ถึงจบเทิร์นถัดไปของเจ้าของ (รวมเทิร์นนี้)', () => {
    let s = aiAttack(guarded(), 0, 0)
    expect(s.players.player.field[0]).toBeNull()
    const killer = uidAt(guarded(), AI, 0)
    expect(s.players.ai.field[0].cannotAttackUntil).toBe(5)
    s = applyAction(s, { type: 'endTurn', player: AI })
    s = act(s, { type: 'endTurn' })
    s = applyAction(s, { type: 'enterBattle', player: AI })
    expect(getReadyAttackers(s, AI).map((m) => m.uid)).not.toContain(killer)
    s = applyAction(s, { type: 'endTurn', player: AI })
    s = act(s, { type: 'endTurn' })
    s = applyAction(s, { type: 'enterBattle', player: AI })
    expect(getReadyAttackers(s, AI).map((m) => m.uid)).toContain(killer)
  })
})

describe('คำสาปตอนตาย: กรณีขอบ (ตามข้อกำหนด DC05 / DC17)', () => {
  it('เลขคี่ปัดลง: ATK 1,001 เหลือ 500', () => {
    const s = aiBattle({ player: { field: ['th06-013'] }, ai: { field: ['th01-022'] } })
    s.players.ai.field[0].tempAtk = [{ amount: -1999, reason: 'ทดสอบ' }]
    s.players.player.field[0].tempAtk = [{ amount: -1000, reason: 'ทดสอบให้ผีแพ้' }]
    const after = aiAttack(s, 0, 0)
    expect(after.players.player.field[0]).toBeNull()
    expect(getFieldAtk(after, AI, uidAt(s, AI, 0))).toBe(500)
  })

  it('เสมอแต่จอมทัพรอด → ผีพรายยังทำลายตาม', () => {
    const s = aiBattle({ player: { field: ['th06-014'] }, ai: { field: ['th01-022'] } })
    s.players.player.field[0].tempAtk = [{ amount: 1700, reason: 'ทดสอบให้เท่ากัน' }]
    const after = aiAttack(s, 0, 0)
    expect(lastLog(after).details.join(' ')).toContain('ถูกทำลายตาม')
    expect(after.players.ai.field[0]).toBeNull()
  })
})
