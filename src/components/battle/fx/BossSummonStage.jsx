import { useEffect, useRef } from 'react'
import { getCardById } from '../../../data/cards'
import { ELEMENTS } from '../../../data/elements'

/*
 * BossSummonStage — ฉากอัญเชิญบอสระดับเทวะ (Boss Summon Cinematic)
 *
 * รองรับ 2 รูปแบบตามความกว้างหน้าจอ (Media Query / ขนาดจอ ไม่ผูกกับชนิดอุปกรณ์):
 * 1) มือถือหรือจอแคบ (< 720px): เล่นเต็มจอ
 *    - จอมืดลงพร้อมบรรยากาศธาตุ
 *    - วงอาคม/ยันต์ไทยหมุนซ้อนชั้น
 *    - การ์ดแยกชั้น 2.5 มิติ (ฉากหลังลึก · กรอบทอง · ตัวละครลอยเด่นทะลุกรอบ · พลังธาตุด้านหน้า)
 *      พร้อมกล้องค่อย ๆ ซูมและเอียงในมุมมอง 3 มิติ
 *    - อนุภาคและแสงตามธาตุบน Canvas (จำกัดไม่เกิน 46 ชิ้น):
 *      • th05-005 พระอินทร์ จอมอาสนี: สายฟ้าฟาดและหมู่เมฆพายุสวรรค์
 *      • th01-012 ครุฑนาคา มหาเทพประสาน: เปลวไฟสุริยะปะทะเกลียวน้ำบาดาล
 *      • th07-016 พญานาคราชมณีบาดาล: น้ำวนบาดาลและรัศมีแสงมณีแดง-ฟ้า
 *    - ชื่อการ์ดขนาดใหญ่พร้อมฉายาและค่าพลัง
 *    - วินาทีสุดท้ายย่อและพุ่งลงช่องบนสนามที่การ์ดลง
 *
 * 2) PC หรือจอกว้าง (≥ 720px): ไม่เต็มจอ
 *    - วงอาคมขึ้นที่ช่องมอนสเตอร์บนกระดาน
 *    - กระดานเอียงเพิ่มเล็กน้อยด้วย CSS perspective (.battle--boss-summon)
 *    - ร่างบอส 2.5 มิติผุดขึ้นจากช่อง สูงพ้นขอบกระดาน พร้อมอนุภาคธาตุและป้ายชื่อ
 *    - ยุบตัวลงเป็นการ์ดในช่องเมื่อจบฉาก
 */

const BOSS_PROFILES = {
  'th05-005': {
    theme: 'indra',
    kicker: '⚡ มหาพิธีอัญเชิญจอมเทวา',
    epithet: 'วัชระส่องประกายเหนือวิมานฟ้า',
    primary: '#ffe680',
    secondary: '#7ee8fa',
    accent: '#f59e0b',
    glow: 'rgba(255, 230, 128, 0.72)',
    veilTint: 'rgba(14, 22, 58, 0.88)',
    hasDedicatedLayers: false,
  },
  'th01-012': {
    theme: 'krut-naga',
    kicker: 'มหาเทพประสานจุติ',
    epithet: 'อัคนีเวหาและวารีบาดาลหลอมรวมเป็นหนึ่ง',
    primary: '#ff7847',
    secondary: '#0b3a5c',
    accent: '#38bdf8',
    glow: 'rgba(255, 120, 71, 0.72)',
    veilTint: 'rgba(10, 14, 28, 0.94)',
    hasDedicatedLayers: false,
  },
  'th07-016': {
    theme: 'naga',
    kicker: 'จ้าวบาดาลจุติ',
    epithet: 'มณีบาดาลเปล่งแสงเหนือวังวนพิภพนาคา',
    primary: '#38e8df',
    secondary: '#0a4c6a',
    accent: '#7ee8fa',
    glow: 'rgba(14, 116, 144, 0.72)',
    veilTint: 'rgba(2, 12, 22, 0.96)',
    hasDedicatedLayers: true,
    bgImage: '/cards/showcase/th07-016-background.webp',
    fgImage: '/cards/showcase/th07-016-foreground.webp',
  },
}

function getBossProfile(card) {
  if (!card) return BOSS_PROFILES['th05-005']
  if (BOSS_PROFILES[card.id]) return BOSS_PROFILES[card.id]

  const el = ELEMENTS[card.element] || ELEMENTS.lightning
  const sec = card.secondaryElements?.[0] ? ELEMENTS[card.secondaryElements[0]] : null
  const theme =
    card.element === 'water'
      ? 'naga'
      : card.secondaryElements?.includes('fire') && card.secondaryElements?.includes('water')
      ? 'krut-naga'
      : 'indra'

  return {
    theme,
    kicker: card.summonType === 'ritual' ? '🙏 มหาพิธีอัญเชิญเทวา' : '🌀 จุติมหาเทพ',
    epithet: card.flavorText || 'เทวานุภาพสะท้านสามภพ',
    primary: el.glow || '#ffe680',
    secondary: sec?.glow || el.color || '#7ee8fa',
    accent: '#fae094',
    glow: 'rgba(250, 224, 148, 0.68)',
    veilTint: 'rgba(12, 16, 34, 0.88)',
    hasDedicatedLayers: false,
  }
}

export default function BossSummonStage({ show }) {
  const card = getCardById(show.resultCardId) || getCardById(show.cardId)
  const profile = getBossProfile(card)
  const isShort = Boolean(show.short)
  const isReduced = Boolean(show.reduced)
  const isWide = Boolean(show.isWide)

  const rootStyle = {
    '--dur': `${show.duration}ms`,
    '--boss-x': `${show.x}px`,
    '--boss-y': `${show.y}px`,
    '--slot-x': `${show.slotX}px`,
    '--slot-y': `${show.slotY}px`,
    '--card-w': `${show.cardW}px`,
    '--ex': `${show.ex}px`,
    '--ey': `${show.ey}px`,
    '--s1': show.s1,
    '--rise-y': `${show.riseY || 145}px`,
    '--boss-c1': profile.primary,
    '--boss-c2': profile.secondary,
    '--boss-c3': profile.accent,
    '--boss-glow': profile.glow,
    '--boss-veil': profile.veilTint,
  }

  const modeClass = isWide ? 'fx-boss--pc' : 'fx-boss--mobile'
  const lengthClass = isReduced
    ? 'fx-boss--reduced'
    : isShort
    ? 'fx-boss--short'
    : 'fx-boss--full'
  const cls = `fx-boss ${modeClass} ${lengthClass} fx-boss--${profile.theme}`

  // โหมดลดการเคลื่อนไหว (prefers-reduced-motion): แสดงป้ายชื่อและตราบอสสั้น ๆ อย่างนุ่มนวล
  if (isReduced) {
    return (
      <div className={cls} style={rootStyle}>
        <div className="fx-boss__anchor">
          <BossTitleBanner card={card} profile={profile} show={show} />
        </div>
        <BossBoardImpact
          theme={profile.theme}
          slotX={show.slotX}
          slotY={show.slotY}
          isShort={isShort}
          isReduced={true}
          duration={show.duration}
        />
      </div>
    )
  }

  const materials = (show.materials || []).slice(0, 3)

  return (
    <div className={cls} style={rootStyle}>
      {/* ม่านมืดเต็มจอเฉพาะโหมดมือถือ/จอแคบ (< 720px) */}
      {!isWide && <div className="fx-boss__veil" />}

      {/* วงอาคมที่ช่องบนกระดาน (เด่นเป็นพิเศษบน PC และเป็นจุดลงจอดบนมือถือ) */}
      <div className="fx-boss__slot-anchor">
        <span className="fx-boss__slot-glow" />
        <BossYantraSvg className="fx-boss__slot-yantra" theme={profile.theme} />
        <span className="fx-boss__slot-pillar" />
        <span className="fx-boss__slot-impact" />
      </div>

      {/* จุดศูนย์กลางเวทีอัญเชิญบอส (กลางจอบนมือถือ / เหนือช่องการ์ดบน PC) */}
      <div className="fx-boss__stage-anchor">
        {/* วัตถุดิบสังเวย/ผสานวิ่งเข้าสู่วงอาคมในช่วงต้น (เฉพาะฉากเต็ม) */}
        {!isShort && materials.length > 0 && (
          <div className="fx-boss__mats">
            {materials.map((matId, idx) => {
              const offset = (idx - (materials.length - 1) / 2) * 1.05
              return (
                <div
                  key={`${matId}-${idx}`}
                  className="fx-boss__mat-card"
                  style={{ '--mat-x': offset, '--mat-i': idx }}
                >
                  <img src={`/cards/${matId}.jpg`} alt="" draggable="false" />
                </div>
              )
            })}
          </div>
        )}

        {/* วงอาคม/ยันต์ใหญ่หมุนด้านหลังร่างบอส */}
        <div className="fx-boss__yantra-wrap">
          <BossYantraSvg className="fx-boss__yantra fx-boss__yantra--outer" theme={profile.theme} />
          <BossYantraSvg className="fx-boss__yantra fx-boss__yantra--inner" theme={profile.theme} />
        </div>

        {/* ชั้นบรรยากาศเฉพาะธาตุ (เมฆพระอินทร์ / เกลียวไฟ-น้ำครุฑนาคา / น้ำวนและรัศมีมณีนาคราช) */}
        <BossAtmosphere theme={profile.theme} />

        {/* อนุภาคและแสงตามธาตุด้วย Canvas 2D (จำกัดไม่เกิน 46 ชิ้น) */}
        <BossParticleCanvas
          theme={profile.theme}
          duration={show.duration}
          isWide={isWide}
          isShort={isShort}
          cardW={show.cardW}
        />

        {/* กล้องและการ์ดแยกชั้น 2.5 มิติ พร้อมย่อพุ่งลงช่องในวินาทีสุดท้าย */}
        <div className="fx-boss__flight">
          <div className="fx-boss__camera">
            <BossCard25D card={card} profile={profile} />
          </div>
        </div>

        {/* ชื่อการ์ดขนาดใหญ่และฉายา */}
        <BossTitleBanner card={card} profile={profile} show={show} />

        {/* ป้ายบอกข้ามฉาก */}
        {!isShort && <span className="fx-boss__skip-hint">แตะที่ใดก็ได้เพื่อข้าม ⏭</span>}
      </div>

      {/* ผลกระทบลงกระดานตอนจบฉาก (0.8–1.2s สำหรับฉากเต็ม / ~0.5s สำหรับฉากสั้น) */}
      <BossBoardImpact
        theme={profile.theme}
        slotX={show.slotX}
        slotY={show.slotY}
        isShort={isShort}
        isReduced={isReduced}
        duration={show.duration}
      />
    </div>
  )
}

/*
 * การ์ดและตัวละครแยกชั้น 2.5 มิติ (CSS 3D Transform Stack)
 * - ชั้นหลังสุด (translateZ -30px): ฉากหลังวัง/วิมาน/บาดาล
 * - ชั้นกลาง (translateZ 0px): กรอบการ์ดลายไทยทองเปลวและวงรัศมี
 * - ชั้นเงาและฐาน (translateZ +18px): เงาตัวละครและฐานบัว/เกลียวคลื่น
 * - ชั้นตัวละครลอยเด่น (translateZ +48px): ตัวละครขนาดใหญ่ลอยพ้นฉากหลังและทะลุกรอบการ์ด
 * - ชั้นเอฟเฟกต์หน้าสุด (translateZ +70px): สายฟ้า / ลูกไฟ-น้ำ / แสงมณีบาดาลลอยหน้าตัวละคร
 */
function BossCard25D({ card, profile }) {
  const cardId = card?.id || 'th05-005'
  const bgSrc = profile.hasDedicatedLayers ? profile.bgImage : `/cards/${cardId}.jpg`
  const fgSrc = profile.hasDedicatedLayers ? profile.fgImage : `/cards/${cardId}.jpg`

  return (
    <div className={`fx-boss__card3d fx-boss__card3d--${profile.theme}`}>
      {/* ชั้นที่ 1: ฉากหลังลึก (Deep Background Plane) */}
      <div className="fx-boss__layer fx-boss__layer--bg">
        <img src={bgSrc} alt="" draggable="false" />
        <span className="fx-boss__bg-vignette" />
      </div>

      {/* ชั้นที่ 2: กรอบเทวะและวงรัศมี (Midground Divine Frame) */}
      <div className="fx-boss__layer fx-boss__layer--frame">
        <span className="fx-boss__frame-border" />
        <span className="fx-boss__frame-halo" />
      </div>

      {/* ชั้นที่ 3: ชั้นกลาง-หน้า (ฐานบัว / เกลียวคลื่น / ลำตัวนาค) */}
      <div className="fx-boss__layer fx-boss__layer--mid">
        <img src={fgSrc} alt="" draggable="false" />
      </div>

      {/* เงาตกกระทบ 2.5 มิติหลังตัวละคร */}
      <div className="fx-boss__layer fx-boss__layer--shadow" />

      {/* ชั้นที่ 4: ตัวละครหลักลอยเด่นจากฉากหลัง (Foreground Pop-out Character) */}
      <div className="fx-boss__layer fx-boss__layer--fg">
        <img src={fgSrc} alt="" draggable="false" />
      </div>

      {/* ชั้นที่ 5: พลังธาตุและประกายแสงด้านหน้าสุด (Front Elemental FX Plane) */}
      <div className="fx-boss__layer fx-boss__layer--front-fx">
        {profile.theme === 'indra' && (
          <svg className="fx-boss__front-svg fx-boss__front-svg--indra" viewBox="0 0 200 280">
            <polyline
              className="fx-boss__bolt-arc fx-boss__bolt-arc--1"
              points="68,16 52,58 76,66 44,124 68,130 34,196"
            />
            <polyline
              className="fx-boss__bolt-arc fx-boss__bolt-arc--2"
              points="146,24 126,72 148,80 116,144 138,154 112,216"
            />
          </svg>
        )}
        {profile.theme === 'krut-naga' && (
          <div className="fx-boss__dual-orbs">
            <span className="fx-boss__orb-fire" />
            <span className="fx-boss__orb-water" />
            <span className="fx-boss__dual-spiral-ring" />
          </div>
        )}
        {profile.theme === 'naga' && (
          <div className="fx-boss__naga-fx">
            <span className="fx-boss__naga-bubble fx-boss__naga-bubble--1" />
            <span className="fx-boss__naga-bubble fx-boss__naga-bubble--2" />
            <span className="fx-boss__naga-bubble fx-boss__naga-bubble--3" />
            <span className="fx-boss__whirlpool-ring" />
            <span className="fx-boss__caustics" />
          </div>
        )}
        <span className="fx-boss__card-sheen" />
      </div>
    </div>
  )
}

function BossTitleBanner({ card, profile, show }) {
  const name = card?.name || show.name || 'มหาเทพอัญเชิญ'
  const stars = Math.min(10, Math.max(1, card?.level || 8))
  return (
    <div className="fx-boss__banner">
      <span className="fx-boss__kicker">{profile.kicker}</span>
      <strong className="fx-boss__name">{name}</strong>
      <div className="fx-boss__meta">
        <span className="fx-boss__stars" aria-hidden="true">
          {'★'.repeat(stars)}
        </span>
        {card?.atk != null && (
          <span className="fx-boss__stats">
            ATK {card.atk.toLocaleString('en-US')} / DEF {(card.def ?? 0).toLocaleString('en-US')}
          </span>
        )}
      </div>
    </div>
  )
}

function BossAtmosphere({ theme }) {
  if (theme === 'indra') {
    return (
      <div className="fx-boss__atmos fx-boss__atmos--indra">
        <span className="fx-boss__cloud fx-boss__cloud--top-l" />
        <span className="fx-boss__cloud fx-boss__cloud--top-r" />
        <span className="fx-boss__cloud fx-boss__cloud--bot-l" />
        <span className="fx-boss__cloud fx-boss__cloud--bot-r" />
        <svg className="fx-boss__sky-bolts" viewBox="0 0 320 380">
          <path
            className="fx-boss__sky-bolt fx-boss__sky-bolt--a"
            d="M78,0 L48,92 L92,98 L36,214 L82,220 L28,350"
          />
          <path
            className="fx-boss__sky-bolt fx-boss__sky-bolt--b"
            d="M248,0 L214,88 L252,96 L196,208 L236,218 L188,352"
          />
          <path
            className="fx-boss__sky-bolt fx-boss__sky-bolt--c"
            d="M162,0 L144,74 L176,82 L138,176"
          />
        </svg>
      </div>
    )
  }

  if (theme === 'krut-naga') {
    return (
      <div className="fx-boss__atmos fx-boss__atmos--krut-naga">
        {/* ครึ่งบน: ฟ้าครุฑสุริยะ ท่าโฉบ ขนนกไฟปลิว (ไม่มีท่ากางปีกตรงหน้า) */}
        <div className="fx-boss__split-sky">
          <span className="fx-boss__sky-glow" />
          <span className="fx-boss__fire-feather fx-boss__fire-feather--1" />
          <span className="fx-boss__fire-feather fx-boss__fire-feather--2" />
          <span className="fx-boss__fire-feather fx-boss__fire-feather--3" />
        </div>
        {/* ครึ่งล่าง: บาดาลนาคราช น้ำวนเข้มลึก */}
        <div className="fx-boss__split-abyss">
          <span className="fx-boss__abyss-glow" />
          <span className="fx-boss__water-current" />
        </div>
        {/* เกลียวคู่ปะทะกลางจอ หลอมรวมเป็นหนึ่ง */}
        <span className="fx-boss__dual-spiral" />
        <span className="fx-boss__fusion-ring fx-boss__fusion-ring--gold" />
        <span className="fx-boss__fusion-ring fx-boss__fusion-ring--blue" />
      </div>
    )
  }

  return (
    <div className="fx-boss__atmos fx-boss__atmos--naga">
      <span className="fx-boss__vortex fx-boss__vortex--outer" />
      <span className="fx-boss__vortex fx-boss__vortex--inner" />
      <span className="fx-boss__mani-burst" />
      <span className="fx-boss__abyss-depth" />
      <span className="fx-boss__water-current" />
    </div>
  )
}

function BossYantraSvg({ className = '', theme }) {
  return (
    <svg className={className} viewBox="0 0 240 240">
      {/* วงรัศมีนอกและจุดอักขระ */}
      <circle
        cx="120"
        cy="120"
        r="112"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="6 5"
      />
      <circle cx="120" cy="120" r="102" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {/* ยันต์แปดทิศ (สี่เหลี่ยมซ้อนสองชั้น) */}
      <rect
        x="48"
        y="48"
        width="144"
        height="144"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="48"
        y="48"
        width="144"
        height="144"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        transform="rotate(45 120 120)"
      />
      {/* ดาวแปดแฉกและกลีบบัวในวงยันต์ */}
      <polygon
        points="120,16 142,82 208,60 166,114 224,120 166,126 208,180 142,158 120,224 98,158 32,180 74,126 16,120 74,114 32,60 98,82"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.82"
      />
      <circle
        cx="120"
        cy="120"
        r="64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={theme === 'naga' ? '12 6' : '8 4'}
      />
      <circle cx="120" cy="120" r="36" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/*
 * Canvas อนุภาคธาตุ (จำกัดจำนวนอนุภาค ≤ 44 ชิ้น เพื่อความลื่นไหลบนมือถือ)
 * - indra: ก้อนเมฆพายุ + ประกายสายฟ้าสีทอง-ฟ้า + เส้นสายฟ้าแลบเป็นจังหวะ
 * - krut-naga: อนุภาคเปลวไฟสีชาด-ทอง และหยดน้ำ/เกลียวคลื่นสีฟ้าคราม หมุนเป็นเกลียวคู่เข้าหากัน
 * - naga: อนุภาคน้ำวนหมุนเป็นวง + ประกายแสงมณีสีทับทิม-ฟ้าครามระยิบระยับ
 */
function BossParticleCanvas({ theme, duration, isWide, isShort, cardW }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = isWide ? Math.round(cardW * 2.5) : Math.min(window.innerWidth, 560)
    const height = isWide ? Math.round(cardW * 2.8) : Math.min(window.innerHeight, 680)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    const cx = width / 2
    const cy = height / 2
    // จำกัดไม่เกิน 44 ชิ้นสำหรับฉากเต็ม และ 18 ชิ้นสำหรับฉากสั้น (ต่ำกว่าเพดาน 60 ชิ้นอย่างปลอดภัย)
    const count = isShort ? 18 : 44
    const particles = []

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const radius = (0.18 + Math.random() * 0.78) * Math.min(width, height) * 0.46
      const isSecondary = i % 2 === 1

      if (theme === 'indra') {
        const isCloud = i < (isShort ? 3 : 7)
        particles.push({
          kind: isCloud ? 'cloud' : 'spark',
          angle,
          radius: isCloud ? radius * 0.85 : radius,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.8,
          vx: (Math.random() - 0.5) * (isCloud ? 18 : 48),
          vy: isCloud ? (Math.random() - 0.5) * 8 : -28 - Math.random() * 55,
          size: isCloud ? 38 + Math.random() * 34 : 2.2 + Math.random() * 3.8,
          color: isSecondary ? '#7ee8fa' : '#ffe680',
          alpha: isCloud ? 0.22 + Math.random() * 0.16 : 0.65 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
        })
      } else if (theme === 'krut-naga') {
        // ครึ่งหนึ่งเป็นไฟสุริยะ (ครุฑ) อีกครึ่งเป็นสายน้ำบาดาล (นาคา) หมุนเกลียวประสาน
        const isFire = !isSecondary
        particles.push({
          kind: isFire ? 'fire' : 'water',
          angle: angle + (isFire ? 0 : Math.PI),
          radius,
          speed: (isFire ? 1.85 : -1.85) * (0.75 + Math.random() * 0.5),
          radialSpeed: -16 - Math.random() * 24,
          size: 3 + Math.random() * 4.8,
          color: isFire
            ? i % 4 === 0
              ? '#ffe680'
              : '#ff6433'
            : i % 4 === 1
            ? '#a5f3fc'
            : '#2ec4ff',
          alpha: 0.72 + Math.random() * 0.28,
          phase: Math.random() * Math.PI * 2,
        })
      } else {
        // พญานาคราช: ฟองอากาศมรกตใต้น้ำลึก (bubble) + เกลียวน้ำวนบาดาล (vortex) - ตัดสีชมพูออกหมด
        const isBubble = i % 3 === 0
        particles.push({
          kind: isBubble ? 'bubble' : 'vortex',
          angle,
          radius: isBubble ? radius * 0.75 : radius,
          speed: (isBubble ? 1.05 : 2.2) * (0.8 + Math.random() * 0.45),
          radialSpeed: isBubble ? -6 : -20 - Math.random() * 16,
          size: isBubble ? 3.6 + Math.random() * 4.4 : 2.2 + Math.random() * 3.4,
          color: isBubble
            ? i % 2 === 0
              ? '#7ee8fa'
              : '#a5f3fc'
            : i % 2 === 0
            ? '#14b8a6'
            : '#0284c7',
          alpha: 0.68 + Math.random() * 0.32,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    const maxR = Math.min(width, height) * 0.48
    const start = performance.now()
    let prev = start
    let rafId = 0

    const drawDiamond = (x, y, r) => {
      ctx.beginPath()
      ctx.moveTo(x, y - r * 1.4)
      ctx.lineTo(x + r * 0.9, y)
      ctx.lineTo(x, y + r * 1.4)
      ctx.lineTo(x - r * 0.9, y)
      ctx.closePath()
      ctx.fill()
    }

    const render = (now) => {
      const elapsed = now - start
      if (elapsed >= duration) return
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const progress = elapsed / duration
      // ค่อย ๆ จางออกในช่วง 20% สุดท้ายตอนการ์ดพุ่งลงช่อง
      const envAlpha =
        progress < 0.12
          ? progress / 0.12
          : progress > 0.78
          ? Math.max(0, (1 - progress) / 0.22)
          : 1

      ctx.clearRect(0, 0, width, height)

      // วาดวงน้ำวนหรือรัศมีมณีบาดาลสำหรับพญานาค
      if (theme === 'naga' && envAlpha > 0.05) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(elapsed * 0.0022)
        ctx.strokeStyle = `rgba(56, 232, 223, ${0.24 * envAlpha})`
        ctx.lineWidth = 2
        for (let arm = 0; arm < 3; arm++) {
          ctx.rotate((Math.PI * 2) / 3)
          ctx.beginPath()
          for (let t = 0; t < 28; t++) {
            const ratio = t / 27
            const r = ratio * maxR * 0.95
            const a = ratio * Math.PI * 2.2
            const px = Math.cos(a) * r
            const py = Math.sin(a) * r * 0.82
            if (t === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        ctx.restore()
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        if (p.kind === 'cloud') {
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x - cx > maxR) p.x = cx - maxR
          if (cx - p.x > maxR) p.x = cx + maxR
          const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size)
          grad.addColorStop(0, `rgba(210, 230, 255, ${p.alpha * envAlpha})`)
          grad.addColorStop(0.55, `rgba(72, 96, 156, ${p.alpha * 0.55 * envAlpha})`)
          grad.addColorStop(1, 'rgba(18, 26, 52, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        if (p.kind === 'spark') {
          p.x += p.vx * dt + Math.sin(elapsed * 0.012 + p.phase) * 0.8
          p.y += p.vy * dt
          if (p.y < cy - maxR) {
            p.y = cy + maxR * 0.85
            p.x = cx + (Math.random() - 0.5) * maxR * 1.6
          }
          ctx.fillStyle = p.color
          ctx.globalAlpha = p.alpha * envAlpha * (0.65 + 0.35 * Math.sin(elapsed * 0.016 + p.phase))
          drawDiamond(p.x, p.y, p.size)
          continue
        }

        // อนุภาคหมุนเป็นเกลียว (krut-naga: fire/water, naga: vortex/mani)
        p.angle += p.speed * dt
        p.radius += p.radialSpeed * dt
        if (p.radius < 14) {
          p.radius = maxR * (0.75 + Math.random() * 0.25)
        }
        const squash = theme === 'naga' ? 0.82 : 0.9
        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius * squash

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha * envAlpha * (0.7 + 0.3 * Math.sin(elapsed * 0.014 + p.phase))

        if (p.kind === 'bubble') {
          // ฟองอากาศโปร่งแสงทรงกลม พร้อมประกายสะท้อนแสงสีขาว
          ctx.beginPath()
          ctx.arc(x, y, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(255, 255, 255, ${0.72 * envAlpha})`
          ctx.beginPath()
          ctx.arc(x - p.size * 0.32, y - p.size * 0.32, Math.max(0.8, p.size * 0.26), 0, Math.PI * 2)
          ctx.fill()
        } else if (p.kind === 'mani') {
          drawDiamond(x, y, p.size)
        } else {
          ctx.beginPath()
          ctx.arc(x, y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // สายฟ้าแลบเป็นจังหวะสำหรับพระอินทร์
      if (theme === 'indra' && Math.sin(elapsed * 0.024) > 0.72) {
        ctx.globalAlpha = 0.82 * envAlpha
        ctx.strokeStyle = '#fff9d2'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        let bx = cx + (Math.sin(elapsed * 0.07) * maxR * 0.55)
        let by = cy - maxR * 0.95
        ctx.moveTo(bx, by)
        for (let s = 0; s < 6; s++) {
          bx += (Math.random() - 0.5) * 34
          by += (maxR * 1.75) / 6
          ctx.lineTo(bx, by)
        }
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [theme, duration, isWide, isShort, cardW])

  return <canvas ref={canvasRef} className="fx-boss__canvas" />
}

/*
 * ผลกระทบของบอสลงบนกระดานจริงตอนจบฉาก (0.8–1.2 วินาที สำหรับฉากเต็ม / ~0.5 วินาที สำหรับฉากสั้น)
 * - พระอินทร์ (th05-005): ฟ้าแลบทั้งกระดาน + สายฟ้าฟาดลงช่อง + ประกายไฟแตกกระจาย + รอยไหม้เรืองแสง + จอสั่นสั้น ๆ
 * - พญานาคราช (th07-016): น้ำน้ำเงินเข้มซัดจากช่องท่วมกระดาน + การ์ดเหมือนจมใต้น้ำ + แสงระลอกน้ำ + น้ำไหลกลับเข้าช่อง
 * - ครุฑนาคา (th01-012): ฝั่งศัตรูลมปีกครุฑพาขนนกไฟปลิว + ฝั่งเรามีคลื่นน้ำวน + หมุนวนประสานที่ช่อง
 * - reduced-motion: แสงนุ่มนวลสั้น ๆ ตรงช่อง ไม่สั่น ไม่วาบทั้งจอ
 */
function BossBoardImpact({ theme, slotX, slotY, isShort, isReduced, duration }) {
  if (isReduced) {
    return (
      <div
        className="fx-boss-impact fx-boss-impact--reduced"
        style={{ '--slot-x': `${slotX}px`, '--slot-y': `${slotY}px` }}
      >
        <span className="fx-boss-impact__soft-pulse" />
      </div>
    )
  }

  const cls = `fx-boss-impact fx-boss-impact--${theme}${isShort ? ' fx-boss-impact--short' : ''}`

  return (
    <div
      className={cls}
      style={{
        '--slot-x': `${slotX}px`,
        '--slot-y': `${slotY}px`,
        '--dur': `${duration}ms`,
      }}
    >
      {theme === 'indra' && (
        <>
          <div className="fx-boss-impact__flash" />
          <div className="fx-boss-impact__ground">
            <svg className="fx-boss-impact__bolt-svg" viewBox="0 0 160 360">
              <path
                className="fx-boss-impact__bolt-main"
                d="M80,0 L65,75 L95,85 L50,195 L88,205 L60,295 L80,360"
              />
              <path
                className="fx-boss-impact__bolt-fork fx-boss-impact__bolt-fork--1"
                d="M65,75 L25,125 L45,135 L15,190"
              />
              <path
                className="fx-boss-impact__bolt-fork fx-boss-impact__bolt-fork--2"
                d="M88,205 L130,250 L115,260 L145,315"
              />
            </svg>
            <span className="fx-boss-impact__scorch" />
            <div className="fx-boss-impact__sparks">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className={`fx-boss-impact__spark fx-boss-impact__spark--${i}`}
                  style={{ '--ang': `${i * 45}deg` }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {theme === 'naga' && (
        <>
          <div className="fx-boss-impact__flood-overlay">
            <span className="fx-boss-impact__caustics-wash" />
          </div>
          <div className="fx-boss-impact__ground">
            <svg className="fx-boss-impact__wave-svg" viewBox="0 0 240 240">
              <path
                className="fx-boss-impact__crest fx-boss-impact__crest--1"
                d="M 120,40 C 160,36 200,75 200,120 C 200,165 160,204 120,200 C 80,196 40,165 40,120 C 40,75 80,44 120,40 Z"
              />
              <path
                className="fx-boss-impact__crest fx-boss-impact__crest--2"
                d="M 120,20 C 175,15 220,65 220,120 C 220,175 175,225 120,220 C 65,215 20,175 20,120 C 20,65 65,25 120,20 Z"
              />
            </svg>
            <span className="fx-boss-impact__wave fx-boss-impact__wave--outer" />
            <span className="fx-boss-impact__wave fx-boss-impact__wave--inner" />
            <span className="fx-boss-impact__water-drain" />
          </div>
        </>
      )}

      {theme === 'krut-naga' && (
        <>
          <div className="fx-boss-impact__enemy-storm">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`fx-boss-impact__storm-feather fx-boss-impact__storm-feather--${i}`}
              />
            ))}
          </div>
          <div className="fx-boss-impact__player-surge" />
          <div className="fx-boss-impact__ground">
            <div className="fx-boss-impact__converge-dual">
              <svg className="fx-boss-impact__converge-svg" viewBox="0 0 160 160">
                <path
                  className="fx-boss-impact__converge-line fx-boss-impact__converge-line--fire"
                  d="M 80,18 A 62,62 0 0,1 142,80 A 62,62 0 0,1 80,142 A 48,48 0 0,1 32,80 A 34,34 0 0,1 80,46 A 22,22 0 0,1 102,80 A 12,12 0 0,1 80,92"
                />
                <path
                  className="fx-boss-impact__converge-line fx-boss-impact__converge-line--water"
                  d="M 80,142 A 62,62 0 0,1 18,80 A 62,62 0 0,1 80,18 A 48,48 0 0,1 128,80 A 34,34 0 0,1 80,114 A 22,22 0 0,1 58,80 A 12,12 0 0,1 80,68"
                />
              </svg>
              <span className="fx-boss-impact__converge-core" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
