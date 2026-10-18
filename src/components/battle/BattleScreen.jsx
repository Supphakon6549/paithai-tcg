import { useEffect, useState } from 'react'
import MonsterCard from '../cards/MonsterCard'
import { FieldActionSheet, HandActionSheet } from './ActionSheets'
import BattleLog from './BattleLog'
import BoardSide, { PileViewer } from './BoardSide'
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
  canAttackThisTurn,
  cardOf,
  createGame,
  currentActor,
  formatNumber,
  getActivated,
  getAiAction,
  getFieldAtk,
  getHandOverflow,
  getReadyAttackers,
  getRitualInfo,
  getSummonableHand,
  getTributeCost,
  handCardBlocker,
  isNormalSummonable,
  positionChangeBlocker,
  previewBattle,
  ritualTributePool,
  ritualTributeProblem,
  tributesRequired,
} from '../../engine'
import './BattleScreen.css'
// ธีมและแอนิเมชัน (ทีมภาพดูแล) — โหลดหลัง BattleScreen.css เพื่อทับสไตล์พื้นฐานได้
import './BattleTheme.css'
import BattleFx from './fx/BattleFx'

const AI_STEP_DELAY = { attack: 1100, respond: 1100, default: 750 }

// deckList / extraDeckList จากหน้าจัดสำรับ (ไม่ระบุ = สำรับเริ่มต้น) — AI ใช้สำรับเริ่มต้นเสมอ
const newGame = (deckList, extraDeckList) =>
  createGame({
    seed: Date.now(),
    firstPlayer: Math.random() < 0.5 ? PLAYER : AI,
    ...(deckList && { deckList }),
    ...(extraDeckList && { extraDeckList }),
  })

// สำรับที่ส่งมาใช้ไม่ได้ → เล่นด้วยสำรับเริ่มต้นแทน พร้อมข้อความแจ้ง
function startGame(deckList, extraDeckList) {
  try {
    return { game: newGame(deckList, extraDeckList), deckError: null }
  } catch (e) {
    return { game: newGame(), deckError: `${e.message} — ใช้สำรับเริ่มต้นแทน` }
  }
}

const OUTCOME_BADGE = {
  attacker: { tone: 'win', label: 'ชนะ' },
  defender: { tone: 'lose', label: 'แพ้' },
  tie: { tone: 'tie', label: 'เสมอ' },
}

const TRIBUTE_BADGE = { tone: 'lose', text: 'สังเวย' }

const toggle = (list, uid, max = Infinity) =>
  list.includes(uid) ? list.filter((u) => u !== uid) : list.length < max ? [...list, uid] : list

export default function BattleScreen({ active = true, deckList, extraDeckList }) {
  const [initial] = useState(() => startGame(deckList, extraDeckList))
  const [game, setGame] = useState(initial.game)
  const [selectedHandUid, setSelectedHandUid] = useState(null)
  const [selectedFieldUid, setSelectedFieldUid] = useState(null) // มอนสเตอร์ของเราที่เปิดเมนู
  const [attackerUid, setAttackerUid] = useState(null)
  const [tributePick, setTributePick] = useState(null) // อัญเชิญสังเวย { handUid, selected, position }
  const [ritualPick, setRitualPick] = useState(null) // พิธีกรรม { ritualUid, selected }
  const [effectPick, setEffectPick] = useState(null) // ความสามารถที่ต้องเลือก { uid, discardUid }
  const [inspectCard, setInspectCard] = useState(null)
  const [openPile, setOpenPile] = useState(null) // { playerId, kind }
  const [error, setError] = useState(initial.deckError)

  const me = game.players[PLAYER]
  const opp = game.players[AI]
  const pending = game.pendingResponse
  const mustRespond = pending?.responder === PLAYER && !game.winner
  const isMyTurn = game.activePlayer === PLAYER && !game.winner && !pending

  const summonable = new Set(getSummonableHand(game, PLAYER).map((c) => c.uid))
  const readyAttackers = new Set(getReadyAttackers(game, PLAYER).map((m) => m.uid))
  const attacker = me.field.find((m) => m?.uid === attackerUid) ?? null
  const selectedHand = me.hand.find((c) => c.uid === selectedHandUid) ?? null
  const selectedField = me.field.find((m) => m?.uid === selectedFieldUid) ?? null
  const oppHasMonsters = opp.field.some(Boolean)

  const tributeInst = tributePick ? me.hand.find((c) => c.uid === tributePick.handUid) : null
  const tributeCard = tributeInst ? cardOf(tributeInst) : null
  const tributeNeeded = tributeCard ? getTributeCost(game, PLAYER, tributeCard) : 0

  const ritualInst = ritualPick ? me.hand.find((c) => c.uid === ritualPick.ritualUid) : null
  const ritual = ritualInst ? getRitualInfo(cardOf(ritualInst)) : null
  const ritualPool = new Set(ritual ? ritualTributePool(game, PLAYER, ritualInst.uid).map((c) => c.uid) : [])
  const ritualProblem = ritual ? ritualTributeProblem(game, PLAYER, ritualInst.uid, ritualPick.selected) : null
  const isTributeSelected = (uid) => Boolean(tributePick?.selected.includes(uid) || ritualPick?.selected.includes(uid))

  function clearSelections() {
    setSelectedHandUid(null)
    setSelectedFieldUid(null)
    setAttackerUid(null)
    setTributePick(null)
    setRitualPick(null)
    setEffectPick(null)
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
    const timer = setTimeout(() => setGame(applyAction(game, action)), delay)
    return () => clearTimeout(timer)
  }, [game, active])

  function restart() {
    const next = startGame(deckList, extraDeckList)
    setGame(next.game)
    clearSelections()
    setError(next.deckError)
  }

  // ---------- การแตะการ์ด ----------
  function onHandCardTap(inst) {
    if (ritualPick) {
      if (ritualPool.has(inst.uid)) {
        setRitualPick((r) => ({ ...r, selected: toggle(r.selected, inst.uid) }))
      }
      return
    }
    if (effectPick && !effectPick.discardUid) {
      setEffectPick((e) => ({ ...e, discardUid: inst.uid }))
      return
    }
    setAttackerUid(null)
    setTributePick(null)
    setSelectedFieldUid(null)
    setSelectedHandUid((uid) => (uid === inst.uid ? null : inst.uid))
  }

  function onMyMonsterTap(monster) {
    if (ritualPick) {
      setRitualPick((r) => ({ ...r, selected: toggle(r.selected, monster.uid) }))
      return
    }
    if (tributePick) {
      setTributePick((t) => ({ ...t, selected: toggle(t.selected, monster.uid, tributeNeeded) }))
      return
    }
    if (effectPick) return
    setSelectedHandUid(null)
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
    if (effectPick?.discardUid) {
      if (monster.faceDown) {
        setError('เลือกได้เฉพาะมอนสเตอร์ที่หงายหน้า')
        return
      }
      play({ type: 'activate', uid: effectPick.uid, discardUid: effectPick.discardUid, targetUid: monster.uid })
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
    } else if (card.type === 'trap') {
      play({ type: 'setTrap', uid: inst.uid })
    } else {
      play({ type: 'playSpell', uid: inst.uid })
    }
  }

  function activateEffectOf(monster) {
    if (getActivated(cardOf(monster)).kind === 'debuff') {
      setSelectedFieldUid(null)
      setEffectPick({ uid: monster.uid, discardUid: null })
      setError(null)
    } else {
      play({ type: 'activate', uid: monster.uid })
    }
  }

  // เหตุผลที่อัญเชิญมอนสเตอร์ในมือไม่ได้
  function summonReason(card, inst) {
    if (summonable.has(inst.uid)) return null
    if (tributesRequired(card) === 0 && !isNormalSummonable(card)) {
      return card.summonType === 'ritual' ? 'ต้องอัญเชิญด้วยการ์ดพิธีกรรม' : 'ต้องอัญเชิญผสานร่าง (ยังไม่เปิดในขั้นนี้)'
    }
    if (!isMyTurn) return 'ยังไม่ถึงตาของคุณ'
    if (game.phase !== 'main1' && game.phase !== 'main2') return 'อัญเชิญได้ในเฟสหลักเท่านั้น'
    if (me.hasNormalSummoned) return 'อัญเชิญไปแล้วในเทิร์นนี้'
    const cost = getTributeCost(game, PLAYER, card)
    if (cost > me.field.filter(Boolean).length) return `ต้องมีมอนสเตอร์บนสนามให้สังเวย ${cost} ตัว`
    return 'สนามเต็มแล้ว'
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
    const target = cardOf(me.field.find((m) => m?.uid === pending.targetUid))
    hint = `${atk.name} ของคู่ต่อสู้ประกาศโจมตี ${target.name} — จะเปิดกับดักไหม?`
  } else if (!isMyTurn) hint = `${PLAYER_NAMES[AI]}กำลังเล่น…`
  else if (ritual) {
    const target = cardOf({ cardId: ritual.target })
    const total = ritualPick.selected.reduce((sum, uid) => {
      const inst = me.hand.find((c) => c.uid === uid) ?? me.field.find((m) => m?.uid === uid)
      return sum + cardOf(inst).level
    }, 0)
    hint = `เลือกเครื่องสังเวยจากมือ/สนามให้ ${target.name}: ระดับรวม ${total}/${ritual.requiredLevel}`
  } else if (effectPick) {
    hint = effectPick.discardUid ? 'แตะมอนสเตอร์หงายหน้าของคู่ต่อสู้ที่จะลด ATK' : 'แตะการ์ดในมือที่จะทิ้ง 1 ใบ'
  } else if (tributeCard) {
    hint = `แตะมอนสเตอร์ของคุณที่จะสังเวยให้ ${tributeCard.name} (${tributePick.selected.length}/${tributeNeeded})`
  } else if (game.phase === 'discard') {
    hint = `การ์ดในมือเกิน ${RULES.handLimit} ใบ — แตะการ์ดเพื่อทิ้งอีก ${getHandOverflow(game, PLAYER)} ใบ`
  } else if (game.phase === 'battle') {
    hint = attacker
      ? oppHasMonsters
        ? `เลือกเป้าหมายให้ ${cardOf(attacker).name}`
        : 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ — โจมตีตรงได้!'
      : readyAttackers.size > 0
      ? 'แตะมอนสเตอร์ของคุณเพื่อเลือกตัวโจมตี'
      : 'ไม่มีมอนสเตอร์ที่โจมตีได้แล้ว'
  } else if (summonable.size > 0) hint = 'แตะการ์ดในมือเพื่ออัญเชิญ หรือแตะมอนสเตอร์บนสนามเพื่อเปลี่ยนท่า/ใช้ความสามารถ'
  else if (!canAttackThisTurn(game)) hint = 'เทิร์นแรกของผู้เริ่มก่อน: โจมตีไม่ได้'
  else hint = 'พร้อมเข้าเฟสต่อสู้หรือจบเทิร์น'

  // ---------- ปุ่มกลางกระดาน ----------
  let actions = null
  if (mustRespond) {
    actions = (
      <>
        {pending.trapUids.map((trapUid) => {
          const trap = me.spellTrap.find((t) => t?.uid === trapUid)
          return (
            <button key={trapUid} type="button" className="btn btn--danger" onClick={() => play({ type: 'respond', trapUid })}>
              🪤 เปิด {cardOf(trap).name}
            </button>
          )
        })}
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
        {attacker && !oppHasMonsters && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => play({ type: 'attack', attackerUid: attacker.uid, targetUid: null })}
          >
            ⚔️ โจมตีตรง {formatNumber(getFieldAtk(game, PLAYER, attacker.uid))}
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

  return (
    <div className="battle" data-battle-root>
      <PlayerBar player={opp} isActive={game.activePlayer === AI} isOpponent />

      <BoardSide
        player={opp}
        isOpponent
        onOpenPile={(playerId, kind) => setOpenPile({ playerId, kind })}
        onInspect={setInspectCard}
        monsterRow={
          <FieldRow
            label="ช่องมอนสเตอร์ของคู่ต่อสู้"
            field={opp.field}
            atkOf={(m) => getFieldAtk(game, AI, m.uid)}
            hideFaceDown
            renderBadge={targetBadge}
            classFor={(m) => (attacker || (effectPick?.discardUid && !m.faceDown) ? 'mini-card--target' : '')}
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
        onOpenPile={(playerId, kind) => setOpenPile({ playerId, kind })}
        onInspect={setInspectCard}
        monsterRow={
          <FieldRow
            label="ช่องมอนสเตอร์ของคุณ"
            field={me.field}
            atkOf={(m) => getFieldAtk(game, PLAYER, m.uid)}
            renderBadge={(m) => (isTributeSelected(m.uid) ? TRIBUTE_BADGE : null)}
            classFor={(m) =>
              [
                (m.uid === attackerUid || m.uid === selectedFieldUid) && 'mini-card--selected',
                isTributeSelected(m.uid) && 'mini-card--tribute',
                (tributePick || ritualPick || readyAttackers.has(m.uid)) && 'mini-card--ready',
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
            onDiscard={() => play({ type: 'discard', uid: selectedHand.uid })}
            onInspect={() => setInspectCard(cardOf(selectedHand))}
            onClose={() => setSelectedHandUid(null)}
          />
        )}
        <div className="hand__row">
          {me.hand.map((inst) => {
            const card = cardOf(inst)
            const picking = ritualPick || effectPick
            const cls = [
              'mini-card--hand',
              [selectedHandUid, tributePick?.handUid, ritualPick?.ritualUid].includes(inst.uid) && 'mini-card--selected',
              isTributeSelected(inst.uid) && 'mini-card--tribute',
              !picking && summonable.has(inst.uid) && 'mini-card--ready',
              ritualPick && ritualPool.has(inst.uid) && 'mini-card--ready',
              ((game.phase === 'discard' && isMyTurn) || (effectPick && !effectPick.discardUid)) && 'mini-card--discardable',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <MiniCard
                key={inst.uid}
                uid={inst.uid}
                card={card}
                className={cls}
                badge={isTributeSelected(inst.uid) ? TRIBUTE_BADGE : effectPick?.discardUid === inst.uid ? { tone: 'lose', text: 'ทิ้ง' } : null}
                onClick={() => onHandCardTap(inst)}
              />
            )
          })}
          {me.hand.length === 0 && <p className="hand__empty">ไม่มีการ์ดในมือ</p>}
        </div>

      </section>

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

function FieldRow({ label, field, atkOf, onTap, classFor, renderBadge, hideFaceDown = false }) {
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
