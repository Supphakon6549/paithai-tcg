import { describe, expect, it } from 'vitest'
import { getCardById } from '../../../data/cards'
import { getMountVerb } from '../../../engine'

describe('Battle FX Boss and Mount Configurations', () => {
  it('th07-016 (พญานาคราช): โทนบาดาลลึก มืด หนัก — ไม่มีสีชมพู #ff4d8d และไม่มีอีโมจิ 🐍', async () => {
    const card = getCardById('th07-016')
    expect(card).toBeDefined()
    expect(card.name).toBe('พญานาคราชมณีบาดาล')

    // ตรวจสอบไฟล์ BossSummonStage.jsx ว่าไม่มี #ff4d8d และไม่มี 🐍
    const fs = await import('node:fs')
    const bossCode = fs.readFileSync(new URL('./BossSummonStage.jsx', import.meta.url), 'utf8')

    // kicker ต้องไม่มีงู
    expect(bossCode).toContain("kicker: 'จ้าวบาดาลจุติ'")
    expect(bossCode).not.toContain("kicker: '🐍 จ้าวบาดาลจุติ'")

    // ตัด #ff4d8d ออกทั้งหมดจาก BossSummonStage
    expect(bossCode).not.toContain('#ff4d8d')

    // ตรวจสอบสีรองของ naga เป็นน้ำเงินเข้มบาดาล
    expect(bossCode).toContain("secondary: '#0a4c6a'")
  })

  it('th01-012 (ครุฑนาคา มหาเทพประสาน): ฟ้าปะทะบาดาล — ไม่มีอีโมจิ 🔥💧 และมีฟ้า-บาดาลหลอมรวม', async () => {
    const card = getCardById('th01-012')
    expect(card).toBeDefined()
    expect(card.name).toBe('ครุฑนาคา มหาเทพประสาน')

    const fs = await import('node:fs')
    const bossCode = fs.readFileSync(new URL('./BossSummonStage.jsx', import.meta.url), 'utf8')

    // kicker ต้องไม่มีอีโมจิ
    expect(bossCode).toContain("kicker: 'มหาเทพประสานจุติ'")
    expect(bossCode).not.toContain("kicker: '🔥💧 มหาเทพประสานจุติ'")

    // สีหลักส้มทองไฟ สีรองน้ำเงินเข้มบาดาล สีเน้นฟ้าเวหา
    expect(bossCode).toContain("primary: '#ff7847'")
    expect(bossCode).toContain("secondary: '#0b3a5c'")
    expect(bossCode).toContain("accent: '#38bdf8'")

    // มีบรรยากาศแยกฟ้า-บาดาล
    expect(bossCode).toContain('fx-boss__split-sky')
    expect(bossCode).toContain('fx-boss__split-abyss')
    expect(bossCode).toContain('fx-boss__dual-spiral')
  })

  it('Boss Board Impact: มีผลลงกระดานครบทั้ง 3 บอส (พระอินทร์, นาคา, ครุฑนาคา)', async () => {
    const fs = await import('node:fs')
    const bossCode = fs.readFileSync(new URL('./BossSummonStage.jsx', import.meta.url), 'utf8')
    const cssCode = fs.readFileSync(new URL('../BattleTheme.css', import.meta.url), 'utf8')

    // Indra: สายฟ้าฟาดลงช่อง + ฟ้าแลบทั้งจอ + รอยไหม้ + ประกายไฟแตก
    expect(bossCode).toContain('fx-boss-impact__flash')
    expect(bossCode).toContain('fx-boss-impact__bolt-svg')
    expect(bossCode).toContain('fx-boss-impact__scorch')
    expect(bossCode).toContain('fx-boss-impact__spark')
    expect(cssCode).toContain('.fx-boss-impact--indra')

    // Naga: น้ำท่วมกระดาน + แสงระลอกน้ำ + น้ำไหลกลับเข้าช่อง
    expect(bossCode).toContain('fx-boss-impact__flood-overlay')
    expect(bossCode).toContain('fx-boss-impact__wave')
    expect(bossCode).toContain('fx-boss-impact__water-drain')
    expect(cssCode).toContain('.fx-boss-impact--naga')

    // Krut-Naga: ขนนกไฟฝั่งศัตรู + น้ำวนฝั่งเรา + เกลียวสองสีหมุนที่ช่อง
    expect(bossCode).toContain('fx-boss-impact__enemy-storm')
    expect(bossCode).toContain('fx-boss-impact__storm-feather')
    expect(bossCode).toContain('fx-boss-impact__player-surge')
    expect(bossCode).toContain('fx-boss-impact__converge-dual')
    expect(cssCode).toContain('.fx-boss-impact--krut-naga')
  })

  it('Mount Showcase: แยกคำกริยา "ขึ้นขี่" vs "รวมร่าง" ได้ถูกต้อง', () => {
    const kraithong = getCardById('th03-013')
    expect(kraithong).toBeDefined()
    expect(getMountVerb(kraithong)).toBe('ขึ้นขี่')

    const banchee = getCardById('th03-014')
    expect(getMountVerb(banchee)).toBe('ขึ้นขี่')

    const bodhiTree = getCardById('th03-017')
    expect(bodhiTree).toBeDefined()
    expect(getMountVerb(bodhiTree)).toBe('รวมร่าง')

    const waspQueen = getCardById('th03-019')
    expect(waspQueen).toBeDefined()
    expect(getMountVerb(waspQueen)).toBe('รวมร่าง')
  })

  it('Mount Showcase: แสดงการอัปเกรด ATK ชัดเจน (เช่น 800 → 2,500 ▲ +1,700)', () => {
    const rider = getCardById('th01-001') // ไกรทองจอมเวท (ATK 800)
    const mounted = getCardById('th03-013') // ไกรทองขี่พญาชาละวัน (ATK 2500)
    expect(rider.atk).toBe(800)
    expect(mounted.atk).toBe(2500)

    const diff = mounted.atk - rider.atk
    expect(diff).toBe(1700)
  })

  it('BattleFx: มี helper window.__previewBossSummon และ window.__previewMount', async () => {
    const fs = await import('node:fs')
    const fxCode = fs.readFileSync(new URL('./BattleFx.jsx', import.meta.url), 'utf8')

    expect(fxCode).toContain('window.__previewBossSummon =')
    expect(fxCode).toContain('window.__previewMount =')
    expect(fxCode).toContain('fx-sc__stat-upgrade')
    expect(fxCode).toContain('fx-sc__mount-duo')
  })
})
