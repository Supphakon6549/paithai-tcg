import { useEffect, useRef, useState } from 'react'
import { getCardById } from '../../../data/cards'
import { ELEMENTS } from '../../../data/elements'

/*
 * ชั้นเอฟเฟกต์ภาพและแอนิเมชันของกระดานต่อสู้ (BattleFx)
 * รองรับเหตุการณ์ทั้งหมดจาก game.log:
 * - summon, changePosition, attack, attackNegated, discard, activate, playSpell, setTrap
 * - ช่องข้อมูล: placed, destroyed, revealed, damage, heal, spellPlaced, spellRemoved, trap
 * - kind 'pending': ประกาศโจมตีรอฝ่ายรับตัดสินใจเปิดกับดัก
 * - ออกแบบสำหรับจอมือถือก่อน และเคารพ prefers-reduced-motion
 */

const FX_DURATION_MS = 1250
// แอนิเมชันเปิดกับดักกลางจอ (แสดงครั้งละใบ ต่อคิวได้อีก 1 ใบ)
const TRAP_MS = 1450
const TRAP_REDUCED_MS = 1100

const TRAP_EFFECT_LABEL = {
  negate: '⚡ ยกเลิกการโจมตี!',
  thorns: '🌿 ขวากหนามสวนกลับ!',
  weaken: '💨 ม่านควัน ลด ATK!',
  drum: '🥁 กลองศึกกระหึ่ม!',
  continuous: '✨ กับดักต่อเนื่อง',
}

// สร้างข้อมูลการแสดงกับดัก: ตำแหน่งช่องเดิม → กลางจอ → สุสาน (หรือกลับช่อง ถ้าต่อเนื่อง)
function buildTrapShow(root, trap, reduced, key) {
  const card = getCardById(trap.cardId)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.round(Math.min(vw * 0.44, 190))
  const center = { x: vw / 2, y: Math.min(vh * 0.44, vh / 2 - 40) }
  const slot =
    findCardOrZoneRect(root, trap.player, trap.uid, trap.zone, 'spell-trap') || {
      x: center.x,
      y: trap.player === 'player' ? vh * 0.7 : vh * 0.25,
      w: cardW * 0.3,
    }
  const isContinuous = trap.effect === 'continuous'
  const grave = isContinuous
    ? null
    : getCenterRect(root.querySelector(`[data-owner="${trap.player}"] [data-pile="graveyard"]`))
  const end = grave || slot
  const clamp = (v) => Math.max(0.12, Math.min(1, v))
  return {
    key,
    reduced,
    effect: TRAP_EFFECT_LABEL[trap.effect] ? trap.effect : 'negate',
    cardId: trap.cardId,
    name: card?.name ?? 'กับดัก',
    x: slot.x,
    y: slot.y,
    cardW,
    dx: center.x - slot.x,
    dy: center.y - slot.y,
    ex: end.x - slot.x,
    ey: end.y - slot.y,
    s0: clamp(slot.w / cardW),
    s1: clamp((end.w || slot.w) / cardW) * 0.8,
  }
}

function getCenterRect(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    w: r.width,
    h: r.height,
  }
}

function findCardOrZoneRect(root, player, uid, zone, zoneType = 'monster') {
  if (!root) return null
  if (uid) {
    const byUid = root.querySelector(`[data-uid="${uid}"]`)
    const rect = getCenterRect(byUid)
    if (rect) return rect
  }
  if (player != null && zoneType === 'field') {
    const fieldEl = root.querySelector(`[data-owner="${player}"] [data-pile="field"]`)
    const rect = getCenterRect(fieldEl)
    if (rect) return rect
  }
  if (player != null && zone != null) {
    const byZone = root.querySelector(
      `[data-owner="${player}"] [data-zone-type="${zoneType}"] [data-zone="${zone}"]`
    )
    const rect = getCenterRect(byZone)
    if (rect) return rect
  }
  return null
}

// LP แสดงหลายที่ตามขนาดจอ (แถบบนมือถือ / ป้ายบนกระดาน PC) — ใช้ตัวแรกที่มองเห็นอยู่
function firstVisible(root, selector) {
  return [...root.querySelectorAll(selector)].find((el) => el.getBoundingClientRect().width > 0) ?? null
}

function findPlayerLpRect(root, player) {
  if (!root || !player) return null
  const lpEl =
    firstVisible(root, `[data-player="${player}"] [data-lp]`) ||
    firstVisible(root, `[data-player="${player}"]`)
  return getCenterRect(lpEl)
}

function triggerDomClass(el, className, duration = 700) {
  if (!el) return
  el.classList.remove(className)
  void el.offsetWidth
  el.classList.add(className)
  setTimeout(() => {
    el.classList.remove(className)
  }, duration)
}

export default function BattleFx({ game }) {
  const lastLogIdRef = useRef(null)
  const fxKeyRef = useRef(0)
  const [fxItems, setFxItems] = useState([])
  // ตัวตั้งเวลาลบเอฟเฟกต์ ต้องอยู่รอดข้ามการเปลี่ยนสถานะเกม (AI เล่นเร็วกว่าเอฟเฟกต์จบ)
  // ยกเลิกเฉพาะตอนปิดหน้าจอ ไม่งั้นเอฟเฟกต์จะค้างสะสมจนมือถือกระพริบ
  const removeTimersRef = useRef(new Set())
  // กับดักแสดงกลางจอครั้งละใบ — ใบถัดไปรอในคิว (เก็บแค่ใบล่าสุด 1 ใบ ไม่ให้ค้างสะสม)
  const [trapShow, setTrapShow] = useState(null)
  const trapQueueRef = useRef([])
  const trapBusyRef = useRef(false)

  useEffect(() => {
    const timers = removeTimersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (!game?.log?.length) {
      lastLogIdRef.current = 0
      return
    }
    const latestId = game.log[game.log.length - 1].id
    if (lastLogIdRef.current === null || latestId < lastLogIdRef.current) {
      lastLogIdRef.current = latestId
      return
    }
    if (latestId === lastLogIdRef.current) return

    const newEntries = game.log.filter(
      (e) => e.id > lastLogIdRef.current && (e.event || e.kind === 'pending')
    )
    lastLogIdRef.current = latestId
    if (newEntries.length === 0) return

    const root = document.querySelector('[data-battle-root]')
    if (!root) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const spawned = []
    const nextKey = () => {
      fxKeyRef.current += 1
      return `fx-${Date.now()}-${fxKeyRef.current}`
    }

    // เล่นกับดักถัดไปในคิว — ตัวตั้งเวลาเก็บใน removeTimersRef (ไม่ผูกกับ cleanup ของ [game])
    const playNextTrap = () => {
      const next = trapQueueRef.current.shift()
      if (!next) {
        trapBusyRef.current = false
        setTrapShow(null)
        return
      }
      trapBusyRef.current = true
      setTrapShow(next)
      const t = setTimeout(() => {
        removeTimersRef.current.delete(t)
        playNextTrap()
      }, next.reduced ? TRAP_REDUCED_MS : TRAP_MS)
      removeTimersRef.current.add(t)
    }
    let trapQueued = false

    for (const entry of newEntries) {
      // 0. กับดักถูกเปิด (trapActivated) — แสดงการ์ดพลิกกลางจอ
      for (const trap of entry.event?.trapActivated || []) {
        trapQueueRef.current.push(buildTrapShow(root, trap, prefersReducedMotion, nextKey()))
        trapQueueRef.current = trapQueueRef.current.slice(-1)
        trapQueued = true
        if (trap.effect === 'continuous' && !prefersReducedMotion) {
          const trapEl = root.querySelector(`[data-uid="${trap.uid}"]`)
          if (trapEl) {
            const t = setTimeout(() => {
              removeTimersRef.current.delete(t)
              triggerDomClass(trapEl, 'fx-dom-trap-linger', 900)
            }, TRAP_MS - 350)
            removeTimersRef.current.add(t)
          }
        }
      }
      // กรณีประกาศโจมตีแล้วรอฝ่ายรับตัดสินใจเปิดกับดัก (kind === 'pending')
      if (entry.kind === 'pending' && game.pendingResponse) {
        const { attacker, attackerUid, targetUid } = game.pendingResponse
        const attackerEl = attackerUid ? root.querySelector(`[data-uid="${attackerUid}"]`) : null
        if (!prefersReducedMotion && attackerEl) {
          triggerDomClass(
            attackerEl,
            attacker === 'player' ? 'fx-dom-lunge-up' : 'fx-dom-lunge-down',
            550
          )
        }
        if (targetUid) {
          const targetRect = findCardOrZoneRect(root, null, targetUid, null)
          if (targetRect) {
            spawned.push({
              key: nextKey(),
              kind: 'pending-target',
              x: targetRect.x,
              y: targetRect.y,
              label: '⚔️ เป้าหมายถูกโจมตี!',
            })
          }
        }
        continue
      }

      const ev = entry.event
      if (!ev) continue

      // 1. อัญเชิญมอนสเตอร์ปกติ / สังเวย / วางคว่ำ
      if (ev.type === 'summon') {
        for (const sac of ev.destroyed || []) {
          const sacRect = findCardOrZoneRect(root, sac.player, null, sac.zone, 'monster')
          if (sacRect) {
            spawned.push({
              key: nextKey(),
              kind: 'tribute',
              x: sacRect.x,
              y: sacRect.y,
              label: '✦ เครื่องสังเวย',
            })
          }
        }

        for (const placed of ev.placed || []) {
          const card = getCardById(placed.cardId)
          const elColor = ELEMENTS[card?.element]?.color || '#d9b24c'
          const cardEl = root.querySelector(`[data-uid="${placed.uid}"]`)
          const rect = findCardOrZoneRect(root, placed.player, placed.uid, placed.zone, 'monster')
          const isTribute = (ev.destroyed?.length || 0) > 0 || (card?.level || 0) >= 5

          if (!prefersReducedMotion && cardEl) {
            triggerDomClass(
              cardEl,
              isTribute ? 'fx-dom-summon-grand' : 'fx-dom-summon',
              750
            )
          }

          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: placed.faceDown ? 'set-card' : isTribute ? 'summon-grand' : 'summon',
              x: rect.x,
              y: rect.y,
              color: elColor,
              label: placed.faceDown
                ? 'วางคว่ำ'
                : isTribute
                ? `อัญเชิญระดับ ${card?.level ?? ''}`
                : 'อัญเชิญ',
            })
          }
        }
      }

      // 2. เปลี่ยนท่า / หงายการ์ดคว่ำ
      if (ev.type === 'changePosition') {
        const cardEl = ev.source ? root.querySelector(`[data-uid="${ev.source}"]`) : null
        if (!prefersReducedMotion && cardEl) {
          triggerDomClass(cardEl, 'fx-dom-flip', 620)
        }
        for (const rev of ev.revealed || []) {
          const rect = findCardOrZoneRect(root, rev.player, rev.uid, rev.zone, 'monster')
          const card = getCardById(rev.cardId)
          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: 'reveal',
              x: rect.x,
              y: rect.y,
              label: card ? `หงาย ${card.name}!` : 'เปิดการ์ดคว่ำ!',
            })
          }
        }
      }

      // 3. กดใช้ความสามารถของมอนสเตอร์บนสนาม (activate)
      if (ev.type === 'activate') {
        const srcEl = ev.source ? root.querySelector(`[data-uid="${ev.source}"]`) : null
        if (!prefersReducedMotion && srcEl) {
          triggerDomClass(srcEl, 'fx-dom-activate', 700)
        }
        const srcRect = findCardOrZoneRect(root, ev.player, ev.source, null, 'monster')
        if (srcRect) {
          spawned.push({
            key: nextKey(),
            kind: 'activate',
            x: srcRect.x,
            y: srcRect.y,
            color: '#fae094',
            label: '✨ ใช้ความสามารถ!',
          })
        }

        // ถ้ามีเป้าหมาย (เช่น พระอินทร์ลด ATK ฝ่ายตรงข้าม 500)
        if (ev.target) {
          const targetEl = root.querySelector(`[data-uid="${ev.target}"]`)
          if (!prefersReducedMotion && targetEl) {
            triggerDomClass(targetEl, 'fx-dom-debuff', 680)
          }
          const targetRect = findCardOrZoneRect(root, null, ev.target, null, 'monster')
          if (targetRect) {
            spawned.push({
              key: nextKey(),
              kind: 'debuff',
              x: targetRect.x,
              y: targetRect.y,
              label: '⚡ −500 ATK',
            })
          }
        }
      }

      // 4. ใช้การ์ดเวทมนตร์ / เวทสนาม / การ์ดพิธีกรรม (playSpell)
      if (ev.type === 'playSpell') {
        // เครื่องสังเวยบนสนามจากพิธีกรรม (ถ้ามี)
        for (const sac of ev.destroyed || []) {
          const sacRect = findCardOrZoneRect(root, sac.player, null, sac.zone, 'monster')
          if (sacRect) {
            spawned.push({
              key: nextKey(),
              kind: 'tribute',
              x: sacRect.x,
              y: sacRect.y,
              label: '🙏 สังเวยพิธีกรรม',
            })
          }
        }

        // มอนสเตอร์พิธีกรรมที่ถูกอัญเชิญลงสนาม (เช่น พระอินทร์ จอมอาสนี)
        for (const placed of ev.placed || []) {
          const card = getCardById(placed.cardId)
          const elColor = ELEMENTS[card?.element]?.color || '#f5dc84'
          const cardEl = root.querySelector(`[data-uid="${placed.uid}"]`)
          const rect = findCardOrZoneRect(root, placed.player, placed.uid, placed.zone, 'monster')
          if (!prefersReducedMotion && cardEl) {
            triggerDomClass(cardEl, 'fx-dom-summon-grand', 850)
          }
          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: 'ritual-summon',
              x: rect.x,
              y: rect.y,
              color: elColor,
              label: card ? `🙏 อัญเชิญพิธีกรรม ${card.name}!` : '🙏 อัญเชิญพิธีกรรม!',
            })
          }
        }

        // เวทสนามที่วางลงช่อง field
        for (const sp of ev.spellPlaced || []) {
          const card = getCardById(sp.cardId)
          const spEl = root.querySelector(`[data-uid="${sp.uid}"]`)
          if (!prefersReducedMotion && spEl) {
            triggerDomClass(spEl, 'fx-dom-summon', 700)
          }
          const rect = findCardOrZoneRect(root, sp.player, sp.uid, sp.zone, sp.zoneType)
          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: 'field-spell',
              x: rect.x,
              y: rect.y,
              color: ELEMENTS[card?.element]?.color || '#fae094',
              label: card ? `🏞️ ${card.name}` : '🏞️ เปิดเวทสนาม!',
            })
          }
        }
      }

      // 5. วางกับดักคว่ำในช่องเวท/กับดัก (setTrap)
      if (ev.type === 'setTrap') {
        for (const sp of ev.spellPlaced || []) {
          const spEl = root.querySelector(`[data-uid="${sp.uid}"]`)
          if (!prefersReducedMotion && spEl) {
            triggerDomClass(spEl, 'fx-dom-summon', 620)
          }
          const rect = findCardOrZoneRect(root, sp.player, sp.uid, sp.zone, sp.zoneType)
          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: 'set-trap',
              x: rect.x,
              y: rect.y,
              color: '#c77b9f',
              label: '🪤 วางกับดักคว่ำ',
            })
          }
        }
      }

      // 6. กับดักทำงานยกเลิกการโจมตี (attackNegated)
      if (ev.type === 'attackNegated') {
        const attackerEl = ev.source ? root.querySelector(`[data-uid="${ev.source}"]`) : null
        if (!prefersReducedMotion && attackerEl) {
          triggerDomClass(
            attackerEl,
            ev.player === 'player' ? 'fx-dom-lunge-up' : 'fx-dom-lunge-down',
            550
          )
        }

        // ตำแหน่งช่องกับดักที่เพิ่งเปิดแล้วถูกส่งลงสุสาน (ถ้ามี trapActivated จะแสดงกลางจอแทน)
        const hasTrapShow = (ev.trapActivated?.length || 0) > 0
        for (const rem of hasTrapShow ? [] : ev.spellRemoved || []) {
          const trapCard = getCardById(rem.cardId)
          const trapRect = findCardOrZoneRect(root, rem.player, null, rem.zone, rem.zoneType)
          if (trapRect) {
            spawned.push({
              key: nextKey(),
              kind: 'trap-trigger',
              x: trapRect.x,
              y: trapRect.y,
              label: trapCard ? `🪤 เปิดกับดัก: ${trapCard.name}!` : '🪤 กับดักทำงาน!',
            })
          }
        }

        // โล่สายฟ้าคุ้มกันมอนสเตอร์เป้าหมายที่รอดจากการโจมตี
        if (ev.target) {
          const targetRect = findCardOrZoneRect(root, null, ev.target, null, 'monster')
          if (targetRect) {
            spawned.push({
              key: nextKey(),
              kind: 'shield-negate',
              x: targetRect.x,
              y: targetRect.y,
              label: '🛡️ ยกเลิกการโจมตี!',
            })
          }
        }
      }

      // 7. โจมตีสำเร็จ (attack)
      if (ev.type === 'attack') {
        const attackerEl = ev.source ? root.querySelector(`[data-uid="${ev.source}"]`) : null
        if (!prefersReducedMotion && attackerEl) {
          triggerDomClass(
            attackerEl,
            ev.player === 'player' ? 'fx-dom-lunge-up' : 'fx-dom-lunge-down',
            600
          )
        }

        for (const rev of ev.revealed || []) {
          const revEl = root.querySelector(`[data-uid="${rev.uid}"]`)
          if (!prefersReducedMotion && revEl) {
            triggerDomClass(revEl, 'fx-dom-reveal-slow', 950)
          }
          const rect = findCardOrZoneRect(root, rev.player, rev.uid, rev.zone, 'monster')
          const card = getCardById(rev.cardId)
          if (rect) {
            spawned.push({
              key: nextKey(),
              kind: 'reveal-flip',
              x: rect.x,
              y: rect.y,
              w: rect.w,
              h: rect.h,
              reduced: prefersReducedMotion,
              label: card ? `👁 เปิดเผยตัว! ${card.name}` : '👁 เปิดเผยตัว!',
            })
          }
        }

        const defenderOwner = ev.player === 'player' ? 'ai' : 'player'
        let targetRect = null
        if (ev.target) {
          const destroyedTarget = (ev.destroyed || []).find((d) => d.uid === ev.target)
          targetRect = findCardOrZoneRect(
            root,
            defenderOwner,
            ev.target,
            destroyedTarget?.zone,
            'monster'
          )
        } else {
          targetRect = findPlayerLpRect(root, defenderOwner)
        }

        if (targetRect) {
          spawned.push({
            key: nextKey(),
            kind: 'slash',
            x: targetRect.x,
            y: targetRect.y,
            direct: !ev.target,
          })
        }

        for (const dead of ev.destroyed || []) {
          const deadRect = findCardOrZoneRect(root, dead.player, null, dead.zone, 'monster')
          const deadCard = getCardById(dead.cardId)
          if (deadRect) {
            spawned.push({
              key: nextKey(),
              kind: 'destroy',
              x: deadRect.x,
              y: deadRect.y,
              label: deadCard ? `${deadCard.name} สลาย!` : 'ถูกทำลาย!',
            })
          }
        }
      }

      // 8. ตัวเลขความเสียหาย LP ลดลง (damage)
      for (const dmg of ev.damage || []) {
        const barEl = firstVisible(root, `[data-player="${dmg.player}"]`)
        if (!prefersReducedMotion && barEl) {
          triggerDomClass(barEl, 'fx-dom-lp-shake', 680)
        }
        const lpRect = findPlayerLpRect(root, dmg.player)
        if (lpRect) {
          spawned.push({
            key: nextKey(),
            kind: 'damage',
            x: lpRect.x,
            y: lpRect.y,
            amount: dmg.amount,
            player: dmg.player,
          })
        }
      }

      // 9. ตัวเลขฟื้นฟู LP เพิ่มขึ้น (heal)
      for (const h of ev.heal || []) {
        const barEl = firstVisible(root, `[data-player="${h.player}"]`)
        if (!prefersReducedMotion && barEl) {
          triggerDomClass(barEl, 'fx-dom-lp-heal', 750)
        }
        const lpRect = findPlayerLpRect(root, h.player)
        if (lpRect) {
          spawned.push({
            key: nextKey(),
            kind: 'heal',
            x: lpRect.x,
            y: lpRect.y,
            amount: h.amount,
            player: h.player,
          })
        }
      }
    }

    if (trapQueued && !trapBusyRef.current) playNextTrap()

    if (spawned.length === 0) return

    setFxItems((prev) => [...prev, ...spawned])
    const keysToRemove = new Set(spawned.map((s) => s.key))
    const timer = setTimeout(() => {
      removeTimersRef.current.delete(timer)
      setFxItems((prev) => prev.filter((item) => !keysToRemove.has(item.key)))
    }, FX_DURATION_MS)
    removeTimersRef.current.add(timer)
  }, [game])

  if (fxItems.length === 0 && !trapShow) return null

  return (
    <div className="battle-fx-layer" aria-hidden="true">
      {trapShow && <TrapShow key={trapShow.key} show={trapShow} />}
      {fxItems.map((item) => {
        const style = {
          left: `${item.x}px`,
          top: `${item.y}px`,
          ...(item.color ? { '--fx-color': item.color } : {}),
        }

        if (
          item.kind === 'summon' ||
          item.kind === 'summon-grand' ||
          item.kind === 'ritual-summon' ||
          item.kind === 'set-card' ||
          item.kind === 'set-trap' ||
          item.kind === 'field-spell' ||
          item.kind === 'activate'
        ) {
          return (
            <div key={item.key} className={`fx-item fx-item--${item.kind}`} style={style}>
              <svg className="fx-yantra-ring" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <polygon
                  points="50,8 61,36 91,36 67,54 76,83 50,65 24,83 33,54 9,36 39,36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {item.label && <span className="fx-tag fx-tag--summon">{item.label}</span>}
            </div>
          )
        }

        if (item.kind === 'tribute') {
          return (
            <div key={item.key} className="fx-item fx-item--tribute" style={style}>
              <span className="fx-wisp" />
              <span className="fx-tag fx-tag--tribute">{item.label}</span>
            </div>
          )
        }

        if (item.kind === 'reveal-flip') {
          return (
            <div
              key={item.key}
              className={`fx-item fx-item--reveal-flip${item.reduced ? ' fx-item--reduced' : ''}`}
              style={{ ...style, '--rv-w': `${item.w}px`, '--rv-h': `${item.h}px` }}
            >
              <span className="fx-rv-back" />
              <span className="fx-rv-flash" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="fx-rv-spark" style={{ '--a': `${i * 60 + 20}deg` }} />
              ))}
              <span className="fx-tag fx-tag--reveal">{item.label}</span>
            </div>
          )
        }

        if (item.kind === 'reveal' || item.kind === 'trap-trigger') {
          return (
            <div key={item.key} className={`fx-item fx-item--${item.kind}`} style={style}>
              <span className="fx-reveal-burst" />
              <span className="fx-tag fx-tag--reveal">{item.label}</span>
            </div>
          )
        }

        if (item.kind === 'debuff') {
          return (
            <div key={item.key} className="fx-item fx-item--debuff" style={style}>
              <svg className="fx-bolt-svg" viewBox="0 0 80 100">
                <polygon
                  points="46,4 16,54 40,54 28,96 66,42 42,42"
                  fill="#fff4b8"
                  stroke="#f0b942"
                  strokeWidth="2.5"
                />
              </svg>
              <span className="fx-tag fx-tag--debuff">{item.label}</span>
            </div>
          )
        }

        if (item.kind === 'shield-negate' || item.kind === 'pending-target') {
          return (
            <div key={item.key} className={`fx-item fx-item--${item.kind}`} style={style}>
              <svg className="fx-shield-svg" viewBox="0 0 90 100">
                <path
                  d="M45 8 L80 24 L80 54 C80 76 64 90 45 96 C26 90 10 76 10 54 L10 24 Z"
                  fill="rgba(255, 240, 175, 0.22)"
                  stroke="#ffe680"
                  strokeWidth="3"
                />
              </svg>
              <span className="fx-tag fx-tag--shield">{item.label}</span>
            </div>
          )
        }

        if (item.kind === 'slash') {
          return (
            <div key={item.key} className="fx-item fx-item--slash" style={style}>
              <svg className="fx-slash-svg" viewBox="0 0 120 120">
                <path
                  d="M15,105 Q55,50 105,15 Q68,58 15,105 Z"
                  fill="#fff4c2"
                  stroke="#e85325"
                  strokeWidth="3"
                />
                <path
                  d="M22,20 Q60,62 98,100"
                  fill="none"
                  stroke="#ffd76b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
              {item.direct && <span className="fx-tag fx-tag--direct">⚔️ โจมตีตรง!</span>}
            </div>
          )
        }

        if (item.kind === 'destroy') {
          return (
            <div key={item.key} className="fx-item fx-item--destroy" style={style}>
              <span className="fx-shatter-ring" />
              <span className="fx-shard fx-shard--1" />
              <span className="fx-shard fx-shard--2" />
              <span className="fx-shard fx-shard--3" />
              <span className="fx-shard fx-shard--4" />
              <span className="fx-tag fx-tag--destroy">💥 {item.label}</span>
            </div>
          )
        }

        if (item.kind === 'damage') {
          return (
            <div key={item.key} className="fx-item fx-item--damage" style={style}>
              <span className="fx-damage-num">−{item.amount.toLocaleString('en-US')} LP</span>
            </div>
          )
        }

        if (item.kind === 'heal') {
          return (
            <div key={item.key} className="fx-item fx-item--heal" style={style}>
              <span className="fx-heal-num">+{item.amount.toLocaleString('en-US')} LP</span>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

/*
 * TrapShow — การ์ดกับดักพลิกกลางจอ (ครั้งละใบ)
 * ช่องเดิม → (พลิกหลังลายไทยเป็นหน้าการ์ด) → ขยายกลางจอพร้อมชื่อ → หดลงสุสาน / กลับช่อง (ต่อเนื่อง)
 * ทุกชิ้นใช้ transform/opacity · ไม่มี animation infinite · ถูกถอดออกเมื่อ removeTimersRef ครบเวลา
 */
function TrapShow({ show }) {
  const style = {
    left: `${show.x}px`,
    top: `${show.y}px`,
    '--dx': `${show.dx}px`,
    '--dy': `${show.dy}px`,
    '--ex': `${show.ex}px`,
    '--ey': `${show.ey}px`,
    '--s0': show.s0,
    '--s1': show.s1,
    '--card-w': `${show.cardW}px`,
  }
  const cls = `fx-trap fx-trap--${show.effect}${show.reduced ? ' fx-trap--reduced' : ''}`

  if (show.reduced) {
    return (
      <div className={cls} style={style}>
        <div className="fx-trap__title">
          <span className="fx-trap__kicker">🪤 เปิดกับดัก</span>
          <strong className="fx-trap__name">{show.name}</strong>
          <span className="fx-trap__effect">{TRAP_EFFECT_LABEL[show.effect]}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`fx-trap-veil fx-trap-veil--${show.effect}`} />
      <div className={cls} style={style}>
        <div className="fx-trap__fx">
          <span className="fx-trap__ring" />
          {show.effect === 'negate' && (
            <>
              <svg className="fx-trap__bolt fx-trap__bolt--l" viewBox="0 0 40 100">
                <polygon points="26,0 6,52 20,52 10,100 36,40 22,40" />
              </svg>
              <svg className="fx-trap__bolt fx-trap__bolt--r" viewBox="0 0 40 100">
                <polygon points="26,0 6,52 20,52 10,100 36,40 22,40" />
              </svg>
            </>
          )}
          {show.effect === 'thorns' &&
            [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span key={i} className="fx-trap__spike" style={{ '--a': `${i * 45 + 22}deg` }} />
            ))}
          {show.effect === 'weaken' &&
            [0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`fx-trap__smoke fx-trap__smoke--${i}`} />
            ))}
          {show.effect === 'drum' &&
            [0, 1, 2].map((i) => <span key={i} className={`fx-trap__wave fx-trap__wave--${i}`} />)}
        </div>

        <div className="fx-trap__card">
          <div className="fx-trap__flipper">
            <div className="fx-trap__face fx-trap__back" />
            <div className="fx-trap__face fx-trap__front">
              <img src={`/cards/${show.cardId}.jpg`} alt="" draggable="false" />
            </div>
          </div>
        </div>

        <div className="fx-trap__title">
          <span className="fx-trap__kicker">🪤 เปิดกับดัก!</span>
          <strong className="fx-trap__name">{show.name}</strong>
          <span className="fx-trap__effect">{TRAP_EFFECT_LABEL[show.effect]}</span>
        </div>

        {show.effect === 'continuous' && (
          <div className="fx-trap__linger">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="fx-trap__glint" style={{ '--a': `${i * 60}deg` }} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
