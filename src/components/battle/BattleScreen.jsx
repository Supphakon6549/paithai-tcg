import { useEffect, useState } from 'react'
import MonsterCard from '../cards/MonsterCard'
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
  applyAction,
  canAttackThisTurn,
  cardOf,
  createGame,
  formatNumber,
  getAiAction,
  getFieldAtk,
  getHandOverflow,
  getReadyAttackers,
  getSummonableHand,
  isNormalSummonable,
  positionChangeBlocker,
  previewBattle,
  getTributeCost,
  tributesRequired,
} from '../../engine'
import './BattleScreen.css'

const AI_STEP_DELAY = { attack: 1100, default: 750 }

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

export default function BattleScreen({ active = true, deckList, extraDeckList }) {
  const [initial] = useState(() => startGame(deckList, extraDeckList))
  const [game, setGame] = useState(initial.game)
  const [selectedHandUid, setSelectedHandUid] = useState(null)
  const [attackerUid, setAttackerUid] = useState(null)
  const [inspectCard, setInspectCard] = useState(null)
  const [openPile, setOpenPile] = useState(null) // { playerId, kind }
  const [tributePick, setTributePick] = useState(null) // { handUid, selected: [uid], position }
  const [selectedFieldUid, setSelectedFieldUid] = useState(null) // มอนสเตอร์ของเราที่เปิดเมนูเปลี่ยนท่า
  const [error, setError] = useState(initial.deckError)

  const me = game.players[PLAYER]
  const opp = game.players[AI]
  const isMyTurn = game.activePlayer === PLAYER && !game.winner

  const summonable = new Set(getSummonableHand(game, PLAYER).map((c) => c.uid))
  const readyAttackers = new Set(getReadyAttackers(game, PLAYER).map((m) => m.uid))
  const attacker = me.field.find((m) => m?.uid === attackerUid) ?? null
  const selectedHand = me.hand.find((c) => c.uid === selectedHandUid) ?? null
  const oppHasMonsters = opp.field.some(Boolean)
  const tributeInst = tributePick ? me.hand.find((c) => c.uid === tributePick.handUid) : null
  const tributeCard = tributeInst ? cardOf(tributeInst) : null
  const tributeNeeded = tributeCard ? getTributeCost(game, PLAYER, tributeCard) : 0

  // ทำแอ็กชันของผู้เล่น — ผิดกติกาจะแสดงข้อความแทน
  function play(action) {
    try {
      setGame(applyAction(game, { ...action, player: PLAYER }))
      setError(null)
      setSelectedHandUid(null)
      setAttackerUid(null)
      setTributePick(null)
      setSelectedFieldUid(null)
    } catch (e) {
      setError(e.message)
    }
  }

  // AI เล่นทีละขั้นพร้อมหน่วงเวลาให้เห็นแต่ละการกระทำ
  useEffect(() => {
    if (!active || game.winner || game.activePlayer !== AI) return
    const action = getAiAction(game)
    if (!action) return
    const delay = AI_STEP_DELAY[action.type] ?? AI_STEP_DELAY.default
    const timer = setTimeout(() => setGame(applyAction(game, action)), delay)
    return () => clearTimeout(timer)
  }, [game, active])

  function restart() {
    const next = startGame(deckList, extraDeckList)
    setGame(next.game)
    setSelectedHandUid(null)
    setAttackerUid(null)
    setTributePick(null)
    setSelectedFieldUid(null)
    setError(next.deckError)
  }

  function onHandCardTap(inst) {
    setAttackerUid(null)
    setTributePick(null)
    setSelectedFieldUid(null)
    setSelectedHandUid((uid) => (uid === inst.uid ? null : inst.uid))
  }

  function onMyMonsterTap(monster) {
    if (tributePick) {
      // เลือก/ยกเลิกตัวสังเวย (เลือกได้ไม่เกินจำนวนที่ต้องใช้)
      setTributePick(({ handUid, selected, position }) => ({
        handUid,
        position,
        selected: selected.includes(monster.uid)
          ? selected.filter((u) => u !== monster.uid)
          : selected.length < tributeNeeded
          ? [...selected, monster.uid]
          : selected,
      }))
      return
    }
    setSelectedHandUid(null)
    if (game.phase === 'battle') {
      if (readyAttackers.has(monster.uid)) {
        setAttackerUid((uid) => (uid === monster.uid ? null : monster.uid))
      } else {
        setInspectCard(cardOf(monster))
      }
      return
    }
    // เฟสหลัก: เปิดเมนูเปลี่ยนท่า / ดูการ์ด
    setSelectedFieldUid((uid) => (uid === monster.uid ? null : monster.uid))
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

  function onOpponentMonsterTap(monster) {
    if (attacker) {
      play({ type: 'attack', attackerUid: attacker.uid, targetUid: monster.uid })
    } else if (monster.faceDown) {
      setError('การ์ดคว่ำ — ยังไม่รู้ว่าเป็นการ์ดอะไร')
    } else {
      setInspectCard(cardOf(monster))
    }
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

  const selectedField = me.field.find((m) => m?.uid === selectedFieldUid) ?? null

  // ---------- คำแนะนำ / ปุ่มตามเฟส ----------
  let hint
  if (game.winner) hint = 'เกมจบแล้ว'
  else if (!isMyTurn) hint = `${PLAYER_NAMES[AI]}กำลังเล่น…`
  else if (tributeCard) {
    hint = `แตะมอนสเตอร์ของคุณที่จะสังเวยให้ ${tributeCard.name} (${tributePick.selected.length}/${tributeNeeded})`
  }
  else if (game.phase === 'discard') {
    hint = `การ์ดในมือเกิน ${RULES.handLimit} ใบ — แตะการ์ดเพื่อทิ้งอีก ${getHandOverflow(game, PLAYER)} ใบ`
  } else if (game.phase === 'battle') {
    hint = attacker
      ? oppHasMonsters
        ? `เลือกเป้าหมายให้ ${cardOf(attacker).name}`
        : 'ฝ่ายตรงข้ามไม่มีมอนสเตอร์ — โจมตีตรงได้!'
      : readyAttackers.size > 0
      ? 'แตะมอนสเตอร์ของคุณเพื่อเลือกตัวโจมตี'
      : 'ไม่มีมอนสเตอร์ที่โจมตีได้แล้ว'
  } else if (summonable.size > 0) hint = 'แตะการ์ดในมือเพื่ออัญเชิญ (เทิร์นละ 1 ตัว)'
  else if (!canAttackThisTurn(game)) hint = 'เทิร์นแรกของผู้เริ่มก่อน: โจมตีไม่ได้'
  else hint = 'พร้อมเข้าเฟสต่อสู้หรือจบเทิร์น'

  return (
    <div className="battle">
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
            classFor={() => (attacker ? 'mini-card--target' : '')}
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
        {isMyTurn && tributePick && (
          <div className="battle__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={tributePick.selected.length !== tributeNeeded}
              onClick={() =>
                play({
                  type: 'summon',
                  uid: tributePick.handUid,
                  tributes: tributePick.selected,
                  position: tributePick.position,
                })
              }
            >
              {tributePick.position === 'defense' ? '🛡 ยืนยันสังเวย (วางคว่ำ)' : '✨ ยืนยันสังเวย'}
            </button>
            <button type="button" className="btn" onClick={() => setTributePick(null)}>
              ยกเลิก
            </button>
          </div>
        )}
        {isMyTurn && !tributePick && (
          <div className="battle__actions">
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
          </div>
        )}
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
            renderBadge={(m) => (tributePick?.selected.includes(m.uid) ? { tone: 'lose', text: 'สังเวย' } : null)}
            classFor={(m) =>
              [
                (m.uid === attackerUid || m.uid === selectedFieldUid) && 'mini-card--selected',
                tributePick?.selected.includes(m.uid) && 'mini-card--tribute',
                (tributePick || readyAttackers.has(m.uid)) && 'mini-card--ready',
                m.hasAttacked && !readyAttackers.has(m.uid) && 'mini-card--spent',
              ]
                .filter(Boolean)
                .join(' ')
            }
            onTap={onMyMonsterTap}
          />
        }
      />

      {selectedField && (
        <FieldActionSheet
          card={cardOf(selectedField)}
          monster={selectedField}
          blocker={positionChangeBlocker(game, PLAYER, selectedField.uid)}
          onChange={() => play({ type: 'changePosition', uid: selectedField.uid })}
          onInspect={() => setInspectCard(cardOf(selectedField))}
          onClose={() => setSelectedFieldUid(null)}
        />
      )}

      <PlayerBar player={me} isActive={game.activePlayer === PLAYER} />

      <section className="hand" aria-label="การ์ดในมือ">
        <div className="hand__row">
          {me.hand.map((inst) => {
            const card = cardOf(inst)
            const cls = [
              'mini-card--hand',
              (inst.uid === selectedHandUid || inst.uid === tributePick?.handUid) && 'mini-card--selected',
              summonable.has(inst.uid) && 'mini-card--ready',
              game.phase === 'discard' && isMyTurn && 'mini-card--discardable',
            ]
              .filter(Boolean)
              .join(' ')
            return <MiniCard key={inst.uid} card={card} className={cls} onClick={() => onHandCardTap(inst)} />
          })}
          {me.hand.length === 0 && <p className="hand__empty">ไม่มีการ์ดในมือ</p>}
        </div>

        {selectedHand && (
          <HandActionSheet
            card={cardOf(selectedHand)}
            canSummon={summonable.has(selectedHand.uid)}
            canDiscard={isMyTurn && game.phase === 'discard'}
            hasSummoned={me.hasNormalSummoned}
            monsterCount={me.field.filter(Boolean).length}
            tributeCost={getTributeCost(game, PLAYER, cardOf(selectedHand))}
            isMyTurn={isMyTurn}
            phase={game.phase}
            onSummon={(position) => startSummon(selectedHand, position)}
            onDiscard={() => play({ type: 'discard', uid: selectedHand.uid })}
            onInspect={() => setInspectCard(cardOf(selectedHand))}
            onClose={() => setSelectedHandUid(null)}
          />
        )}
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
    <section className="field-row" aria-label={label}>
      {field.map((m, i) =>
        m ? (
          <MiniCard
            key={m.uid}
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
          <div key={`empty-${i}`} className="field-row__slot" aria-label={`ช่องว่าง ${i + 1}`} />
        )
      )}
    </section>
  )
}

function HandActionSheet({ card, canSummon, canDiscard, hasSummoned, monsterCount, tributeCost, isMyTurn, phase, onSummon, onDiscard, onInspect, onClose }) {
  const required = tributeCost
  let reason = null
  if (!canSummon && !canDiscard) {
    if (tributesRequired(card) === 0 && !isNormalSummonable(card)) {
      reason = card.type === 'monster' ? 'ต้องใช้พิธีกรรม/ผสานร่าง (ยังไม่เปิดในขั้นนี้)' : 'การ์ดเวท/กับดักยังใช้ไม่ได้ในขั้นนี้'
    } else if (!isMyTurn) reason = 'ยังไม่ถึงตาของคุณ'
    else if (phase !== 'main1' && phase !== 'main2') reason = 'อัญเชิญได้ในเฟสหลักเท่านั้น'
    else if (hasSummoned) reason = 'อัญเชิญไปแล้วในเทิร์นนี้'
    else if (required > monsterCount) reason = `ต้องมีมอนสเตอร์บนสนามให้สังเวย ${required} ตัว`
    else reason = 'สนามเต็มแล้ว'
  }
  return (
    <div className="hand-sheet">
      <div className="hand-sheet__info">
        <strong>{card.name}</strong>
        <span>
          ระดับ {card.level} · ATK {formatNumber(card.atk)} / DEF {formatNumber(card.def)}
        </span>
        {reason && <span className="hand-sheet__reason">{reason}</span>}
      </div>
      <div className="hand-sheet__buttons">
        {canDiscard ? (
          <button type="button" className="btn btn--danger" onClick={onDiscard}>
            🗑 ทิ้ง
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--primary" disabled={!canSummon} onClick={() => onSummon('attack')}>
              {required > 0 ? `✨ สังเวย ${required} ตัว` : '⚔️ โจมตี'}
            </button>
            <button type="button" className="btn" disabled={!canSummon} onClick={() => onSummon('defense')}>
              🛡 วางคว่ำ
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={onInspect} aria-label="ดูการ์ดขนาดเต็ม">
          🔍
        </button>
        <button type="button" className="btn" onClick={onClose} aria-label="ยกเลิก">
          ✕
        </button>
      </div>
    </div>
  )
}

function FieldActionSheet({ card, monster, blocker, onChange, onInspect, onClose }) {
  const inDefense = monster.position === 'defense'
  const status = inDefense ? (monster.faceDown ? 'ท่าตั้งรับ (คว่ำ)' : 'ท่าตั้งรับ') : 'ท่าโจมตี'
  const action = inDefense ? (monster.faceDown ? '⚔️ หงายเป็นท่าโจมตี' : '⚔️ เปลี่ยนเป็นท่าโจมตี') : '🛡 เปลี่ยนเป็นท่าตั้งรับ'
  return (
    <div className="hand-sheet">
      <div className="hand-sheet__info">
        <strong>{card.name}</strong>
        <span>
          {status} · ATK {formatNumber(card.atk)} / DEF {formatNumber(card.def)}
        </span>
        {blocker && <span className="hand-sheet__reason">{blocker}</span>}
      </div>
      <div className="hand-sheet__buttons">
        <button type="button" className="btn btn--primary" disabled={Boolean(blocker)} onClick={onChange}>
          {action}
        </button>
        <button type="button" className="btn" onClick={onInspect} aria-label="ดูการ์ดขนาดเต็ม">
          🔍
        </button>
        <button type="button" className="btn" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
      </div>
    </div>
  )
}
