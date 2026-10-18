import {
  getActivated,
  getBranchSpell,
  getBuffSpell,
  getContinuousTrap,
  getEquip,
  getFusionSpell,
  getReviveSpell,
  getRitualInfo,
  isPlayableNonMonster,
} from './effects'
import {
  activationBlocker,
  applyAction,
  canAttackDirectly,
  canAttackThisTurn,
  cardOf,
  currentActor,
  evolveBlocker,
  getActivationTargets,
  getDestroyWeakerTargets,
  getEquipTargets,
  getReviveTargets,
  getEvolveSources,
  getFusionPairs,
  getFusionTargets,
  handCardBlocker,
  ritualTributePool,
  ritualTributeProblem,
  specialSummonBlocker,
  trapActivationBlocker,
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
 * AI แบบง่าย: เลื่อนยศ → เวทสนาม → ผสานร่าง → พิธีกรรม → อัญเชิญตัว ATK สูงสุด (สังเวยเมื่อคุ้ม · วางคว่ำเมื่อสู้ไม่ได้)
 * → ใช้ความสามารถ → วางกับดัก → หงายตัวคว่ำที่สู้ได้แล้ว → โจมตีเฉพาะเมื่อชนะ → จบเทิร์น
 * ถูกโจมตีขณะมีกับดักที่เปิดได้ → เปิดเสมอ
 * AI ไม่แอบดูการ์ดคว่ำของผู้เล่น
 * คืนแอ็กชันถัดไป 1 ขั้น (UI จะเล่นทีละขั้นให้เห็น) หรือ null ถ้าไม่ใช่ตาของ AI
 */
export function getAiAction(state, playerId = AI) {
  if (state.winner || currentActor(state) !== playerId) return null
  if (state.pendingChoice) return { type: 'choose', player: playerId, optionId: chooseOption(state, playerId) }
  if (state.pendingResponse) {
    // เปิดกับดักเสมอ (กับดักยกเลิกการโจมตีก่อน ถ้าไม่มีค่อยใช้กลองศึกผสานร่าง)
    const options = state.pendingResponse.options ?? state.pendingResponse.trapUids.map((id) => ({ id }))
    const best = options.find((o) => o.kind !== 'drum') ?? options[0]
    return { type: 'respond', player: playerId, trapUid: best.id }
  }
  const me = state.players[playerId]

  switch (state.phase) {
    case 'discard': {
      const weakest = [...me.hand].sort(cheapestFirst)[0]
      return { type: 'discard', player: playerId, uid: weakest.uid }
    }
    case 'main1': {
      const spell =
        chooseEvolve(state, playerId) ??
        chooseFieldSpell(state, playerId) ??
        chooseFusion(state, playerId) ??
        chooseRitual(state, playerId)
      if (spell) return spell
      const special =
        chooseBranchSpell(state, playerId) ?? chooseSpecialSummon(state, playerId) ?? chooseReviveSpell(state, playerId)
      if (special) return special
      const summon = chooseSummon(state, playerId)
      if (summon) return summon
      const effect =
        chooseEquip(state, playerId) ??
        chooseBuffSpell(state, playerId) ??
        chooseActivation(state, playerId) ??
        chooseTrapSet(state, playerId) ??
        chooseContinuousTrap(state, playerId)
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

// เลื่อนยศทันทีที่ทำได้ (ใช้ร่างใหม่จากกองการ์ดก่อน เก็บการ์ดในมือไว้)
function chooseEvolve(state, playerId) {
  const ready = state.players[playerId].field.find((m) => m && !evolveBlocker(state, playerId, m.uid))
  if (!ready) return null
  const from = getEvolveSources(state, playerId, ready.uid).deck ? 'deck' : 'hand'
  return { type: 'evolve', player: playerId, uid: ready.uid, from }
}

// ตัวเลือกที่รอ: ค้นการ์ด → เอาใบที่มีค่ามากสุด · คืนชีพ → จ่าย LP ถ้ายังเหลือเยอะ ไม่งั้นใช้น้ำมนต์
function chooseOption(state, playerId) {
  const choice = state.pendingChoice
  if (choice.kind === 'mill') return choice.options[0].id
  if (choice.kind === 'search') {
    return [...choice.options].sort((a, b) => cardValue({ cardId: b.id }) - cardValue({ cardId: a.id }))[0].id
  }
  const has = (id) => choice.options.some((o) => o.id === id)
  if (has('pay') && state.players[playerId].lp > 2000) return 'pay'
  if (has('water')) return 'water'
  return has('pay') ? 'pay' : 'skip'
}

// อัญเชิญพิเศษ (สามเณรสังเวยเด็กวัด) ทำทันทีเมื่อทำได้ — ได้ตัวแรงขึ้นและจั่วเพิ่ม
function chooseSpecialSummon(state, playerId) {
  const inst = state.players[playerId].hand.find((c) => !specialSummonBlocker(state, playerId, c.uid))
  return inst ? { type: 'specialSummon', player: playerId, uid: inst.uid } : null
}

// เวทคืนชีพ: คืนชีพตัวที่ ATK สูงสุด
function chooseReviveSpell(state, playerId) {
  for (const spell of playable(state, playerId, (c) => Boolean(getReviveSpell(c)))) {
    const target = [...getReviveTargets(state, playerId, cardOf(spell))].sort(byAtkDesc)[0]
    if (target) return { type: 'playSpell', player: playerId, uid: spell.uid, targetUid: target.uid }
  }
  return null
}

// เวทสวมใส่: ให้ตัวที่ ATK สูงสุดที่สวมได้
function chooseEquip(state, playerId) {
  for (const spell of playable(state, playerId, (c) => Boolean(getEquip(c)))) {
    const target = [...getEquipTargets(state, playerId, cardOf(spell))].sort(byAtkDesc)[0]
    if (target) return { type: 'playSpell', player: playerId, uid: spell.uid, targetUid: target.uid }
  }
  return null
}

// เปิดสายมืด: ทำทันทีเมื่อมีคู่ (ร่างสายมืดแรงกว่าต้นสาย)
function chooseBranchSpell(state, playerId) {
  for (const spell of playable(state, playerId, (c) => Boolean(getBranchSpell(c)))) {
    const source = getEquipTargets(state, playerId, cardOf(spell))[0]
    if (source) return { type: 'playSpell', player: playerId, uid: spell.uid, targetUid: source.uid }
  }
  return null
}

// เวทบัฟจนจบเทิร์น: ใช้ก่อนเข้าเฟสต่อสู้กับตัวท่าโจมตีที่ ATK สูงสุด (เฉพาะเทิร์นที่โจมตีได้)
function chooseBuffSpell(state, playerId) {
  if (!canAttackThisTurn(state)) return null
  for (const spell of playable(state, playerId, (c) => Boolean(getBuffSpell(c)))) {
    const target = [...getEquipTargets(state, playerId, cardOf(spell))]
      .filter((m) => m.position === 'attack' && !m.hasAttacked && m.cannotAttackTurn !== state.turn)
      .sort(byAtkDesc)[0]
    if (target) return { type: 'playSpell', player: playerId, uid: spell.uid, targetUid: target.uid }
  }
  return null
}

// กับดักต่อเนื่องที่วางไว้: เปิดหงายเมื่อเปิดได้
function chooseContinuousTrap(state, playerId) {
  const trap = state.players[playerId].spellTrap.find(
    (t) => t && getContinuousTrap(cardOf(t)) && !trapActivationBlocker(state, playerId, t.uid)
  )
  return trap ? { type: 'activateTrap', player: playerId, uid: trap.uid } : null
}

const playable = (state, playerId, predicate) =>
  state.players[playerId].hand.filter((c) => predicate(cardOf(c)) && !handCardBlocker(state, playerId, c.uid))

// เวทสนาม: ลงเมื่อยังไม่มีเวทสนาม
function chooseFieldSpell(state, playerId) {
  if (state.players[playerId].fieldSpell) return null
  const spell = playable(state, playerId, (c) => c.type === 'spell' && c.spellSubtype === 'field')[0]
  return spell ? { type: 'playSpell', player: playerId, uid: spell.uid } : null
}

// ผสานร่าง: เลือกร่างผสานที่ ATK สูงสุด ใช้วัตถุดิบคู่ที่มีค่ารวมน้อยที่สุด
// และผสานเฉพาะเมื่อร่างใหม่แรงกว่าวัตถุดิบทุกตัว
function chooseFusion(state, playerId) {
  const p = state.players[playerId]
  const all = [...p.hand, ...p.field.filter(Boolean)]
  const instOf = (uid) => all.find((c) => c.uid === uid)
  for (const spell of playable(state, playerId, (c) => Boolean(getFusionSpell(c)))) {
    const targets = [...getFusionTargets(state, playerId, spell.uid)].sort(byAtkDesc)
    for (const target of targets) {
      const pairs = getFusionPairs(state, playerId, spell.uid, target.uid)
        .map((uids) => ({ uids, cost: uids.reduce((sum, uid) => sum + cardValue(instOf(uid)), 0) }))
        .filter(({ uids }) => uids.every((uid) => cardOf(instOf(uid)).atk < cardOf(target).atk))
        .sort((a, b) => a.cost - b.cost)
      if (pairs.length > 0) {
        return { type: 'playSpell', player: playerId, uid: spell.uid, fusionTarget: target.uid, tributes: pairs[0].uids }
      }
    }
  }
  return null
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
    if (activated.kind === 'heal' || activated.kind === 'destroySpellsTraps' || activated.kind === 'searchTrap') {
      return { type: 'activate', player: playerId, uid: m.uid }
    }
    if (['bind', 'drain', 'curse'].includes(activated.kind)) {
      // เลือกศัตรูที่ ATK สูงสุด (ภัยใหญ่สุด) · ดูดพลังใช้เฉพาะเทิร์นที่โจมตีได้
      if (activated.kind === 'drain' && !canAttackThisTurn(state)) continue
      const oppId = opponentOf(playerId)
      const target = [...getActivationTargets(state, playerId, m.uid)].sort(
        (a, b) => getFieldAtk(state, oppId, b.uid) - getFieldAtk(state, oppId, a.uid)
      )[0]
      return { type: 'activate', player: playerId, uid: m.uid, targetUid: target.uid }
    }
    if (activated.kind === 'lockAttack') {
      const oppId = opponentOf(playerId)
      const target = [...getActivationTargets(state, playerId, m.uid)].sort(
        (a, b) => getFieldAtk(state, oppId, b.uid) - getFieldAtk(state, oppId, a.uid)
      )[0]
      return { type: 'activate', player: playerId, uid: m.uid, targetUid: target.uid }
    }
    if (activated.kind === 'destroyWeaker') {
      const oppId = opponentOf(playerId)
      const target = [...getDestroyWeakerTargets(state, playerId, m.uid)].sort(
        (a, b) => getFieldAtk(state, oppId, b.uid) - getFieldAtk(state, oppId, a.uid)
      )[0]
      return { type: 'activate', player: playerId, uid: m.uid, targetUid: target.uid }
    }
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
      const needsDiscard = activated.discardCost !== false
      const discard = needsDiscard ? [...state.players[playerId].hand].sort(cheapestFirst)[0] : null
      if (target && (discard || !needsDiscard)) {
        return { type: 'activate', player: playerId, uid: m.uid, discardUid: discard?.uid, targetUid: target.uid }
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
    if (canAttackDirectly(state, playerId, attacker.uid)) {
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
