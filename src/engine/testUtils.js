import { createGame } from './game'
import { AI, PLAYER, RULES } from './rules'

// สร้างสถานะเกมแบบกำหนดเองสำหรับเทส: ระบุ cardId ในมือ/สนาม/กอง
export function makeState({ turn = 3, activePlayer = PLAYER, phase = 'main1', player = {}, ai = {} } = {}) {
  const state = createGame({ seed: 1 })
  state.turn = turn
  state.activePlayer = activePlayer
  state.phase = phase
  state.log = []

  for (const [id, spec] of [[PLAYER, player], [AI, ai]]) {
    let n = 0
    const inst = (cardId) => ({ uid: `${id}-t${++n}`, cardId })
    const p = state.players[id]
    p.hand = (spec.hand ?? []).map(inst)
    p.deck = (spec.deck ?? ['th01-001', 'th01-001', 'th01-001']).map(inst)
    p.field = Array(RULES.monsterZones).fill(null)
    p.spellTrap = Array(RULES.spellTrapZones).fill(null)
    p.fieldSpell = null
    // field: ['th01-001', { id: 'th01-005', position: 'defense', faceDown: true }, null, ...]
    ;(spec.field ?? []).forEach((entry, i) => {
      if (!entry) return
      const { id, position = 'attack', faceDown = false } = typeof entry === 'string' ? { id: entry } : entry
      p.field[i] = { ...inst(id), hasAttacked: false, summonedTurn: 1, position, faceDown, positionChangedTurn: null }
    })
    // spellTrap: [{ id: 'th05-008', setTurn: 1 }] (คว่ำเสมอ) · fieldSpell: 'th05-007'
    ;(spec.spellTrap ?? []).forEach((entry, i) => {
      if (entry) p.spellTrap[i] = { ...inst(entry.id), faceDown: true, setTurn: entry.setTurn ?? 1 }
    })
    p.fieldSpell = spec.fieldSpell ? inst(spec.fieldSpell) : null
    p.graveyard = []
    p.lp = spec.lp ?? RULES.startingLP
    p.hasNormalSummoned = spec.hasNormalSummoned ?? false
    p.usedEffects = {}
  }
  return state
}

export const uidAt = (state, playerId, zone) => state.players[playerId].field[zone].uid
export const handUid = (state, playerId, index) => state.players[playerId].hand[index].uid
export const lastLog = (state) => state.log.at(-1)
