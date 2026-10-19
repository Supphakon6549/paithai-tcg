import { useEffect, useState } from 'react'
import MonsterCard from '../cards/MonsterCard'
import { FieldActionSheet, HandActionSheet, TrapActionSheet } from './ActionSheets'
import BattleLog from './BattleLog'
import BoardSide, { PileViewer } from './BoardSide'
import LpHud, { SideLp } from './LpHud'
import MiniCard from './MiniCard'
import PlayerBar from './PlayerBar'
import {
  AI,
  PHASE_NAMES,
  PLAYER,
  PLAYER_NAMES,
  RULES,
  activationBlocker,
  applyAction,
  canAttackDirectly,
  canAttackThisTurn,
  cardOf,
  createGame,
  currentActor,
  evolveBlocker,
  formatNumber,
  fusionMaterialPool,
  fusionProblem,
  getActivated,
  getActivationTargets,
  getAttackableTargets,
  getAiAction,
  getBranchSpell,
  getBuffSpell,
  getContinuousTrap,
  getEquip,
  getEquipTargets,
  getEvolve,
  getEvolveSources,
  getFieldAtk,
  getFusionMaterials,
  getFusionSpell,
  getFusionTargets,
  getMountOptions,
  getMountVerb,
  getHandOverflow,
  getReadyAttackers,
  getReviveSpell,
  getReviveTargets,
  getRitualInfo,
  getSpecialSummon,
  getSummonOnlyBy,
  getSummonableHand,
  getTributeCost,
  handCardBlocker,
  isNormalSummonable,
  mountBlocker,
  positionChangeBlocker,
  previewBattle,
  ritualTributePool,
  ritualTributeProblem,
  specialSummonBlocker,
  trapActivationBlocker,
  tributesRequired,
} from '../../engine'
import './BattleScreen.css'
// ธีมและแอนิเมชัน (ทีมภาพดูแล) — โหลดหลัง BattleScreen.css เพื่อทับสไตล์พื้นฐานได้
import './BattleTheme.css'
import BattleFx from './fx/BattleFx'

const AI_STEP_DELAY = { attack: 1100, respond: 1100, default: 750 }

// deckList / extraDeckList จากหน้าจัดสำรับ (ไม่ระบุ = สำรับทดสอบ)
// aiDecks = สำรับสำเร็จรูปให้ AI สุ่มใช้ (ว่าง = สำรับทดสอบ)
const newGame = (deckList, extraDeckList, aiDecks = []) => {
  const ai = aiDecks.length ? aiDecks[Math.floor(Math.random() * aiDecks.length)] : null
  return createGame({
    seed: Date.now(),
    firstPlayer: Math.random() < 0.5 ? PLAYER : AI,
    ...(deckList && { deckList }),
    ...(extraDeckList && { extraDeckList }),
    ...(ai && { aiDeckList: ai.main, aiExtraDeckList: ai.extra ?? [], aiDeckName: ai.name }),
  })
}

// สำรับที่ส่งมาใช้ไม่ได้ → เล่นด้วยสำรับเริ่มต้นแทน พร้อมข้อความแจ้ง
function startGame(deckList, extraDeckList, aiDecks) {
  try {
    return { game: newGame(deckList, extraDeckList, aiDecks), deckError: null }
  } catch (e) {
    return { game: newGame(), deckError: `${e.message} — ใช้สำรับทดสอบแทน` }
  }
}

const OUTCOME_BADGE = {
  attacker: { tone: 'win', label: 'ชนะ' },
  defender: { tone: 'lose', label: 'แพ้' },
  tie: { tone: 'tie', label: 'เสมอ' },
}

const toggle = (list, uid, max = Infinity) =>
  list.includes(uid) ? list.filter((u) => u !== uid) : list.length < max ? [...list, uid] : list

// initialGame: สถานะเกมที่จัดเตรียมไว้ (ใช้ทดสอบ / โหมดโจทย์ในอนาคต) — ไม่ระบุ = เริ่มเกมใหม่จากสำรับ
export default function BattleScreen({ active = true, deckList, extraDeckList, aiDecks, initialGame }) {
  const [initial] = useState(() =>
    initialGame ? { game: initialGame, deckError: null } : startGame(deckList, extraDeckList, aiDecks)
  )
  const [game, setGame] = useState(initial.game)
  const [selectedHandUid, setSelectedHandUid] = useState(null)
  const [selectedFieldUid, setSelectedFieldUid] = useState(null) // มอนสเตอร์ของเราที่เปิดเมนู
  const [attackerUid, setAttackerUid] = useState(null)
  const [tributePick, setTributePick] = useState(null) // อัญเชิญสังเวย { handUid, selected, position }
  const [ritualPick, setRitualPick] = useState(null) // พิธีกรรม { ritualUid, selected }
  const [effectPick, setEffectPick] = useState(null) // ความสามารถที่ต้องเลือก { uid, kind, discardUid }
  const [fusionPick, setFusionPick] = useState(null) // ผสานร่าง { spellUid, targetUid, selected }
  const [revivePick, setRevivePick] = useState(null) // เวทคืนชีพ: uid ของเวท
  const [equipPick, setEquipPick] = useState(null) // เวทสวมใส่: uid ของเวท
  const [mountPick, setMountPick] = useState(null) // ขึ้นขี่ { fusionUid, selected }
  const [selectedTrapUid, setSelectedTrapUid] = useState(null) // กับดักคว่ำของเราที่เปิดเมนู
  const [inspectCard, setInspectCard] = useState(null)
  const [openPile, setOpenPile] = useState(null) // { playerId, kind }
  const [previewCard, setPreviewCard] = useState(null) // การ์ดในมือที่ชี้เมาส์อยู่ (PC)
  const [error, setError] = useState(initial.deckError)

  const me = game.players[PLAYER]
  const opp = game.players[AI]
  const pending = game.pendingResponse
  const choice = game.pendingChoice
  const mustChoose = choice?.player === PLAYER && !game.winner
  const mustRespond = !choice && pending?.responder === PLAYER && !game.winner
  const isMyTurn = game.activePlayer === PLAYER && !game.winner && !pending && !choice

  const summonable = new Set(getSummonableHand(game, PLAYER).map((c) => c.uid))
  const readyAttackers = new Set(getReadyAttackers(game, PLAYER).map((m) => m.uid))
  const attacker = me.field.find((m) => m?.uid === attackerUid) ?? null
  const selectedHand = me.hand.find((c) => c.uid === selectedHandUid) ?? null
  const selectedField = me.field.find((m) => m?.uid === selectedFieldUid) ?? null
  const oppHasMonsters = opp.field.some(Boolean)
  const attackableTargets = new Set(getAttackableTargets(game, PLAYER).map((m) => m.uid))

  const tributeInst = tributePick ? me.hand.find((c) => c.uid === tributePick.handUid) : null
  const tributeCard = tributeInst ? cardOf(tributeInst) : null
  const tributeNeeded = tributeCard ? getTributeCost(game, PLAYER, tributeCard) : 0

  const ritualInst = ritualPick ? me.hand.find((c) => c.uid === ritualPick.ritualUid) : null
  const ritual = ritualInst ? getRitualInfo(cardOf(ritualInst)) : null
  const ritualPool = new Set(ritual ? ritualTributePool(game, PLAYER, ritualInst.uid).map((c) => c.uid) : [])
  const ritualProblem = ritual ? ritualTributeProblem(game, PLAYER, ritualInst.uid, ritualPick.selected) : null
  const fusionTargets = fusionPick ? getFusionTargets(game, PLAYER, fusionPick.spellUid) : []
  const fusionTargetInst = fusionPick?.targetUid ? me.extraDeck.find((c) => c.uid === fusionPick.targetUid) : null
  const fusionPool = new Set(
    fusionPick ? fusionMaterialPool(game, PLAYER).map((c) => c.uid).filter((uid) => uid !== fusionPick.spellUid) : []
  )
  const fusionIssue =
    fusionTargetInst && fusionProblem(game, PLAYER, fusionPick.spellUid, fusionPick.targetUid, fusionPick.selected)
  // ขึ้นขี่: ร่างที่เลือกได้ · คู่คน+สัตว์ของร่างที่เลือก · ตัวที่เป็นวัตถุดิบได้
  const mountOptions = mountPick ? getMountOptions(game, PLAYER) : []
  const mountOption = mountPick?.fusionUid ? mountOptions.find((o) => o.fusionUid === mountPick.fusionUid) : null
  const mountPool = new Set(mountOption ? mountOption.pairs.flat() : [])
  // จำนวนวัตถุดิบตามสูตร (ขี่ 2 · ราชินีต่อ 3)
  const mountNeed = mountOption ? mountOption.pairs[0].length : 2
  const mountRider = mountOption ? cardOf(me.extraDeck.find((c) => c.uid === mountPick.fusionUid)) : null
  const mountVerb = mountRider ? getMountVerb(mountRider) : 'ขึ้นขี่'
  const mountReady =
    mountOption &&
    mountOption.pairs.some((set) => mountPick.selected.length === set.length && set.every((uid) => mountPick.selected.includes(uid)))
  const fusionNeed = fusionTargetInst ? getFusionMaterials(cardOf(fusionTargetInst)).length : 2
  const isTributeSelected = (uid) =>
    Boolean(
      tributePick?.selected.includes(uid) ||
        ritualPick?.selected.includes(uid) ||
        fusionPick?.selected.includes(uid) ||
        mountPick?.selected.includes(uid)
    )
  const materialBadge = { tone: 'lose', text: fusionPick || mountPick ? 'วัตถุดิบ' : 'สังเวย' }
  // ความสามารถที่ต้องเลือกเป้า: ขั้นทิ้งการ์ด (debuff) / ขั้นเลือกเป้า
  const pickingDiscard = effectPick?.kind === 'debuff' && effectPick.needsDiscard && !effectPick.discardUid
  const pickingTarget = Boolean(effectPick) && !pickingDiscard
  const activationTargets = new Set(
    pickingTarget ? getActivationTargets(game, PLAYER, effectPick.uid).map((m) => m.uid) : []
  )
  const reviveInst = revivePick ? me.hand.find((c) => c.uid === revivePick) : null
  const reviveTargets = reviveInst ? getReviveTargets(game, PLAYER, cardOf(reviveInst)) : []
  const equipInst = equipPick ? me.hand.find((c) => c.uid === equipPick) : null
  const equipTargets = new Set(equipInst ? getEquipTargets(game, PLAYER, cardOf(equipInst)).map((m) => m.uid) : [])
  const selectedTrap = me.spellTrap.find((t) => t?.uid === selectedTrapUid) ?? null

  function clearSelections() {
    setSelectedHandUid(null)
    setSelectedFieldUid(null)
    setAttackerUid(null)
    setTributePick(null)
    setRitualPick(null)
    setEffectPick(null)
    setFusionPick(null)
    setRevivePick(null)
    setEquipPick(null)
    setMountPick(null)
    setSelectedTrapUid(null)
    setPreviewCard(null)
  }

  // ทำแอ็กชันของผู้เล่น — ผิดกติกาจะแสดงข้อความแทน
  function play(action) {
    try {
      setGame(applyAction(game, { ...action, player: PLAYER }))
      setError(null)
      clearSelections()
    } catch (e) {
      setError(e.message)
    }
  }

  // AI เล่นทีละขั้นพร้อมหน่วงเวลา (รวมตอนต้องตัดสินใจเปิดกับดักระหว่างตาของเรา)
  useEffect(() => {
    if (!active || game.winner || currentActor(game) !== AI) return
    const action = getAiAction(game)
    if (!action) return
    const delay = AI_STEP_DELAY[action.type] ?? AI_STEP_DELAY.default
    // AI ทำผิดกติกา/เกิดข้อผิดพลาด → แจ้งบนจอและจบเทิร์น AI แทน เพื่อไม่ให้เกมค้างเงียบ
    const timer = setTimeout(() => {
      try {
        setGame(applyAction(game, action))
      } catch (e) {
        setError(`คู่ต่อสู้ทำ "${action.type}" ไม่ได้: ${e.message} (กรุณาแจ้งผู้พัฒนา)`)
        try {
          setGame(applyAction(game, { type: 'endTurn', player: AI }))
        } catch {
          // จบเทิร์นไม่ได้ด้วย — คงสถานะเดิมไว้ ข้อความด้านบนช่วยให้แจ้งปัญหาได้
        }
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [game, active])

  function restart() {
    const next = startGame(deckList, extraDeckList, aiDecks)
    setGame(next.game)
    clearSelections()
    setError(next.deckError)
  }

  // ---------- การแตะการ์ด ----------
  function onHandCardTap(inst) {
    if (revivePick || equipPick || mountPick) return
    if (ritualPick) {
      if (ritualPool.has(inst.uid)) {
        setRitualPick((r) => ({ ...r, selected: toggle(r.selected, inst.uid) }))
      }
      return
    }
    if (fusionPick) {
      if (fusionPick.targetUid && fusionPool.has(inst.uid)) {
        setFusionPick((f) => ({ ...f, selected: toggle(f.selected, inst.uid, fusionNeed) }))
      }
      return
    }
    if (pickingDiscard) {
      setEffectPick((e) => ({ ...e, discardUid: inst.uid }))
      return
    }
    setAttackerUid(null)
    setTributePick(null)
    setSelectedFieldUid(null)
    setSelectedTrapUid(null)
    setSelectedHandUid((uid) => (uid === inst.uid ? null : inst.uid))
  }

  function onMyMonsterTap(monster) {
    if (mountPick) {
      if (mountPool.has(monster.uid)) setMountPick((m) => ({ ...m, selected: toggle(m.selected, monster.uid, mountNeed) }))
      return
    }
    if (equipPick) {
      if (equipTargets.has(monster.uid)) play({ type: 'playSpell', uid: equipPick, targetUid: monster.uid })
      else setError('เลือกได้เฉพาะมอนสเตอร์หงายหน้าที่ตรงเงื่อนไข (ขอบเรืองแสง)')
      return
    }
    if (revivePick) return
    if (ritualPick) {
      setRitualPick((r) => ({ ...r, selected: toggle(r.selected, monster.uid) }))
      return
    }
    if (tributePick) {
      setTributePick((t) => ({ ...t, selected: toggle(t.selected, monster.uid, tributeNeeded) }))
      return
    }
    if (fusionPick) {
      if (fusionPick.targetUid) setFusionPick((f) => ({ ...f, selected: toggle(f.selected, monster.uid, fusionNeed) }))
      return
    }
    if (effectPick) return
    setSelectedHandUid(null)
    setSelectedTrapUid(null)
    if (game.phase === 'battle') {
      if (readyAttackers.has(monster.uid)) {
        setAttackerUid((uid) => (uid === monster.uid ? null : monster.uid))
      } else {
        setInspectCard(cardOf(monster))
      }
      return
    }
    // เฟสหลัก: เปิดเมนูเปลี่ยนท่า / ความสามารถ
    setSelectedFieldUid((uid) => (uid === monster.uid ? null : monster.uid))
  }

  function onOpponentMonsterTap(monster) {
    if (pickingTarget) {
      if (!activationTargets.has(monster.uid)) {
        setError('เลือกได้เฉพาะมอนสเตอร์ที่มีขอบเรืองแสง')
        return
      }
      play({ type: 'activate', uid: effectPick.uid, discardUid: effectPick.discardUid ?? undefined, targetUid: monster.uid })
    } else if (attacker) {
      play({ type: 'attack', attackerUid: attacker.uid, targetUid: monster.uid })
    } else if (monster.faceDown) {
      setError('การ์ดคว่ำ — ยังไม่รู้ว่าเป็นการ์ดอะไร')
    } else {
      setInspectCard(cardOf(monster))
    }
  }

  function startSummon(inst, position) {
    if (getTributeCost(game, PLAYER, cardOf(inst)) > 0) {
      setSelectedHandUid(null)
      setTributePick({ handUid: inst.uid, selected: [], position })
      setError(null)
    } else {
      play({ type: 'summon', uid: inst.uid, position })
    }
  }

  function playNonMonster(inst) {
    const card = cardOf(inst)
    if (card.type === 'ritual') {
      setSelectedHandUid(null)
      setRitualPick({ ritualUid: inst.uid, selected: [] })
      setError(null)
    } else if (getFusionSpell(card)) {
      const targets = getFusionTargets(game, PLAYER, inst.uid)
      setSelectedHandUid(null)
      setFusionPick({ spellUid: inst.uid, targetUid: targets.length === 1 ? targets[0].uid : null, selected: [] })
      setError(null)
    } else if (getReviveSpell(card)) {
      setSelectedHandUid(null)
      setRevivePick(inst.uid)
      setError(null)
    } else if (getEquip(card) || getBuffSpell(card) || getBranchSpell(card)) {
      setSelectedHandUid(null)
      setEquipPick(inst.uid)
      setError(null)
    } else if (card.type === 'trap') {
      play({ type: 'setTrap', uid: inst.uid })
    } else {
      play({ type: 'playSpell', uid: inst.uid })
    }
  }

  function activateEffectOf(monster) {
    const activated = getActivated(cardOf(monster))
    const kind = activated.kind
    if (['debuff', 'destroyWeaker', 'lockAttack', 'bind', 'drain', 'curse', 'vine'].includes(kind)) {
      setSelectedFieldUid(null)
      setEffectPick({
        uid: monster.uid,
        kind,
        discardUid: null,
        needsDiscard: kind === 'debuff' && activated.discardCost !== false,
      })
      setError(null)
    } else {
      play({ type: 'activate', uid: monster.uid })
    }
  }

  // เหตุผลที่อัญเชิญมอนสเตอร์ในมือไม่ได้
  function summonReason(card, inst) {
    if (summonable.has(inst.uid)) return null
    const onlyBy = getSummonOnlyBy(card)
    if (onlyBy) return `อัญเชิญได้ด้วย "${cardOf({ cardId: onlyBy }).name}" เท่านั้น`
    if (tributesRequired(card) === 0 && !isNormalSummonable(card)) {
      return card.summonType === 'ritual' ? 'ต้องอัญเชิญด้วยการ์ดพิธีกรรม' : 'ต้องอัญเชิญด้วยคาถาผสานร่าง'
    }
    if (!isMyTurn) return 'ยังไม่ถึงตาของคุณ'
    if (game.phase !== 'main1' && game.phase !== 'main2') return 'อัญเชิญได้ในเฟสหลักเท่านั้น'
    if (me.hasNormalSummoned) return 'อัญเชิญไปแล้วในเทิร์นนี้'
    const cost = getTributeCost(game, PLAYER, card)
    if (cost > me.field.filter(Boolean).length) return `ต้องมีมอนสเตอร์บนสนามให้สังเวย ${cost} ตัว`
    return 'สนามเต็มแล้ว'
  }

  // โหมดขึ้นขี่: ป้ายบอกว่าการ์ดใบนี้ใช้เป็น "คน" หรือ "สัตว์" ได้
  function mountRoleBadge(m) {
    if (!mountOption || !mountPool.has(m.uid)) return null
    if (mountVerb !== 'ขึ้นขี่') return { tone: 'tie', text: '🌿 วัตถุดิบ' }
    const human = mountOption.pairs.some(([a]) => a === m.uid)
    const animal = mountOption.pairs.some(([, b]) => b === m.uid)
    return { tone: 'tie', text: human && animal ? 'คน/สัตว์' : human ? '👤 คน' : '🐾 สัตว์' }
  }

  // ปุ่มขึ้นขี่บอกร่างที่จะได้ เช่น "🐎 ขึ้นขี่ → พรานขี่เสือ" (หลายแบบ = บอกจำนวน)
  function mountButtonLabel() {
    const options = getMountOptions(game, PLAYER)
    if (options.length !== 1) return `🐎 ขึ้นขี่/รวมร่าง (${options.length} แบบ)`
    const rider = cardOf(me.extraDeck.find((c) => c.uid === options[0].fusionUid))
    const verb = getMountVerb(rider)
    return `${verb === 'ขึ้นขี่' ? '🐎' : '🌿'} ${verb} → ${rider.name}`
  }

  // ป้ายสถานะบนมอนสเตอร์: คำสาป / ห้ามโจมตี (รากตะเคียน/พระอาจารย์)
  function statusBadge(m) {
    if (m.curse?.until >= game.turn) return { tone: 'lose', text: 'ต้องสาป' }
    if (m.cannotAttackTurn >= game.turn || m.cannotAttackUntil >= game.turn) return { tone: 'lose', text: 'ห้ามโจมตี' }
    if (m.growth > 0 && !m.faceDown) return { tone: 'win', text: `🌱 ${m.growth}` }
    return null
  }

  // ป้ายคาดการณ์บนเป้าหมาย (การ์ดคว่ำไม่รู้ค่า จึงแสดง ?)
  function targetBadge(m) {
    if (!attacker) return null
    if (m.faceDown) return { tone: 'tie', text: 'คว่ำ', detail: '?' }
    const r = previewBattle(game, PLAYER, attacker.uid, m.uid)
    const numbers = `${formatNumber(r.attacker.final)}:${formatNumber(r.defender.final)}`
    if (m.position === 'defense') {
      const label = { attacker: 'ทำลาย', defender: 'ตีไม่ผ่าน', tie: 'ไม่เกิดผล' }[r.outcome]
      return { tone: OUTCOME_BADGE[r.outcome].tone, text: label, detail: numbers }
    }
    const b = OUTCOME_BADGE[r.outcome]
    return { tone: b.tone, text: b.label, detail: numbers }
  }

  // ---------- คำแนะนำ ----------
  let hint
  if (game.winner) hint = 'เกมจบแล้ว'
  else if (mustRespond) {
    const atk = cardOf(opp.field.find((m) => m?.uid === pending.attackerUid))
    const target = pending.targetUid ? cardOf(me.field.find((m) => m?.uid === pending.targetUid)).name : 'คุณโดยตรง'
    hint = `${atk.name} ของคู่ต่อสู้ประกาศโจมตี ${target} — จะตอบโต้ไหม?`
  } else if (mustChoose) hint = choice.prompt
  else if (choice) hint = `${PLAYER_NAMES[choice.player]}กำลังตัดสินใจ…`
  else if (!isMyTurn) hint = `${PLAYER_NAMES[AI]}กำลังเล่น…`
  else if (ritual) {
    const target = cardOf({ cardId: ritual.target })
    const total = ritualPick.selected.reduce((sum, uid) => {
      const inst = me.hand.find((c) => c.uid === uid) ?? me.field.find((m) => m?.uid === uid)
      return sum + cardOf(inst).level
    }, 0)
    hint = `เลือกเครื่องสังเวยจากมือ/สนามให้ ${target.name}: ระดับรวม ${total}/${ritual.requiredLevel}`
  } else if (mountPick) {
    if (!mountOption) hint = 'เลือกร่างขี่/ร่างรวมจากกองพิเศษ'
    else {
      const recipe = getFusionMaterials(cardOf(game.players.player.extraDeck.find((c) => c.uid === mountPick.fusionUid)))
        .map((m) => m.label)
        .join(' + ')
      const names = mountPick.selected.map((uid) => cardOf(me.field.find((m) => m?.uid === uid)).name).join(' + ')
      hint = mountReady
        ? `พร้อม${mountVerb}: ${names} — กดปุ่มด้านล่างเพื่อยืนยัน (แตะการ์ดเพื่อเปลี่ยน)`
        : mountVerb === 'ขึ้นขี่'
          ? `แตะการ์ดที่มีป้าย 👤 คน / 🐾 สัตว์ (${mountPick.selected.length}/2): ${recipe}`
          : `แตะการ์ดที่มีป้าย 🌿 วัตถุดิบ (${mountPick.selected.length}/${mountNeed}): ${recipe}`
    }
  } else if (fusionPick) {
    if (!fusionTargetInst) hint = 'เลือกมอนสเตอร์ผสานร่างจากกองพิเศษ'
    else {
      const recipe = getFusionMaterials(cardOf(fusionTargetInst)).map((m) => m.label).join(' + ')
      hint = `เลือกวัตถุดิบจากมือ/สนาม (${fusionPick.selected.length}/${fusionNeed}): ${recipe}`
    }
  } else if (revivePick) {
    hint = reviveTargets.length ? 'เลือกมอนสเตอร์ในสุสานที่จะคืนชีพ (ท่าโจมตี)' : 'ไม่มีมอนสเตอร์ในสุสานที่คืนชีพได้'
  } else if (equipPick) {
    hint = getBranchSpell(cardOf(equipInst))
      ? 'แตะต้นสายบนสนาม (พรานหนุ่ม / พระอาจารย์) เพื่อเปลี่ยนเป็นร่างสายมืด'
      : `แตะมอนสเตอร์ของคุณที่จะ${getBuffSpell(cardOf(equipInst)) ? 'ใช้' : 'สวม'} ${cardOf(equipInst).name}`
  } else if (effectPick) {
    hint = pickingDiscard
      ? 'แตะการ์ดในมือที่จะทิ้ง 1 ใบ'
      : effectPick.kind === 'destroyWeaker'
      ? 'แตะมอนสเตอร์ศัตรูหงายหน้าที่ ATK ต่ำกว่า เพื่อทำลาย'
      : effectPick.kind === 'lockAttack'
      ? 'แตะมอนสเตอร์ศัตรูเผ่าอสูร/วิญญาณ ที่จะห้ามโจมตีเทิร์นหน้า'
      : effectPick.kind === 'bind'
      ? 'แตะมอนสเตอร์ศัตรูที่จะให้รากตะเคียนพันไว้'
      : effectPick.kind === 'drain'
      ? 'แตะมอนสเตอร์ศัตรูที่จะดูดพลัง'
      : effectPick.kind === 'vine'
      ? 'แตะมอนสเตอร์ศัตรูที่จะให้เถาหวายรัด (ATK −300 ข้ามเทิร์น)'
      : effectPick.kind === 'curse'
      ? 'แตะมอนสเตอร์ศัตรูที่จะสาป'
      : 'แตะมอนสเตอร์หงายหน้าของคู่ต่อสู้ที่จะลด ATK'
  } else if (tributeCard) {
    hint = `แตะมอนสเตอร์ของคุณที่จะสังเวยให้ ${tributeCard.name} (${tributePick.selected.length}/${tributeNeeded})`
  } else if (game.phase === 'discard') {
    hint = `การ์ดในมือเกิน ${RULES.handLimit} ใบ — แตะการ์ดเพื่อทิ้งอีก ${getHandOverflow(game, PLAYER)} ใบ`
  } else if (game.phase === 'battle') {
    hint = attacker
      ? !oppHasMonsters
        ? 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ — โจมตีตรงได้!'
        : canAttackDirectly(game, PLAYER, attacker.uid)
        ? `เลือกเป้าหมาย หรือให้ ${cardOf(attacker).name} บินข้ามการ์ดคว่ำโจมตีตรง`
        : `เลือกเป้าหมายให้ ${cardOf(attacker).name}`
      : readyAttackers.size > 0
      ? 'แตะมอนสเตอร์ของคุณเพื่อเลือกตัวโจมตี'
      : 'ไม่มีมอนสเตอร์ที่โจมตีได้แล้ว'
  } else if (me.field.some((m) => m && !evolveBlocker(game, PLAYER, m.uid))) {
    hint = '🎖️ มีมอนสเตอร์เลื่อนยศได้ — แตะการ์ดที่มี ⭐ สีทองบนสนาม'
  } else if (summonable.size > 0) hint = 'แตะการ์ดในมือเพื่ออัญเชิญ หรือแตะมอนสเตอร์บนสนามเพื่อเปลี่ยนท่า/ใช้ความสามารถ'
  else if (!canAttackThisTurn(game)) hint = 'เทิร์นแรกของผู้เริ่มก่อน: โจมตีไม่ได้'
  else hint = 'พร้อมเข้าเฟสต่อสู้หรือจบเทิร์น'

  // ---------- ปุ่มกลางกระดาน ----------
  let actions = null
  if (mustChoose) {
    actions = choice.options.map((o) => (
      <button
        key={o.id}
        type="button"
        className={o.id === 'skip' ? 'btn' : 'btn btn--primary'}
        onClick={() => play({ type: 'choose', optionId: o.id })}
      >
        {o.label}
      </button>
    ))
  } else if (mustRespond) {
    actions = (
      <>
        {pending.options.map((o) => (
          <button key={o.id} type="button" className="btn btn--danger" onClick={() => play({ type: 'respond', trapUid: o.id })}>
            {o.label}
          </button>
        ))}
        <button type="button" className="btn" onClick={() => play({ type: 'respond', trapUid: null })}>
          ไม่เปิด
        </button>
      </>
    )
  } else if (isMyTurn && ritualPick) {
    actions = (
      <>
        <button
          type="button"
          className="btn btn--primary"
          disabled={Boolean(ritualProblem)}
          title={ritualProblem ?? undefined}
          onClick={() => play({ type: 'playSpell', uid: ritualPick.ritualUid, tributes: ritualPick.selected })}
        >
          🙏 ยืนยันพิธี
        </button>
        <button type="button" className="btn" onClick={() => setRitualPick(null)}>
          ยกเลิก
        </button>
      </>
    )
  } else if (isMyTurn && mountPick) {
    const riderOf = (uid) => cardOf(me.extraDeck.find((c) => c.uid === uid))
    actions = (
      <>
        {!mountOption &&
          mountOptions.map((o) => (
            <button
              key={o.fusionUid}
              type="button"
              className="btn btn--primary"
              onClick={() => setMountPick({ fusionUid: o.fusionUid, selected: o.pairs.length === 1 ? o.pairs[0] : [] })}
            >
              {getMountVerb(riderOf(o.fusionUid)) === 'ขึ้นขี่' ? '🐎' : '🌿'} {riderOf(o.fusionUid).name} · ATK{' '}
              {formatNumber(riderOf(o.fusionUid).atk)}
            </button>
          ))}
        {mountOption && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!mountReady}
            onClick={() => play({ type: 'mount', fusionUid: mountPick.fusionUid, materials: mountPick.selected })}
          >
            {mountVerb === 'ขึ้นขี่' ? '🐎' : '🌿'} {mountVerb}เป็น {riderOf(mountPick.fusionUid).name}
          </button>
        )}
        {mountOption && mountOptions.length > 1 && (
          <button type="button" className="btn" onClick={() => setMountPick({ fusionUid: null, selected: [] })}>
            เปลี่ยนร่างขี่
          </button>
        )}
        <button type="button" className="btn" onClick={() => setMountPick(null)}>
          ยกเลิก
        </button>
      </>
    )
  } else if (isMyTurn && fusionPick) {
    actions = (
      <>
        {!fusionTargetInst &&
          fusionTargets.map((t) => (
            <button
              key={t.uid}
              type="button"
              className="btn btn--primary"
              onClick={() => setFusionPick((f) => ({ ...f, targetUid: t.uid, selected: [] }))}
            >
              🌀 {cardOf(t).name} · ATK {formatNumber(cardOf(t).atk)}
            </button>
          ))}
        {fusionTargetInst && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={Boolean(fusionIssue)}
            title={fusionIssue || undefined}
            onClick={() =>
              play({
                type: 'playSpell',
                uid: fusionPick.spellUid,
                fusionTarget: fusionPick.targetUid,
                tributes: fusionPick.selected,
              })
            }
          >
            🌀 ผสานเป็น {cardOf(fusionTargetInst).name}
          </button>
        )}
        {fusionTargetInst && fusionTargets.length > 1 && (
          <button type="button" className="btn" onClick={() => setFusionPick((f) => ({ ...f, targetUid: null, selected: [] }))}>
            เปลี่ยนร่างผสาน
          </button>
        )}
        <button type="button" className="btn" onClick={() => setFusionPick(null)}>
          ยกเลิก
        </button>
      </>
    )
  } else if (isMyTurn && revivePick) {
    actions = (
      <>
        {reviveTargets.map((t) => (
          <button
            key={t.uid}
            type="button"
            className="btn btn--primary"
            onClick={() => play({ type: 'playSpell', uid: revivePick, targetUid: t.uid })}
          >
            💧 {cardOf(t).name} · ATK {formatNumber(cardOf(t).atk)}
          </button>
        ))}
        <button type="button" className="btn" onClick={() => setRevivePick(null)}>
          ยกเลิก
        </button>
      </>
    )
  } else if (isMyTurn && equipPick) {
    actions = (
      <button type="button" className="btn" onClick={() => setEquipPick(null)}>
        ยกเลิก
      </button>
    )
  } else if (isMyTurn && effectPick) {
    actions = (
      <button type="button" className="btn" onClick={() => setEffectPick(null)}>
        ยกเลิก
      </button>
    )
  } else if (isMyTurn && tributePick) {
    actions = (
      <>
        <button
          type="button"
          className="btn btn--primary"
          disabled={tributePick.selected.length !== tributeNeeded}
          onClick={() =>
            play({ type: 'summon', uid: tributePick.handUid, tributes: tributePick.selected, position: tributePick.position })
          }
        >
          {tributePick.position === 'defense' ? '🛡 ยืนยันสังเวย (วางคว่ำ)' : '✨ ยืนยันสังเวย'}
        </button>
        <button type="button" className="btn" onClick={() => setTributePick(null)}>
          ยกเลิก
        </button>
      </>
    )
  } else if (isMyTurn) {
    actions = (
      <>
        {attacker && canAttackDirectly(game, PLAYER, attacker.uid) && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => play({ type: 'attack', attackerUid: attacker.uid, targetUid: null })}
          >
            ⚔️ โจมตีตรง {formatNumber(getFieldAtk(game, PLAYER, attacker.uid))}
          </button>
        )}
        {(game.phase === 'main1' || game.phase === 'main2') && !mountBlocker(game, PLAYER) && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const options = getMountOptions(game, PLAYER)
              clearSelections()
              // มีร่างเดียวและคู่เดียว → เลือกวัตถุดิบให้เลย กดยืนยันได้ทันที
              const only = options.length === 1 ? options[0] : null
              setMountPick({ fusionUid: only?.fusionUid ?? null, selected: only?.pairs.length === 1 ? only.pairs[0] : [] })
              setError(null)
            }}
          >
            {mountButtonLabel()}
          </button>
        )}
        {game.phase === 'main1' && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAttackThisTurn(game)}
            onClick={() => play({ type: 'enterBattle' })}
          >
            ⚔️ เข้าเฟสต่อสู้
          </button>
        )}
        {game.phase === 'battle' && (
          <button type="button" className="btn" onClick={() => play({ type: 'endBattle' })}>
            จบเฟสต่อสู้
          </button>
        )}
        {game.phase !== 'discard' && (
          <button type="button" className="btn" onClick={() => play({ type: 'endTurn' })}>
            จบเทิร์น ⏭
          </button>
        )}
      </>
    )
  }

  const selectedActivated = selectedField ? getActivated(cardOf(selectedField)) : null
  const selectedEvolve = selectedField ? getEvolve(cardOf(selectedField)) : null
  const selectedSources = selectedEvolve ? getEvolveSources(game, PLAYER, selectedField.uid) : null

  // ตัวนับแต้มบนการ์ด (มอนสเตอร์หงายที่มีสายประสบการณ์)
  const xpOf = (owner) => (m) => {
    const evolve = getEvolve(cardOf(m))
    if (!evolve || m.faceDown) return null
    const ready = owner === PLAYER && !evolveBlocker(game, PLAYER, m.uid)
    return { text: `⭐ ${Math.min(m.xp ?? 0, evolve.xpNeeded)}/${evolve.xpNeeded}`, ready }
  }

  return (
    <div
      className="battle"
      data-battle-root
      data-field-me={me.fieldSpell?.cardId ?? 'none'}
      data-field-opp={opp.fieldSpell?.cardId ?? 'none'}
    >
      <LpHud game={game} />
      <PlayerBar player={opp} isActive={game.activePlayer === AI} isOpponent />

      <BoardSide
        player={opp}
        isOpponent
        lpBadge={<SideLp player={opp} isOpponent isActive={game.activePlayer === AI} />}
        onOpenPile={(playerId, kind) => setOpenPile({ playerId, kind })}
        onInspect={setInspectCard}
        monsterRow={
          <FieldRow
            label="ช่องมอนสเตอร์ของคู่ต่อสู้"
            field={opp.field}
            atkOf={(m) => getFieldAtk(game, AI, m.uid)}
            xpOf={xpOf(AI)}
            hideFaceDown
            renderBadge={(m) =>
              targetBadge(m) ?? statusBadge(m)
            }
            classFor={(m) =>
              (attacker && attackableTargets.has(m.uid)) ||
              (pickingTarget && activationTargets.has(m.uid))
                ? 'mini-card--target'
                : ''
            }
            onTap={onOpponentMonsterTap}
          />
        }
      />

      <div className="battle__status">
        <div className="battle__turn">
          <span className="battle__turn-num">เทิร์น {game.turn}</span>
          <span className={`battle__whose battle__whose--${game.activePlayer}`}>
            ตาของ{PLAYER_NAMES[game.activePlayer]}
          </span>
          <span className="battle__phase">{PHASE_NAMES[game.phase]}</span>
        </div>
        <p className="battle__hint">{hint}</p>
        {error && (
          <p className="battle__error" role="alert">
            ⚠️ {error}
          </p>
        )}
        {actions && <div className="battle__actions">{actions}</div>}
      </div>

      <BoardSide
        player={me}
        lpBadge={<SideLp player={me} isActive={game.activePlayer === PLAYER} />}
        onSpellTrapTap={(t) => {
          if (t.faceDown && getContinuousTrap(cardOf(t)) && isMyTurn) {
            setSelectedHandUid(null)
            setSelectedFieldUid(null)
            setSelectedTrapUid((uid) => (uid === t.uid ? null : t.uid))
          } else setInspectCard(cardOf(t))
        }}
        onOpenPile={(playerId, kind) => setOpenPile({ playerId, kind })}
        onInspect={setInspectCard}
        monsterRow={
          <FieldRow
            label="ช่องมอนสเตอร์ของคุณ"
            field={me.field}
            atkOf={(m) => getFieldAtk(game, PLAYER, m.uid)}
            xpOf={xpOf(PLAYER)}
            renderBadge={(m) =>
              isTributeSelected(m.uid) ? materialBadge : mountRoleBadge(m) ?? statusBadge(m)
            }
            classFor={(m) =>
              [
                (m.uid === attackerUid || m.uid === selectedFieldUid) && 'mini-card--selected',
                isTributeSelected(m.uid) && 'mini-card--tribute',
                (tributePick ||
                  ritualPick ||
                  (fusionTargetInst && fusionPool.has(m.uid)) ||
                  mountPool.has(m.uid) ||
                  equipTargets.has(m.uid) ||
                  readyAttackers.has(m.uid)) &&
                  'mini-card--ready',
                (tributePick || ritualPick || (fusionTargetInst && fusionPool.has(m.uid)) || mountPool.has(m.uid) || equipTargets.has(m.uid)) &&
                  !isTributeSelected(m.uid) &&
                  'mini-card--pickable',
                m.hasAttacked && !readyAttackers.has(m.uid) && 'mini-card--spent',
              ]
                .filter(Boolean)
                .join(' ')
            }
            onTap={onMyMonsterTap}
          />
        }
      />

      <PlayerBar player={me} isActive={game.activePlayer === PLAYER} />

      {/* แถบมือ: ลอยติดขอบล่างจอบนมือถือ — เมนูการ์ดอยู่เหนือแถวการ์ดให้กดถึงง่าย */}
      <section className="hand" aria-label="การ์ดในมือ">
        {selectedField && (
          <FieldActionSheet
            card={cardOf(selectedField)}
            monster={selectedField}
            blocker={positionChangeBlocker(game, PLAYER, selectedField.uid)}
            onChange={() => play({ type: 'changePosition', uid: selectedField.uid })}
            evolve={
              selectedEvolve && {
                intoName: cardOf({ cardId: selectedEvolve.into }).name,
                blocker: evolveBlocker(game, PLAYER, selectedField.uid),
                fromHand: Boolean(selectedSources.hand),
                fromDeck: Boolean(selectedSources.deck),
                onEvolve: (from) => play({ type: 'evolve', uid: selectedField.uid, from }),
              }
            }
            effect={
              selectedActivated && {
                label: selectedActivated.label,
                blocker: activationBlocker(game, PLAYER, selectedField.uid),
                onUse: () => activateEffectOf(selectedField),
              }
            }
            onInspect={() => setInspectCard(cardOf(selectedField))}
            onClose={() => setSelectedFieldUid(null)}
          />
        )}
        {selectedTrap && (
          <TrapActionSheet
            card={cardOf(selectedTrap)}
            blocker={trapActivationBlocker(game, PLAYER, selectedTrap.uid)}
            onActivate={() => play({ type: 'activateTrap', uid: selectedTrap.uid })}
            onInspect={() => setInspectCard(cardOf(selectedTrap))}
            onClose={() => setSelectedTrapUid(null)}
          />
        )}
        {selectedHand && (
          <HandActionSheet
            card={cardOf(selectedHand)}
            canDiscard={isMyTurn && game.phase === 'discard'}
            canSummon={summonable.has(selectedHand.uid)}
            summonReason={summonReason(cardOf(selectedHand), selectedHand)}
            tributeCost={getTributeCost(game, PLAYER, cardOf(selectedHand))}
            blocker={cardOf(selectedHand).type === 'monster' ? null : handCardBlocker(game, PLAYER, selectedHand.uid)}
            onSummon={(position) => startSummon(selectedHand, position)}
            onPlay={() => playNonMonster(selectedHand)}
            special={
              getSpecialSummon(cardOf(selectedHand)) && {
                label: getSpecialSummon(cardOf(selectedHand)).label,
                blocker: specialSummonBlocker(game, PLAYER, selectedHand.uid),
                onUse: () => play({ type: 'specialSummon', uid: selectedHand.uid }),
              }
            }
            onDiscard={() => play({ type: 'discard', uid: selectedHand.uid })}
            onInspect={() => setInspectCard(cardOf(selectedHand))}
            onClose={() => setSelectedHandUid(null)}
          />
        )}
        <div className="hand__row">
          {me.hand.map((inst) => {
            const card = cardOf(inst)
            const picking = ritualPick || effectPick || fusionPick || revivePick || equipPick || mountPick
            const cls = [
              'mini-card--hand',
              [selectedHandUid, tributePick?.handUid, ritualPick?.ritualUid, fusionPick?.spellUid, revivePick, equipPick].includes(
                inst.uid
              ) &&
                'mini-card--selected',
              isTributeSelected(inst.uid) && 'mini-card--tribute',
              !picking && summonable.has(inst.uid) && 'mini-card--ready',
              ritualPick && ritualPool.has(inst.uid) && 'mini-card--ready',
              fusionTargetInst && fusionPool.has(inst.uid) && 'mini-card--ready',
              ((ritualPick && ritualPool.has(inst.uid)) || (fusionTargetInst && fusionPool.has(inst.uid))) &&
                !isTributeSelected(inst.uid) &&
                'mini-card--pickable',
              ((game.phase === 'discard' && isMyTurn) || pickingDiscard) && 'mini-card--discardable',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <MiniCard
                key={inst.uid}
                uid={inst.uid}
                card={card}
                className={cls}
                badge={
                  isTributeSelected(inst.uid)
                    ? materialBadge
                    : effectPick?.discardUid === inst.uid
                    ? { tone: 'lose', text: 'ทิ้ง' }
                    : null
                }
                onClick={() => onHandCardTap(inst)}
                onPreview={setPreviewCard}
              />
            )
          })}
          {me.hand.length === 0 && <p className="hand__empty">ไม่มีการ์ดในมือ</p>}
        </div>

      </section>

      {/* PC: ชี้เมาส์ที่การ์ดในมือ → การ์ดขนาดเต็มมุมซ้ายล่าง อ่านเอฟเฟกต์ได้ (มือถือแตะ 🔍 แทน) */}
      {previewCard && (
        <div className="hand-preview" aria-hidden="true">
          <MonsterCard card={previewCard} />
        </div>
      )}

      <BattleLog log={game.log} />

      {openPile && (
        <PileViewer
          player={game.players[openPile.playerId]}
          kind={openPile.kind}
          isOpponent={openPile.playerId === AI}
          onInspect={setInspectCard}
          onClose={() => setOpenPile(null)}
        />
      )}

      {inspectCard && (
        <div className="battle-modal" onClick={() => setInspectCard(null)} role="dialog" aria-label={inspectCard.name}>
          <div className="battle-modal__card">
            <MonsterCard card={inspectCard} />
          </div>
          <p className="battle-modal__hint">แตะที่ใดก็ได้เพื่อปิด</p>
        </div>
      )}

      <BattleFx game={game} />

      {game.winner && (
        <div className="battle-modal battle-modal--result" role="dialog" aria-label="ผลการต่อสู้">
          <div className="result-panel">
            <p className="result-panel__title">{game.winner === PLAYER ? '🏆 คุณชนะ!' : '💀 คุณแพ้'}</p>
            <p className="result-panel__reason">
              {game.endReason === 'deckOut'
                ? `${PLAYER_NAMES[game.winner === PLAYER ? AI : PLAYER]}ต้องจั่วแต่การ์ดหมดกอง`
                : `LP ของ${PLAYER_NAMES[game.winner === PLAYER ? AI : PLAYER]}เหลือ 0`}
            </p>
            <p className="result-panel__score">
              LP คุณ {formatNumber(me.lp)} · คู่ต่อสู้ {formatNumber(opp.lp)} · {game.turn} เทิร์น
            </p>
            <button type="button" className="btn btn--primary" onClick={restart}>
              เล่นใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, field, atkOf, xpOf, onTap, classFor, renderBadge, hideFaceDown = false }) {
  return (
    <section className="field-row" aria-label={label} data-zone-type="monster">
      {field.map((m, i) =>
        m ? (
          <MiniCard
            key={m.uid}
            uid={m.uid}
            zone={i}
            card={cardOf(m)}
            atk={atkOf(m)}
            xp={xpOf?.(m)}
            defense={m.position === 'defense'}
            faceDown={m.faceDown}
            hidden={hideFaceDown && m.faceDown}
            className={`mini-card--field ${classFor?.(m) ?? ''}`}
            badge={renderBadge?.(m)}
            onClick={() => onTap(m)}
          />
        ) : (
          <div key={`empty-${i}`} className="field-row__slot" aria-label={`ช่องว่าง ${i + 1}`} data-zone={i} />
        )
      )}
    </section>
  )
}
