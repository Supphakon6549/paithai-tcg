import { getActivated, getRitualInfo, isPlayableNonMonster } from './effects'
import {
  activationBlocker,
  applyAction,
  canAttackThisTurn,
  cardOf,
  currentActor,
  handCardBlocker,
  ritualTributePool,
  ritualTributeProblem,
  getOpponentMonsters,
  getReadyAttackers,
  getFieldAtk,
  getSummonableHand,
  getTributeCost,
  isNormalSummonable,
  positionChangeBlocker,
  previewBattle,
} from './game'
import { AI, opponentOf } from './rules'

// ตีการ์ดคว่ำ (ไม่รู้ DEF) เมื่อตัวที่ตีมี ATK อย่างน้อยเท่านี้
const BLIND_ATTACK_MIN_ATK = 1500

const byAtkDesc = (a, b) => (cardOf(b).atk ?? 0) - (cardOf(a).atk ?? 0)

// มูลค่าการ์ดในมือ (ใช้เลือกใบที่จะทิ้ง): มอนสเตอร์ = ATK · เวท/กับดักที่ใช้ได้ = 1,500 · ใบที่ยังใช้ไม่ได้ = 0
const cardValue = (inst) => {
  const card = cardOf(inst)
  if (card.type === 'monster') return card.atk
  return isPlayableNonMonster(card) ? 1500 : 0
}
const cheapestFirst = (a, b) => cardValue(a) - cardValue(b)

/**
 * AI แบบง่าย: เวทสนาม → พิธีกรรม → อัญเชิญตัว ATK สูงสุด (สังเวยเมื่อคุ้ม · วางคว่ำเมื่อสู้ไม่ได้)
 * → ใช้ความสามารถ → วางกับดัก → หงายตัวคว่ำที่สู้ได้แล้ว → โจมตีเฉพาะเมื่อชนะ → จบเทิร์น
 * ถูกโจมตีขณะมีกับดักที่เปิดได้ → เปิดเสมอ
 * AI ไม่แอบดูการ์ดคว่ำของผู้เล่น
 * คืนแอ็กชันถัดไป 1 ขั้น (UI จะเล่นทีละขั้นให้เห็น) หรือ null ถ้าไม่ใช่ตาของ AI
 */
export function getAiAction(state, playerId = AI) {
  if (state.winner || currentActor(state) !== playerId) return null
  if (state.pendingResponse) {
    return { type: 'respond', player: playerId, trapUid: state.pendingResponse.trapUids[0] }
  }
  const me = state.players[playerId]

  switch (state.phase) {
    case 'discard': {
      const weakest = [...me.hand].sort(cheapestFirst)[0]
      return { type: 'discard', player: playerId, uid: weakest.uid }
    }
    case 'main1': {
      const spell = chooseFieldSpell(state, playerId) ?? chooseRitual(state, playerId)
      if (spell) return spell
      const summon = chooseSummon(state, playerId)
      if (summon) return summon
      const effect = chooseActivation(state, playerId) ?? chooseTrapSet(state, playerId)
      if (effect) return effect
      const flip = chooseFlip(state, playerId)
      if (flip) return flip
      if (canAttackThisTurn(state) && me.field.some((m) => m && m.position !== 'defense')) {
        return { type: 'enterBattle', player: playerId }
      }
      return { type: 'endTurn', player: playerId }
    }
    case 'battle': {
      const attack = chooseAttack(state, playerId)
      return attack ?? { type: 'endTurn', player: playerId }
    }
    default:
      return { type: 'endTurn', player: playerId }
  }
}

/*
 * เลือกการอัญเชิญ: เทียบตัวอัญเชิญปกติที่ ATK สูงสุด กับตัวสังเวยที่ ATK สูงสุด
 * สังเวยตัว ATK ต่ำสุดบนสนาม และจะสังเวยก็ต่อเมื่อ "คุ้ม" คือ
 * ตัวใหม่ ATK สูงกว่าตัวอัญเชิญปกติที่ดีที่สุด และสูงกว่าตัวที่ต้องเสียไปทุกตัว
 */
function chooseSummon(state, playerId) {
  const options = [...getSummonableHand(state, playerId)].sort(byAtkDesc)
  // cost = จำนวนตัวสังเวยจริง (0 = ลงได้เลย รวมการ์ดสังเวยที่เอฟเฟกต์ยกเว้นการสังเวย)
  const costOf = (inst) => (isNormalSummonable(cardOf(inst)) ? 0 : getTributeCost(state, playerId, cardOf(inst)))
  const bestNormal = options.find((inst) => costOf(inst) === 0)
  const bestTribute = options.find((inst) => costOf(inst) > 0)

  if (bestTribute) {
    const card = cardOf(bestTribute)
    const fodder = state.players[playerId].field
      .filter(Boolean)
      .sort((a, b) => getFieldAtk(state, playerId, a.uid) - getFieldAtk(state, playerId, b.uid))
      .slice(0, costOf(bestTribute))
    const beatsNormal = !bestNormal || card.atk > cardOf(bestNormal).atk
    const beatsFodder = fodder.every((m) => card.atk > getFieldAtk(state, playerId, m.uid))
    if (beatsNormal && beatsFodder) {
      return {
        type: 'summon',
        player: playerId,
        uid: bestTribute.uid,
        tributes: fodder.map((m) => m.uid),
        position: positionFor(state, playerId, card.atk),
      }
    }
  }
  if (!bestNormal) return null
  return {
    type: 'summon',
    player: playerId,
    uid: bestNormal.uid,
    position: positionFor(state, playerId, cardOf(bestNormal).atk),
  }
}

const playable = (state, playerId, predicate) =>
  state.players[playerId].hand.filter((c) => predicate(cardOf(c)) && !handCardBlocker(state, playerId, c.uid))

// เวทสนาม: ลงเมื่อยังไม่มีเวทสนาม
function chooseFieldSpell(state, playerId) {
  if (state.players[playerId].fieldSpell) return null
  const spell = playable(state, playerId, (c) => c.type === 'spell')[0]
  return spell ? { type: 'playSpell', player: playerId, uid: spell.uid } : null
}

// พิธีกรรม: ใช้ตัวแทน (เช่น เอราวัณ) ถ้ามี ไม่งั้นสังเวยตัวถูกที่สุดจากมือก่อน แล้วค่อยจากสนาม
function chooseRitual(state, playerId) {
  for (const ritualInst of playable(state, playerId, (c) => c.type === 'ritual')) {
    const ritual = getRitualInfo(cardOf(ritualInst))
    const pool = ritualTributePool(state, playerId, ritualInst.uid)
    const substitute = pool.find((c) => ritual.substitutes.includes(c.cardId))
    const plans = substitute ? [[substitute]] : []
    const handSet = new Set(state.players[playerId].hand.map((c) => c.uid))
    const ordered = [...pool].sort((a, b) => (handSet.has(b.uid) - handSet.has(a.uid)) || cheapestFirst(a, b))
    const greedy = []
    let total = 0
    for (const c of ordered) {
      if (total >= ritual.requiredLevel) break
      greedy.push(c)
      total += cardOf(c).level
    }
    plans.push(greedy)
    for (const plan of plans) {
      const tributes = plan.map((c) => c.uid)
      if (!ritualTributeProblem(state, playerId, ritualInst.uid, tributes)) {
        return { type: 'playSpell', player: playerId, uid: ritualInst.uid, tributes }
      }
    }
  }
  return null
}

// ความสามารถ: ฟื้น LP ใช้ทันที · ลด ATK ใช้กับตัวที่แรงที่สุดของศัตรูเมื่อทำให้ตีชนะได้
function chooseActivation(state, playerId) {
  for (const m of state.players[playerId].field) {
    if (!m || activationBlocker(state, playerId, m.uid)) continue
    const activated = getActivated(cardOf(m))
    if (activated.kind === 'heal') return { type: 'activate', player: playerId, uid: m.uid }
    if (activated.kind === 'debuff' && canAttackThisTurn(state)) {
      const oppId = opponentOf(playerId)
      const ourBest = Math.max(
        0,
        ...state.players[playerId].field
          .filter((x) => x && x.position === 'attack')
          .map((x) => getFieldAtk(state, playerId, x.uid))
      )
      const target = state.players[oppId].field
        .filter((x) => x && !x.faceDown)
        .sort((a, b) => getFieldAtk(state, oppId, b.uid) - getFieldAtk(state, oppId, a.uid))
        .find((x) => {
          const atk = getFieldAtk(state, oppId, x.uid)
          return atk >= ourBest && atk + activated.amount < ourBest
        })
      const discard = [...state.players[playerId].hand].sort(cheapestFirst)[0]
      if (target && discard) {
        return { type: 'activate', player: playerId, uid: m.uid, discardUid: discard.uid, targetUid: target.uid }
      }
    }
  }
  return null
}

function chooseTrapSet(state, playerId) {
  const trap = playable(state, playerId, (c) => c.type === 'trap')[0]
  return trap ? { type: 'setTrap', player: playerId, uid: trap.uid } : null
}

// ATK สูงสุดของมอนสเตอร์ท่าโจมตีที่หงายอยู่ของอีกฝ่าย (สิ่งที่ AI มองเห็นว่าเป็นภัย)
function strongestVisibleThreat(state, playerId) {
  const oppId = opponentOf(playerId)
  return Math.max(
    0,
    ...state.players[oppId].field
      .filter((m) => m && !m.faceDown && m.position === 'attack')
      .map((m) => getFieldAtk(state, oppId, m.uid))
  )
}

// ตั้งรับเมื่อสู้ตัวที่แรงที่สุดของอีกฝ่ายไม่ได้
function positionFor(state, playerId, atk) {
  return atk < strongestVisibleThreat(state, playerId) ? 'defense' : 'attack'
}

// หงาย/เปลี่ยนตัวตั้งรับเป็นท่าโจมตีเมื่อสู้ได้แล้ว
function chooseFlip(state, playerId) {
  const threat = strongestVisibleThreat(state, playerId)
  const candidate = state.players[playerId].field.find(
    (m) =>
      m &&
      m.position === 'defense' &&
      !positionChangeBlocker(state, playerId, m.uid) &&
      getFieldAtk(state, playerId, m.uid) >= threat
  )
  return candidate ? { type: 'changePosition', player: playerId, uid: candidate.uid } : null
}

function chooseAttack(state, playerId) {
  const attackers = [...getReadyAttackers(state, playerId)].sort(byAtkDesc)
  const targets = getOpponentMonsters(state, playerId)
  const visible = targets.filter((t) => !t.faceDown)
  const hidden = targets.filter((t) => t.faceDown)

  for (const attacker of attackers) {
    if (targets.length === 0) {
      return { type: 'attack', player: playerId, attackerUid: attacker.uid, targetUid: null }
    }
    // เลือกเป้าที่หงายอยู่และชนะได้ แข็งที่สุดในบรรดานั้น
    const winnable = visible
      .map((t) => ({ t, result: previewBattle(state, playerId, attacker.uid, t.uid) }))
      .filter(({ result }) => result.outcome === 'attacker')
      .sort((x, y) => y.result.defender.final - x.result.defender.final)
    if (winnable.length > 0) {
      return { type: 'attack', player: playerId, attackerUid: attacker.uid, targetUid: winnable[0].t.uid }
    }
    // ไม่มีเป้าที่ชนะแน่ → เสี่ยงตีการ์ดคว่ำถ้าตัวนี้แรงพอ
    if (hidden.length > 0 && getFieldAtk(state, playerId, attacker.uid) >= BLIND_ATTACK_MIN_ATK) {
      return { type: 'attack', player: playerId, attackerUid: attacker.uid, targetUid: hidden[0].uid }
    }
  }
  return null
}

// เล่นตาของ AI จนจบเทิร์น (ใช้ในเทส / จำลองเกม)
export function runAiTurn(state, playerId = AI) {
  let current = state
  for (let guard = 0; guard < 100; guard++) {
    const action = getAiAction(current, playerId)
    if (!action) return current
    current = applyAction(current, action)
  }
  throw new Error('AI วนลูปไม่จบเทิร์น')
}
