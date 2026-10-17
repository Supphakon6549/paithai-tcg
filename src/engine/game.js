import { getCardById } from '../data/cards'
import { describeSide, resolveBattle } from './battle'
import { getAtkBoosts, getEffectiveAtk } from './effects'
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
 *                      extraDeck, hasNormalSummoned } },
 *   log: [{ id, turn, actor, kind, text, details? }], logSeq
 * }
 * การ์ดในกอง/มือ/สุสาน = { uid, cardId }
 * บนสนามเพิ่ม { hasAttacked, summonedTurn, position: 'attack'|'defense', faceDown, positionChangedTurn }
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

export function createGame({
  seed = Date.now(),
  firstPlayer = PLAYER,
  deckList = STARTER_DECK_LIST,
  extraDeckList = EXTRA_DECK_LIST,
} = {}) {
  const rng = createRng(seed)

  const makePlayer = (id) => {
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
    }
  }

  const state = {
    turn: 1,
    activePlayer: firstPlayer,
    phase: 'main1',
    winner: null,
    endReason: null,
    players: { [PLAYER]: makePlayer(PLAYER), [opponentOf(PLAYER)]: makePlayer(opponentOf(PLAYER)) },
    log: [],
    logSeq: 0,
  }

  const deckSize = state.players[PLAYER].deck.length + RULES.startingHand
  addLog(
    state,
    null,
    'system',
    `เริ่มเกม! LP ฝ่ายละ ${formatNumber(RULES.startingLP)} · สำรับฝ่ายละ ${deckSize} ใบ · จั่วมือแรกฝ่ายละ ${RULES.startingHand} ใบ`
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

export function getSummonableHand(state, playerId) {
  const p = state.players[playerId]
  if (state.winner || state.activePlayer !== playerId) return []
  if (state.phase !== 'main1' && state.phase !== 'main2') return []
  if (p.hasNormalSummoned) return []
  const hasEmptyZone = p.field.includes(null)
  const monsterCount = p.field.filter(Boolean).length
  return p.hand.filter((inst) => {
    const card = cardOf(inst)
    if (isNormalSummonable(card)) return hasEmptyZone
    const required = tributesRequired(card)
    return required > 0 && monsterCount >= required
  })
}

export function canAttackThisTurn(state) {
  return state.turn > 1
}

export function getReadyAttackers(state, playerId) {
  if (state.winner || state.activePlayer !== playerId || state.phase !== 'battle') return []
  if (!canAttackThisTurn(state)) return []
  return state.players[playerId].field.filter((m) => m && !m.hasAttacked && m.position !== 'defense')
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

// ATK จริงบนสนามรวมบัฟจากเอฟเฟกต์ (ยังไม่รวมโบนัสธาตุ/เผ่าซึ่งขึ้นกับคู่ต่อสู้)
export function getFieldAtk(state, playerId, uid) {
  const monster = state.players[playerId].field.find((m) => m?.uid === uid)
  return getEffectiveAtk(cardOf(monster), getAllies(state, playerId, uid))
}

// คำนวณผลต่อสู้ล่วงหน้าโดยไม่เปลี่ยนสถานะ — ใช้ทั้งตอนโจมตีจริง, AI และ UI
export function previewBattle(state, playerId, attackerUid, defenderUid) {
  const oppId = opponentOf(playerId)
  const attacker = state.players[playerId].field.find((m) => m?.uid === attackerUid)
  const defender = state.players[oppId].field.find((m) => m?.uid === defenderUid)
  return resolveBattle(cardOf(attacker), cardOf(defender), {
    attackerAllies: getAllies(state, playerId, attackerUid),
    defenderAllies: getAllies(state, oppId, defenderUid),
    defenderStat: defender.position === 'defense' ? 'def' : 'atk',
  })
}

export function getHandOverflow(state, playerId) {
  return Math.max(0, state.players[playerId].hand.length - RULES.handLimit)
}

// ---------- แอ็กชัน ----------

export function applyAction(state, action) {
  if (state.winner) throw new GameRuleError('เกมจบแล้ว')
  if (action.player !== state.activePlayer) {
    throw new GameRuleError('ยังไม่ถึงเทิร์นของผู้เล่นนี้')
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
    default:
      throw new GameRuleError(`ไม่รู้จักแอ็กชัน ${action.type}`)
  }
  return next
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

  const required = tributesRequired(card)
  if (required === 0 && !isNormalSummonable(card)) {
    throw new GameRuleError(`${card.name} อัญเชิญปกติไม่ได้ (ต้องเป็นมอนสเตอร์ระดับ 1–4)`)
  }
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
    addLog(state, playerId, 'summon', `${name}${placed} ${where}`)
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

function damagePlayer(state, playerId, amount, details) {
  const p = state.players[playerId]
  const before = p.lp
  p.lp = Math.max(0, before - amount)
  details.push(
    `${PLAYER_NAMES[playerId]}เสีย LP ${formatNumber(amount)}: ${formatNumber(before)} − ${formatNumber(amount)} = ${formatNumber(p.lp)}`
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
  if (attacker.hasAttacked) throw new GameRuleError('มอนสเตอร์ตัวนี้โจมตีไปแล้วในเทิร์นนี้')
  if (attacker.position === 'defense') throw new GameRuleError('มอนสเตอร์ท่าตั้งรับโจมตีไม่ได้')

  const attackerCard = cardOf(attacker)
  const details = []

  if (targetUid === null) {
    if (opp.field.some(Boolean)) {
      throw new GameRuleError('โจมตีตรงได้เมื่อฝ่ายตรงข้ามไม่มีมอนสเตอร์บนสนามเท่านั้น')
    }
    attacker.hasAttacked = true
    const boosts = getAtkBoosts(attackerCard, getAllies(state, playerId, attacker.uid))
    const power = attackerCard.atk + boosts.reduce((sum, b) => sum + b.amount, 0)
    const boostText = boosts.map((b) => ` + ${formatNumber(b.amount)} (${b.label}: ${b.reason})`).join('')
    details.push(
      `ฝ่ายตรงข้ามไม่มีมอนสเตอร์ → โจมตีตรงด้วย ATK ${formatNumber(attackerCard.atk)}${boostText ? `${boostText} = ${formatNumber(power)}` : ''}`
    )
    damagePlayer(state, oppId, power, details)
    addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตีตรง${PLAYER_NAMES[oppId]}!`, details)
    logLpKnockout(state)
    return
  }

  const defender = opp.field.find((m) => m?.uid === targetUid)
  if (!defender) throw new GameRuleError('ไม่พบมอนสเตอร์เป้าหมาย')
  const defenderCard = cardOf(defender)
  const result = previewBattle(state, playerId, attacker.uid, defender.uid)
  attacker.hasAttacked = true

  const inDefense = defender.position === 'defense'
  if (defender.faceDown) {
    defender.faceDown = false
    details.push(`เปิดการ์ดคว่ำ: ${defenderCard.name} (DEF ${formatNumber(defenderCard.def)})`)
  }

  if (result.defender.cancelled.length > 0) {
    details.push(`🏹 ${attackerCard.name} ซุ่มโจมตี! ${defenderCard.name} ไม่ได้รับโบนัสธาตุ/เผ่า`)
  }
  details.push(`ฝ่ายโจมตี — ${describeSide(result.attacker)}`)
  details.push(`ฝ่ายรับ — ${describeSide(result.defender)}`)

  const a = formatNumber(result.attacker.final)
  const d = formatNumber(result.defender.final)
  if (inDefense) {
    // ATK ปะทะ DEF: ตัวตั้งรับถูกทำลายได้แต่เจ้าของไม่เสีย LP · ตีไม่ผ่าน ฝ่ายโจมตีเสีย LP
    if (result.outcome === 'attacker') {
      details.push(`ATK ${a} > DEF ${d} → ${defenderCard.name} ถูกทำลาย (ท่าตั้งรับ ไม่เสีย LP)`)
      destroyMonster(state, oppId, defender.uid)
    } else if (result.outcome === 'defender') {
      details.push(
        `ATK ${a} < DEF ${d} → ตีไม่ผ่าน ไม่มีใครถูกทำลาย (ส่วนต่าง ${d} − ${a} = ${formatNumber(result.damage)})`
      )
      damagePlayer(state, playerId, result.damage, details)
    } else {
      details.push(`ATK ${a} = DEF ${d} → ไม่มีอะไรเกิดขึ้น`)
    }
  } else if (result.outcome === 'attacker') {
    details.push(`${a} > ${d} → ${defenderCard.name} ถูกทำลาย (ส่วนต่าง ${a} − ${d} = ${formatNumber(result.damage)})`)
    destroyMonster(state, oppId, defender.uid)
    damagePlayer(state, oppId, result.damage, details)
  } else if (result.outcome === 'defender') {
    details.push(`${a} < ${d} → ${attackerCard.name} ถูกทำลาย (ส่วนต่าง ${d} − ${a} = ${formatNumber(result.damage)})`)
    destroyMonster(state, playerId, attacker.uid)
    damagePlayer(state, playerId, result.damage, details)
  } else {
    details.push(`${a} = ${d} → เสมอ ทำลายทั้งคู่ ไม่มีใครเสีย LP`)
    destroyMonster(state, playerId, attacker.uid)
    destroyMonster(state, oppId, defender.uid)
  }

  const target = `${defenderCard.name}${inDefense ? ' (ท่าตั้งรับ)' : ''}`
  addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตี ${target}`, details)
  logLpKnockout(state)
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

  state.turn += 1
  state.activePlayer = nextId
  state.phase = 'main1'
  next.hasNormalSummoned = false
  for (const m of next.field) if (m) m.hasAttacked = false

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
