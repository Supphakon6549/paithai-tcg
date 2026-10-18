import { getCardById } from '../data/cards'
import { describeSide, resolveBattle } from './battle'
import {
  getActivated,
  getAfterBattleDestroy,
  getAtkBoosts,
  getEffectiveAtk,
  getEvolve,
  getExtraAttack,
  getNoTributeCondition,
  getPiercing,
  getRitualInfo,
  getTrapEffect,
  hasTrapLock,
  isFieldSpell,
  isPlayableNonMonster,
  reduceBattleDamage,
} from './effects'
import { createRng, shuffle } from './random'
import {
  PLAYER,
  PLAYER_NAMES,
  RULES,
  EXTRA_DECK_LIST,
  STARTER_DECK_LIST,
  formatNumber,
  opponentOf,
} from './rules'

/*
 * สถานะเกมเป็นออบเจกต์ธรรมดา (serialize ได้) ทุกแอ็กชันคืนสถานะใหม่ ไม่แก้ของเดิม
 *
 * state = {
 *   turn, activePlayer, phase: 'main1'|'battle'|'main2'|'discard'|'over',
 *   winner, endReason: 'lp'|'deckOut'|null,
 *   players: { [id]: { id, lp, deck, hand, field[5], spellTrap[5], fieldSpell, graveyard,
 *                      extraDeck, hasNormalSummoned, usedEffects: { [key]: turn } } },
 *   pendingResponse: null | { responder, attacker, attackerUid, targetUid, trapUids, details }
 *                    (การโจมตีที่รอฝ่ายรับตัดสินใจเปิดกับดัก — ตอนนี้ responder เป็นคนเล่น)
 *   log: [{ id, turn, actor, kind, text, details?, event? }], logSeq
 * }
 * การ์ดในกอง/มือ/สุสาน = { uid, cardId }
 * บนสนามเพิ่ม { hasAttacked, summonedTurn, position: 'attack'|'defense', faceDown, positionChangedTurn,
 *               tempAtk?: [{ amount, reason }] (ตัวปรับ ATK จนจบเทิร์น),
 *               xp?: แต้มประสบการณ์, xpReadyTurn?: เทิร์นที่แต้มครบ (เลื่อนยศได้เทิร์นหลังจากนั้น) }
 * ช่องเวท/กับดัก = { uid, cardId, faceDown, setTurn } · ช่องเวทสนาม = { uid, cardId }
 */

export class GameRuleError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GameRuleError'
  }
}

export const cardOf = (instance) => getCardById(instance.cardId)

export function expandDeckList(deckList) {
  return deckList.flatMap(([cardId, copies]) => Array(copies).fill(cardId))
}

// จำนวนตัวที่ต้องสังเวย: ระดับ 5–6 = 1, ระดับ 7+ = 2 (เฉพาะการ์ดอัญเชิญสังเวย) · 0 = อัญเชิญแบบนี้ไม่ได้
export function tributesRequired(card) {
  if (card?.type !== 'monster' || card.summonType !== 'tribute') return 0
  return card.level >= 7 ? 2 : card.level >= 5 ? 1 : 0
}

export function isNormalSummonable(card) {
  return (
    card?.type === 'monster' &&
    (card.summonType ?? 'normal') === 'normal' &&
    card.level >= 1 &&
    card.level <= RULES.maxNormalSummonLevel
  )
}

function addLog(state, actor, kind, text, details) {
  state.logSeq += 1
  state.log.push({ id: state.logSeq, turn: state.turn, actor, kind, text, ...(details ? { details } : {}) })
}

// ตรวจสำรับจากภายนอก (เช่นหน้าจัดสำรับ): รหัสการ์ดต้องมีจริง และกองพิเศษรับเฉพาะมอนสเตอร์ผสานร่าง
// คืนรายการปัญหาเป็นข้อความภาษาไทย (ว่าง = ใช้ได้)
export function validateDeck(deckList, extraDeckList = []) {
  const problems = []
  const check = (list, label) => {
    if (!Array.isArray(list)) {
      problems.push(`${label}ต้องเป็นรายการ [รหัสการ์ด, จำนวน]`)
      return
    }
    for (const entry of list) {
      const [cardId, copies] = Array.isArray(entry) ? entry : []
      if (!getCardById(cardId)) problems.push(`${label}: ไม่พบการ์ดรหัส ${cardId}`)
      if (!Number.isInteger(copies) || copies < 1) problems.push(`${label}: จำนวนของ ${cardId} ไม่ถูกต้อง`)
    }
  }
  check(deckList, 'กองหลัก')
  check(extraDeckList, 'กองพิเศษ')
  if (problems.length) return problems

  if (expandDeckList(deckList).length <= RULES.startingHand) {
    problems.push(`กองหลักต้องมีมากกว่า ${RULES.startingHand} ใบ`)
  }
  for (const [cardId] of extraDeckList) {
    if (getCardById(cardId).summonType !== 'fusion') {
      problems.push(`กองพิเศษ: ${getCardById(cardId).name} ไม่ใช่มอนสเตอร์ผสานร่าง`)
    }
  }
  for (const [cardId] of deckList) {
    if (getCardById(cardId).summonType === 'fusion') {
      problems.push(`กองหลัก: ${getCardById(cardId).name} เป็นมอนสเตอร์ผสานร่าง ต้องอยู่กองพิเศษ`)
    }
  }
  return problems
}

/**
 * deckList / extraDeckList = สำรับของผู้เล่น · aiDeckList / aiExtraDeckList = สำรับของ AI
 * (ไม่ระบุ = สำรับเริ่มต้น) รูปแบบ: [['th01-001', 4], ...]
 */
export function createGame({
  seed = Date.now(),
  firstPlayer = PLAYER,
  deckList = STARTER_DECK_LIST,
  extraDeckList = EXTRA_DECK_LIST,
  aiDeckList = STARTER_DECK_LIST,
  aiExtraDeckList = EXTRA_DECK_LIST,
} = {}) {
  for (const [main, extra, owner] of [
    [deckList, extraDeckList, 'ผู้เล่น'],
    [aiDeckList, aiExtraDeckList, 'AI'],
  ]) {
    const problems = validateDeck(main, extra)
    if (problems.length) throw new GameRuleError(`สำรับ${owner}ใช้ไม่ได้: ${problems.join(' · ')}`)
  }
  const rng = createRng(seed)
  const decks = {
    [PLAYER]: { deckList, extraDeckList },
    [opponentOf(PLAYER)]: { deckList: aiDeckList, extraDeckList: aiExtraDeckList },
  }

  const makePlayer = (id) => {
    const { deckList, extraDeckList } = decks[id]
    const cards = expandDeckList(deckList).map((cardId, i) => ({ uid: `${id}-${i + 1}`, cardId }))
    const deck = shuffle(cards, rng)
    const hand = deck.splice(0, RULES.startingHand)
    return {
      id,
      lp: RULES.startingLP,
      deck,
      hand,
      field: Array(RULES.monsterZones).fill(null),
      spellTrap: Array(RULES.spellTrapZones).fill(null),
      fieldSpell: null,
      graveyard: [],
      extraDeck: expandDeckList(extraDeckList).map((cardId, i) => ({ uid: `${id}-x${i + 1}`, cardId })),
      hasNormalSummoned: false,
      usedEffects: {},
    }
  }

  const state = {
    turn: 1,
    activePlayer: firstPlayer,
    phase: 'main1',
    winner: null,
    endReason: null,
    players: { [PLAYER]: makePlayer(PLAYER), [opponentOf(PLAYER)]: makePlayer(opponentOf(PLAYER)) },
    pendingResponse: null,
    log: [],
    logSeq: 0,
  }

  const deckSizeOf = (id) => state.players[id].deck.length + RULES.startingHand
  const mySize = deckSizeOf(PLAYER)
  const aiSize = deckSizeOf(opponentOf(PLAYER))
  const deckText = mySize === aiSize ? `สำรับฝ่ายละ ${mySize} ใบ` : `สำรับคุณ ${mySize} ใบ · คู่ต่อสู้ ${aiSize} ใบ`
  addLog(
    state,
    null,
    'system',
    `เริ่มเกม! LP ฝ่ายละ ${formatNumber(RULES.startingLP)} · ${deckText} · จั่วมือแรกฝ่ายละ ${RULES.startingHand} ใบ`
  )
  addLog(
    state,
    firstPlayer,
    'turn',
    `เทิร์น 1 — ${PLAYER_NAMES[firstPlayer]}เริ่มก่อน (เทิร์นแรกไม่จั่ว และยังโจมตีไม่ได้)`
  )
  return state
}

// ---------- ตัวช่วยสำหรับ UI / AI (อ่านอย่างเดียว) ----------

// ผู้ที่ต้องทำแอ็กชันถัดไป: ปกติคือเจ้าของเทิร์น แต่ระหว่างรอเปิดกับดักคือฝ่ายรับ
export function currentActor(state) {
  return state.pendingResponse ? state.pendingResponse.responder : state.activePlayer
}

const inMainPhase = (state) => state.phase === 'main1' || state.phase === 'main2'
const isPlayersOpenMain = (state, playerId) =>
  !state.winner && state.activePlayer === playerId && !state.pendingResponse && inMainPhase(state)

export function getSummonableHand(state, playerId) {
  const p = state.players[playerId]
  if (state.winner || state.activePlayer !== playerId || state.pendingResponse) return []
  if (state.phase !== 'main1' && state.phase !== 'main2') return []
  if (p.hasNormalSummoned) return []
  const hasEmptyZone = p.field.includes(null)
  const monsterCount = p.field.filter(Boolean).length
  return p.hand.filter((inst) => {
    const card = cardOf(inst)
    if (isNormalSummonable(card)) return hasEmptyZone
    if (tributesRequired(card) === 0) return false
    const cost = getTributeCost(state, playerId, card)
    return cost === 0 ? hasEmptyZone : monsterCount >= cost
  })
}

// จำนวนตัวสังเวยจริง (เอฟเฟกต์บางใบลดเป็น 0 ได้ เช่น ช้างศึกไอยรา)
export function getTributeCost(state, playerId, card) {
  const base = tributesRequired(card)
  if (base === 0) return 0
  const free = getNoTributeCondition(card)
  return free?.isActive({ allies: getAllies(state, playerId, null) }) ? 0 : base
}

export function canAttackThisTurn(state) {
  return state.turn > 1
}

export function getReadyAttackers(state, playerId) {
  if (state.winner || state.activePlayer !== playerId || state.phase !== 'battle') return []
  if (state.pendingResponse || !canAttackThisTurn(state)) return []
  return state.players[playerId].field.filter((m) => m && canDeclareAttack(state, playerId, m))
}

const attacksMade = (m) => m.attackCount ?? (m.hasAttacked ? 1 : 0)

// โจมตีได้กี่ครั้งเทิร์นนี้ (เอฟเฟกต์โจมตีเพิ่มเช็ก ณ ตอนประกาศโจมตี)
function maxAttacks(state, playerId, m) {
  const extra = getExtraAttack(cardOf(m))
  if (!extra) return 1
  const allyCount = state.players[playerId].field.filter(Boolean).length
  const enemyCount = state.players[opponentOf(playerId)].field.filter(Boolean).length
  return extra.isActive({ allyCount, enemyCount }) ? 2 : 1
}

function canDeclareAttack(state, playerId, m) {
  return m.position !== 'defense' && attacksMade(m) < maxAttacks(state, playerId, m)
}

// เปลี่ยนท่าได้ในเฟสหลัก ตัวละ 1 ครั้ง/เทิร์น ยกเว้นเทิร์นที่เพิ่งลงสนามหรือโจมตีไปแล้ว
// คืนข้อความเหตุผลถ้าเปลี่ยนไม่ได้ หรือ null ถ้าเปลี่ยนได้
export function positionChangeBlocker(state, playerId, uid) {
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  if (!m) return 'ไม่พบมอนสเตอร์ตัวนี้บนสนาม'
  if (state.winner || state.activePlayer !== playerId) return 'ยังไม่ถึงตาของคุณ'
  if (state.phase !== 'main1' && state.phase !== 'main2') return 'เปลี่ยนท่าได้เฉพาะเฟสหลัก'
  if (m.summonedTurn === state.turn) return 'เพิ่งลงสนามเทิร์นนี้ ยังเปลี่ยนท่าไม่ได้'
  if (m.hasAttacked) return 'โจมตีไปแล้วเทิร์นนี้ เปลี่ยนท่าไม่ได้'
  if (m.positionChangedTurn === state.turn) return 'เปลี่ยนท่าไปแล้วเทิร์นนี้'
  return null
}

export function getOpponentMonsters(state, playerId) {
  return state.players[opponentOf(playerId)].field.filter(Boolean)
}

// การ์ดมอนสเตอร์ตัวอื่นบนสนามของ playerId (ใช้เช็กเงื่อนไขเอฟเฟกต์)
export function getAllies(state, playerId, excludeUid) {
  // การ์ดคว่ำยังไม่เปิดเผย จึงไม่นับเป็นเงื่อนไขเอฟเฟกต์
  return state.players[playerId].field.filter((m) => m && m.uid !== excludeUid && !m.faceDown).map(cardOf)
}

// ตัวปรับ ATK ที่ไม่ได้มาจากมอนสเตอร์: เวทสนามของเจ้าของ + ตัวปรับชั่วคราวบนตัวมอนสเตอร์
function atkExtras(state, playerId, m) {
  const fieldSpell = state.players[playerId].fieldSpell
  return { fieldSpell: fieldSpell ? cardOf(fieldSpell) : null, temp: m?.tempAtk ?? [] }
}

// ATK จริงบนสนามรวมบัฟจากเอฟเฟกต์ (ยังไม่รวมโบนัสธาตุ/เผ่าซึ่งขึ้นกับคู่ต่อสู้)
export function getFieldAtk(state, playerId, uid) {
  const monster = state.players[playerId].field.find((m) => m?.uid === uid)
  return getEffectiveAtk(
    cardOf(monster),
    getAllies(state, playerId, uid),
    getAllies(state, opponentOf(playerId), null),
    atkExtras(state, playerId, monster)
  )
}

// คำนวณผลต่อสู้ล่วงหน้าโดยไม่เปลี่ยนสถานะ — ใช้ทั้งตอนโจมตีจริง, AI และ UI
export function previewBattle(state, playerId, attackerUid, defenderUid) {
  const oppId = opponentOf(playerId)
  const attacker = state.players[playerId].field.find((m) => m?.uid === attackerUid)
  const defender = state.players[oppId].field.find((m) => m?.uid === defenderUid)
  return resolveBattle(cardOf(attacker), cardOf(defender), {
    attackerAllies: getAllies(state, playerId, attackerUid),
    attackerEnemies: getAllies(state, oppId, null),
    attackerExtras: atkExtras(state, playerId, attacker),
    defenderAllies: getAllies(state, oppId, defenderUid),
    defenderEnemies: getAllies(state, playerId, null),
    defenderExtras: atkExtras(state, oppId, defender),
    defenderStat: defender.position === 'defense' ? 'def' : 'atk',
  })
}

export function getHandOverflow(state, playerId) {
  return Math.max(0, state.players[playerId].hand.length - RULES.handLimit)
}

const usedKey = (activated, m) => (activated.oncePer === 'name' ? `name:${m.cardId}` : `card:${m.uid}`)

// เหตุผลที่ยังกดใช้ความสามารถของมอนสเตอร์บนสนามไม่ได้ (null = ใช้ได้)
export function activationBlocker(state, playerId, uid) {
  const p = state.players[playerId]
  const m = p.field.find((x) => x?.uid === uid)
  if (!m) return 'ไม่พบมอนสเตอร์ตัวนี้บนสนาม'
  const card = cardOf(m)
  const activated = getActivated(card)
  if (!activated) return `${card.name} ไม่มีความสามารถที่กดใช้ได้`
  if (state.winner || state.activePlayer !== playerId || state.pendingResponse) return 'ยังไม่ถึงตาของคุณ'
  if (!inMainPhase(state)) return 'ใช้ความสามารถได้เฉพาะเฟสหลัก'
  if (m.faceDown) return 'การ์ดคว่ำอยู่ ใช้ความสามารถไม่ได้'
  if ((p.usedEffects ?? {})[usedKey(activated, m)] === state.turn) {
    return activated.oncePer === 'name'
      ? `ใช้ความสามารถของ "${card.name}" ไปแล้วเทิร์นนี้`
      : 'ใช้ความสามารถไปแล้วเทิร์นนี้'
  }
  if (activated.isReady && !activated.isReady({ allies: getAllies(state, playerId, uid) })) {
    return activated.notReadyReason
  }
  if (activated.kind === 'debuff') {
    if (p.hand.length === 0) return 'ต้องมีการ์ดในมือให้ทิ้ง 1 ใบ'
    if (getAllies(state, opponentOf(playerId), null).length === 0) return 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์หงายหน้า'
  }
  return null
}

// การ์ดพิธีกรรม: มอนสเตอร์ที่ใช้เป็นเครื่องสังเวยได้ (มือ ยกเว้นตัวที่จะอัญเชิญ 1 ใบ + บนสนาม ทั้งหงายและคว่ำ)
export function ritualTributePool(state, playerId, ritualUid) {
  const p = state.players[playerId]
  const ritual = getRitualInfo(cardOf(p.hand.find((c) => c.uid === ritualUid) ?? {}))
  if (!ritual) return []
  const targetInst = p.hand.find((c) => c.cardId === ritual.target)
  const fromHand = p.hand.filter((c) => c.uid !== targetInst?.uid && cardOf(c).type === 'monster')
  return [...fromHand, ...p.field.filter(Boolean)]
}

// ตรวจเครื่องสังเวยที่เลือกสำหรับพิธีกรรม (null = ใช้ได้)
export function ritualTributeProblem(state, playerId, ritualUid, tributeUids = []) {
  const p = state.players[playerId]
  const ritual = getRitualInfo(cardOf(p.hand.find((c) => c.uid === ritualUid) ?? {}))
  if (!ritual) return 'ไม่ใช่การ์ดพิธีกรรม'
  const pool = ritualTributePool(state, playerId, ritualUid)
  const chosen = [...new Set(tributeUids)].map((uid) => pool.find((c) => c.uid === uid))
  if (chosen.length === 0) return 'เลือกมอนสเตอร์ที่จะสังเวย'
  if (chosen.includes(undefined)) return 'สังเวยได้เฉพาะมอนสเตอร์ในมือหรือบนสนามของเรา'
  const usesSubstitute = chosen.length === 1 && ritual.substitutes.includes(chosen[0].cardId)
  const total = chosen.reduce((sum, c) => sum + cardOf(c).level, 0)
  if (!usesSubstitute && total < ritual.requiredLevel) {
    return `ระดับรวม ${total} ยังไม่ถึง ${ritual.requiredLevel}`
  }
  const fieldTributes = chosen.filter((c) => p.field.some((m) => m?.uid === c.uid)).length
  if (!p.field.includes(null) && fieldTributes === 0) return 'ไม่มีช่องมอนสเตอร์ว่างให้อัญเชิญ'
  return null
}

// เหตุผลที่ยังใช้การ์ดเวท / พิธีกรรม / วางกับดักใบนี้จากมือไม่ได้ (null = ใช้ได้)
export function handCardBlocker(state, playerId, uid) {
  const p = state.players[playerId]
  const inst = p.hand.find((c) => c.uid === uid)
  if (!inst) return 'ไม่พบการ์ดนี้ในมือ'
  const card = cardOf(inst)
  if (card.type === 'monster') return 'การ์ดมอนสเตอร์ใช้วิธีอัญเชิญ'
  if (!isPlayableNonMonster(card)) return 'การ์ดใบนี้ยังใช้ไม่ได้ในเกมขั้นนี้'
  if (!isPlayersOpenMain(state, playerId)) return 'ใช้ได้เฉพาะเฟสหลักในตาของเรา'
  if (card.type === 'trap' && !p.spellTrap.includes(null)) return 'ช่องเวท/กับดักเต็มแล้ว'
  const ritual = getRitualInfo(card)
  if (ritual) {
    if (!p.hand.some((c) => c.cardId === ritual.target)) return `ต้องมี "${getCardById(ritual.target).name}" อยู่ในมือ`
    const pool = ritualTributePool(state, playerId, uid)
    const hasSubstitute = pool.some((c) => ritual.substitutes.includes(c.cardId))
    const total = pool.reduce((sum, c) => sum + cardOf(c).level, 0)
    if (!hasSubstitute && total < ritual.requiredLevel) {
      return `มอนสเตอร์ในมือและบนสนามมีระดับรวม ${total} ยังไม่ถึง ${ritual.requiredLevel}`
    }
  }
  return null
}

// ---------- แอ็กชัน ----------

export function applyAction(state, action) {
  if (state.winner) throw new GameRuleError('เกมจบแล้ว')
  if (action.player !== currentActor(state)) {
    throw new GameRuleError(
      state.pendingResponse ? 'รอฝ่ายรับตัดสินใจเปิดกับดักก่อน' : 'ยังไม่ถึงเทิร์นของผู้เล่นนี้'
    )
  }
  if (state.pendingResponse && action.type !== 'respond') {
    throw new GameRuleError('ต้องตัดสินใจก่อนว่าจะเปิดกับดักหรือไม่')
  }
  const next = structuredClone(state)
  switch (action.type) {
    case 'summon':
      summon(next, action.player, action.uid, action.zone, action.tributes, action.position)
      break
    case 'changePosition':
      changePosition(next, action.player, action.uid)
      break
    case 'enterBattle':
      enterBattle(next, action.player)
      break
    case 'endBattle':
      endBattle(next, action.player)
      break
    case 'attack':
      attack(next, action.player, action.attackerUid, action.targetUid ?? null)
      break
    case 'endTurn':
      endTurn(next, action.player)
      break
    case 'discard':
      discard(next, action.player, action.uid)
      break
    case 'activate':
      activate(next, action.player, action.uid, action.discardUid, action.targetUid)
      break
    case 'playSpell':
      playSpell(next, action.player, action.uid, action.tributes)
      break
    case 'setTrap':
      setTrap(next, action.player, action.uid)
      break
    case 'respond':
      respond(next, action.player, action.trapUid ?? null)
      break
    case 'evolve':
      evolve(next, action.player, action.uid, action.from)
      break
    default:
      throw new GameRuleError(`ไม่รู้จักแอ็กชัน ${action.type}`)
  }
  attachEvent(state, next, action)
  return next
}

/*
 * ข้อมูลเหตุการณ์สำหรับแอนิเมชัน (ภาพ/เสียง) — แนบที่บันทึกหลักของแอ็กชัน
 * (kind: summon | position | battle | discard | effect | spell | trap) เป็น entry.event:
 * {
 *   type: 'summon' | 'changePosition' | 'attack' | 'attackNegated' | 'discard'
 *         | 'activate' | 'playSpell' | 'setTrap' | 'evolve',
 *   player, source: uid ตัวที่ทำ, target: uid เป้าหมาย (โจมตีตรง/ไม่มีเป้า = null),
 *   trap: uid กับดักที่เปิด (attackNegated) หรือ null,
 *   placed:       [{ player, uid, cardId, zone, faceDown, position }]  มอนสเตอร์ลงสนามใหม่
 *   destroyed:    [{ player, uid, cardId, zone }]                      มอนสเตอร์ออกจากสนามลงสุสาน
 *   revealed:     [{ player, uid, cardId, zone }]                      การ์ดคว่ำถูกเปิด
 *   damage:       [{ player, amount, lpBefore, lpAfter }]              LP ที่ลดลง
 *   heal:         [{ player, amount, lpBefore, lpAfter }]              LP ที่เพิ่มขึ้น
 *   spellPlaced:  [{ player, uid, cardId, zoneType: 'spell-trap'|'field', zone, faceDown }]
 *   spellRemoved: [{ player, uid, cardId, zoneType: 'spell-trap'|'field', zone }]
 * }
 * การโจมตีที่ต้องรอกับดัก: บันทึกตอนประกาศเป็น kind 'pending' (ไม่มี event)
 * แล้ว event มาพร้อมผล (type 'attack' หรือ 'attackNegated') หลังฝ่ายรับตัดสินใจ
 * ทุก uid ตรงกับ data-uid บนหน้าจอ ใช้หาตำแหน่งการ์ดได้
 */
function attachEvent(prev, next, action) {
  const entry = next.log
    .slice(prev.log.length)
    .find((e) => ['summon', 'position', 'battle', 'discard', 'effect', 'spell', 'trap', 'evolve'].includes(e.kind))
  if (!entry) return
  const placed = []
  const destroyed = []
  const revealed = []
  const damage = []
  const heal = []
  const spellPlaced = []
  const spellRemoved = []
  const spellZones = (pl) => [
    ...pl.spellTrap.map((t, zone) => t && { ...t, zone, zoneType: 'spell-trap' }),
    pl.fieldSpell && { ...pl.fieldSpell, zone: 0, zoneType: 'field' },
  ].filter(Boolean)
  for (const id of Object.keys(next.players)) {
    const before = prev.players[id]
    const after = next.players[id]
    before.field.forEach((m, zone) => {
      if (!m) return
      const now = after.field.find((x) => x?.uid === m.uid)
      if (!now) destroyed.push({ player: id, uid: m.uid, cardId: m.cardId, zone })
      else if (m.faceDown && !now.faceDown) revealed.push({ player: id, uid: m.uid, cardId: m.cardId, zone })
    })
    after.field.forEach((m, zone) => {
      if (m && !before.field.some((x) => x?.uid === m.uid)) {
        placed.push({ player: id, uid: m.uid, cardId: m.cardId, zone, faceDown: m.faceDown, position: m.position })
      }
    })
    if (after.lp < before.lp) {
      damage.push({ player: id, amount: before.lp - after.lp, lpBefore: before.lp, lpAfter: after.lp })
    }
    if (after.lp > before.lp) {
      heal.push({ player: id, amount: after.lp - before.lp, lpBefore: before.lp, lpAfter: after.lp })
    }
    const beforeSpells = spellZones(before)
    const afterSpells = spellZones(after)
    for (const t of afterSpells) {
      if (!beforeSpells.some((b) => b.uid === t.uid)) {
        spellPlaced.push({ player: id, uid: t.uid, cardId: t.cardId, zoneType: t.zoneType, zone: t.zone, faceDown: Boolean(t.faceDown) })
      }
    }
    for (const t of beforeSpells) {
      if (!afterSpells.some((a) => a.uid === t.uid)) {
        spellRemoved.push({ player: id, uid: t.uid, cardId: t.cardId, zoneType: t.zoneType, zone: t.zone })
      }
    }
  }
  const pending = prev.pendingResponse
  const isRespond = action.type === 'respond'
  entry.event = {
    type: isRespond ? (action.trapUid ? 'attackNegated' : 'attack') : action.type,
    player: isRespond ? pending.attacker : action.player,
    source: isRespond ? pending.attackerUid : (action.attackerUid ?? action.uid ?? null),
    target: isRespond ? pending.targetUid : (action.targetUid ?? null),
    trap: isRespond ? (action.trapUid ?? null) : null,
    placed,
    destroyed,
    revealed,
    damage,
    heal,
    spellPlaced,
    spellRemoved,
  }
}

function summon(state, playerId, uid, zone, tributeUids = [], position = 'attack') {
  const p = state.players[playerId]
  if (state.phase !== 'main1' && state.phase !== 'main2') {
    throw new GameRuleError('อัญเชิญได้เฉพาะเฟสหลัก')
  }
  if (p.hasNormalSummoned) throw new GameRuleError('อัญเชิญปกติ/สังเวยได้เทิร์นละ 1 ครั้ง')
  const handIndex = p.hand.findIndex((c) => c.uid === uid)
  if (handIndex === -1) throw new GameRuleError('ไม่พบการ์ดนี้ในมือ')
  const card = cardOf(p.hand[handIndex])

  const baseTributes = tributesRequired(card)
  if (baseTributes === 0 && !isNormalSummonable(card)) {
    throw new GameRuleError(`${card.name} อัญเชิญปกติไม่ได้ (ต้องเป็นมอนสเตอร์ระดับ 1–4)`)
  }
  const required = getTributeCost(state, playerId, card)
  const freeReason = baseTributes > 0 && required === 0 ? getNoTributeCondition(card).reason : null
  const uniqueTributes = [...new Set(tributeUids)]
  if (uniqueTributes.length !== required) {
    throw new GameRuleError(
      required === 0
        ? `${card.name} อัญเชิญได้โดยไม่ต้องสังเวย`
        : `${card.name} ระดับ ${card.level} ต้องสังเวยมอนสเตอร์ ${required} ตัว`
    )
  }
  if (position !== 'attack' && position !== 'defense') throw new GameRuleError('ท่าไม่ถูกต้อง')
  const tributeZones = uniqueTributes.map((tUid) => p.field.findIndex((m) => m?.uid === tUid))
  if (tributeZones.includes(-1)) throw new GameRuleError('สังเวยได้เฉพาะมอนสเตอร์บนสนามของเรา')

  // ตัวที่ถูกสังเวยลงสุสาน แล้วช่องแรกที่ว่างลงจะเป็นที่วางตัวใหม่
  const tributedCards = tributeZones.map((z) => {
    const { uid: id, cardId } = p.field[z]
    p.field[z] = null
    p.graveyard.push({ uid: id, cardId })
    return getCardById(cardId)
  })

  const zoneIndex = zone ?? (required > 0 ? Math.min(...tributeZones) : p.field.indexOf(null))
  if (zoneIndex < 0 || zoneIndex >= RULES.monsterZones || p.field[zoneIndex]) {
    throw new GameRuleError('ช่องมอนสเตอร์ไม่ว่าง')
  }

  const [inst] = p.hand.splice(handIndex, 1)
  const faceDown = position === 'defense'
  p.field[zoneIndex] = {
    ...inst,
    hasAttacked: false,
    summonedTurn: state.turn,
    position,
    faceDown,
    positionChangedTurn: null,
  }
  p.hasNormalSummoned = true

  // การ์ดคว่ำของคู่ต่อสู้ไม่เปิดเผยชื่อในบันทึก
  const name = PLAYER_NAMES[playerId]
  const shown = !faceDown || playerId === PLAYER
  const what = shown
    ? `${card.name} (ระดับ ${card.level} · ATK ${formatNumber(card.atk)} / DEF ${formatNumber(card.def)})`
    : 'มอนสเตอร์ 1 ใบ'
  const placed = faceDown ? `วาง ${what} คว่ำ (ท่าตั้งรับ)` : `${required > 0 ? 'อัญเชิญสังเวย' : 'อัญเชิญ'} ${what}`
  const where = `ลงช่องที่ ${zoneIndex + 1}`
  if (required > 0) {
    const tributeNames = tributedCards.map((c) => `${c.name} (ATK ${formatNumber(c.atk)})`).join(' + ')
    addLog(state, playerId, 'summon', `${name}สังเวย ${tributeNames} → ${placed} ${where}`)
  } else {
    const free = freeReason ? ` (ไม่ต้องสังเวย: ${freeReason})` : ''
    addLog(state, playerId, 'summon', `${name}${placed} ${where}${free}`)
  }
}

function changePosition(state, playerId, uid) {
  const blocker = positionChangeBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  const card = cardOf(m)
  const name = PLAYER_NAMES[playerId]
  m.positionChangedTurn = state.turn
  if (m.position === 'defense') {
    const flip = m.faceDown
    m.position = 'attack'
    m.faceDown = false
    const verb = flip ? 'หงาย' : 'เปลี่ยน'
    addLog(state, playerId, 'position', `${name}${verb} ${card.name} เป็นท่าโจมตี (ATK ${formatNumber(card.atk)})`)
  } else {
    m.position = 'defense'
    addLog(state, playerId, 'position', `${name}เปลี่ยน ${card.name} เป็นท่าตั้งรับ (DEF ${formatNumber(card.def)})`)
  }
}

function enterBattle(state, playerId) {
  if (state.phase !== 'main1') throw new GameRuleError('เข้าเฟสต่อสู้ได้จากเฟสหลัก 1 เท่านั้น')
  if (!canAttackThisTurn(state)) throw new GameRuleError('ผู้เล่นที่เริ่มก่อนโจมตีไม่ได้ในเทิร์นแรก')
  state.phase = 'battle'
  addLog(state, playerId, 'phase', `${PLAYER_NAMES[playerId]}เข้าสู่เฟสต่อสู้`)
}

function endBattle(state, playerId) {
  if (state.phase !== 'battle') throw new GameRuleError('ไม่ได้อยู่ในเฟสต่อสู้')
  state.phase = 'main2'
  addLog(state, playerId, 'phase', `${PLAYER_NAMES[playerId]}จบเฟสต่อสู้ → เฟสหลัก 2`)
}

// battle = { ownMonster, opposingMonster } ใช้เช็กเอฟเฟกต์ลด/กันความเสียหายของผู้รับ
function damagePlayer(state, playerId, amount, details, battle = {}) {
  const p = state.players[playerId]
  const reduced = reduceBattleDamage(amount, { ...battle, ownFieldCards: getAllies(state, playerId, null) })
  details.push(...reduced.steps)
  if (reduced.amount === 0) {
    details.push(`${PLAYER_NAMES[playerId]}ไม่เสีย LP`)
    return
  }
  const dealt = reduced.amount
  const before = p.lp
  p.lp = Math.max(0, before - dealt)
  details.push(
    `${PLAYER_NAMES[playerId]}เสีย LP ${formatNumber(dealt)}: ${formatNumber(before)} − ${formatNumber(dealt)} = ${formatNumber(p.lp)}`
  )
  if (p.lp === 0) {
    state.winner = opponentOf(playerId)
    state.endReason = 'lp'
    state.phase = 'over'
  }
}

function destroyMonster(state, playerId, uid) {
  const p = state.players[playerId]
  const zone = p.field.findIndex((m) => m?.uid === uid)
  const { uid: id, cardId } = p.field[zone]
  p.field[zone] = null
  p.graveyard.push({ uid: id, cardId })
}

function attack(state, playerId, attackerUid, targetUid) {
  if (state.phase !== 'battle') throw new GameRuleError('โจมตีได้เฉพาะเฟสต่อสู้')
  const me = state.players[playerId]
  const oppId = opponentOf(playerId)
  const opp = state.players[oppId]

  const attacker = me.field.find((m) => m?.uid === attackerUid)
  if (!attacker) throw new GameRuleError('ไม่พบมอนสเตอร์ที่จะโจมตี')
  if (attacker.position === 'defense') throw new GameRuleError('มอนสเตอร์ท่าตั้งรับโจมตีไม่ได้')
  if (!canDeclareAttack(state, playerId, attacker)) {
    throw new GameRuleError('มอนสเตอร์ตัวนี้โจมตีไปแล้วในเทิร์นนี้')
  }

  const attackerCard = cardOf(attacker)
  const details = []
  const attackNo = attacksMade(attacker) + 1
  const markAttacked = () => {
    attacker.attackCount = attackNo
    attacker.hasAttacked = true
    if (attackNo > 1) details.push(`⚔️ โจมตีครั้งที่ ${attackNo}: ${getExtraAttack(attackerCard).reason}`)
  }

  if (targetUid === null) {
    if (opp.field.some(Boolean)) {
      throw new GameRuleError('โจมตีตรงได้เมื่อฝ่ายตรงข้ามไม่มีมอนสเตอร์บนสนามเท่านั้น')
    }
    markAttacked()
    const boosts = getAtkBoosts(
      attackerCard,
      getAllies(state, playerId, attacker.uid),
      getAllies(state, oppId, null),
      atkExtras(state, playerId, attacker)
    )
    const power = getFieldAtk(state, playerId, attacker.uid)
    const boostText = boosts
      .map((b) => `${b.amount < 0 ? ' − ' : ' + '}${formatNumber(Math.abs(b.amount))} (${b.label}: ${b.reason})`)
      .join('')
    details.push(
      `ฝ่ายตรงข้ามไม่มีมอนสเตอร์ → โจมตีตรงด้วย ATK ${formatNumber(attackerCard.atk)}${boostText ? `${boostText} = ${formatNumber(power)}` : ''}`
    )
    damagePlayer(state, oppId, power, details, { opposingMonster: attackerCard })
    addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตีตรง${PLAYER_NAMES[oppId]}!`, details)
    logLpKnockout(state)
    return
  }

  const defender = opp.field.find((m) => m?.uid === targetUid)
  if (!defender) throw new GameRuleError('ไม่พบมอนสเตอร์เป้าหมาย')
  markAttacked()

  // จังหวะเปิดกับดักของฝ่ายรับ: หยุดรอให้ฝ่ายรับตัดสินใจก่อนคำนวณ (การโจมตีนับว่าใช้สิทธิ์แล้ว)
  const responses = getTrapResponses(state, oppId, attackerCard, defender)
  if (responses.length > 0) {
    state.pendingResponse = { responder: oppId, attacker: playerId, attackerUid, targetUid, trapUids: responses, details }
    addLog(
      state,
      playerId,
      'pending',
      `⚔️ ${attackerCard.name} ประกาศโจมตี ${cardOf(defender).name} — รอ${PLAYER_NAMES[oppId]}ตัดสินใจเปิดกับดัก`
    )
    return
  }
  resolveMonsterAttack(state, playerId, attacker, defender, details)
}

// กับดักของ defenderId ที่เปิดตอบโต้การโจมตีนี้ได้ (กับดักต้องวางไว้ก่อนเทิร์นนี้)
function getTrapResponses(state, defenderId, attackerCard, target) {
  if (hasTrapLock(attackerCard) || target.faceDown) return []
  const targetCard = cardOf(target)
  return state.players[defenderId].spellTrap
    .filter((t) => {
      if (!t?.faceDown || t.setTurn >= state.turn) return false
      const trap = getTrapEffect(cardOf(t))
      return trap?.trigger === 'enemyAttacksFaceUp' && trap.appliesTo(targetCard)
    })
    .map((t) => t.uid)
}

function resolveMonsterAttack(state, playerId, attacker, defender, details) {
  const oppId = opponentOf(playerId)
  const attackerCard = cardOf(attacker)
  const defenderCard = cardOf(defender)

  // เปิดการ์ดคว่ำก่อนคำนวณ เอฟเฟกต์ของการ์ดที่เพิ่งเปิดจึงมีผลในการต่อสู้นี้
  const inDefense = defender.position === 'defense'
  if (defender.faceDown) {
    defender.faceDown = false
    details.push(`เปิดการ์ดคว่ำ: ${defenderCard.name} (DEF ${formatNumber(defenderCard.def)})`)
  }
  const result = previewBattle(state, playerId, attacker.uid, defender.uid)

  if (result.defender.cancelled.length > 0) {
    details.push(`🏹 ${attackerCard.name} ซุ่มโจมตี! ${defenderCard.name} ไม่ได้รับโบนัสธาตุ/เผ่า`)
  }
  details.push(`ฝ่ายโจมตี — ${describeSide(result.attacker)}`)
  details.push(`ฝ่ายรับ — ${describeSide(result.defender)}`)

  // คิดความเสียหายก่อนทำลายการ์ด (เอฟเฟกต์ลดความเสียหายของตัวที่แพ้ยังมีผล)
  const hitDefenderOwner = (amount) =>
    damagePlayer(state, oppId, amount, details, { ownMonster: defenderCard, opposingMonster: attackerCard })
  const hitAttackerOwner = (amount) =>
    damagePlayer(state, playerId, amount, details, { ownMonster: attackerCard, opposingMonster: defenderCard })

  const a = formatNumber(result.attacker.final)
  const d = formatNumber(result.defender.final)
  const diff = formatNumber(result.damage)
  if (inDefense) {
    // ATK ปะทะ DEF: ตัวตั้งรับถูกทำลายได้แต่เจ้าของไม่เสีย LP (ยกเว้นตีทะลุ) · ตีไม่ผ่าน ฝ่ายโจมตีเสีย LP
    if (result.outcome === 'attacker') {
      const pierce = getPiercing(attackerCard)
      if (pierce) {
        const amount = Math.floor(result.damage * pierce.ratio)
        details.push(`ATK ${a} > DEF ${d} → ${defenderCard.name} ถูกทำลาย`)
        details.push(
          pierce.ratio === 1
            ? `${attackerCard.name} ${pierce.reason}: ${a} − ${d} = ${formatNumber(amount)}`
            : `${attackerCard.name} ${pierce.reason}: (${a} − ${d}) ÷ ${1 / pierce.ratio} = ${formatNumber(amount)}`
        )
        hitDefenderOwner(amount)
      } else {
        details.push(`ATK ${a} > DEF ${d} → ${defenderCard.name} ถูกทำลาย (ท่าตั้งรับ ไม่เสีย LP)`)
      }
      destroyMonster(state, oppId, defender.uid)
      awardXp(state, attacker, details)
    } else if (result.outcome === 'defender') {
      details.push(`ATK ${a} < DEF ${d} → ตีไม่ผ่าน ไม่มีใครถูกทำลาย (ส่วนต่าง ${d} − ${a} = ${diff})`)
      hitAttackerOwner(result.damage)
    } else {
      details.push(`ATK ${a} = DEF ${d} → ไม่มีอะไรเกิดขึ้น`)
    }
  } else if (result.outcome === 'attacker') {
    details.push(`${a} > ${d} → ${defenderCard.name} ถูกทำลาย (ส่วนต่าง ${a} − ${d} = ${diff})`)
    hitDefenderOwner(result.damage)
    destroyMonster(state, oppId, defender.uid)
    awardXp(state, attacker, details)
  } else if (result.outcome === 'defender') {
    details.push(`${a} < ${d} → ${attackerCard.name} ถูกทำลาย (ส่วนต่าง ${d} − ${a} = ${diff})`)
    hitAttackerOwner(result.damage)
    destroyMonster(state, playerId, attacker.uid)
    awardXp(state, defender, details)
  } else {
    details.push(`${a} = ${d} → เสมอ ทำลายทั้งคู่ ไม่มีใครเสีย LP`)
    destroyMonster(state, playerId, attacker.uid)
    destroyMonster(state, oppId, defender.uid)
  }

  // เอฟเฟกต์หลังคำนวณความเสียหาย: ทำลายคู่ต่อสู้ตามเผ่า (ถ้ายังอยู่บนสนาม)
  for (const [card, foe, foeOwner, foeUid] of [
    [attackerCard, defenderCard, oppId, defender.uid],
    [defenderCard, attackerCard, playerId, attacker.uid],
  ]) {
    const effect = getAfterBattleDestroy(card, foe)
    if (effect && state.players[foeOwner].field.some((m) => m?.uid === foeUid)) {
      details.push(`${effect.reason}: ${foe.name} ถูกทำลาย`)
      destroyMonster(state, foeOwner, foeUid)
    }
  }

  const target = `${defenderCard.name}${inDefense ? ' (ท่าตั้งรับ)' : ''}`
  addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตี ${target}`, details)
  logLpKnockout(state)
}

function respond(state, playerId, trapUid) {
  const pending = state.pendingResponse
  if (!pending) throw new GameRuleError('ไม่มีการโจมตีที่รอการตอบโต้')
  state.pendingResponse = null
  const attacker = state.players[pending.attacker].field.find((m) => m?.uid === pending.attackerUid)
  const defender = state.players[playerId].field.find((m) => m?.uid === pending.targetUid)
  const details = pending.details

  if (trapUid === null) {
    details.push(`${PLAYER_NAMES[playerId]}ไม่เปิดกับดัก`)
    resolveMonsterAttack(state, pending.attacker, attacker, defender, details)
    return
  }
  if (!pending.trapUids.includes(trapUid)) throw new GameRuleError('กับดักใบนี้เปิดตอบโต้การโจมตีนี้ไม่ได้')
  const p = state.players[playerId]
  const zone = p.spellTrap.findIndex((t) => t?.uid === trapUid)
  const trapInst = p.spellTrap[zone]
  p.spellTrap[zone] = null
  p.graveyard.push({ uid: trapInst.uid, cardId: trapInst.cardId })
  const trapCard = cardOf(trapInst)
  details.push(
    `🪤 ${PLAYER_NAMES[playerId]}เปิดกับดัก ${trapCard.name}!`,
    `${getTrapEffect(trapCard).reason} → ไม่มีความเสียหาย ไม่มีใครถูกทำลาย`,
    `${cardOf(attacker).name} ใช้สิทธิ์โจมตีครั้งนี้ไปแล้ว · ${trapCard.name} ลงสุสาน`
  )
  addLog(
    state,
    pending.attacker,
    'battle',
    `⚔️ ${cardOf(attacker).name} โจมตี ${cardOf(defender).name} — ถูกยกเลิกด้วยกับดัก`,
    details
  )
}

// มอนสเตอร์ที่ชนะการต่อสู้ (ทำลายศัตรูได้และยังอยู่บนสนาม) ได้แต้มประสบการณ์ 1 แต้ม
function awardXp(state, monster, details) {
  const card = cardOf(monster)
  const evolve = getEvolve(card)
  if (!evolve) return
  monster.xp = (monster.xp ?? 0) + 1
  const ready = monster.xp >= evolve.xpNeeded
  if (ready && monster.xpReadyTurn == null) monster.xpReadyTurn = state.turn
  const shown = Math.min(monster.xp, evolve.xpNeeded)
  const next = ready ? ` — เลื่อนยศเป็น ${getCardById(evolve.into).name} ได้ตั้งแต่เทิร์นถัดไปของเรา` : ''
  details.push(`⭐ ${card.name} ได้ประสบการณ์ 1 แต้ม (${shown}/${evolve.xpNeeded})${next}`)
}

// ที่มาของร่างใหม่: ใบแรกในมือ และใบแรกในกองการ์ด (null ถ้าไม่มี)
export function getEvolveSources(state, playerId, uid) {
  const p = state.players[playerId]
  const m = p.field.find((x) => x?.uid === uid)
  const evolve = m && getEvolve(cardOf(m))
  if (!evolve) return { hand: null, deck: null }
  return {
    hand: p.hand.find((c) => c.cardId === evolve.into) ?? null,
    deck: p.deck.find((c) => c.cardId === evolve.into) ?? null,
  }
}

// เหตุผลที่ยังเลื่อนยศไม่ได้ (null = เลื่อนได้)
export function evolveBlocker(state, playerId, uid) {
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  if (!m) return 'ไม่พบมอนสเตอร์ตัวนี้บนสนาม'
  const card = cardOf(m)
  const evolve = getEvolve(card)
  if (!evolve) return `${card.name} ไม่มีสายประสบการณ์`
  if (!isPlayersOpenMain(state, playerId)) return 'เลื่อนยศได้เฉพาะเฟสหลักในตาของเรา'
  if (m.faceDown) return 'การ์ดคว่ำอยู่ เลื่อนยศไม่ได้'
  const xp = m.xp ?? 0
  if (xp < evolve.xpNeeded) return `ประสบการณ์ ${xp}/${evolve.xpNeeded} — ทำลายมอนสเตอร์ศัตรูอีก ${evolve.xpNeeded - xp} ตัว`
  if (state.turn <= m.xpReadyTurn) return 'แต้มเพิ่งครบเทิร์นนี้ — เลื่อนยศได้ในเทิร์นถัดไปของเรา'
  const sources = getEvolveSources(state, playerId, uid)
  if (!sources.hand && !sources.deck) return `ไม่มี "${getCardById(evolve.into).name}" ในมือหรือกองการ์ด`
  return null
}

// เลื่อนยศ: ร่างเก่าลงสุสาน ร่างใหม่จากมือ/กองลงช่องเดิมท่าโจมตี (ไม่ใช้สิทธิ์อัญเชิญปกติ)
// ร่างใหม่โจมตีได้ถ้าร่างเก่ายังไม่ได้โจมตีเทิร์นนี้
function evolve(state, playerId, uid, from) {
  const blocker = evolveBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const p = state.players[playerId]
  const sources = getEvolveSources(state, playerId, uid)
  const source = from === 'hand' ? 'hand' : from === 'deck' ? 'deck' : sources.deck ? 'deck' : 'hand'
  const pile = source === 'hand' ? p.hand : p.deck
  const newInst = sources[source]
  if (!newInst) throw new GameRuleError(source === 'hand' ? 'ไม่มีร่างใหม่ในมือ' : 'ไม่มีร่างใหม่ในกองการ์ด')

  const zone = p.field.findIndex((x) => x?.uid === uid)
  const old = p.field[zone]
  const oldCard = cardOf(old)
  p.graveyard.push({ uid: old.uid, cardId: old.cardId })
  pile.splice(pile.findIndex((c) => c.uid === newInst.uid), 1)
  p.field[zone] = {
    uid: newInst.uid,
    cardId: newInst.cardId,
    hasAttacked: old.hasAttacked,
    attackCount: old.attackCount ?? 0,
    summonedTurn: state.turn,
    position: 'attack',
    faceDown: false,
    positionChangedTurn: null,
  }
  const newCard = cardOf(newInst)
  const where = source === 'hand' ? 'จากมือ' : 'จากกองการ์ด'
  addLog(
    state,
    playerId,
    'evolve',
    `🎖️ ${PLAYER_NAMES[playerId]}เลื่อนยศ ${oldCard.name} → ${newCard.name} (ATK ${formatNumber(newCard.atk)}) ${where} ลงช่องที่ ${zone + 1}`,
    [`${oldCard.name} ลงสุสาน`, ...(old.hasAttacked ? [`${oldCard.name} โจมตีไปแล้วเทิร์นนี้ ${newCard.name} จึงโจมตีไม่ได้อีก`] : [])]
  )
}

function activate(state, playerId, uid, discardUid, targetUid) {
  const blocker = activationBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const p = state.players[playerId]
  const m = p.field.find((x) => x?.uid === uid)
  const card = cardOf(m)
  const activated = getActivated(card)
  const name = PLAYER_NAMES[playerId]

  if (activated.kind === 'heal') {
    const before = p.lp
    p.lp += activated.amount
    addLog(state, playerId, 'effect', `✨ ${card.name}: ${name}ฟื้น LP ${formatNumber(activated.amount)}`, [
      `LP ${formatNumber(before)} + ${formatNumber(activated.amount)} = ${formatNumber(p.lp)}`,
    ])
  } else if (activated.kind === 'debuff') {
    const handIndex = p.hand.findIndex((c) => c.uid === discardUid)
    if (handIndex === -1) throw new GameRuleError('เลือกการ์ดในมือที่จะทิ้ง 1 ใบ')
    const oppId = opponentOf(playerId)
    const target = state.players[oppId].field.find((x) => x?.uid === targetUid)
    if (!target || target.faceDown) throw new GameRuleError('เลือกมอนสเตอร์ที่หงายหน้าของฝ่ายตรงข้าม 1 ตัว')
    const before = getFieldAtk(state, oppId, target.uid)
    const [discarded] = p.hand.splice(handIndex, 1)
    p.graveyard.push(discarded)
    target.tempAtk = [...(target.tempAtk ?? []), { amount: activated.amount, reason: activated.reason }]
    const after = getFieldAtk(state, oppId, target.uid)
    const targetCard = cardOf(target)
    const size = formatNumber(Math.abs(activated.amount))
    addLog(state, playerId, 'effect', `✨ ${card.name}: ${targetCard.name} ATK −${size} จนจบเทิร์น`, [
      `${name}ทิ้ง ${cardOf(discarded).name} ลงสุสาน`,
      `${targetCard.name}: ATK ${formatNumber(before)} − ${size} = ${formatNumber(after)}${after === 0 ? ' (ต่ำสุด 0)' : ''}`,
    ])
  }
  p.usedEffects = { ...(p.usedEffects ?? {}), [usedKey(activated, m)]: state.turn }
}

function playSpell(state, playerId, uid, tributeUids = []) {
  const blocker = handCardBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const p = state.players[playerId]
  const handIndex = p.hand.findIndex((c) => c.uid === uid)
  const card = cardOf(p.hand[handIndex])
  const name = PLAYER_NAMES[playerId]

  if (isFieldSpell(card)) {
    const details = []
    if (p.fieldSpell) {
      details.push(`ส่งเวทสนามเดิม ${cardOf(p.fieldSpell).name} ลงสุสาน`)
      p.graveyard.push(p.fieldSpell)
    }
    const [inst] = p.hand.splice(handIndex, 1)
    p.fieldSpell = { uid: inst.uid, cardId: inst.cardId }
    addLog(state, playerId, 'spell', `🏞️ ${name}ใช้เวทสนาม ${card.name}`, details.length ? details : undefined)
    return
  }

  const ritual = getRitualInfo(card)
  if (!ritual) throw new GameRuleError(`${card.name} ใช้แบบนี้ไม่ได้ (กับดักต้องวางคว่ำ)`)
  const problem = ritualTributeProblem(state, playerId, uid, tributeUids)
  if (problem) throw new GameRuleError(problem)

  const chosen = [...new Set(tributeUids)]
  const target = getCardById(ritual.target)
  const tributeText = chosen.map((tUid) => {
    const fieldZone = p.field.findIndex((m) => m?.uid === tUid)
    let inst
    if (fieldZone >= 0) {
      inst = p.field[fieldZone]
      p.field[fieldZone] = null
    } else {
      inst = p.hand.splice(p.hand.findIndex((c) => c.uid === tUid), 1)[0]
    }
    p.graveyard.push({ uid: inst.uid, cardId: inst.cardId })
    const tc = cardOf(inst)
    return `${tc.name} (ระดับ ${tc.level}${fieldZone >= 0 ? ' · สนาม' : ' · มือ'})`
  })
  const ritualInst = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1)[0]
  const targetInst = p.hand.splice(p.hand.findIndex((c) => c.cardId === ritual.target), 1)[0]
  p.graveyard.push(ritualInst)
  const zone = p.field.indexOf(null)
  p.field[zone] = {
    ...targetInst,
    hasAttacked: false,
    summonedTurn: state.turn,
    position: 'attack',
    faceDown: false,
    positionChangedTurn: null,
  }

  addLog(
    state,
    playerId,
    'summon',
    `🙏 ${name}ใช้ ${card.name} → อัญเชิญพิธีกรรม ${target.name} (ระดับ ${target.level} · ATK ${formatNumber(target.atk)} / DEF ${formatNumber(target.def)}) ลงช่องที่ ${zone + 1}`,
    [`สังเวย: ${tributeText.join(' + ')}`, `${card.name} ลงสุสาน`]
  )
}

function setTrap(state, playerId, uid) {
  const blocker = handCardBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const p = state.players[playerId]
  const handIndex = p.hand.findIndex((c) => c.uid === uid)
  const card = cardOf(p.hand[handIndex])
  if (card.type !== 'trap') throw new GameRuleError(`${card.name} ไม่ใช่การ์ดกับดัก`)
  const [inst] = p.hand.splice(handIndex, 1)
  const zone = p.spellTrap.indexOf(null)
  p.spellTrap[zone] = { uid: inst.uid, cardId: inst.cardId, faceDown: true, setTurn: state.turn }
  const what = playerId === PLAYER ? `กับดัก ${card.name}` : 'การ์ด 1 ใบ'
  addLog(state, playerId, 'trap', `🪤 ${PLAYER_NAMES[playerId]}วาง${what}คว่ำในช่องเวท/กับดักที่ ${zone + 1}`)
}

function logLpKnockout(state) {
  if (state.endReason !== 'lp') return
  const loser = opponentOf(state.winner)
  addLog(state, loser, 'gameover', `LP ของ${PLAYER_NAMES[loser]}เหลือ 0 → ${PLAYER_NAMES[state.winner]}ชนะ!`)
}

function endTurn(state, playerId) {
  if (state.phase === 'discard') throw new GameRuleError('ต้องทิ้งการ์ดให้เหลือไม่เกิน 6 ใบก่อน')
  const overflow = getHandOverflow(state, playerId)
  if (overflow > 0) {
    state.phase = 'discard'
    addLog(
      state,
      playerId,
      'phase',
      `เฟสจบ: ${PLAYER_NAMES[playerId]}มีการ์ดในมือ ${state.players[playerId].hand.length} ใบ ต้องทิ้ง ${overflow} ใบ (เก็บได้สูงสุด ${RULES.handLimit})`
    )
    return
  }
  startNextTurn(state, playerId)
}

function discard(state, playerId, uid) {
  if (state.phase !== 'discard') throw new GameRuleError('ทิ้งการ์ดได้เฉพาะตอนการ์ดเกินมือ')
  const p = state.players[playerId]
  const index = p.hand.findIndex((c) => c.uid === uid)
  if (index === -1) throw new GameRuleError('ไม่พบการ์ดนี้ในมือ')
  const [inst] = p.hand.splice(index, 1)
  p.graveyard.push(inst)
  addLog(state, playerId, 'discard', `${PLAYER_NAMES[playerId]}ทิ้ง ${cardOf(inst).name} ลงสุสาน`)
  if (getHandOverflow(state, playerId) === 0) startNextTurn(state, playerId)
}

function startNextTurn(state, endingPlayerId) {
  const nextId = opponentOf(endingPlayerId)
  const next = state.players[nextId]

  // ตัวปรับ "จนจบเทิร์นนี้" หมดอายุ
  for (const pl of Object.values(state.players)) {
    for (const m of pl.field) if (m?.tempAtk) delete m.tempAtk
  }

  state.turn += 1
  state.activePlayer = nextId
  state.phase = 'main1'
  next.hasNormalSummoned = false
  for (const m of next.field) {
    if (m) {
      m.hasAttacked = false
      m.attackCount = 0
    }
  }

  addLog(state, nextId, 'turn', `เทิร์น ${state.turn} — ตาของ${PLAYER_NAMES[nextId]}`)

  if (next.deck.length < RULES.drawPerTurn) {
    state.winner = endingPlayerId
    state.endReason = 'deckOut'
    state.phase = 'over'
    addLog(state, nextId, 'gameover', `${PLAYER_NAMES[nextId]}ต้องจั่วแต่การ์ดหมดกอง → แพ้!`)
    return
  }

  const drawn = next.deck.shift()
  next.hand.push(drawn)
  const what = nextId === PLAYER ? ` (${cardOf(drawn).name})` : ''
  addLog(
    state,
    nextId,
    'draw',
    `${PLAYER_NAMES[nextId]}จั่วการ์ด 1 ใบ${what} · เหลือในกอง ${next.deck.length} ใบ`
  )
}
