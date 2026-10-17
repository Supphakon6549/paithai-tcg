import { describe, expect, it } from 'vitest'
import { getCardById } from '../data/cards'
import { describeSide, getAdvantageBonuses, resolveBattle } from './battle'

const card = (id) => getCardById(id)

describe('getAdvantageBonuses', () => {
  it('ให้ +300 เมื่อธาตุได้เปรียบ (วายุ > ปฐวี)', () => {
    // th01-019 ธาตุวายุ ปะทะ th01-001 ธาตุปฐวี
    const bonuses = getAdvantageBonuses(card('th01-019'), card('th01-001'))
    expect(bonuses).toEqual([
      expect.objectContaining({ kind: 'element', amount: 300, reason: 'ธาตุวายุ ชนะทางธาตุปฐวี' }),
    ])
  })

  it('ไม่มีโบนัสเมื่อไม่ได้เปรียบ', () => {
    expect(getAdvantageBonuses(card('th01-001'), card('th01-019'))).toEqual([])
    expect(getAdvantageBonuses(card('th01-016'), card('th01-017'))).toEqual([])
  })

  it('ให้ +200 เมื่อเผ่าได้เปรียบ (สัตว์ใหญ่ > นก)', () => {
    // th01-019 เผ่าสัตว์ใหญ่ ปะทะ th01-009 เผ่านก
    const bonuses = getAdvantageBonuses(card('th01-019'), card('th01-009'))
    expect(bonuses).toEqual([expect.objectContaining({ kind: 'tribe', amount: 200 })])
  })

  it('เผ่ามนุษย์ไม่ได้/ไม่เสียโบนัสเผ่า', () => {
    expect(getAdvantageBonuses(card('th01-016'), card('th01-011'))).toEqual([])
  })

  it('ธาตุรองนับเป็นความได้เปรียบด้วย', () => {
    // th01-012 ธาตุหลักอาสนี + ธาตุรองอัคนี/วารี → ชนะวายุ (ไฟ > ลม)
    const bonuses = getAdvantageBonuses(card('th01-012'), card('th01-019'))
    expect(bonuses[0]).toMatchObject({ kind: 'element', amount: 300, reason: 'ธาตุอัคนี ชนะทางธาตุวายุ' })
  })
})

describe('resolveBattle', () => {
  it('ฝ่ายโจมตีชนะพร้อมโบนัสธาตุ: 1,200 + 300 = 1,500 vs 800', () => {
    const r = resolveBattle(card('th01-019'), card('th01-001'))
    expect(r.attacker.final).toBe(1500)
    expect(r.defender.final).toBe(800)
    expect(r.outcome).toBe('attacker')
    expect(r.damage).toBe(700)
  })

  it('ฝ่ายรับได้โบนัสธาตุด้วย: 800 vs 1,200 + 300', () => {
    const r = resolveBattle(card('th01-001'), card('th01-019'))
    expect(r.attacker.final).toBe(800)
    expect(r.defender.final).toBe(1500)
    expect(r.outcome).toBe('defender')
    expect(r.damage).toBe(700)
  })

  it('โบนัสธาตุทำให้ตัวอ่อนกว่าพลิกชนะได้: 300 + 300 vs 700 ยังแพ้ 100', () => {
    // th01-004 ศูนยตา > th01-005 โชติ
    const r = resolveBattle(card('th01-004'), card('th01-005'))
    expect(r.attacker.final).toBe(600)
    expect(r.outcome).toBe('defender')
    expect(r.damage).toBe(100)
  })

  it('โบนัสธาตุและเผ่าซ้อนกันได้ (+500)', () => {
    const a = { name: 'นกไฟ', atk: 1000, element: 'fire', tribe: 'bird' }
    const d = { name: 'แมลงลม', atk: 1000, element: 'wind', tribe: 'insect' }
    const r = resolveBattle(a, d)
    expect(r.attacker.final).toBe(1500)
    expect(r.attacker.bonuses.map((b) => b.kind)).toEqual(['element', 'tribe'])
    expect(r.damage).toBe(500)
  })

  it('ทั้งสองฝ่ายได้โบนัสคนละอย่างพร้อมกัน', () => {
    // th01-019 (ลม, สัตว์ใหญ่) vs th01-009 (ไฟ, นก): 1,200+200 vs 2,300+300
    const r = resolveBattle(card('th01-019'), card('th01-009'))
    expect(r.attacker.final).toBe(1400)
    expect(r.defender.final).toBe(2600)
    expect(r.damage).toBe(1200)
  })

  it('ATK เท่ากันคือเสมอ', () => {
    const r = resolveBattle(card('th01-016'), card('th01-016'))
    expect(r.outcome).toBe('tie')
    expect(r.damage).toBe(0)
  })
})

describe('describeSide', () => {
  it('แสดงตัวเลขทุกขั้น', () => {
    const r = resolveBattle(card('th01-019'), card('th01-001'))
    expect(describeSide(r.attacker)).toBe(
      `${card('th01-019').name}: ATK 1,200 + 300 (ธาตุ: ธาตุวายุ ชนะทางธาตุปฐวี) = 1,500`
    )
    expect(describeSide(r.defender)).toBe('ลูกพราน: ATK 800 (ไม่มีโบนัส) = 800')
  })
})
