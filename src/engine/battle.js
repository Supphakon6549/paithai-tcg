import { getCardMatchupInfo } from '../data/cards'
import { ELEMENTS } from '../data/elements'
import { getAtkBoosts, hasAmbush } from './effects'
import { formatNumber } from './rules'

/**
 * โบนัสที่ `card` ได้เมื่อปะทะ `opponent` (ธาตุ +300 / เผ่า +200 ซ้อนกันได้)
 */
export function getAdvantageBonuses(card, opponent) {
  const matchup = getCardMatchupInfo(card)
  const bonuses = []

  if (matchup.strongElements.some((el) => el.id === opponent.element)) {
    const ownElementIds = [card.element, ...(card.secondaryElements || [])]
    const sourceId = ownElementIds.find(
      (id) => ELEMENTS[id]?.strongAgainst === opponent.element
    )
    bonuses.push({
      kind: 'element',
      label: 'ธาตุ',
      amount: matchup.elementBonus,
      reason: `ธาตุ${ELEMENTS[sourceId].name} ชนะทางธาตุ${ELEMENTS[opponent.element].name}`,
    })
  }

  if (matchup.strongTribe && matchup.strongTribe.id === opponent.tribe) {
    bonuses.push({
      kind: 'tribe',
      label: 'เผ่า',
      amount: matchup.tribeBonus,
      reason: `เผ่า${matchup.tribe.name} ชนะทางเผ่า${matchup.strongTribe.name}`,
    })
  }

  return bonuses
}

// stat: 'atk' (ท่าโจมตี) หรือ 'def' (ท่าตั้งรับ) — บัฟ ATK จากเอฟเฟกต์ไม่บวกเข้า DEF
// แต่โบนัสธาตุ/เผ่าบวกได้ทั้งสองค่า
function computeSide(card, opponent, { allies = [], ambushed = false, stat = 'atk' } = {}) {
  const advantage = getAdvantageBonuses(card, opponent)
  const effects = stat === 'atk' ? getAtkBoosts(card, allies) : []
  const bonuses = [...effects, ...(ambushed ? [] : advantage)]
  const total = bonuses.reduce((sum, b) => sum + b.amount, 0)
  const base = stat === 'def' ? card.def : card.atk
  return {
    card,
    stat,
    base,
    bonuses,
    cancelled: ambushed ? advantage : [],
    final: base + total,
  }
}

/**
 * คำนวณผลการต่อสู้ ATK ปะทะ ATK หรือ ATK ปะทะ DEF (รวมเอฟเฟกต์การ์ด + โบนัสธาตุ/เผ่า)
 * outcome: 'attacker' | 'defender' | 'tie' (ค่าไหนสูงกว่า — ผลจริงขึ้นกับท่าของฝ่ายรับ ดู game.js)
 */
export function resolveBattle(
  attackerCard,
  defenderCard,
  { attackerAllies = [], defenderAllies = [], defenderStat = 'atk' } = {}
) {
  const ambush = hasAmbush(attackerCard)
  const attacker = computeSide(attackerCard, defenderCard, { allies: attackerAllies })
  const defender = computeSide(defenderCard, attackerCard, {
    allies: defenderAllies,
    ambushed: ambush,
    stat: defenderStat,
  })
  const diff = attacker.final - defender.final
  return {
    attacker,
    defender,
    ambush,
    outcome: diff > 0 ? 'attacker' : diff < 0 ? 'defender' : 'tie',
    damage: Math.abs(diff),
  }
}

// "ลูกพราน: ATK 800 + 300 (ธาตุ: ธาตุปฐวี ชนะทางธาตุอาสนี) = 1,100"
export function describeSide(side) {
  const parts = side.bonuses
    .map((b) => ` + ${formatNumber(b.amount)} (${b.label}: ${b.reason})`)
    .join('')
  const cancelled = (side.cancelled ?? [])
    .map((b) => ` [ซุ่มโจมตียกเลิก${b.label} +${formatNumber(b.amount)}: ${b.reason}]`)
    .join('')
  const noBonus = !parts && !cancelled ? ' (ไม่มีโบนัส)' : ''
  const label = side.stat === 'def' ? 'DEF' : 'ATK'
  return `${side.card.name}: ${label} ${formatNumber(side.base)}${parts}${cancelled}${noBonus} = ${formatNumber(side.final)}`
}
