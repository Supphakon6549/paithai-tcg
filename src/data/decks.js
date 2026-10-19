import { EXTRA_DECK_LIST, STARTER_DECK_LIST } from '../engine/rules'

/*
 * สำรับ: { id, name, icon?, description?, main: [[cardId, n]], extra: [[cardId, n]], preset?, test? }
 * - สำรับทดสอบ (การ์ดครบทุกแบบ) ได้รับยกเว้นกติกา 40 ใบ
 * - สำรับสำเร็จรูปอ่านจาก preset-decks.json (ถ้ายังไม่มีไฟล์ = ไม่มีสำรับสำเร็จรูป)
 * - สำรับของผู้เล่นเก็บใน localStorage ของเบราว์เซอร์นี้
 */

const presetModules = import.meta.glob('./preset-decks.json', { eager: true, import: 'default' })
export const PRESET_DECKS = (Object.values(presetModules)[0] ?? []).map((deck) => ({ ...deck, preset: true }))

export const TEST_DECK = {
  id: 'test-all',
  name: 'สำรับทดสอบ (การ์ดครบทุกแบบ)',
  icon: '🧪',
  description: 'การ์ดทุกแบบ แบบละ 1 ใบ — ไว้ลองการ์ดใหม่ (ยกเว้นกติกา 40 ใบ)',
  main: STARTER_DECK_LIST,
  extra: EXTRA_DECK_LIST,
  preset: true,
  test: true,
}

const STORE_KEY = 'paithai.decks.v1'

export function loadDeckStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    return {
      decks: Array.isArray(data?.decks) ? data.decks : [],
      activeId: typeof data?.activeId === 'string' ? data.activeId : TEST_DECK.id,
    }
  } catch {
    return { decks: [], activeId: TEST_DECK.id }
  }
}

export function saveDeckStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // บันทึกไม่ได้ (โหมดส่วนตัว / พื้นที่เต็ม) — ใช้ต่อได้จนปิดหน้า
  }
}

export const allDecks = (store) => [TEST_DECK, ...PRESET_DECKS, ...store.decks]

export const findDeck = (store, id) => allDecks(store).find((deck) => deck.id === id) ?? TEST_DECK

// [[cardId, n]] ⇄ { cardId: n }
export const toCounts = (list = []) => Object.fromEntries(list.map(([id, n]) => [id, n]))
export const toList = (counts) => Object.entries(counts).filter(([, n]) => n > 0)

export const newDeckId = () => `deck-${Date.now().toString(36)}`
