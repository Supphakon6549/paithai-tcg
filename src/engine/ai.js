import {
  getActivated,
  getBranchSpell,
  getBuffSpell,
  getContinuousTrap,
  getEquip,
  getFusionSpell,
  getGrowthSpell,
  getKala,
  getNagaSummonSearch,
  getOnSummonCall,
  getOnSummonLook,
  getOnSummonSearch,
  getReviveSpell,
  getRitualInfo,
  isContinuousSpell,
  isNagaVeil,
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
  getMountOptions,
  handCardBlocker,
  mountBlocker,
  ritualTributePool,
  ritualTributeProblem,
  specialSummonBlocker,
  trapActivationBlocker,
  getAttackableTargets,
  isAttackLocked,
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
    // ตัวเลือกนาคามีต้นทุน (คืนตัวขึ้นมือ / ทิ้งการ์ดคว่ำ) → จำลองผลแต่ละทางแล้วเลือกทางที่ดีที่สุด
    if (options.some((o) => NAGA_RESPONSES.includes(o.kind))) {
      return { type: 'respond', player: playerId, trapUid: bestResponse(state, playerId, options) }
    }
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
        chooseMount(state, playerId) ??
        chooseRitual(state, playerId)
      if (spell) return spell
      const special =
        chooseBranchSpell(state, playerId) ??
        chooseSpecialSummon(state, playerId) ??
        chooseReviveSpell(state, playerId) ??
        chooseNagaSpell(state, playerId)
      if (special) return special
      const summon = chooseSummon(state, playerId)
      if (summon) return summon
      const effect =
        chooseEquip(state, playerId) ??
        chooseBuffSpell(state, playerId) ??
        playable(state, playerId, (c) => Boolean(getGrowthSpell(c))).map((spell) => ({ type: 'playSpell', player: playerId, uid: spell.uid }))[0] ??
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
// คะแนนการลงสนาม: ATK จริงหลังลง (รวมออร่าเพื่อน/สุสาน/เวทสนาม) + ค่าเอฟเฟกต์เมื่ออัญเชิญ
// ทำให้ AI เห็นค่าของการ์ดที่แรงขึ้นเมื่ออยู่เป็นกลุ่ม (เช่น สายผี) ไม่ใช่ดูแค่ ATK บนการ์ด
function summonScore(state, playerId, inst) {
  const card = cardOf(inst)
  const p = state.players[playerId]
  const zone = p.field.indexOf(null)
  let atk = card.atk
  if (zone !== -1 && isNormalSummonable(card)) {
    const probe = structuredClone(state)
    probe.players[playerId].field[zone] = { uid: inst.uid, cardId: inst.cardId, position: 'attack', faceDown: false }
    atk = getFieldAtk(probe, playerId, inst.uid)
  }
  let bonus = 0
  if (getOnSummonSearch(card) || getOnSummonCall(card) || getOnSummonLook(card) || getNagaSummonSearch(card)) bonus += 400
  // ต้นสายของสายมืด: มีคำสาปพันธะเงา + ร่างสายมืดคู่กันในมือ
  const branch = p.hand.map((h) => getBranchSpell(cardOf(h))).find(Boolean)
  if (branch?.pairs.some((pair) => pair.from === card.id && p.hand.some((h) => h.cardId === pair.to))) bonus += 900
  return { atk, value: atk + bonus }
}

function chooseSummon(state, playerId) {
  const score = new Map(getSummonableHand(state, playerId).map((inst) => [inst.uid, summonScore(state, playerId, inst)]))
  const options = [...getSummonableHand(state, playerId)].sort((a, b) => score.get(b.uid).value - score.get(a.uid).value)
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
    const beatsNormal = !bestNormal || card.atk > score.get(bestNormal.uid).value
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
  // นาคาที่ค้นการ์ดตอนอัญเชิญต้องลงหงาย (วางคว่ำไม่เกิดเอฟเฟกต์)
  const searcher = getNagaSummonSearch(cardOf(bestNormal)) && !nagaNameUsed(state, playerId, bestNormal.cardId)
  return {
    type: 'summon',
    player: playerId,
    uid: bestNormal.uid,
    position: searcher ? 'attack' : positionFor(state, playerId, score.get(bestNormal.uid).atk),
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
  const realOptions = choice.options.filter((o) => o.id !== 'skip')
  const inHandOrDeck = (uid) => {
    const p = state.players[playerId]
    return [...p.hand, ...p.deck, ...p.graveyard].find((c) => c.uid === uid)
  }
  if (choice.kind === 'mill' || choice.kind === 'scout') return choice.options[0].id
  if (choice.kind.startsWith('naga')) return chooseNagaOption(state, playerId, choice)
  // เรียกพวก / ดูบนกอง / ลงจากหลัง → เลือกใบที่มีค่ามากสุด
  if (['summonFromHand', 'look', 'dismount'].includes(choice.kind)) {
    const best = [...realOptions].sort((a, b) => cardValue(inHandOrDeck(b.id)) - cardValue(inHandOrDeck(a.id)))[0]
    return best?.id ?? 'skip'
  }
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

// ขึ้นขี่: เมื่อร่างขี่แรงกว่าวัตถุดิบตัวที่แรงสุด
function chooseMount(state, playerId) {
  if (mountBlocker(state, playerId)) return null
  for (const option of getMountOptions(state, playerId)) {
    const rider = cardOf(state.players[playerId].extraDeck.find((c) => c.uid === option.fusionUid))
    const pair = [...option.pairs].sort(
      (a, b) =>
        Math.max(...a.map((uid) => getFieldAtk(state, playerId, uid))) - Math.max(...b.map((uid) => getFieldAtk(state, playerId, uid)))
    )[0]
    if (rider.atk > Math.max(...pair.map((uid) => getFieldAtk(state, playerId, uid)))) {
      return { type: 'mount', player: playerId, fusionUid: option.fusionUid, materials: pair }
    }
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
      .filter((m) => m.position === 'attack' && !m.hasAttacked && !isAttackLocked(state, m))
      .sort(byAtkDesc)[0]
    if (target) return { type: 'playSpell', player: playerId, uid: spell.uid, targetUid: target.uid }
  }
  return null
}

// กับดักต่อเนื่องที่วางไว้: เปิดหงายเมื่อเปิดได้
// ผนึกสังข์ (เปิดในเฟสหลักได้): ใช้เฉพาะเมื่อศัตรูมีเวท/กับดักหงายอยู่ (ไม่งั้นเก็บไว้ตอบโต้การโจมตี)
function chooseContinuousTrap(state, playerId) {
  const opp = state.players[opponentOf(playerId)]
  const enemyFaceUp = Boolean(opp.fieldSpell) || opp.spellTrap.some((t) => t && !t.faceDown)
  const trap = state.players[playerId].spellTrap.find(
    (t) => t && !trapActivationBlocker(state, playerId, t.uid) && (getContinuousTrap(cardOf(t)) || enemyFaceUp)
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
    if (activated.kind === 'forestCall' || activated.kind === 'nestCall') return { type: 'activate', player: playerId, uid: m.uid }
    if (['nagaShield', 'kalaDraw', 'nagaKing'].includes(activated.kind)) return { type: 'activate', player: playerId, uid: m.uid }
    if (activated.kind === 'nagaPact') {
      // สงบศึกกับศัตรูที่แรงกว่าตัวที่แรงที่สุดของเรา (ตีไม่ชนะอยู่แล้ว)
      const oppId = opponentOf(playerId)
      const ourBest = Math.max(0, ...state.players[playerId].field.filter(Boolean).map((x) => getFieldAtk(state, playerId, x.uid)))
      if (state.players[oppId].field.some((x) => x && !x.faceDown && getFieldAtk(state, oppId, x.uid) > ourBest)) {
        return { type: 'activate', player: playerId, uid: m.uid }
      }
    }
    if (activated.kind === 'scout' && canAttackThisTurn(state)) return { type: 'activate', player: playerId, uid: m.uid }
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
      // เลือกจากเป้าที่ถูกกติกาเท่านั้น (ข้ามตัวที่กันเลือกเป้า เช่น นางตานี / แม่นาค)
      const target = [...getActivationTargets(state, playerId, m.uid)]
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
  const targets = getAttackableTargets(state, playerId)
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

// ---------- TH07 ราชสำนักนาคา ----------
const NAGA_RESPONSES = ['nagaRescue', 'nagaSecret', 'nagaTide', 'nagaSeal']
const nagaNameUsed = (state, playerId, cardId) =>
  (state.players[playerId].usedEffects ?? {})[`name:${cardId}`] === state.turn

// คะแนนกระดานแบบหยาบ: LP + มอนสเตอร์บนสนาม + การ์ดในมือ + เวท/กับดัก (ของเราลบของศัตรู)
function boardScore(state, playerId) {
  if (state.winner) return state.winner === playerId ? 1e6 : -1e6
  const side = (pl) =>
    pl.lp + 1000 * pl.field.filter(Boolean).length + 300 * pl.hand.length + 250 * pl.spellTrap.filter(Boolean).length
  return side(state.players[playerId]) - side(state.players[opponentOf(playerId)])
}

// เลือกการตอบโต้ที่ได้กระดานดีที่สุด (เสมอกัน = ไม่ใช้ เก็บทรัพยากรไว้)
function bestResponse(state, playerId, options) {
  let best = { id: null, score: -Infinity }
  for (const id of [null, ...options.map((o) => o.id)]) {
    try {
      const score = boardScore(applyAction(state, { type: 'respond', player: playerId, trapUid: id }), playerId)
      if (score > best.score) best = { id, score }
    } catch {
      // ตัวเลือกที่ใช้ไม่ได้ข้ามไป
    }
  }
  return best.id
}

// เวทนาคา: ประตูวังวน (ลงเมื่อยังไม่มี) · ม่านน้ำคืนวัง (คืนตัวค้นการ์ดแล้วเรียกกลับมาค้นซ้ำ)
function chooseNagaSpell(state, playerId) {
  const p = state.players[playerId]
  const gateUp = p.spellTrap.some((t) => t && !t.faceDown && isContinuousSpell(cardOf(t)))
  const gate = !gateUp && playable(state, playerId, (c) => isContinuousSpell(c))[0]
  if (gate) return { type: 'playSpell', player: playerId, uid: gate.uid }
  const veil = playable(state, playerId, (c) => isNagaVeil(c))[0]
  if (veil && p.field.some((m) => m && !m.faceDown && recastValue(state, playerId, m) > 0)) {
    return { type: 'playSpell', player: playerId, uid: veil.uid }
  }
  return null
}

// ค่าของการคืนนาคาตัวนี้ขึ้นมือแล้วลงใหม่: ตัวค้นการ์ดที่ยังไม่ใช้สิทธิ์เทิร์นนี้ = คุ้ม · ตัวที่สะสมกาลอยู่ = ไม่คุ้ม
function recastValue(state, playerId, m) {
  const card = cardOf(m)
  if (card.summonType === 'fusion' || card.groupTag !== 'naga-court') return -Infinity
  if (getKala(card) && m.kala) return -1000 * m.kala
  const search = getNagaSummonSearch(card)
  if (search && !nagaNameUsed(state, playerId, card.id)) {
    if (state.players[playerId].deck.some((c) => search.matches(cardOf(c)))) return 1000
  }
  return -card.atk / 10
}

const fieldInst = (state, uid) =>
  Object.values(state.players)
    .flatMap((pl) => pl.field)
    .find((m) => m?.uid === uid)

function chooseNagaOption(state, playerId, choice) {
  const real = choice.options.filter((o) => o.id !== 'skip')
  const oppId = opponentOf(playerId)
  const atkOf = (uid) => {
    const m = fieldInst(state, uid)
    if (!m) return 0
    return getFieldAtk(state, state.players[playerId].field.includes(m) ? playerId : oppId, uid)
  }
  const hand = state.players[playerId].hand
  const best = (score) => [...real].sort((a, b) => score(b) - score(a))[0]?.id ?? 'skip'
  switch (choice.kind) {
    case 'nagaShield':
    case 'nagaPact':
    case 'nagaKingEnemy':
      return best((o) => atkOf(o.id))
    case 'nagaKingAlly':
    case 'nagaVeilReturn':
      return best((o) => recastValue(state, playerId, fieldInst(state, o.id)))
    case 'nagaVeilSummon':
      return best((o) => {
        const card = cardOf(hand.find((h) => h.uid === o.id))
        return (getNagaSummonSearch(card) && !nagaNameUsed(state, playerId, card.id) ? 2000 : 0) + card.def
      })
    case 'nagaFollow':
      return real.find((o) => o.id !== 'only')?.id ?? 'only'
    case 'nagaDiscard':
      return best((o) => -cardValue(hand.find((h) => h.uid === o.id)))
    case 'nagaSeal':
      return (real.find((o) => o.enemy && !o.faceDown) ?? real.find((o) => o.enemy) ?? real[0]).id
    default:
      return real[0]?.id ?? 'skip'
  }
}
