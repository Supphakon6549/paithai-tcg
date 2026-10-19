import { getCardById } from '../data/cards'
import { describeSide, resolveBattle } from './battle'
import {
  getActivated,
  getAfterBattleDestroy,
  getAtkBoosts,
  getAttackDecay,
  animalSetOf,
  canDismount,
  canMount,
  cardHasTribe,
  getAmbushFlip,
  getAttackGuard,
  getEndTurnGrow,
  getGrowth,
  getGrowthSpell,
  getHuntBonus,
  getMercy,
  getOnSummonCall,
  getOnSummonLook,
  getSting,
  getDeathCurse,
  getTaunt,
  hasRootShield,
  isPlantCard,
  getAttackingBoost,
  getBranchSpell,
  getBuffSpell,
  getBurnOnKill,
  getFlyOver,
  getMillOnKill,
  getReturnOnDestroy,
  getShroud,
  getSummonOnlyBy,
  getContinuousTrap,
  getEffectProtection,
  getEndTurnHeal,
  getEquip,
  getEffectiveAtk,
  getEvolve,
  getExtraAttack,
  getFusionMaterials,
  getFusionSpell,
  getOnSummonSearch,
  getReviveOnGrave,
  getReviveSpell,
  getRitualLevel,
  getSpecialSummon,
  getNoTributeCondition,
  getPiercing,
  getRitualInfo,
  getTrapEffect,
  hasNoDirectAttack,
  hasTrapLock,
  isBattleIndestructible,
  isFieldSpell,
  matchesFusion,
  isPlayableNonMonster,
  reduceBattleDamage,
} from './effects'
import { createRng, shuffle } from './random'
import {
  PLAYER,
  PLAYER_NAMES,
  RULES,
  DECK_RULES,
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
 *   pendingResponse: null | { responder, attacker, attackerUid, targetUid (null = โจมตีตรง),
 *                             trapUids, options: [{ id, kind, label, ... }], details }
 *                    (การโจมตีที่รอฝ่ายรับตัดสินใจเปิดกับดัก — ตอนนี้ responder เป็นคนเล่น)
 *   pendingChoice: null | { player, kind: 'search' | 'revive', prompt, options: [{ id, label }], ... }
 *                    (เอฟเฟกต์ที่รอเจ้าของเลือก เช่น การ์ดที่จะค้นจากกอง / จ่าย LP คืนชีพ)
 *   log: [{ id, turn, actor, kind, text, details?, event? }], logSeq
 * }
 * การ์ดในกอง/มือ/สุสาน = { uid, cardId }
 * บนสนามเพิ่ม { hasAttacked, summonedTurn, position: 'attack'|'defense', faceDown, positionChangedTurn,
 *               tempAtk?: [{ amount, reason }] (ตัวปรับ ATK จนจบเทิร์น),
 *               xp?: แต้มประสบการณ์, xpReadyTurn?: เทิร์นที่แต้มครบ (เลื่อนยศได้เทิร์นหลังจากนั้น),
 *               decayStep?: จำนวนครั้งที่อ่อนแรงจาก attackDecay (ค้างจนออกจากสนาม) }
 * ช่องเวท/กับดัก = { uid, cardId, faceDown, setTurn, equippedTo? } · ช่องเวทสนาม = { uid, cardId }
 * มอนสเตอร์บนสนามเพิ่ม cannotAttackTurn?, darkImmuneTurn? · ผู้เล่นเพิ่ม revivedUids (คืนชีพไปแล้ว)
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

// ตรวจสำรับตามกติกาการจัดสำรับ (40 ใบพอดี · ชื่อเดียวกันไม่เกิน 3 · กองพิเศษ ≤ 5)
// คืนรายการปัญหาภาษาไทย (ว่าง = พร้อมเล่น)
export function deckProblems(deckList, extraDeckList = []) {
  // ข้อขั้นต่ำ "มากกว่า 5 ใบ" ของ validateDeck ถูกแทนด้วยกติกา 40 ใบด้านล่าง
  const problems = validateDeck(deckList, extraDeckList).filter((p) => !p.startsWith('กองหลักต้องมีมากกว่า'))
  const broken = problems.some((p) => /ไม่พบการ์ด|ไม่ถูกต้อง|ต้องเป็นรายการ/.test(p))
  if (broken) return problems
  const main = expandDeckList(deckList).length
  const extra = expandDeckList(extraDeckList).length
  if (main !== DECK_RULES.mainSize) {
    problems.push(`กองหลักต้องมี ${DECK_RULES.mainSize} ใบพอดี (ตอนนี้ ${main} ใบ)`)
  }
  if (extra > DECK_RULES.extraMax) problems.push(`กองพิเศษใส่ได้ไม่เกิน ${DECK_RULES.extraMax} ใบ (ตอนนี้ ${extra} ใบ)`)
  const copies = {}
  for (const [cardId, n] of [...deckList, ...extraDeckList]) copies[cardId] = (copies[cardId] ?? 0) + n
  for (const [cardId, n] of Object.entries(copies)) {
    if (n > DECK_RULES.maxCopies) problems.push(`${getCardById(cardId).name} ใส่ได้ไม่เกิน ${DECK_RULES.maxCopies} ใบ (ตอนนี้ ${n})`)
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
  aiDeckName = null, // ชื่อสำรับของ AI (แสดงในบันทึกตอนเริ่มเกม)
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
      revivedUids: [],
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
    pendingChoice: null,
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
    `เริ่มเกม! LP ฝ่ายละ ${formatNumber(RULES.startingLP)} · ${deckText} · จั่วมือแรกฝ่ายละ ${RULES.startingHand} ใบ${
      aiDeckName ? ` · คู่ต่อสู้ใช้สำรับ "${aiDeckName}"` : ''
    }`
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
  if (state.pendingChoice) return state.pendingChoice.player
  return state.pendingResponse ? state.pendingResponse.responder : state.activePlayer
}

const isInterrupted = (state) => Boolean(state.pendingResponse || state.pendingChoice)

const inMainPhase = (state) => state.phase === 'main1' || state.phase === 'main2'
const isPlayersOpenMain = (state, playerId) =>
  !state.winner && state.activePlayer === playerId && !isInterrupted(state) && inMainPhase(state)

export function getSummonableHand(state, playerId) {
  const p = state.players[playerId]
  if (state.winner || state.activePlayer !== playerId || isInterrupted(state)) return []
  if (state.phase !== 'main1' && state.phase !== 'main2') return []
  if (p.hasNormalSummoned) return []
  const hasEmptyZone = p.field.includes(null)
  const monsterCount = p.field.filter(Boolean).length
  return p.hand.filter((inst) => {
    const card = cardOf(inst)
    if (getSummonOnlyBy(card)) return false
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
  if (isInterrupted(state) || !canAttackThisTurn(state)) return []
  return state.players[playerId].field.filter((m) => m && canDeclareAttack(state, playerId, m))
}

const attacksMade = (m) => m.attackCount ?? (m.hasAttacked ? 1 : 0)

// โจมตีได้กี่ครั้งเทิร์นนี้ (เอฟเฟกต์โจมตีเพิ่มเช็ก ณ ตอนประกาศโจมตี)
function maxAttacks(state, playerId, m) {
  const extra = getExtraAttack(cardOf(m))
  if (!extra) return 1
  const allyCount = state.players[playerId].field.filter(Boolean).length
  const enemyCount = state.players[opponentOf(playerId)].field.filter(Boolean).length
  return extra.isActive({ allyCount, enemyCount, allies: getAllies(state, playerId, m.uid) }) ? 2 : 1
}

// โจมตีตรงได้ไหม: ศัตรูไม่มีมอนสเตอร์ · หรือมีแต่การ์ดคว่ำและใบนี้บินข้ามได้ (กระสือ)
export function canAttackDirectly(state, playerId, uid) {
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  if (!m) return false
  const card = cardOf(m)
  if (hasNoDirectAttack(card)) return false
  const oppField = state.players[opponentOf(playerId)].field
  if (!oppField.some(Boolean)) return true
  return Boolean(getFlyOver(card)) && !oppField.some((x) => x && !x.faceDown)
}

// ศัตรูเลือกมอนสเตอร์ตัวนี้เป็นเป้าความสามารถไม่ได้ (นางตานี / แม่นาค เมื่อมีผีตัวอื่น)
function isShrouded(state, ownerId, m) {
  const shroud = !m.faceDown && getShroud(cardOf(m))
  return Boolean(shroud && shroud.isActive({ allies: getAllies(state, ownerId, m.uid) }))
}

// มอนสเตอร์หงายของศัตรูที่เลือกเป็นเป้าความสามารถได้
function targetableEnemies(state, playerId) {
  const oppId = opponentOf(playerId)
  return state.players[oppId].field.filter((t) => t && !t.faceDown && !isShrouded(state, oppId, t))
}

function canDeclareAttack(state, playerId, m) {
  if (isAttackLocked(state, m)) return false
  // โจมตีตรงไม่ได้ + ศัตรูไม่มีมอนสเตอร์ = ไม่มีอะไรให้โจมตี
  if (hasNoDirectAttack(cardOf(m)) && !state.players[opponentOf(playerId)].field.some(Boolean)) return false
  return m.position !== 'defense' && attacksMade(m) < maxAttacks(state, playerId, m)
}

// เปลี่ยนท่าได้ในเฟสหลัก ตัวละ 1 ครั้ง/เทิร์น ยกเว้นเทิร์นที่เพิ่งลงสนามหรือโจมตีไปแล้ว
// คืนข้อความเหตุผลถ้าเปลี่ยนไม่ได้ หรือ null ถ้าเปลี่ยนได้
export function positionChangeBlocker(state, playerId, uid) {
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  if (!m) return 'ไม่พบมอนสเตอร์ตัวนี้บนสนาม'
  if (state.winner || state.activePlayer !== playerId) return 'ยังไม่ถึงตาของคุณ'
  if (state.phase !== 'main1' && state.phase !== 'main2') return 'เปลี่ยนท่าได้เฉพาะเฟสหลัก'
  if (m.positionLockTurn >= state.turn) return 'ถูกรากตะเคียนพันไว้ เปลี่ยนท่าไม่ได้'
  if (m.summonedTurn === state.turn) return 'เพิ่งลงสนามเทิร์นนี้ ยังเปลี่ยนท่าไม่ได้'
  if (m.hasAttacked) return 'โจมตีไปแล้วเทิร์นนี้ เปลี่ยนท่าไม่ได้'
  if (m.positionChangedTurn === state.turn) return 'เปลี่ยนท่าไปแล้วเทิร์นนี้'
  return null
}

export function getOpponentMonsters(state, playerId) {
  return state.players[opponentOf(playerId)].field.filter(Boolean)
}

// ห้ามโจมตี: ระบุเทิร์นเดียว (cannotAttackTurn) หรือถึงเทิร์นที่กำหนด (cannotAttackUntil)
export const isAttackLocked = (state, m) => m.cannotAttackTurn === state.turn || m.cannotAttackUntil >= state.turn

// เป้าที่โจมตีได้: ถ้าศัตรูมีผีเฝ้าทาง (หงายท่าตั้งรับ) ต้องตีตัวนั้นก่อน
export function getAttackableTargets(state, playerId) {
  const all = getOpponentMonsters(state, playerId)
  const guards = all.filter((m) => !m.faceDown && m.position === 'defense' && getTaunt(cardOf(m)))
  return guards.length ? guards : all
}

// การ์ดมอนสเตอร์ตัวอื่นบนสนามของ playerId (ใช้เช็กเงื่อนไขเอฟเฟกต์)
export function getAllies(state, playerId, excludeUid) {
  // การ์ดคว่ำยังไม่เปิดเผย จึงไม่นับเป็นเงื่อนไขเอฟเฟกต์
  return state.players[playerId].field.filter((m) => m && m.uid !== excludeUid && !m.faceDown).map(cardOf)
}

// ATK ที่หายไปจากการอ่อนแรงหลังโจมตี (attackDecay)
function decayModifiers(m) {
  const decay = m?.decayStep ? getAttackDecay(cardOf(m)) : null
  if (!decay) return []
  const step = Math.min(m.decayStep, decay.penalties.length)
  return [{ amount: -decay.penalties[step - 1], reason: `${decay.reason} (โจมตีแล้ว ${m.decayStep} ครั้ง)` }]
}

// ตัวปรับ ATK ที่ไม่ได้มาจากมอนสเตอร์ตัวอื่น: เวทสนามของเจ้าของ + ตัวปรับบนตัวมอนสเตอร์เอง
function atkExtras(state, playerId, m) {
  const p = state.players[playerId]
  return {
    fieldSpell: p.fieldSpell ? cardOf(p.fieldSpell) : null,
    temp: [
      ...(m?.tempAtk ?? []),
      ...decayModifiers(m),
      ...(m?.statMods ?? []).filter((x) => x.atk).map((x) => ({ amount: x.atk, reason: x.reason })),
    ],
    defTemp: (m?.statMods ?? []).filter((x) => x.def).map((x) => ({ amount: x.def, reason: x.reason })),
    growth: m && !m.faceDown ? m.growth ?? 0 : 0,
    graveyard: p.graveyard.map(cardOf),
    equips: equipsOf(state, m?.uid).map(cardOf),
    continuous: p.spellTrap.filter((t) => t && !t.faceDown && getContinuousTrap(cardOf(t))).map(cardOf),
  }
}

// ตัวปรับ ATK ตอนเป็นฝ่ายโจมตี = atkExtras + บัฟเฉพาะตอนโจมตี (attackingBoost)
// + พรานขี่เสือ: เป้าเป็นมอนสเตอร์หงายที่ ATK สูงสุดฝ่ายศัตรู
function attackExtras(state, playerId, m, target = null) {
  const extras = atkExtras(state, playerId, m)
  const card = cardOf(m)
  const temp = [...extras.temp]
  const boost = getAttackingBoost(card)
  if (boost) temp.push(boost)
  const hunt = getHuntBonus(card)
  if (hunt && target && !target.faceDown) {
    const oppId = opponentOf(playerId)
    const top = Math.max(
      ...state.players[oppId].field.filter((x) => x && !x.faceDown).map((x) => getFieldAtk(state, oppId, x.uid))
    )
    if (getFieldAtk(state, oppId, target.uid) >= top) temp.push(hunt)
  }
  return { ...extras, temp }
}

// เวทสวมใส่ที่ติดกับมอนสเตอร์ uid (อยู่ในช่องเวท/กับดักของเจ้าของ)
function equipsOf(state, uid) {
  if (!uid) return []
  return Object.values(state.players).flatMap((pl) => pl.spellTrap.filter((t) => t?.equippedTo === uid))
}

// ทำลายจากเอฟเฟกต์ (เจ้าของที่มีครูบาศรีวิชัยหงายอยู่ ไม่ถูกทำลาย) — คืน true ถ้าถูกทำลายจริง
function effectDestroy(state, ownerId, uid, details) {
  const p = state.players[ownerId]
  const m = p.field.find((x) => x?.uid === uid)
  if (!m) return false
  const guard = p.field.filter((x) => x && !x.faceDown).map(cardOf).map(getEffectProtection).find(Boolean)
  if (guard) {
    details.push(`${guard.reason} → ${cardOf(m).name} ไม่ถูกทำลาย`)
    return false
  }
  destroyMonster(state, ownerId, uid, details)
  return true
}

// หลังประกาศโจมตี: มอนสเตอร์ที่มี attackDecay อ่อนแรงลง (ถ้ายังอยู่บนสนามและไม่มีเงื่อนไขป้องกัน)
function applyAttackDecay(state, playerId, attackerUid, details) {
  const p = state.players[playerId]
  const m = p.field.find((x) => x?.uid === attackerUid)
  const decay = m && getAttackDecay(cardOf(m))
  if (!decay) return
  const card = cardOf(m)
  const protectedReason = decay.protectedBy({
    allies: getAllies(state, playerId, m.uid),
    fieldSpell: p.fieldSpell ? cardOf(p.fieldSpell) : null,
  })
  if (protectedReason) {
    details.push(`🌑 ${card.name} ไม่อ่อนแรง: ${protectedReason}`)
    return
  }
  const prevStep = Math.min(m.decayStep ?? 0, decay.penalties.length)
  const nextStep = Math.min(prevStep + 1, decay.penalties.length)
  const before = card.atk - (prevStep ? decay.penalties[prevStep - 1] : 0)
  const after = card.atk - decay.penalties[nextStep - 1]
  m.decayStep = (m.decayStep ?? 0) + 1
  details.push(
    before === after
      ? `🌑 ${card.name} ${decay.reason}: ATK ต่ำสุดแล้ว ${formatNumber(after)}`
      : `🌑 ${card.name} ${decay.reason}: ATK ${formatNumber(before)} → ${formatNumber(after)}`
  )
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
    attackerExtras: attackExtras(state, playerId, attacker, defender),
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
  if (state.winner || state.activePlayer !== playerId || isInterrupted(state)) return 'ยังไม่ถึงตาของคุณ'
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
    if (activated.discardCost !== false && p.hand.length === 0) return 'ต้องมีการ์ดในมือให้ทิ้ง 1 ใบ'
  }
  if (['debuff', 'bind', 'drain', 'curse', 'vine'].includes(activated.kind)) {
    if (getActivationTargets(state, playerId, uid).length === 0) {
      return getAllies(state, opponentOf(playerId), null).length === 0
        ? 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์หงายหน้า'
        : 'มอนสเตอร์ศัตรูทุกตัวเลือกเป็นเป้าไม่ได้'
    }
  }
  if (activated.kind === 'destroySpellsTraps') {
    const opp = state.players[opponentOf(playerId)]
    if (!opp.fieldSpell && !opp.spellTrap.some(Boolean)) return 'ฝ่ายตรงข้ามไม่มีการ์ดเวท/กับดัก'
  }
  if (activated.kind === 'destroyWeaker' && getDestroyWeakerTargets(state, playerId, uid).length === 0) {
    return 'ไม่มีมอนสเตอร์ศัตรูหงายหน้าที่ ATK ต่ำกว่า'
  }
  if (activated.kind === 'lockAttack' && getActivationTargets(state, playerId, uid).length === 0) {
    return 'ไม่มีมอนสเตอร์ศัตรูเผ่าอสูร/วิญญาณหงายหน้า'
  }
  if (activated.kind === 'vine' && !(m.growth > 0)) return 'ต้องมีแต้มเติบโตอย่างน้อย 1 แต้ม'
  if (activated.kind === 'growthBuff') {
    if (!p.field.some((x) => x && !x.faceDown && isPlantCard(cardOf(x)) && x.growth > 0)) {
      return 'ต้องมีพืชหงายที่มีแต้มเติบโต'
    }
    if (growthBuffTargets(p).length === 0) return 'ไม่มีสัตว์ใหญ่หงายที่ยังไม่ได้รับบัฟนี้'
  }
  if (activated.kind === 'scout' && !state.players[opponentOf(playerId)].spellTrap.some((t) => t?.faceDown)) {
    return 'ฝ่ายตรงข้ามไม่มีเวท/กับดักคว่ำ'
  }
  if (activated.kind === 'searchTrap' && !p.deck.some((c) => cardOf(c).type === 'trap')) {
    return 'ไม่มีการ์ดกับดักเหลือในกอง'
  }
  return null
}

// หมอช้างพันธะไพร: สัตว์ใหญ่หงายของเราที่ยังไม่มีบัฟจากหมอช้าง
function growthBuffTargets(p) {
  return p.field.filter(
    (x) => x && !x.faceDown && cardHasTribe(cardOf(x), 'largeBeast') && !(x.statMods ?? []).some((mod) => mod.tag === 'th03-008')
  )
}

// เป้าหมายของ "ทำลายศัตรูที่ ATK ต่ำกว่าใบนี้": มอนสเตอร์หงายของศัตรูที่ ATK (จริงบนสนาม) ต่ำกว่า
export function getDestroyWeakerTargets(state, playerId, uid) {
  const oppId = opponentOf(playerId)
  const own = getFieldAtk(state, playerId, uid)
  return targetableEnemies(state, playerId).filter((t) => getFieldAtk(state, oppId, t.uid) < own)
}

// เป้าหมายที่เลือกได้ของความสามารถแบบเลือกเป้า (debuff / destroyWeaker / lockAttack) — [] ถ้าไม่ต้องเลือก
// มอนสเตอร์ที่ "ไม่รับผลจากการ์ดธาตุตมะ" เทิร์นนี้ เลือกด้วยความสามารถของการ์ดธาตุตมะไม่ได้
export function getActivationTargets(state, playerId, uid) {
  const m = state.players[playerId].field.find((x) => x?.uid === uid)
  const card = m && cardOf(m)
  const activated = card && getActivated(card)
  if (!activated) return []
  const immune = (t) => card.element === 'dark' && t.darkImmuneTurn === state.turn
  let targets = []
  if (['debuff', 'bind', 'drain', 'curse', 'vine'].includes(activated.kind)) targets = targetableEnemies(state, playerId)
  if (activated.kind === 'destroyWeaker') targets = getDestroyWeakerTargets(state, playerId, uid)
  if (activated.kind === 'lockAttack') {
    targets = targetableEnemies(state, playerId).filter((t) => activated.targets(cardOf(t)))
  }
  return targets.filter((t) => !immune(t))
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
  const ritualCard = cardOf(p.hand.find((c) => c.uid === ritualUid))
  const usesSubstitute = chosen.length === 1 && ritual.substitutes.includes(chosen[0].cardId)
  const total = chosen.reduce((sum, c) => sum + getRitualLevel(cardOf(c), ritualCard), 0)
  if (!usesSubstitute && total < ritual.requiredLevel) {
    return `ระดับรวม ${total} ยังไม่ถึง ${ritual.requiredLevel}`
  }
  const fieldTributes = chosen.filter((c) => p.field.some((m) => m?.uid === c.uid)).length
  if (!p.field.includes(null) && fieldTributes === 0) return 'ไม่มีช่องมอนสเตอร์ว่างให้อัญเชิญ'
  return null
}

// ผสานร่าง: วัตถุดิบที่ใช้ได้ = มอนสเตอร์ในมือ + บนสนามเรา (หงายหรือคว่ำ)
export function fusionMaterialPool(state, playerId) {
  const p = state.players[playerId]
  return [...p.hand.filter((c) => cardOf(c).type === 'monster'), ...p.field.filter(Boolean)]
}

// ตรวจการผสาน (null = ใช้ได้): การ์ดเวทผสาน + เป้าหมายในกองพิเศษ + วัตถุดิบ 2 ตัว
export function fusionProblem(state, playerId, spellUid, fusionUid, materialUids = []) {
  const p = state.players[playerId]
  const spell = p.hand.find((c) => c.uid === spellUid)
  if (!spell || !getFusionSpell(cardOf(spell))) return 'ไม่ใช่การ์ดเวทผสานร่าง'
  const fusionInst = p.extraDeck.find((c) => c.uid === fusionUid)
  if (!fusionInst) return 'เลือกมอนสเตอร์ผสานร่างจากกองพิเศษ'
  const pool = fusionMaterialPool(state, playerId)
  const chosen = [...new Set(materialUids)].map((uid) => pool.find((c) => c.uid === uid))
  if (chosen.length !== 2) return 'เลือกวัตถุดิบ 2 ตัว'
  if (chosen.includes(undefined)) return 'วัตถุดิบต้องเป็นมอนสเตอร์ในมือหรือบนสนามของเรา'
  const target = cardOf(fusionInst)
  if (!matchesFusion(target, chosen.map(cardOf))) {
    return `วัตถุดิบไม่ตรงสูตร: ${getFusionMaterials(target).map((m) => m.label).join(' + ')}`
  }
  const fromField = chosen.filter((c) => p.field.some((m) => m?.uid === c.uid)).length
  if (!p.field.includes(null) && fromField === 0) return 'ไม่มีช่องมอนสเตอร์ว่างให้อัญเชิญ'
  return null
}

// คู่วัตถุดิบทั้งหมดที่ผสานเป็น fusionUid ได้ (ใช้เช็กว่าทำได้ไหม และให้ AI เลือก)
export function getFusionPairs(state, playerId, spellUid, fusionUid) {
  const pool = fusionMaterialPool(state, playerId)
  const pairs = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const uids = [pool[i].uid, pool[j].uid]
      if (!fusionProblem(state, playerId, spellUid, fusionUid, uids)) pairs.push(uids)
    }
  }
  return pairs
}

// มอนสเตอร์ในกองพิเศษที่ผสานได้ตอนนี้
export function getFusionTargets(state, playerId, spellUid) {
  return state.players[playerId].extraDeck.filter(
    (c) => getFusionPairs(state, playerId, spellUid, c.uid).length > 0
  )
}

// เวทคืนชีพ: มอนสเตอร์ในสุสานเราที่คืนชีพได้
export function getReviveTargets(state, playerId, spellCard) {
  const revive = getReviveSpell(spellCard)
  if (!revive) return []
  return state.players[playerId].graveyard.filter((c) => {
    const card = cardOf(c)
    return card.type === 'monster' && !revive.excludeSummonTypes.includes(card.summonType) && !getSummonOnlyBy(card)
  })
}

// เวทสวมใส่ / เวทบัฟ: มอนสเตอร์หงายของเราที่เลือกเป็นเป้าได้
export function getEquipTargets(state, playerId, spellCard) {
  const branch = getBranchSpell(spellCard)
  if (branch) {
    const p = state.players[playerId]
    return p.field.filter(
      (m) => m && !m.faceDown && branch.pairs.some((pair) => pair.from === m.cardId && p.hand.some((h) => h.cardId === pair.to))
    )
  }
  const equip = getEquip(spellCard) ?? getBuffSpell(spellCard)
  if (!equip) return []
  return state.players[playerId].field.filter((m) => m && !m.faceDown && equip.appliesTo(cardOf(m)))
}

// ขึ้นขี่: ร่างขี่ในกองพิเศษ + คู่วัตถุดิบหงายบนสนาม [คน, สัตว์] ที่ใช้ได้
export function getMountOptions(state, playerId) {
  const p = state.players[playerId]
  const faceUp = p.field.filter((m) => m && !m.faceDown)
  return p.extraDeck
    .filter((c) => canMount(cardOf(c)))
    .map((c) => {
      const [human, animal] = getFusionMaterials(cardOf(c))
      const pairs = []
      for (const a of faceUp) {
        for (const b of faceUp) {
          if (a !== b && human.matches(cardOf(a)) && animal.matches(cardOf(b))) pairs.push([a.uid, b.uid])
        }
      }
      return { fusionUid: c.uid, pairs }
    })
    .filter((o) => o.pairs.length > 0)
}

export function mountBlocker(state, playerId) {
  if (!isPlayersOpenMain(state, playerId)) return 'ขึ้นขี่ได้เฉพาะเฟสหลักในตาของเรา'
  if (state.players[playerId].mountedTurn === state.turn) return 'ขึ้นขี่ไปแล้วเทิร์นนี้ (เทิร์นละ 1 ครั้ง)'
  if (getMountOptions(state, playerId).length === 0) return 'ไม่มีคน + สัตว์หงายบนสนามที่ตรงสูตรร่างขี่'
  return null
}

function mount(state, playerId, fusionUid, materials = []) {
  const blocker = mountBlocker(state, playerId)
  if (blocker) throw new GameRuleError(blocker)
  const p = state.players[playerId]
  const option = getMountOptions(state, playerId).find((o) => o.fusionUid === fusionUid)
  if (!option) throw new GameRuleError('ร่างขี่ใบนี้ยังขึ้นขี่ไม่ได้')
  const pair = option.pairs.find(([a, b]) => materials.length === 2 && materials.includes(a) && materials.includes(b))
  if (!pair) throw new GameRuleError('เลือกคน 1 ตัว + สัตว์ 1 ตัวบนสนามที่ตรงสูตร')
  const zone = p.field.findIndex((m) => m?.uid === pair[0])
  const materialText = pair.map((uid) => sendMaterialToGrave(p, uid))
  const inst = p.extraDeck.splice(p.extraDeck.findIndex((c) => c.uid === fusionUid), 1)[0]
  const rider = cardOf(inst)
  p.field[zone] = {
    ...inst,
    hasAttacked: false,
    summonedTurn: state.turn,
    position: 'attack',
    faceDown: false,
    positionChangedTurn: null,
    materials: pair,
  }
  p.mountedTurn = state.turn
  addLog(state, playerId, 'summon', `🐎 ${PLAYER_NAMES[playerId]}ขึ้นขี่ → ${rider.name} (ระดับ ${rider.level} · ATK ${formatNumber(rider.atk)} / DEF ${formatNumber(rider.def)}) ลงช่องที่ ${zone + 1}`, [
    `วัตถุดิบ: ${materialText.join(' + ')}`,
  ])
}

// อัญเชิญพิเศษจากมือ (เช่น สามเณรสังเวยเด็กวัด) — เหตุผลที่ทำไม่ได้ หรือ null
export function specialSummonBlocker(state, playerId, uid) {
  const p = state.players[playerId]
  const inst = p.hand.find((c) => c.uid === uid)
  const special = inst && getSpecialSummon(cardOf(inst))
  if (!special) return 'การ์ดใบนี้อัญเชิญพิเศษไม่ได้'
  if (!isPlayersOpenMain(state, playerId)) return 'อัญเชิญได้เฉพาะเฟสหลักในตาของเรา'
  if (special.returnId) {
    if ((p.usedEffects ?? {})[`name:${inst.cardId}`] === state.turn) return 'ใช้ทางนี้ไปแล้วเทิร์นนี้'
    if (!p.field.some((m) => m?.cardId === special.returnId && !m.faceDown)) {
      return `ต้องมี "${getCardById(special.returnId).name}" หงายบนสนาม`
    }
    return null
  }
  if (!p.field.some((m) => m?.cardId === special.tributeId)) {
    return `ต้องมี "${getCardById(special.tributeId).name}" บนสนามให้สังเวย`
  }
  return null
}

// กับดักต่อเนื่องที่วางคว่ำ: เปิดหงายได้ในเฟสหลักของเรา ตั้งแต่เทิร์นหลังวาง
export function trapActivationBlocker(state, playerId, uid) {
  const t = state.players[playerId].spellTrap.find((x) => x?.uid === uid)
  if (!t || !getContinuousTrap(cardOf(t))) return 'ไม่ใช่กับดักต่อเนื่อง'
  if (!t.faceDown) return 'เปิดใช้อยู่แล้ว'
  if (!isPlayersOpenMain(state, playerId)) return 'เปิดได้เฉพาะเฟสหลักในตาของเรา'
  if (t.setTurn >= state.turn) return 'เพิ่งวางเทิร์นนี้ เปิดได้ตั้งแต่เทิร์นหน้า'
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
  if (getFusionSpell(card) && getFusionTargets(state, playerId, uid).length === 0) {
    return 'ยังไม่มีวัตถุดิบครบสำหรับมอนสเตอร์ผสานร่างในกองพิเศษ'
  }
  if (getReviveSpell(card)) {
    if (getReviveTargets(state, playerId, card).length === 0) return 'ไม่มีมอนสเตอร์ในสุสานที่คืนชีพได้'
    if (!p.field.includes(null)) return 'ไม่มีช่องมอนสเตอร์ว่าง'
  }
  if (getGrowthSpell(card) && (p.usedEffects ?? {})[`name:${card.id}`] === state.turn) {
    return `ใช้ "${card.name}" ไปแล้วเทิร์นนี้`
  }
  if (getBranchSpell(card)) {
    if ((p.usedEffects ?? {})[`name:${card.id}`] === state.turn) return `ใช้ "${card.name}" ไปแล้วเทิร์นนี้`
    if (getEquipTargets(state, playerId, card).length === 0) {
      return 'ต้องมีต้นสาย (พรานหนุ่ม/พระอาจารย์) หงายบนสนาม และร่างสายมืดที่คู่กันในมือ'
    }
  }
  if (getBuffSpell(card) && getEquipTargets(state, playerId, card).length === 0) {
    return 'ไม่มีมอนสเตอร์เผ่าอสูรหงายหน้าบนสนามเรา'
  }
  if (getEquip(card)) {
    if (getEquipTargets(state, playerId, card).length === 0) return 'ไม่มีมอนสเตอร์ที่สวมใส่ได้ (ทหารหาญหงายหน้า)'
    if (!p.spellTrap.includes(null)) return 'ช่องเวท/กับดักเต็มแล้ว'
  }
  const ritual = getRitualInfo(card)
  if (ritual) {
    if (!p.hand.some((c) => c.cardId === ritual.target)) return `ต้องมี "${getCardById(ritual.target).name}" อยู่ในมือ`
    const pool = ritualTributePool(state, playerId, uid)
    const hasSubstitute = pool.some((c) => ritual.substitutes.includes(c.cardId))
    const total = pool.reduce((sum, c) => sum + getRitualLevel(cardOf(c), card), 0)
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
      state.pendingChoice
        ? 'รออีกฝ่ายตัดสินใจก่อน'
        : state.pendingResponse
        ? 'รอฝ่ายรับตัดสินใจเปิดกับดักก่อน'
        : 'ยังไม่ถึงเทิร์นของผู้เล่นนี้'
    )
  }
  if (state.pendingChoice && action.type !== 'choose') throw new GameRuleError('ต้องเลือกก่อน')
  if (!state.pendingChoice && state.pendingResponse && action.type !== 'respond') {
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
      playSpell(next, action.player, action.uid, action.tributes, action.fusionTarget, action.targetUid)
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
    case 'choose':
      choose(next, action.player, action.optionId)
      break
    case 'specialSummon':
      specialSummon(next, action.player, action.uid, action.position)
      break
    case 'mount':
      mount(next, action.player, action.fusionUid, action.materials)
      break
    case 'activateTrap':
      activateContinuousTrap(next, action.player, action.uid)
      break
    default:
      throw new GameRuleError(`ไม่รู้จักแอ็กชัน ${action.type}`)
  }
  runTriggers(state, next)
  attachEvent(state, next, action)
  return next
}

/*
 * เอฟเฟกต์ที่เกิดตามหลังแอ็กชันใด ๆ:
 * - เวทสวมใส่ที่มอนสเตอร์เป้าหมายออกจากสนามแล้ว → ลงสุสาน
 * - การ์ด reviveOnGrave ที่เพิ่งตกสุสานจากสนาม → ถามเจ้าของว่าจะคืนชีพไหม (pendingChoice)
 */
function runTriggers(prev, next) {
  for (const [id, p] of Object.entries(next.players)) {
    p.spellTrap = p.spellTrap.map((t) => {
      if (!t?.equippedTo || Object.values(next.players).some((pl) => pl.field.some((m) => m?.uid === t.equippedTo))) {
        return t
      }
      p.graveyard.push({ uid: t.uid, cardId: t.cardId })
      addLog(next, id, 'effect', `${cardOf(t).name} ลงสุสาน (มอนสเตอร์ที่สวมใส่ออกจากสนาม)`)
      return null
    })
  }
  if (next.winner) return
  for (const [id, p] of Object.entries(next.players)) {
    const before = prev.players[id]
    const fallen = p.graveyard.filter(
      (c) =>
        !before.graveyard.some((g) => g.uid === c.uid) &&
        before.field.some((m) => m?.uid === c.uid) &&
        getReviveOnGrave(cardOf(c)) &&
        !(p.revivedUids ?? []).includes(c.uid)
    )
    for (const c of fallen) {
      const revive = getReviveOnGrave(cardOf(c))
      if (!p.field.includes(null)) continue
      const water = p.hand.find((h) => h.cardId === revive.altCostCardId)
      const options = [
        ...(p.lp > revive.lpCost ? [{ id: 'pay', label: `จ่าย ${formatNumber(revive.lpCost)} LP` }] : []),
        ...(water ? [{ id: 'water', label: `ทิ้ง ${cardOf(water).name} จากมือ` }] : []),
      ]
      if (options.length === 0) continue
      queueChoice(next, {
        player: id,
        kind: 'revive',
        uid: c.uid,
        prompt: `${cardOf(c).name} ตกสุสาน — คืนชีพกลับมาท่าตั้งรับไหม?`,
        options: [...options, { id: 'skip', label: 'ไม่คืนชีพ' }],
      })
      addLog(next, id, 'phase', `${cardOf(c).name} ตกสุสาน — รอ${PLAYER_NAMES[id]}ตัดสินใจคืนชีพ`)
      return
    }
  }
}

// ตัวเลือกที่รอผู้เล่นตัดสินใจ: มีอันค้างอยู่แล้ว → ต่อคิว (เปิดอันถัดไปหลังเลือกเสร็จ)
function queueChoice(state, choice) {
  if (state.pendingChoice) state.choiceQueue = [...(state.choiceQueue ?? []), choice]
  else state.pendingChoice = choice
}

// เอฟเฟกต์เมื่ออัญเชิญหงายสำเร็จ: ค้นการ์ด (002 ฯลฯ) · เรียกพวกจากมือ (ฝูงต่อ) · ดูบนกอง (นกเงือก)
function onSummoned(state, playerId, card, { skipSearch = false } = {}) {
  const p = state.players[playerId]
  const used = (key) => (p.usedEffects ?? {})[key] === state.turn
  if (!skipSearch) triggerSummonSearch(state, playerId, card)
  const call = getOnSummonCall(card)
  if (call && !used(`name:${card.id}`) && p.field.includes(null)) {
    const candidates = p.hand.filter((h) => call.matches(cardOf(h)))
    if (candidates.length) {
      queueChoice(state, {
        player: playerId,
        kind: 'summonFromHand',
        source: card.id,
        markName: true,
        prompt: `${card.name}: เรียก${call.label}จากมือลงสนามท่าตั้งรับไหม? (โจมตีไม่ได้เทิร์นนี้)`,
        options: [...candidates.map((h) => ({ id: h.uid, label: cardOf(h).name })), { id: 'skip', label: 'ไม่เรียก' }],
      })
    }
  }
  const look = getOnSummonLook(card)
  if (look && !used(`name:${card.id}`) && p.deck.length) {
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${card.id}`]: state.turn }
    const top = p.deck.slice(0, look.count).map((c) => c.uid)
    const picks = p.field.some((x) => x && !x.faceDown && isPlantCard(cardOf(x))) ? 2 : 1
    queueLook(state, playerId, card, look, top, picks)
  }
}

// นกเงือก: เลือกการ์ดจากบนกองที่ดูอยู่ทีละใบ · หมดสิทธิ์เลือก → ที่เหลือไว้ใต้กอง
function queueLook(state, playerId, card, look, uids, picks) {
  const p = state.players[playerId]
  const candidates = p.deck.filter((c) => uids.includes(c.uid) && look.matches(cardOf(c)))
  if (picks <= 0 || candidates.length === 0) {
    const rest = uids.map((uid) => p.deck.find((c) => c.uid === uid)).filter(Boolean)
    p.deck = [...p.deck.filter((c) => !uids.includes(c.uid)), ...rest]
    addLog(state, playerId, 'effect', `🐦 ${card.name}: การ์ดที่ดู ${rest.length} ใบไว้ใต้กอง`)
    return
  }
  queueChoice(state, {
    player: playerId,
    kind: 'look',
    source: card.id,
    cards: uids,
    picks,
    prompt: `${card.name}: ดูบนกอง ${uids.length} ใบ — เลือก${look.label}ขึ้นมือ (เหลือเลือกได้ ${picks} ใบ)`,
    options: candidates.map((c) => ({ id: c.uid, label: cardOf(c).name })),
  })
}

// อัญเชิญหงายสำเร็จ: ค้นการ์ดจากกอง (oncePerName = ชื่อละครั้งต่อเทิร์น นับเมื่อค้นได้จริง)
function triggerSummonSearch(state, playerId, card) {
  const search = getOnSummonSearch(card)
  if (!search) return
  const p = state.players[playerId]
  const key = `search:${card.id}`
  if (search.oncePerName && (p.usedEffects ?? {})[key] === state.turn) return
  if (startSearch(state, playerId, card, search.matches, search.label) && search.oncePerName) {
    p.usedEffects = { ...(p.usedEffects ?? {}), [key]: state.turn }
  }
}

// ค้นการ์ดจากกองขึ้นมือ: ตัวเลือกเดียว → ค้นเลย · หลายแบบ → ให้เจ้าของเลือก (pendingChoice)
// คืน true เมื่อมีการ์ดให้ค้น
function startSearch(state, playerId, sourceCard, matches, label) {
  const p = state.players[playerId]
  const ids = [...new Set(p.deck.filter((c) => matches(cardOf(c))).map((c) => c.cardId))]
  if (ids.length === 0) {
    addLog(state, playerId, 'effect', `🔎 ${sourceCard.name}: ไม่มี${label}เหลือในกอง`)
    return false
  }
  if (ids.length === 1) {
    takeFromDeck(state, playerId, sourceCard, ids[0])
    return true
  }
  queueChoice(state, {
    player: playerId,
    kind: 'search',
    source: sourceCard.id,
    prompt: `${sourceCard.name}: เลือก${label} 1 ใบจากกองขึ้นมือ`,
    options: ids.map((id) => ({ id, label: getCardById(id).name })),
  })
  return true
}

function takeFromDeck(state, playerId, sourceCard, cardId) {
  const p = state.players[playerId]
  const inst = p.deck.splice(p.deck.findIndex((c) => c.cardId === cardId), 1)[0]
  p.hand.push(inst)
  addLog(state, playerId, 'effect', `🔎 ${sourceCard.name}: ${PLAYER_NAMES[playerId]}ค้น ${cardOf(inst).name} จากกองขึ้นมือ`)
}

function choose(state, playerId, optionId) {
  const choice = state.pendingChoice
  if (!choice) throw new GameRuleError('ไม่มีอะไรให้เลือก')
  if (!choice.options.some((o) => o.id === optionId)) throw new GameRuleError('ตัวเลือกไม่ถูกต้อง')
  state.pendingChoice = null
  if (state.choiceQueue?.length) {
    state.pendingChoice = state.choiceQueue[0]
    state.choiceQueue = state.choiceQueue.slice(1)
  }
  const p = state.players[playerId]
  if (choice.kind === 'search') {
    takeFromDeck(state, playerId, getCardById(choice.source), optionId)
    return
  }
  if (choice.kind === 'summonFromHand') {
    const source = getCardById(choice.source)
    if (optionId === 'skip') {
      addLog(state, playerId, 'effect', `${source.name}: ${PLAYER_NAMES[playerId]}ไม่เรียกพวก`)
      return
    }
    if (choice.markName) p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${choice.source}`]: state.turn }
    const zone = p.field.indexOf(null)
    if (zone === -1) throw new GameRuleError('ไม่มีช่องมอนสเตอร์ว่าง')
    const [inst] = p.hand.splice(p.hand.findIndex((h) => h.uid === optionId), 1)
    p.field[zone] = {
      ...inst,
      hasAttacked: false,
      summonedTurn: state.turn,
      position: 'defense',
      faceDown: false,
      positionChangedTurn: null,
      cannotAttackTurn: state.turn,
    }
    addLog(state, playerId, 'summon', `✨ ${source.name}: ${PLAYER_NAMES[playerId]}เรียก ${cardOf(inst).name} ลงช่องที่ ${zone + 1} ท่าตั้งรับ (โจมตีไม่ได้เทิร์นนี้)`)
    onSummoned(state, playerId, cardOf(inst))
    return
  }
  if (choice.kind === 'look') {
    const source = getCardById(choice.source)
    const [inst] = p.deck.splice(p.deck.findIndex((c) => c.uid === optionId), 1)
    p.hand.push(inst)
    addLog(state, playerId, 'effect', `🐦 ${source.name}: ${PLAYER_NAMES[playerId]}นำ ${cardOf(inst).name} จากบนกองขึ้นมือ`)
    queueLook(state, playerId, source, getOnSummonLook(source), choice.cards.filter((uid) => uid !== optionId), choice.picks - 1)
    return
  }
  if (choice.kind === 'dismount') {
    if (optionId === 'skip') {
      addLog(state, playerId, 'effect', `${PLAYER_NAMES[playerId]}ไม่ใช้ลงจากหลัง`)
      return
    }
    p.dismountedUids = [...(p.dismountedUids ?? []), choice.source]
    const gIndex = p.graveyard.findIndex((g) => g.uid === optionId)
    const zone = p.field.indexOf(null)
    if (gIndex === -1 || zone === -1) {
      addLog(state, playerId, 'effect', 'ลงจากหลังไม่สำเร็จ (ไม่มีวัตถุดิบในสุสานหรือไม่มีช่องว่าง)')
      return
    }
    const [inst] = p.graveyard.splice(gIndex, 1)
    p.field[zone] = { ...inst, hasAttacked: false, summonedTurn: state.turn, position: 'defense', faceDown: false, positionChangedTurn: null }
    addLog(state, playerId, 'summon', `🐎 ลงจากหลัง: ${cardOf(inst).name} กลับจากสุสาน ท่าตั้งรับ ลงช่องที่ ${zone + 1}`)
    return
  }
  if (choice.kind === 'scout') {
    const t = state.players[opponentOf(playerId)].spellTrap.find((x) => x?.uid === optionId)
    t.scoutedBy = { uid: choice.source, turn: state.turn }
    const scout = cardOf(p.field.find((m) => m?.uid === choice.source) ?? { cardId: 'th03-016' })
    // ผู้เล่นเห็นชื่อการ์ดที่ตัวเองดู · AI ดูการ์ดของผู้เล่นไม่ต้องเปิดเผยในบันทึก
    addLog(state, playerId, 'effect', `🦅 ${scout.name}: ${PLAYER_NAMES[playerId]}ดูการ์ดคว่ำของฝ่ายตรงข้าม 1 ใบ`, [
      playerId === PLAYER ? `เป็น "${cardOf(t).name}" — ใบนี้เปิดตอน ${scout.name} โจมตีไม่ได้จนจบเทิร์น` : `ใบนั้นเปิดตอน ${scout.name} โจมตีไม่ได้จนจบเทิร์น`,
    ])
    return
  }
  if (choice.kind === 'mill') {
    const source = getCardById(choice.source)
    if (optionId === 'skip') {
      addLog(state, playerId, 'effect', `${source.name}: ${PLAYER_NAMES[playerId]}ไม่ส่งการ์ดลงสุสาน`)
      return
    }
    const inst = p.deck.splice(p.deck.findIndex((c) => c.cardId === optionId), 1)[0]
    p.graveyard.push(inst)
    addLog(state, playerId, 'effect', `🪦 ${source.name}: ${PLAYER_NAMES[playerId]}ส่ง ${cardOf(inst).name} จากกองลงสุสาน`)
    return
  }
  // คืนชีพ
  const inst = p.graveyard.find((c) => c.uid === choice.uid)
  const card = cardOf(inst)
  const revive = getReviveOnGrave(card)
  p.revivedUids = [...(p.revivedUids ?? []), inst.uid]
  if (optionId === 'skip') {
    addLog(state, playerId, 'effect', `${PLAYER_NAMES[playerId]}ไม่คืนชีพ ${card.name}`)
    return
  }
  const details = []
  if (optionId === 'pay') {
    const before = p.lp
    p.lp -= revive.lpCost
    details.push(`จ่าย LP ${formatNumber(revive.lpCost)}: ${formatNumber(before)} − ${formatNumber(revive.lpCost)} = ${formatNumber(p.lp)}`)
  } else {
    const water = p.hand.splice(p.hand.findIndex((h) => h.cardId === revive.altCostCardId), 1)[0]
    p.graveyard.push(water)
    details.push(`ทิ้ง ${cardOf(water).name} ลงสุสาน`)
  }
  p.graveyard.splice(p.graveyard.findIndex((c) => c.uid === inst.uid), 1)
  const zone = p.field.indexOf(null)
  p.field[zone] = {
    ...inst,
    hasAttacked: false,
    summonedTurn: state.turn,
    position: revive.position,
    faceDown: false,
    positionChangedTurn: null,
  }
  addLog(state, playerId, 'summon', `💧 ${PLAYER_NAMES[playerId]}คืนชีพ ${card.name} ท่าตั้งรับ ลงช่องที่ ${zone + 1}`, details)
}

function specialSummon(state, playerId, uid, position = 'attack') {
  const blocker = specialSummonBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  if (position !== 'attack' && position !== 'defense') throw new GameRuleError('ท่าไม่ถูกต้อง')
  const p = state.players[playerId]
  const card = cardOf(p.hand.find((c) => c.uid === uid))
  const special = getSpecialSummon(card)
  if (special.returnId) {
    const zone = p.field.findIndex((m) => m?.cardId === special.returnId && !m.faceDown)
    const back = p.field[zone]
    p.field[zone] = null
    p.hand.push({ uid: back.uid, cardId: back.cardId })
    const inst = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1)[0]
    p.field[zone] = { ...inst, hasAttacked: false, summonedTurn: state.turn, position, faceDown: false, positionChangedTurn: null }
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${card.id}`]: state.turn }
    addLog(state, playerId, 'summon', `✨ ${PLAYER_NAMES[playerId]}คืน ${cardOf(back).name} ขึ้นมือ → อัญเชิญพิเศษ ${card.name} (ATK ${formatNumber(card.atk)}) ลงช่องที่ ${zone + 1}`)
    const call = special.callAfter
    if (call && p.field.includes(null)) {
      const present = p.field.filter((x) => x && !x.faceDown).flatMap((x) => animalSetOf(cardOf(x)))
      const candidates = p.hand.filter((h) => {
        const hc = cardOf(h)
        return call.matches(hc) && (!call.newTribeOnly || !animalSetOf(hc).some((t) => present.includes(t)))
      })
      if (candidates.length) {
        queueChoice(state, {
          player: playerId,
          kind: 'summonFromHand',
          source: card.id,
          prompt: `${card.name}: เรียก${call.label}จากมือมาช่วยไหม? (ท่าตั้งรับ โจมตีไม่ได้เทิร์นนี้)`,
          options: [...candidates.map((h) => ({ id: h.uid, label: cardOf(h).name })), { id: 'skip', label: 'ไม่เรียก' }],
        })
      }
    }
    return
  }
  const tributeZone = p.field.findIndex((m) => m?.cardId === special.tributeId)
  const tribute = p.field[tributeZone]
  p.field[tributeZone] = null
  p.graveyard.push({ uid: tribute.uid, cardId: tribute.cardId })
  const inst = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1)[0]
  p.field[tributeZone] = {
    ...inst,
    hasAttacked: false,
    summonedTurn: state.turn,
    position,
    faceDown: false,
    positionChangedTurn: null,
  }
  const drawn = p.deck.splice(0, special.draw)
  p.hand.push(...drawn)
  addLog(
    state,
    playerId,
    'summon',
    `✨ ${PLAYER_NAMES[playerId]}สังเวย ${cardOf(tribute).name} → อัญเชิญพิเศษ ${card.name} (ATK ${formatNumber(card.atk)} / DEF ${formatNumber(card.def)}) ลงช่องที่ ${tributeZone + 1}`,
    [drawn.length ? `จั่วการ์ด ${drawn.length} ใบ` : 'กองการ์ดหมด จั่วไม่ได้']
  )
}

function activateContinuousTrap(state, playerId, uid) {
  const blocker = trapActivationBlocker(state, playerId, uid)
  if (blocker) throw new GameRuleError(blocker)
  const t = state.players[playerId].spellTrap.find((x) => x?.uid === uid)
  t.faceDown = false
  const aura = getContinuousTrap(cardOf(t)).aura
  addLog(state, playerId, 'trap', `🥁 ${PLAYER_NAMES[playerId]}เปิดกับดักต่อเนื่อง ${cardOf(t).name}`, [
    `${aura.reason}: ทหารหาญและสัตว์ใหญ่ของเรา ATK/DEF +${formatNumber(aura.amount)}`,
  ])
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
 *   trapActivated: [{ player, uid, cardId, zone, wasFaceDown, effect }]  กับดักที่ถูกเปิดใช้ (พลิกหงาย)
 *                  effect: 'negate' | 'thorns' | 'weaken' | 'drum' | 'continuous'
 *                  (กับดักที่เปิดตอบโต้การโจมตีลงสุสานทันที — ใช้ zone หาตำแหน่งช่องเดิม)
 *   showcase: { player, cardId, kind, label, resultCardId, materialCardIds } | null  การ์ดที่ "ใช้" (โชว์กลางจอ)
 *             materialCardIds = วัตถุดิบ/เครื่องสังเวย (ผสาน: 2 ใบ · ขึ้นขี่: [คน, สัตว์] · พิธี: หลายใบ) หรือ []
 *             kind: 'spell' | 'field' | 'equip' | 'fusion' | 'ritual' | 'effect' | 'special' | 'mount' | 'evolve'
 *                   | 'dismount' (cardId = ร่างขี่ที่ถูกทำลาย · resultCardId = วัตถุดิบที่กลับลงสนาม)
 *             resultCardId = มอนสเตอร์ที่ได้ (ผสาน/พิธี/ขึ้นขี่/เลื่อนยศ/อัญเชิญพิเศษ) หรือ null
 * }
 * การโจมตีที่ต้องรอกับดัก: บันทึกตอนประกาศเป็น kind 'pending' (ไม่มี event)
 * แล้ว event มาพร้อมผล (type 'attack' หรือ 'attackNegated') หลังฝ่ายรับตัดสินใจ
 * ทุก uid ตรงกับ data-uid บนหน้าจอ ใช้หาตำแหน่งการ์ดได้
 */
function attachEvent(prev, next, action) {
  const entry = next.log
    .slice(prev.log.length)
    .find((e) => ['summon', 'position', 'battle', 'discard', 'effect', 'spell', 'trap', 'evolve'].includes(e.kind))
  if (!entry || entry.event) return
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
  const showcase = buildShowcase(prev, action, placed)
  const trapActivated = []
  const trapAt = (playerId, uid) => {
    const zone = prev.players[playerId].spellTrap.findIndex((t) => t?.uid === uid)
    return zone === -1 ? null : { zone, inst: prev.players[playerId].spellTrap[zone] }
  }
  const respondOption = isRespond ? pending.options?.find((o) => o.id === action.trapUid) : null
  if (respondOption?.trapUid) {
    const found = trapAt(pending.responder, respondOption.trapUid)
    if (found) {
      trapActivated.push({
        player: pending.responder,
        uid: found.inst.uid,
        cardId: found.inst.cardId,
        zone: found.zone,
        wasFaceDown: Boolean(found.inst.faceDown),
        effect: respondOption.kind,
      })
    }
  }
  if (action.type === 'activateTrap') {
    const found = trapAt(action.player, action.uid)
    if (found) {
      trapActivated.push({
        player: action.player,
        uid: found.inst.uid,
        cardId: found.inst.cardId,
        zone: found.zone,
        wasFaceDown: true,
        effect: 'continuous',
      })
    }
  }
  // เปิดกับดักแล้วการโจมตีอาจยังดำเนินต่อ (ม่านควัน / กลองศึกที่เป้ายังอยู่) — ดูจากบันทึกผล
  const negated = isRespond && Boolean(action.trapUid) && entry.text.includes('ถูกยกเลิก')
  entry.event = {
    type: isRespond ? (negated ? 'attackNegated' : 'attack') : action.type,
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
    trapActivated,
    showcase,
  }
}

// การ์ดที่ผู้เล่น "ใช้" ในแอ็กชันนี้ — ชั้นแอนิเมชันโชว์การ์ดกลางจอเหมือนตอนเปิดกับดัก
function buildShowcase(prev, action, placed) {
  const pl = prev.players[action.player]
  if (!pl) return null
  const find = (uid) =>
    [...pl.hand, ...pl.field.filter(Boolean), ...pl.extraDeck, ...pl.spellTrap.filter(Boolean), ...pl.graveyard].find(
      (c) => c.uid === uid
    )
  const result = placed.find((x) => x.player === action.player)?.cardId ?? null
  const materials = (uids = []) => uids.map((uid) => find(uid)?.cardId).filter(Boolean)
  const make = (inst, kind, label, materialCardIds = []) =>
    inst ? { player: action.player, cardId: inst.cardId, kind, label, resultCardId: result, materialCardIds } : null
  if (action.type === 'playSpell') {
    const card = cardOf(find(action.uid))
    if (card.type === 'ritual') return make(find(action.uid), 'ritual', '🙏 พิธีอัญเชิญ', materials(action.tributes))
    if (getFusionSpell(card)) return make(find(action.uid), 'fusion', '🌀 ผสานร่าง', materials(action.tributes))
    if (isFieldSpell(card)) return make(find(action.uid), 'field', '🏞️ เวทสนาม')
    if (getEquip(card)) return make(find(action.uid), 'equip', '🗡️ เวทสวมใส่')
    return make(find(action.uid), 'spell', '✨ ใช้เวทมนตร์')
  }
  if (action.type === 'activate') {
    const inst = find(action.uid)
    return make(inst, 'effect', `✨ ${getActivated(cardOf(inst))?.label ?? 'ใช้ความสามารถ'}`)
  }
  if (action.type === 'specialSummon') return make(find(action.uid), 'special', '✨ อัญเชิญพิเศษ')
  if (action.type === 'mount') {
    // เรียง [คน, สัตว์] ตามสูตรร่างขี่ — ฝั่งแอนิเมชันให้คนกระโดดขึ้นหลังสัตว์
    const [human] = getFusionMaterials(cardOf(find(action.fusionUid)))
    const pair = materials(action.materials)
    const ordered = human.matches(getCardById(pair[0])) ? pair : [...pair].reverse()
    return make(find(action.fusionUid), 'mount', '🐎 ขึ้นขี่', ordered)
  }
  if (action.type === 'evolve') return make(find(action.uid), 'evolve', '🎖️ เลื่อนยศ')
  if (action.type === 'choose' && prev.pendingChoice?.kind === 'dismount' && action.optionId !== 'skip') {
    return make(find(prev.pendingChoice.source), 'dismount', '🐎 ลงจากหลัง')
  }
  return null
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
  const onlyBy = getSummonOnlyBy(card)
  if (onlyBy) throw new GameRuleError(`${card.name} อัญเชิญได้ด้วย "${getCardById(onlyBy).name}" เท่านั้น`)

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

  if (!faceDown) onSummoned(state, playerId, card)
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

// ทำลายมอนสเตอร์ (ต่อสู้/เอฟเฟกต์) — ไม่ใช้กับการสังเวยหรือส่งลงสุสานเฉย ๆ
function destroyMonster(state, playerId, uid, details = []) {
  const p = state.players[playerId]
  const zone = p.field.findIndex((m) => m?.uid === uid)
  const m = p.field[zone]
  const card = cardOf(m)
  if (m.curse && m.curse.until >= state.turn) {
    effectDamage(state, playerId, m.curse.amount, details, `🕯️ คำสาป: ${card.name} ถูกทำลาย`)
  }
  p.field[zone] = null
  p.graveyard.push({ uid: m.uid, cardId: m.cardId })
  // ร่างขี่: ลงจากหลัง → เลือกคืนวัตถุดิบ 1 ตัวจากสุสาน (ใบละครั้งต่อเกม)
  if (canDismount(card) && m.materials && !(p.dismountedUids ?? []).includes(m.uid)) {
    const back = m.materials
      .map((mUid) => p.graveyard.find((g) => g.uid === mUid))
      .filter((g) => g && !getSummonOnlyBy(cardOf(g)))
    if (back.length) {
      queueChoice(state, {
        player: playerId,
        kind: 'dismount',
        source: m.uid,
        prompt: `${card.name} ถูกทำลาย — ลงจากหลัง: คืนวัตถุดิบ 1 ตัวท่าตั้งรับ`,
        options: [...back.map((g) => ({ id: g.uid, label: cardOf(g).name })), { id: 'skip', label: 'ไม่คืน' }],
      })
    }
  }
  const ret = getReturnOnDestroy(card)
  if (ret && !(p.returnedUids ?? []).includes(m.uid)) {
    p.pendingReturns = [...(p.pendingReturns ?? []), m.uid]
    details.push(`🔁 ${ret.reason}: ${card.name} จะกลับมาท่าตั้งรับตอนจบเทิร์นนี้`)
  }
}

// ความเสียหายจากเอฟเฟกต์ (ไม่ผ่านการลดความเสียหายจากการต่อสู้)
function effectDamage(state, playerId, amount, details, reason) {
  const p = state.players[playerId]
  const before = p.lp
  p.lp = Math.max(0, before - amount)
  details.push(
    `${reason} → ${PLAYER_NAMES[playerId]}เสีย LP ${formatNumber(amount)}: ${formatNumber(before)} − ${formatNumber(amount)} = ${formatNumber(p.lp)}`
  )
  if (p.lp === 0 && !state.winner) {
    state.winner = opponentOf(playerId)
    state.endReason = 'lp'
    state.phase = 'over'
  }
}

function attack(state, playerId, attackerUid, targetUid) {
  if (state.phase !== 'battle') throw new GameRuleError('โจมตีได้เฉพาะเฟสต่อสู้')
  const me = state.players[playerId]
  const oppId = opponentOf(playerId)
  const opp = state.players[oppId]

  const attacker = me.field.find((m) => m?.uid === attackerUid)
  if (!attacker) throw new GameRuleError('ไม่พบมอนสเตอร์ที่จะโจมตี')
  if (attacker.position === 'defense') throw new GameRuleError('มอนสเตอร์ท่าตั้งรับโจมตีไม่ได้')
  if (isAttackLocked(state, attacker)) throw new GameRuleError('มอนสเตอร์ตัวนี้ถูกห้ามโจมตีในเทิร์นนี้')
  if (targetUid === null && hasNoDirectAttack(cardOf(attacker))) {
    throw new GameRuleError(`${cardOf(attacker).name} โจมตีตรงไม่ได้`)
  }
  if (!canDeclareAttack(state, playerId, attacker)) {
    throw new GameRuleError('มอนสเตอร์ตัวนี้โจมตีไปแล้วในเทิร์นนี้')
  }

  const attackerCard = cardOf(attacker)
  const details = []
  const attackNo = attacksMade(attacker) + 1

  let defender = null
  if (targetUid === null) {
    if (!canAttackDirectly(state, playerId, attackerUid)) {
      throw new GameRuleError('โจมตีตรงได้เมื่อฝ่ายตรงข้ามไม่มีมอนสเตอร์บนสนามเท่านั้น')
    }
  } else {
    defender = opp.field.find((m) => m?.uid === targetUid)
    if (!defender) throw new GameRuleError('ไม่พบมอนสเตอร์เป้าหมาย')
    if (!getAttackableTargets(state, playerId).some((m) => m.uid === targetUid)) {
      const guard = getAttackableTargets(state, playerId)[0]
      throw new GameRuleError(`ต้องโจมตี ${cardOf(guard).name} ก่อน (${getTaunt(cardOf(guard)).reason.split(': ')[1] ?? 'เฝ้าทาง'})`)
    }
  }

  attacker.attackCount = attackNo
  attacker.hasAttacked = true
  if (attackNo > 1) details.push(`⚔️ โจมตีครั้งที่ ${attackNo}: ${getExtraAttack(attackerCard).reason}`)

  // จังหวะตอบโต้ของฝ่ายรับ: หยุดรอให้ฝ่ายรับตัดสินใจก่อนคำนวณ (การโจมตีนับว่าใช้สิทธิ์แล้ว)
  const options = getTrapResponses(state, oppId, attacker, defender)
  if (options.length > 0) {
    state.pendingResponse = {
      responder: oppId,
      attacker: playerId,
      attackerUid,
      targetUid,
      trapUids: options.filter((o) => o.kind !== 'drum').map((o) => o.id),
      options,
      details,
    }
    const what = defender ? cardOf(defender).name : `${PLAYER_NAMES[oppId]}โดยตรง`
    addLog(state, playerId, 'pending', `⚔️ ${attackerCard.name} ประกาศโจมตี ${what} — รอ${PLAYER_NAMES[oppId]}ตัดสินใจเปิดกับดัก`)
    return
  }
  if (defender) resolveMonsterAttack(state, playerId, attacker, defender, details)
  else resolveDirectAttack(state, playerId, attacker, details)
}

function resolveDirectAttack(state, playerId, attacker, details) {
  const oppId = opponentOf(playerId)
  const attackerCard = cardOf(attacker)
  const oppField = state.players[oppId].field
  if (oppField.some((m) => m && !m.faceDown)) {
    details.push('ศัตรูมีมอนสเตอร์หงายหน้าแล้ว → การโจมตีตรงจบโดยไม่มีความเสียหาย')
    applyAttackDecay(state, playerId, attacker.uid, details)
    addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตีตรง — ไม่สำเร็จ`, details)
    return
  }
  if (oppField.some(Boolean)) details.push(`🦇 ${getFlyOver(attackerCard).reason} → บินข้ามการ์ดคว่ำ`)
  const allies = getAllies(state, playerId, attacker.uid)
  const enemies = getAllies(state, oppId, null)
  const extras = attackExtras(state, playerId, attacker)
  const boosts = getAtkBoosts(attackerCard, allies, enemies, extras)
  const power = getEffectiveAtk(attackerCard, allies, enemies, extras)
  const boostText = boosts
    .map((b) => `${b.amount < 0 ? ' − ' : ' + '}${formatNumber(Math.abs(b.amount))} (${b.label}: ${b.reason})`)
    .join('')
  details.push(
    `${oppField.some(Boolean) ? '' : 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ → '}โจมตีตรงด้วย ATK ${formatNumber(attackerCard.atk)}${boostText ? `${boostText} = ${formatNumber(power)}` : ''}`
  )
  damagePlayer(state, oppId, power, details, { opposingMonster: attackerCard })
  applyAttackDecay(state, playerId, attacker.uid, details)
  addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตีตรง${PLAYER_NAMES[oppId]}!`, details)
  logLpKnockout(state)
}

// กับดักของ defenderId ที่เปิดตอบโต้การโจมตีนี้ได้ (กับดักต้องวางไว้ก่อนเทิร์นนี้)
// ตัวเลือกตอบโต้ของ defenderId ต่อการโจมตีนี้ (target = null คือโจมตีตรง)
// กับดักต้องวางไว้ก่อนเทิร์นนี้ · ขุนศึกอาทมาฏโจมตี = เปิดกับดักไม่ได้
// เสือสมิง: ถูกโจมตีจนพลิกหงาย → เปลี่ยนเป็นท่าโจมตีถ้าจะชนะ (+โบนัสเมื่อมีสัตว์ต่างเผ่า)
function tryAmbushFlip(state, attackerOwner, attacker, defender, details) {
  const card = cardOf(defender)
  const ambush = getAmbushFlip(card)
  if (!ambush || defender.position !== 'defense' || defender.positionLockTurn >= state.turn) return
  const ownerId = opponentOf(attackerOwner)
  const own = animalSetOf(card)
  const diverse = getAllies(state, ownerId, defender.uid).some((a) => {
    const set = animalSetOf(a)
    return set.length > 0 && !set.some((t) => own.includes(t))
  })
  defender.position = 'attack'
  if (diverse) defender.tempAtk = [...(defender.tempAtk ?? []), { amount: ambush.bonus, reason: ambush.reason, battleOnly: true }]
  // เลือกให้อัตโนมัติ: เปลี่ยนท่าเฉพาะเมื่อจะชนะการต่อสู้นี้
  if (previewBattle(state, attackerOwner, attacker.uid, defender.uid).outcome !== 'defender') {
    defender.position = 'defense'
    if (defender.tempAtk) defender.tempAtk = defender.tempAtk.filter((x) => !x.battleOnly)
    return
  }
  details.push(`🐅 ${card.name} พลิกซุ่ม: เปลี่ยนเป็นท่าโจมตี${diverse ? ` (+${formatNumber(ambush.bonus)} มีสัตว์ต่างเผ่า)` : ''}`)
}

function getTrapResponses(state, defenderId, attacker, target) {
  const attackerCard = cardOf(attacker)
  const p = state.players[defenderId]
  const options = []
  for (const t of hasTrapLock(attackerCard) ? [] : p.spellTrap) {
    if (!t) continue
    const card = cardOf(t)
    const trap = getTrapEffect(card)
    // โหราจารย์ทรงนกเงือกดูกับดักใบนี้แล้ว → เปิดตอนใบนั้นโจมตีไม่ได้จนจบเทิร์น
    const scouted = t.scoutedBy?.uid === attacker.uid && t.scoutedBy.turn === state.turn
    if (trap && t.faceDown && t.setTurn < state.turn && !scouted) {
      const fits =
        trap.trigger === 'enemyAttacks' ||
        (trap.trigger === 'enemyAttacksFaceUp' && target && !target.faceDown && trap.appliesTo(cardOf(target)))
      if (fits && trap.effect === 'swap') {
        // สับแนวพงไพร: ตัวเลือกละ 1 ใบในมือที่ส่งลงแทนได้ (สัตว์ระดับ 1–4 ชื่ออื่น)
        if ((p.usedEffects ?? {})[`name:${card.id}`] !== state.turn) {
          for (const h of p.hand) {
            const hc = cardOf(h)
            if (hc.type !== 'monster' || !animalSetOf(hc).length || hc.level > 4 || h.cardId === target.cardId) continue
            options.push({ id: `swap:${t.uid}:${h.uid}`, kind: 'swap', trapUid: t.uid, handUid: h.uid, label: `🪤 ${card.name}: ส่ง ${hc.name} แทน` })
          }
        }
      } else if (fits) options.push({ id: t.uid, kind: trap.effect, trapUid: t.uid, label: `🪤 เปิด ${card.name}` })
    }
    const drum = getContinuousTrap(card)?.drumFusion
    if (drum && !t.faceDown) {
      for (const fusion of p.extraDeck) {
        const pair = findFieldFusionPair(p, cardOf(fusion), drum.pair)
        if (pair) {
          options.push({
            id: `drum:${t.uid}:${fusion.uid}`,
            kind: 'drum',
            trapUid: t.uid,
            fusionUid: fusion.uid,
            materials: pair,
            label: `🥁 ส่ง${card.name}ลงสุสาน ผสานเป็น ${cardOf(fusion).name}`,
          })
        }
      }
    }
  }
  // หลวงตาธุดงค์: สัตว์ศัตรูโจมตีสัตว์ตัวอื่นของเรา → ยกเลิกได้ (ชื่อละครั้งต่อเทิร์น)
  const isAnimalInst = (inst) => animalSetOf(cardOf(inst)).length > 0
  if (target && !target.faceDown && isAnimalInst(target) && animalSetOf(attackerCard).length > 0) {
    const monk = p.field.find((x) => x && !x.faceDown && x.uid !== target.uid && getMercy(cardOf(x)))
    if (monk && (p.usedEffects ?? {})[`name:${monk.cardId}`] !== state.turn) {
      options.push({ id: `mercy:${monk.uid}`, kind: 'mercy', monkUid: monk.uid, label: `🐅 ${cardOf(monk).name}: ยกเลิกการโจมตี` })
    }
  }
  // ผีเรือน: รับการโจมตีแทนผีหงายตัวอื่น (ไม่ใช่กับดัก จึงใช้ได้แม้ขุนศึกอาทมาฏโจมตี)
  if (target && !target.faceDown && cardHasTribe(cardOf(target), 'ghost')) {
    for (const g of p.field) {
      if (!g || g.faceDown || g.uid === target.uid || !getAttackGuard(cardOf(g))) continue
      if ((p.usedEffects ?? {})[`card:${g.uid}`] === state.turn) continue
      options.push({ id: `guard:${g.uid}`, kind: 'guard', guardUid: g.uid, label: `🏠 ${cardOf(g).name} รับการโจมตีแทน` })
    }
  }
  return options
}

// คู่วัตถุดิบบนสนาม (ใบหนึ่งเข้า pair[0] อีกใบเข้า pair[1]) ที่ผสานเป็น fusionCard ได้
function findFieldFusionPair(p, fusionCard, pair) {
  const field = p.field.filter(Boolean)
  for (const a of field) {
    for (const b of field) {
      if (a === b) continue
      const ca = cardOf(a)
      const cb = cardOf(b)
      if (pair[0](ca) && pair[1](cb) && matchesFusion(fusionCard, [ca, cb])) return [a.uid, b.uid]
    }
  }
  return null
}
// ทำลายจากการต่อสู้ (การ์ดที่ไม่ถูกทำลายจากการต่อสู้จะรอด) — คืน true ถ้าถูกทำลายจริง
// รอดการต่อสู้: การ์ดที่ไม่ถูกทำลายจากการต่อสู้ หรือผีเรือนที่รับการโจมตีแทน
const survivesBattle = (inst) => isBattleIndestructible(cardOf(inst)) || Boolean(inst.guardShield)
// ต้นไทร: มีแต้มเติบโต → ถอน 1 แต้มแทนการถูกทำลาย
const rootSaves = (inst) => Boolean(hasRootShield(cardOf(inst)) && !inst.faceDown && inst.growth > 0)

function battleDestroy(state, ownerId, monster, details) {
  if (survivesBattle(monster)) return false
  if (rootSaves(monster)) {
    monster.growth -= 1
    details.push(`🌳 ${hasRootShield(cardOf(monster)).reason} (เหลือ ${monster.growth} แต้ม)`)
    return false
  }
  destroyMonster(state, ownerId, monster.uid, details)
  return true
}

// ฝูงต่อ: ถูกทำลายตอนเป็นฝ่ายรับ → ผู้โจมตี ATK ลดจนจบเทิร์น
function applySting(state, attackerOwner, attacker, victimCard, details) {
  const sting = getSting(victimCard)
  if (!sting || !state.players[attackerOwner].field.some((m) => m?.uid === attacker.uid)) return
  attacker.tempAtk = [...(attacker.tempAtk ?? []), { amount: sting.amount, reason: sting.reason }]
  details.push(`🐝 ${sting.reason}: ${cardOf(attacker).name} ATK ${formatNumber(sting.amount)} จนจบเทิร์น`)
}

// คำสาปตอนตาย: การ์ดที่ถูกทำลายจากการต่อสู้สาปตัวที่ทำลายมัน (ทำลายตาม หรือ ATK เหลือครึ่งถาวร)
function applyDeathCurse(state, killerOwner, killer, victimCard, details) {
  const curse = getDeathCurse(victimCard)
  if (!curse || !state.players[killerOwner].field.some((m) => m?.uid === killer.uid)) return
  const name = cardOf(killer).name
  if (curse.mode === 'lock') {
    // ถึงจบเทิร์นถัดไปของผู้ควบคุมตัวที่ทำลาย (ตาเขาอยู่ตอนนี้ = ข้ามไปอีกรอบ)
    const until = killerOwner === state.activePlayer ? state.turn + 2 : state.turn + 1
    killer.cannotAttackUntil = Math.max(killer.cannotAttackUntil ?? 0, until)
    details.push(`👻 ${curse.reason}: ${name} โจมตีไม่ได้ถึงจบเทิร์นถัดไปของเจ้าของ`)
    return
  }
  if (curse.mode === 'destroy') {
    if (effectDestroy(state, killerOwner, killer.uid, details)) details.push(`👻 ${curse.reason}: ${name} ถูกทำลายตาม`)
    return
  }
  const before = getFieldAtk(state, killerOwner, killer.uid)
  // เหลือครึ่งปัดลง: 1,001 → 500 (หักออก = ส่วนที่เหลือปัดขึ้น)
  const cut = before - Math.floor(before / 2)
  killer.statMods = [...(killer.statMods ?? []), { atk: -cut, until: Number.MAX_SAFE_INTEGER, reason: curse.reason }]
  details.push(`👻 ${curse.reason}: ${name} ATK ${formatNumber(before)} → ${formatNumber(before - cut)} (ถาวร)`)
}

// ชนะการต่อสู้ (ทำลายศัตรูได้): แต้มประสบการณ์ + สายฟ้าฟาดซ้ำ + พรานไสยเวทส่งผีจากกองลงสุสาน
function onBattleWin(state, ownerId, monster, details) {
  awardXp(state, monster, details)
  const card = cardOf(monster)
  const burn = getBurnOnKill(card)
  if (burn) effectDamage(state, opponentOf(ownerId), burn.amount, details, `⚡ ${burn.reason}`)
  const mill = getMillOnKill(card)
  if (!mill) return
  const ids = [...new Set(state.players[ownerId].deck.filter((c) => mill.matches(cardOf(c))).map((c) => c.cardId))]
  if (ids.length === 0) return
  queueChoice(state, {
    player: ownerId,
    kind: 'mill',
    source: card.id,
    prompt: `${card.name}: ส่ง${mill.label}จากกองลงสุสาน 1 ใบไหม?`,
    options: [...ids.map((id) => ({ id, label: getCardById(id).name })), { id: 'skip', label: 'ไม่ส่ง' }],
  })
}

const fallText = (card, inst) =>
  survivesBattle(inst) || rootSaves(inst) ? `${card.name} ไม่ถูกทำลาย (กันการทำลายจากการต่อสู้)` : `${card.name} ถูกทำลาย`

function resolveMonsterAttack(state, playerId, attacker, defender, details) {
  const oppId = opponentOf(playerId)
  const attackerCard = cardOf(attacker)
  const defenderCard = cardOf(defender)

  // เปิดการ์ดคว่ำก่อนคำนวณ เอฟเฟกต์ของการ์ดที่เพิ่งเปิดจึงมีผลในการต่อสู้นี้
  if (defender.faceDown) {
    defender.faceDown = false
    details.push(`เปิดการ์ดคว่ำ: ${defenderCard.name} (DEF ${formatNumber(defenderCard.def)})`)
    tryAmbushFlip(state, playerId, attacker, defender, details)
  }
  const inDefense = defender.position === 'defense'
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
        details.push(`ATK ${a} > DEF ${d} → ${fallText(defenderCard, defender)}`)
        details.push(
          pierce.ratio === 1
            ? `${attackerCard.name} ${pierce.reason}: ${a} − ${d} = ${formatNumber(amount)}`
            : `${attackerCard.name} ${pierce.reason}: (${a} − ${d}) ÷ ${1 / pierce.ratio} = ${formatNumber(amount)}`
        )
        hitDefenderOwner(amount)
      } else {
        details.push(`ATK ${a} > DEF ${d} → ${fallText(defenderCard, defender)} (ท่าตั้งรับ ไม่เสีย LP)`)
      }
      if (battleDestroy(state, oppId, defender, details)) {
        onBattleWin(state, playerId, attacker, details)
        applySting(state, playerId, attacker, defenderCard, details)
        applyDeathCurse(state, playerId, attacker, defenderCard, details)
      }
    } else if (result.outcome === 'defender') {
      details.push(`ATK ${a} < DEF ${d} → ตีไม่ผ่าน ไม่มีใครถูกทำลาย (ส่วนต่าง ${d} − ${a} = ${diff})`)
      hitAttackerOwner(result.damage)
    } else {
      details.push(`ATK ${a} = DEF ${d} → ไม่มีอะไรเกิดขึ้น`)
    }
  } else if (result.outcome === 'attacker') {
    details.push(`${a} > ${d} → ${fallText(defenderCard, defender)} (ส่วนต่าง ${a} − ${d} = ${diff})`)
    hitDefenderOwner(result.damage)
    if (battleDestroy(state, oppId, defender, details)) {
        onBattleWin(state, playerId, attacker, details)
        applySting(state, playerId, attacker, defenderCard, details)
        applyDeathCurse(state, playerId, attacker, defenderCard, details)
      }
  } else if (result.outcome === 'defender') {
    details.push(`${a} < ${d} → ${fallText(attackerCard, attacker)} (ส่วนต่าง ${d} − ${a} = ${diff})`)
    hitAttackerOwner(result.damage)
    if (battleDestroy(state, playerId, attacker, details)) {
      onBattleWin(state, oppId, defender, details)
      applyDeathCurse(state, oppId, defender, attackerCard, details)
    }
  } else {
    const anySurvives = survivesBattle(attacker) || survivesBattle(defender)
    details.push(
      anySurvives
        ? `${a} = ${d} → เสมอ ${fallText(attackerCard, attacker)} · ${fallText(defenderCard, defender)} · ไม่มีใครเสีย LP`
        : `${a} = ${d} → เสมอ ทำลายทั้งคู่ ไม่มีใครเสีย LP`
    )
    const attackerDied = battleDestroy(state, playerId, attacker, details)
    const defenderDied = battleDestroy(state, oppId, defender, details)
    // เสมอแต่อีกฝ่ายรอด (เช่น จอมทัพ) → คำสาปของตัวที่ตายยังเกิด · ตายทั้งคู่ไม่มีเป้าให้สาป
    if (attackerDied && !defenderDied) applyDeathCurse(state, oppId, defender, attackerCard, details)
    if (defenderDied && !attackerDied) applyDeathCurse(state, playerId, attacker, defenderCard, details)
  }

  // เอฟเฟกต์หลังคำนวณความเสียหาย: ทำลายคู่ต่อสู้ตามเผ่า (ถ้ายังอยู่บนสนาม)
  for (const [card, foe, foeOwner, foeUid] of [
    [attackerCard, defenderCard, oppId, defender.uid],
    [defenderCard, attackerCard, playerId, attacker.uid],
  ]) {
    const effect = getAfterBattleDestroy(card, foe)
    if (effect && state.players[foeOwner].field.some((m) => m?.uid === foeUid)) {
      if (effectDestroy(state, foeOwner, foeUid, details)) details.push(`${effect.reason}: ${foe.name} ถูกทำลาย`)
    }
  }

  // บัฟเฉพาะการต่อสู้นี้ (เสือสมิง) หมดผล
  for (const inst of [attacker, defender]) {
    if (inst.tempAtk) inst.tempAtk = inst.tempAtk.filter((x) => !x.battleOnly)
  }
  applyAttackDecay(state, playerId, attacker.uid, details)
  const target = `${defenderCard.name}${inDefense ? ' (ท่าตั้งรับ)' : ''}`
  addLog(state, playerId, 'battle', `⚔️ ${attackerCard.name} โจมตี ${target}`, details)
  logLpKnockout(state)
}

function respond(state, playerId, optionId) {
  const pending = state.pendingResponse
  if (!pending) throw new GameRuleError('ไม่มีการโจมตีที่รอการตอบโต้')
  const options = pending.options ?? pending.trapUids.map((id) => ({ id, kind: 'negate', trapUid: id }))
  const option = optionId === null ? null : options.find((o) => o.id === optionId)
  if (optionId !== null && !option) throw new GameRuleError('กับดักใบนี้เปิดตอบโต้การโจมตีนี้ไม่ได้')
  state.pendingResponse = null
  const attackerOwner = pending.attacker
  const attacker = state.players[attackerOwner].field.find((m) => m?.uid === pending.attackerUid)
  const defender = pending.targetUid ? state.players[playerId].field.find((m) => m?.uid === pending.targetUid) : null
  const details = pending.details
  const continueAttack = () =>
    defender
      ? resolveMonsterAttack(state, attackerOwner, attacker, defender, details)
      : resolveDirectAttack(state, attackerOwner, attacker, details)

  if (!option) {
    details.push(`${PLAYER_NAMES[playerId]}ไม่เปิดกับดัก`)
    continueAttack()
    return
  }

  const p = state.players[playerId]
  if (option.kind === 'mercy') {
    const monk = p.field.find((m) => m?.uid === option.monkUid)
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${monk.cardId}`]: state.turn }
    details.push(`🐅 ${PLAYER_NAMES[playerId]}ใช้ ${cardOf(monk).name}: ${getMercy(cardOf(monk)).reason} → ยกเลิกการโจมตี`)
    applyAttackDecay(state, attackerOwner, pending.attackerUid, details)
    addLog(state, attackerOwner, 'battle', `⚔️ ${cardOf(attacker).name} โจมตี ${cardOf(defender).name} — ถูกยกเลิก (เมตตา)`, details)
    return
  }
  if (option.kind === 'guard') {
    const guard = p.field.find((m) => m?.uid === option.guardUid)
    p.usedEffects = { ...(p.usedEffects ?? {}), [`card:${guard.uid}`]: state.turn }
    guard.guardShield = true
    details.push(`🏠 ${PLAYER_NAMES[playerId]}ใช้ ${cardOf(guard).name} รับการโจมตีแทน ${cardOf(defender).name}`)
    resolveMonsterAttack(state, attackerOwner, attacker, guard, details)
    delete guard.guardShield
    return
  }
  const zone = p.spellTrap.findIndex((t) => t?.uid === option.trapUid)
  const trapInst = p.spellTrap[zone]
  p.spellTrap[zone] = null
  p.graveyard.push({ uid: trapInst.uid, cardId: trapInst.cardId })
  const trapCard = cardOf(trapInst)
  const attackerName = cardOf(attacker).name
  const targetName = defender ? cardOf(defender).name : PLAYER_NAMES[playerId]

  if (option.kind === 'drum') {
    // กลองศึก: ผสานร่างทหารหาญ + สัตว์ใหญ่บนสนามทันที
    const materialText = option.materials.map((uid) => sendMaterialToGrave(p, uid))
    const fusionInst = p.extraDeck.splice(p.extraDeck.findIndex((c) => c.uid === option.fusionUid), 1)[0]
    const fusionZone = p.field.indexOf(null)
    p.field[fusionZone] = {
      ...fusionInst,
      hasAttacked: false,
      summonedTurn: state.turn,
      position: 'attack',
      faceDown: false,
      positionChangedTurn: null,
    }
    details.push(
      `🥁 ${PLAYER_NAMES[playerId]}ส่ง ${trapCard.name} ลงสุสาน → ผสานร่าง ${cardOf(fusionInst).name} ลงช่องที่ ${fusionZone + 1}`,
      `วัตถุดิบ: ${materialText.join(' + ')}`
    )
    const targetStillThere = defender && p.field.some((m) => m?.uid === defender.uid)
    if (targetStillThere) {
      continueAttack()
      return
    }
    details.push('เป้าหมายเปลี่ยนไป → การโจมตีถูกยกเลิก')
    applyAttackDecay(state, attackerOwner, pending.attackerUid, details)
    addLog(state, attackerOwner, 'battle', `⚔️ ${attackerName} โจมตี ${targetName} — ถูกยกเลิก (กลองศึก)`, details)
    return
  }

  if (option.kind === 'swap') {
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${trapCard.id}`]: state.turn }
    const zone = p.field.findIndex((m) => m?.uid === defender.uid)
    p.field[zone] = null
    p.hand.push({ uid: defender.uid, cardId: defender.cardId })
    const [inst] = p.hand.splice(p.hand.findIndex((h) => h.uid === option.handUid), 1)
    p.field[zone] = { ...inst, hasAttacked: false, summonedTurn: state.turn, position: 'defense', faceDown: false, positionChangedTurn: null }
    details.push(
      `🪤 ${PLAYER_NAMES[playerId]}เปิดกับดัก ${trapCard.name}! · ${trapCard.name} ลงสุสาน`,
      `${cardOf(defender).name} กลับขึ้นมือ → ${cardOf(inst).name} ลงช่องที่ ${zone + 1} ท่าตั้งรับ · การโจมตีจบลง`
    )
    applyAttackDecay(state, attackerOwner, pending.attackerUid, details)
    addLog(state, attackerOwner, 'battle', `⚔️ ${attackerName} โจมตี ${targetName} — ถูกยกเลิก (สับแนว)`, details)
    onSummoned(state, playerId, cardOf(inst))
    return
  }

  if (option.kind === 'weaken') {
    const trap = getTrapEffect(trapCard)
    const before = getFieldAtk(state, attackerOwner, attacker.uid)
    attacker.tempAtk = [...(attacker.tempAtk ?? []), { amount: trap.amount, reason: trap.reason }]
    const after = getFieldAtk(state, attackerOwner, attacker.uid)
    details.push(
      `🪤 ${PLAYER_NAMES[playerId]}เปิดกับดัก ${trapCard.name}! · ${trapCard.name} ลงสุสาน`,
      `${trap.reason}: ${attackerName} ATK ${formatNumber(before)} − ${formatNumber(Math.abs(trap.amount))} = ${formatNumber(after)} · การโจมตีดำเนินต่อ`
    )
    continueAttack()
    return
  }

  if (option.kind === 'thorns') {
    const trap = getTrapEffect(trapCard)
    attacker.position = 'defense'
    attacker.faceDown = false
    details.push(`🪤 ${PLAYER_NAMES[playerId]}เปิดกับดัก ${trapCard.name}!`, `${trap.reason} · ${trapCard.name} ลงสุสาน`)
    applyAttackDecay(state, attackerOwner, pending.attackerUid, details)
    const ally = p.field.filter((m) => m && !m.faceDown).map(cardOf).find((c) => trap.destroyIfAlly(c))
    if (ally && effectDestroy(state, attackerOwner, attacker.uid, details)) {
      details.push(`มี${ally.name}บนสนาม → ${attackerName} ถูกทำลาย`)
    }
    addLog(state, attackerOwner, 'battle', `⚔️ ${attackerName} โจมตี ${targetName} — ถูกยกเลิกด้วยกับดัก`, details)
    return
  }

  details.push(
    `🪤 ${PLAYER_NAMES[playerId]}เปิดกับดัก ${trapCard.name}!`,
    `${getTrapEffect(trapCard).reason} → ไม่มีความเสียหาย ไม่มีใครถูกทำลาย`,
    `${attackerName} ใช้สิทธิ์โจมตีครั้งนี้ไปแล้ว · ${trapCard.name} ลงสุสาน`
  )
  applyAttackDecay(state, attackerOwner, pending.attackerUid, details)
  addLog(state, attackerOwner, 'battle', `⚔️ ${attackerName} โจมตี ${targetName} — ถูกยกเลิกด้วยกับดัก`, details)
}
// มอนสเตอร์ที่ชนะการต่อสู้ (ทำลายศัตรูได้และยังอยู่บนสนาม) ได้แต้มประสบการณ์ 1 แต้ม
function awardXp(state, monster, details) {
  const card = cardOf(monster)
  const evolve = getEvolve(card)
  if (!evolve) return
  const bonus = equipsOf(state, monster.uid).reduce((sum, e) => sum + (getEquip(cardOf(e))?.xpBonus ?? 0), 0)
  if (bonus) details.push(`🗡️ เวทสวมใส่ให้แต้มประสบการณ์เพิ่ม ${bonus} แต้ม`)
  monster.xp = (monster.xp ?? 0) + 1 + bonus
  const ready = monster.xp >= evolve.xpNeeded
  if (ready && monster.xpReadyTurn == null) monster.xpReadyTurn = state.turn
  const shown = Math.min(monster.xp, evolve.xpNeeded)
  const next = ready ? ` — เลื่อนยศเป็น ${getCardById(evolve.into).name} ได้ตั้งแต่เทิร์นถัดไปของเรา` : ''
  details.push(`⭐ ${card.name} ได้ประสบการณ์ ${1 + bonus} แต้ม (${shown}/${evolve.xpNeeded})${next}`)
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
    const needsDiscard = activated.discardCost !== false
    const handIndex = p.hand.findIndex((c) => c.uid === discardUid)
    if (needsDiscard && handIndex === -1) throw new GameRuleError('เลือกการ์ดในมือที่จะทิ้ง 1 ใบ')
    const oppId = opponentOf(playerId)
    const target = getActivationTargets(state, playerId, uid).find((x) => x.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์ที่หงายหน้าของฝ่ายตรงข้าม 1 ตัว')
    const before = getFieldAtk(state, oppId, target.uid)
    const discarded = needsDiscard ? p.hand.splice(handIndex, 1)[0] : null
    if (discarded) p.graveyard.push(discarded)
    target.tempAtk = [...(target.tempAtk ?? []), { amount: activated.amount, reason: activated.reason }]
    const after = getFieldAtk(state, oppId, target.uid)
    const targetCard = cardOf(target)
    const size = formatNumber(Math.abs(activated.amount))
    addLog(state, playerId, 'effect', `✨ ${card.name}: ${targetCard.name} ATK −${size} จนจบเทิร์น`, [
      ...(discarded ? [`${name}ทิ้ง ${cardOf(discarded).name} ลงสุสาน`] : []),
      `${targetCard.name}: ATK ${formatNumber(before)} − ${size} = ${formatNumber(after)}${after === 0 ? ' (ต่ำสุด 0)' : ''}`,
    ])
  }
  if (activated.kind === 'destroySpellsTraps') {
    const opp = state.players[opponentOf(playerId)]
    const destroyed = [...opp.spellTrap.filter(Boolean), ...(opp.fieldSpell ? [opp.fieldSpell] : [])]
    opp.spellTrap = opp.spellTrap.map(() => null)
    opp.fieldSpell = null
    for (const t of destroyed) opp.graveyard.push({ uid: t.uid, cardId: t.cardId })
    addLog(state, playerId, 'effect', `✨ ${card.name}: ทำลายการ์ดเวท/กับดักของศัตรู ${destroyed.length} ใบ`, [
      `ลงสุสาน: ${destroyed.map((t) => cardOf(t).name).join(', ')}`,
    ])
  }
  if (activated.kind === 'destroyWeaker') {
    const oppId = opponentOf(playerId)
    const target = getActivationTargets(state, playerId, uid).find((x) => x.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์ศัตรูหงายหน้าที่ ATK ต่ำกว่าใบนี้ 1 ตัว')
    const own = getFieldAtk(state, playerId, uid)
    const theirs = getFieldAtk(state, oppId, target.uid)
    const details = []
    if (effectDestroy(state, oppId, target.uid, details)) {
      details.unshift(`ATK ${formatNumber(theirs)} < ${formatNumber(own)} → ${cardOf(target).name} ถูกทำลาย (เอฟเฟกต์)`)
    }
    addLog(state, playerId, 'effect', `✨ ${card.name}: ทำลาย ${cardOf(target).name}`, details)
  }
  if (activated.kind === 'lockAttack') {
    const target = getActivationTargets(state, playerId, uid).find((x) => x.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์ศัตรูเผ่าอสูร/วิญญาณที่หงายหน้า 1 ตัว')
    target.cannotAttackTurn = state.turn + 1
    addLog(state, playerId, 'effect', `✨ ${card.name}: ${cardOf(target).name} โจมตีไม่ได้ในเทิร์นถัดไป`)
  }
  if (activated.kind === 'vine') {
    const oppId = opponentOf(playerId)
    const target = getActivationTargets(state, playerId, uid).find((x) => x.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์หงายหน้าของฝ่ายตรงข้าม 1 ตัว')
    const before = getFieldAtk(state, oppId, target.uid)
    m.growth -= 1
    target.statMods = [...(target.statMods ?? []), { atk: activated.amount, until: state.turn + 1, reason: `${card.name}: รัดไว้` }]
    addLog(state, playerId, 'effect', `🌿 ${card.name}: รัด ${cardOf(target).name}`, [
      `ถอนแต้มเติบโต 1 (เหลือ ${m.growth})`,
      `${cardOf(target).name}: ATK ${formatNumber(before)} − ${formatNumber(-activated.amount)} = ${formatNumber(getFieldAtk(state, oppId, target.uid))} ถึงจบเทิร์นถัดไปของ${PLAYER_NAMES[oppId]}`,
    ])
  }
  if (activated.kind === 'growthBuff') {
    const plant = p.field
      .filter((x) => x && !x.faceDown && isPlantCard(cardOf(x)) && x.growth > 0)
      .sort((a, b) => b.growth - a.growth)[0]
    const target = growthBuffTargets(p).sort((a, b) => getFieldAtk(state, playerId, b.uid) - getFieldAtk(state, playerId, a.uid))[0]
    plant.growth -= 1
    target.statMods = [
      ...(target.statMods ?? []),
      { atk: activated.amount, def: activated.amount, until: state.turn + 1, reason: card.name, tag: 'th03-008' },
    ]
    addLog(state, playerId, 'effect', `🐘 ${card.name}: ${cardOf(target).name} ATK/DEF +${formatNumber(activated.amount)}`, [
      `ถอนแต้มเติบโตจาก ${cardOf(plant).name} (เหลือ ${plant.growth})`,
      `อยู่ถึงจบเทิร์นถัดไปของ${PLAYER_NAMES[opponentOf(playerId)]}`,
    ])
  }
  if (activated.kind === 'scout') {
    const opp = state.players[opponentOf(playerId)]
    queueChoice(state, {
      player: playerId,
      kind: 'scout',
      source: uid,
      prompt: `${card.name}: เลือกเวท/กับดักคว่ำของฝ่ายตรงข้าม 1 ใบเพื่อดู`,
      options: opp.spellTrap
        .map((t, i) => t?.faceDown && { id: t.uid, label: `ช่องเวท/กับดักที่ ${i + 1}` })
        .filter(Boolean),
    })
  }
  if (['bind', 'drain', 'curse'].includes(activated.kind)) {
    const oppId = opponentOf(playerId)
    const target = getActivationTargets(state, playerId, uid).find((x) => x.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์หงายหน้าของฝ่ายตรงข้ามที่เลือกเป็นเป้าได้ 1 ตัว')
    const targetCard = cardOf(target)
    if (activated.kind === 'bind') {
      target.cannotAttackTurn = Math.max(target.cannotAttackTurn ?? 0, state.turn + 1)
      target.positionLockTurn = Math.max(target.positionLockTurn ?? 0, state.turn + 1)
      addLog(state, playerId, 'effect', `🌳 ${card.name}: รากพัน ${targetCard.name}`, [
        `${targetCard.name} โจมตีและเปลี่ยนท่าไม่ได้ ถึงจบเทิร์นถัดไปของ${PLAYER_NAMES[oppId]}`,
      ])
    } else if (activated.kind === 'drain') {
      const theirs = getFieldAtk(state, oppId, target.uid)
      const own = getFieldAtk(state, playerId, uid)
      const reason = `${card.name}: ดูดพลังจนจบเทิร์น`
      target.tempAtk = [...(target.tempAtk ?? []), { amount: -activated.amount, reason }]
      m.tempAtk = [...(m.tempAtk ?? []), { amount: activated.amount, reason }]
      const size = formatNumber(activated.amount)
      addLog(state, playerId, 'effect', `👻 ${card.name}: ดูดพลัง ${targetCard.name} ${size}`, [
        `${targetCard.name}: ATK ${formatNumber(theirs)} − ${size} = ${formatNumber(getFieldAtk(state, oppId, target.uid))}`,
        `${card.name}: ATK ${formatNumber(own)} + ${size} = ${formatNumber(getFieldAtk(state, playerId, uid))}`,
      ])
    } else if (target.curse && target.curse.until >= state.turn) {
      addLog(state, playerId, 'effect', `🕯️ ${card.name}: ${targetCard.name} ติดคำสาปอยู่แล้ว (ไม่ต่ออายุ ไม่เพิ่มความเสียหาย)`)
    } else {
      target.curse = { until: state.turn + 1, amount: activated.amount }
      addLog(state, playerId, 'effect', `🕯️ ${card.name}: สาป ${targetCard.name}`, [
        `ถ้าถูกทำลายก่อนจบเทิร์นถัดไปของ${PLAYER_NAMES[oppId]} ผู้ควบคุมเสีย LP ${formatNumber(activated.amount)}`,
      ])
    }
  }
  if (activated.kind === 'searchTrap') {
    startSearch(state, playerId, card, (c) => c.type === 'trap', 'การ์ดกับดัก')
  }
  p.usedEffects = { ...(p.usedEffects ?? {}), [usedKey(activated, m)]: state.turn }
}

// ส่งการ์ด uid จากมือหรือสนามลงสุสาน คืนข้อความ "ชื่อ (ระดับ · มือ/สนาม)"
function sendMaterialToGrave(p, uid) {
  const fieldZone = p.field.findIndex((m) => m?.uid === uid)
  let inst
  if (fieldZone >= 0) {
    inst = p.field[fieldZone]
    p.field[fieldZone] = null
  } else {
    inst = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1)[0]
  }
  p.graveyard.push({ uid: inst.uid, cardId: inst.cardId })
  const card = cardOf(inst)
  return `${card.name} (ระดับ ${card.level}${fieldZone >= 0 ? ' · สนาม' : ' · มือ'})`
}

function playSpell(state, playerId, uid, tributeUids = [], fusionTarget = null, targetUid = null) {
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

  const reviveSpell = getReviveSpell(card)
  if (reviveSpell) {
    const target = getReviveTargets(state, playerId, card).find((c) => c.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์ในสุสานที่จะคืนชีพ')
    p.graveyard.push(p.hand.splice(handIndex, 1)[0])
    p.graveyard.splice(p.graveyard.findIndex((c) => c.uid === target.uid), 1)
    const zone = p.field.indexOf(null)
    p.field[zone] = {
      ...target,
      hasAttacked: false,
      summonedTurn: state.turn,
      position: reviveSpell.position,
      faceDown: false,
      positionChangedTurn: null,
      ...(reviveSpell.darkImmune ? { darkImmuneTurn: state.turn } : {}),
    }
    addLog(state, playerId, 'summon', `💧 ${name}ใช้ ${card.name} → คืนชีพ ${cardOf(target).name} ลงช่องที่ ${zone + 1}`, [
      `${cardOf(target).name} ไม่รับผลจากการ์ดธาตุตมะจนจบเทิร์น`,
      `${card.name} ลงสุสาน`,
    ])
    if (getOnSummonSearch(cardOf(target))?.alsoOnRevive) triggerSummonSearch(state, playerId, cardOf(target))
    else onSummoned(state, playerId, cardOf(target), { skipSearch: true })
    return
  }

  const growthSpell = getGrowthSpell(card)
  if (growthSpell) {
    p.graveyard.push(p.hand.splice(handIndex, 1)[0])
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${card.id}`]: state.turn }
    const details = []
    for (const m of p.field) {
      const growth = m && !m.faceDown && getGrowth(cardOf(m))
      if (!growth || (m.growth ?? 0) >= growth.cap) continue
      m.growth = Math.min(growth.cap, (m.growth ?? 0) + growthSpell.amount)
      details.push(`🌱 ${cardOf(m).name} แต้มเติบโต ${m.growth}/${growth.cap}`)
    }
    const drawn = p.deck.splice(0, growthSpell.draw)
    p.hand.push(...drawn)
    details.push(drawn.length ? `จั่วการ์ด ${drawn.length} ใบ` : 'กองการ์ดหมด จั่วไม่ได้')
    addLog(state, playerId, 'spell', `🌧️ ${name}ใช้ ${card.name}`, details)
    return
  }

  const branch = getBranchSpell(card)
  if (branch) {
    const source = getEquipTargets(state, playerId, card).find((m) => m.uid === targetUid)
    if (!source) throw new GameRuleError('เลือกต้นสายหงายบนสนามของเรา 1 ตัว')
    const pair = branch.pairs.find((x) => x.from === source.cardId && p.hand.some((h) => h.cardId === x.to))
    p.graveyard.push(p.hand.splice(handIndex, 1)[0])
    const zone = p.field.indexOf(source)
    p.field[zone] = null
    p.graveyard.push({ uid: source.uid, cardId: source.cardId })
    const inst = p.hand.splice(p.hand.findIndex((h) => h.cardId === pair.to), 1)[0]
    const into = cardOf(inst)
    p.field[zone] = { ...inst, hasAttacked: false, summonedTurn: state.turn, position: 'attack', faceDown: false, positionChangedTurn: null }
    p.usedEffects = { ...(p.usedEffects ?? {}), [`name:${card.id}`]: state.turn }
    addLog(state, playerId, 'summon', `🌑 ${name}ใช้ ${card.name}: สังเวย ${cardOf(source).name} → อัญเชิญพิเศษ ${into.name} ลงช่องที่ ${zone + 1}`, [
      `${into.name} (ระดับ ${into.level} · ATK ${formatNumber(into.atk)} / DEF ${formatNumber(into.def)}) ท่าโจมตี`,
      `${card.name} ลงสุสาน`,
    ])
    return
  }

  const buff = getBuffSpell(card)
  if (buff) {
    const target = getEquipTargets(state, playerId, card).find((m) => m.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์เผ่าอสูรหงายหน้าของเรา 1 ตัว')
    const before = getFieldAtk(state, playerId, target.uid)
    p.graveyard.push(p.hand.splice(handIndex, 1)[0])
    target.tempAtk = [...(target.tempAtk ?? []), { amount: buff.amount, reason: buff.reason }]
    addLog(state, playerId, 'spell', `🔥 ${name}ใช้ ${card.name} กับ ${cardOf(target).name}`, [
      `ATK ${formatNumber(before)} + ${formatNumber(buff.amount)} = ${formatNumber(getFieldAtk(state, playerId, target.uid))} จนจบเทิร์น`,
      `${card.name} ลงสุสาน`,
    ])
    return
  }

  const equip = getEquip(card)
  if (equip) {
    const target = getEquipTargets(state, playerId, card).find((m) => m.uid === targetUid)
    if (!target) throw new GameRuleError('เลือกมอนสเตอร์ของเราที่จะสวมใส่')
    const [inst] = p.hand.splice(handIndex, 1)
    const zone = p.spellTrap.indexOf(null)
    p.spellTrap[zone] = { uid: inst.uid, cardId: inst.cardId, faceDown: false, equippedTo: target.uid }
    addLog(state, playerId, 'spell', `🗡️ ${name}สวม ${card.name} ให้ ${cardOf(target).name}`, [
      `ATK +${formatNumber(equip.atk)} · ได้ธาตุอาสนีเพิ่ม · ทำลายศัตรูได้แต้มประสบการณ์เพิ่ม ${equip.xpBonus} แต้ม`,
    ])
    return
  }

  const fusionSpell = getFusionSpell(card)
  if (fusionSpell) {
    const problem = fusionProblem(state, playerId, uid, fusionTarget, tributeUids)
    if (problem) throw new GameRuleError(problem)
    const materialText = [...new Set(tributeUids)].map((mUid) => sendMaterialToGrave(p, mUid))
    const spellInst = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1)[0]
    p.graveyard.push(spellInst)
    const fusionInst = p.extraDeck.splice(p.extraDeck.findIndex((c) => c.uid === fusionTarget), 1)[0]
    const target = cardOf(fusionInst)
    const zone = p.field.indexOf(null)
    p.field[zone] = {
      ...fusionInst,
      hasAttacked: false,
      summonedTurn: state.turn,
      position: 'attack',
      faceDown: false,
      positionChangedTurn: null,
      materials: [...new Set(tributeUids)],
    }
    const details = [`วัตถุดิบ: ${materialText.join(' + ')}`, `${card.name} ลงสุสาน`]
    const bonus = fusionSpell.bonusDraw
    if (bonus?.forFusion === target.id) {
      const drawn = p.deck.splice(0, bonus.count)
      p.hand.push(...drawn)
      details.push(`${bonus.reason}${drawn.length < bonus.count ? ' (กองการ์ดหมด)' : ''}`)
    }
    addLog(
      state,
      playerId,
      'summon',
      `🌀 ${name}ใช้ ${card.name} → อัญเชิญผสานร่าง ${target.name} (ระดับ ${target.level} · ATK ${formatNumber(target.atk)} / DEF ${formatNumber(target.def)}) ลงช่องที่ ${zone + 1}`,
      details
    )
    return
  }

  const ritual = getRitualInfo(card)
  if (!ritual) throw new GameRuleError(`${card.name} ใช้แบบนี้ไม่ได้ (กับดักต้องวางคว่ำ)`)
  const problem = ritualTributeProblem(state, playerId, uid, tributeUids)
  if (problem) throw new GameRuleError(problem)

  const chosen = [...new Set(tributeUids)]
  const target = getCardById(ritual.target)
  const tributeText = chosen.map((tUid) => sendMaterialToGrave(p, tUid))
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

  // แม่นาค: ถูกทำลายเทิร์นนี้ → กลับท่าตั้งรับหงาย (ต้องยังอยู่ในสุสานและมีช่องว่าง)
  for (const [id, pl] of Object.entries(state.players)) {
    for (const uid of pl.pendingReturns ?? []) {
      const gIndex = pl.graveyard.findIndex((c) => c.uid === uid)
      const zone = pl.field.indexOf(null)
      if (gIndex === -1) continue
      const card = cardOf(pl.graveyard[gIndex])
      if (zone === -1) {
        addLog(state, id, 'effect', `🔁 ${card.name} กลับมาไม่ได้: สนามเต็ม`)
        continue
      }
      const [inst] = pl.graveyard.splice(gIndex, 1)
      pl.field[zone] = { ...inst, hasAttacked: false, summonedTurn: state.turn, position: 'defense', faceDown: false, positionChangedTurn: null }
      pl.returnedUids = [...(pl.returnedUids ?? []), uid]
      addLog(state, id, 'summon', `🔁 ${getReturnOnDestroy(card).reason}: ${card.name} กลับจากสุสาน ท่าตั้งรับ ลงช่องที่ ${zone + 1}`)
    }
    pl.pendingReturns = []
  }

  const ending = state.players[endingPlayerId]
  // แต้มเติบโต: พืชหงายของฝ่ายที่จบเทิร์น +1 (ไม่เกินเพดาน)
  const grown = []
  for (const m of ending.field) {
    const growth = m && !m.faceDown && getGrowth(cardOf(m))
    if (!growth || (m.growth ?? 0) >= growth.cap) continue
    m.growth = (m.growth ?? 0) + 1
    grown.push(`${cardOf(m).name} ${m.growth}/${growth.cap}`)
  }
  if (grown.length) addLog(state, endingPlayerId, 'effect', `🌱 เติบโต: ${grown.join(' · ')}`)
  // หมอช้างทรงคชสาร: พืชที่แต้มน้อยสุดเติบโต +1 แล้วฟื้น LP (ชื่อละครั้ง)
  const elephant = ending.field.find((m) => m && !m.faceDown && getEndTurnGrow(cardOf(m)))
  if (elephant) {
    const grow = getEndTurnGrow(cardOf(elephant))
    const plant = ending.field
      .filter((m) => m && !m.faceDown && getGrowth(cardOf(m)) && (m.growth ?? 0) < getGrowth(cardOf(m)).cap)
      .sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))[0]
    if (plant) {
      plant.growth = (plant.growth ?? 0) + grow.amount
      const before = ending.lp
      ending.lp += grow.heal
      addLog(state, endingPlayerId, 'effect', `🐘 ${grow.reason}`, [
        `${cardOf(plant).name} แต้มเติบโต ${plant.growth}/${getGrowth(cardOf(plant)).cap}`,
        `LP ${formatNumber(before)} + ${formatNumber(grow.heal)} = ${formatNumber(ending.lp)}`,
      ])
    }
  }
  for (const m of ending.field) {
    const heal = m && !m.faceDown && getEndTurnHeal(cardOf(m))
    if (!heal) continue
    const before = ending.lp
    ending.lp += heal.amount
    addLog(state, endingPlayerId, 'effect', `✨ ${heal.reason}`, [
      `LP ${formatNumber(before)} + ${formatNumber(heal.amount)} = ${formatNumber(ending.lp)}`,
    ])
  }

  // ตัวปรับ "จนจบเทิร์นนี้" หมดอายุ
  for (const pl of Object.values(state.players)) {
    for (const m of pl.field) if (m?.tempAtk) delete m.tempAtk
  }

  state.turn += 1
  state.activePlayer = nextId
  // ตัวปรับ "ถึงจบเทิร์นถัดไปของศัตรู" หมดอายุ
  for (const pl of Object.values(state.players)) {
    for (const m of pl.field) if (m?.statMods) m.statMods = m.statMods.filter((x) => x.until >= state.turn)
  }
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
