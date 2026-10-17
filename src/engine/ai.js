import {
  applyAction,
  canAttackThisTurn,
  cardOf,
  getOpponentMonsters,
  getReadyAttackers,
  getSummonableHand,
  previewBattle,
} from './game'
import { AI } from './rules'

const byAtkDesc = (a, b) => cardOf(b).atk - cardOf(a).atk

/**
 * AI แบบง่าย: อัญเชิญตัว ATK สูงสุด → โจมตีเฉพาะเมื่อชนะ → จบเทิร์น
 * คืนแอ็กชันถัดไป 1 ขั้น (UI จะเล่นทีละขั้นให้เห็น) หรือ null ถ้าไม่ใช่ตาของ AI
 */
export function getAiAction(state, playerId = AI) {
  if (state.winner || state.activePlayer !== playerId) return null
  const me = state.players[playerId]

  switch (state.phase) {
    case 'discard': {
      // ทิ้งตัว ATK ต่ำสุด
      const weakest = [...me.hand].sort(byAtkDesc).at(-1)
      return { type: 'discard', player: playerId, uid: weakest.uid }
    }
    case 'main1': {
      const best = [...getSummonableHand(state, playerId)].sort(byAtkDesc)[0]
      if (best) return { type: 'summon', player: playerId, uid: best.uid }
      if (canAttackThisTurn(state) && me.field.some(Boolean)) {
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

function chooseAttack(state, playerId) {
  const attackers = [...getReadyAttackers(state, playerId)].sort(byAtkDesc)
  const targets = getOpponentMonsters(state, playerId)

  for (const attacker of attackers) {
    if (targets.length === 0) {
      return { type: 'attack', player: playerId, attackerUid: attacker.uid, targetUid: null }
    }
    // เลือกเป้าที่ชนะได้ และแข็งที่สุดในบรรดานั้น
    const winnable = targets
      .map((t) => ({ t, result: previewBattle(state, playerId, attacker.uid, t.uid) }))
      .filter(({ result }) => result.outcome === 'attacker')
      .sort((x, y) => y.result.defender.final - x.result.defender.final)
    if (winnable.length > 0) {
      return { type: 'attack', player: playerId, attackerUid: attacker.uid, targetUid: winnable[0].t.uid }
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
