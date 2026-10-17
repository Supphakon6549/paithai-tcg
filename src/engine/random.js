// ตัวสุ่มแบบกำหนด seed ได้ (mulberry32) — ทำให้เทสสับไพ่ซ้ำผลเดิมได้
export function createRng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// สับไพ่แบบ Fisher–Yates คืนอาร์เรย์ใหม่
export function shuffle(items, rng) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
