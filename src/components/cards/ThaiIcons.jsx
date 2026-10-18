// ตราสัญลักษณ์และเพชรเจียระไนทรงหยดน้ำสำหรับ ไพ่ไทย TCG (Dark Gold Filigree Edition)

export function ElementSeal({ elementId, size = 22, title }) {
  const configs = {
    fire: {
      bg1: '#ff6b35',
      bg2: '#6e1105',
      rim: '#e5c158',
      path: (
        <g fill="#fff0d4">
          <path d="M12 3.2 C14.6 7.2 17.5 10.2 16.8 14.8 C16.2 17.8 14.3 19.8 12 19.8 C9.7 19.8 7.8 17.8 7.2 14.8 C6.5 10.2 9.4 7.2 12 3.2 Z" />
          <path d="M12 7 C10.3 10.2 9.5 12.6 10.5 15.2 C11.2 16.8 12.8 16.8 13.5 15.2 C14.5 12.6 13.7 10.2 12 7 Z" fill="#8f1808" />
        </g>
      ),
    },
    water: {
      bg1: '#2980b9',
      bg2: '#0a2942',
      rim: '#e5c158',
      path: (
        <g fill="#e8f6ff">
          <path d="M12 3.5 C15.4 8.5 17.2 11.6 17.2 14.8 C17.2 17.9 14.9 20 12 20 C9.1 20 6.8 17.9 6.8 14.8 C6.8 11.6 8.6 8.5 12 3.5 Z" />
          <path d="M8.6 14.8 C9.8 16.5 12.4 17 14.5 14.6 C13.3 17.5 9.8 17.8 8.6 14.8 Z" fill="#0d3d63" />
        </g>
      ),
    },
    earth: {
      bg1: '#5c8a2e',
      bg2: '#1b300d',
      rim: '#e5c158',
      path: (
        <g fill="#eef7d8">
          <path d="M12 3.5 L16 9.5 L14.2 14 L17.2 15.5 L12 20 L6.8 15.5 L9.8 14 L8 9.5 Z" />
          <path d="M12 6.8 L12 17.8" stroke="#223d11" strokeWidth="1.3" />
        </g>
      ),
    },
    wind: {
      bg1: '#2ea891',
      bg2: '#0b3b32',
      rim: '#e5c158',
      path: (
        <g fill="none" stroke="#e8fff9" strokeWidth="1.9" strokeLinecap="round">
          <path d="M5.5 10.5 C8.2 7.5 13.8 7.5 16 10.2 C17.4 11.8 16 14 14 13.6 C12.5 13.3 12.5 11.2 13.8 11" />
          <path d="M5 14.8 C8.6 13 15 13.8 17.8 16.5" />
        </g>
      ),
    },
    lightning: {
      bg1: '#d9a726',
      bg2: '#543803',
      rim: '#f5dc84',
      path: (
        <g fill="#fff8d6">
          <polygon points="13.5,3.2 7,12.6 11.6,12.6 9.8,20.5 17,10.6 12.2,10.6" />
        </g>
      ),
    },
    dark: {
      bg1: '#653ba6',
      bg2: '#1b0938',
      rim: '#e5c158',
      path: (
        <g fill="#ede3ff">
          <path d="M14.5 4.6 C10.3 5.2 7.4 8.6 7.4 12.6 C7.4 16.6 10.6 19.6 14.6 19.4 C11.8 18 10.3 15.4 10.3 12 C10.3 8.8 12 6.2 14.5 4.6 Z" />
        </g>
      ),
    },
    light: {
      bg1: '#e0b836',
      bg2: '#6e4706',
      rim: '#f5e2a8',
      path: (
        <g fill="#fffdf2">
          <polygon points="12,3.2 14,8.8 19.8,8.8 15,12.3 16.8,18.2 12,14.5 7.2,18.2 9,12.3 4.2,8.8 10,8.8" />
          <circle cx="12" cy="11.6" r="2" fill="#7d5208" />
        </g>
      ),
    },
    void: {
      bg1: '#707b8f',
      bg2: '#1f242e',
      rim: '#d4af37',
      path: (
        <g fill="none" stroke="#edf1f7" strokeWidth="1.7">
          <circle cx="12" cy="12" r="5.8" />
          <circle cx="12" cy="12" r="2" fill="#edf1f7" />
        </g>
      ),
    },
  }

  const cfg = configs[elementId] || configs.void
  const gradId = `el-orb-${elementId}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="thai-seal"
      role="img"
      aria-label={title || elementId}
    >
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={cfg.bg1} />
          <stop offset="100%" stopColor={cfg.bg2} />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.8" fill="#0d0a08" stroke={cfg.rim} strokeWidth="1.4" />
      <circle cx="12" cy="12" r="9" fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />
      {cfg.path}
    </svg>
  )
}

export function RarityGem({ rarityId, size = 14, title }) {
  const palettes = {
    common: { top: '#c2bfb8', left: '#827f78', right: '#4f4d47', rim: '#b0aba0' },
    copper: { top: '#f0b684', left: '#b86b35', right: '#6e3814', rim: '#e0a575' },
    silver: { top: '#ffffff', left: '#c2c9d6', right: '#768094', rim: '#e4e9f2' },
    gold: { top: '#fff4b8', left: '#e0b236', right: '#8c620a', rim: '#f7dc79' },
    emerald: { top: '#a7f3d0', left: '#10b981', right: '#065f46', rim: '#ebd075' },
    divine: { top: '#fff7d6', left: '#f43f5e', right: '#7e22ce', rim: '#ffe47a' },
  }
  const p = palettes[rarityId] || palettes.common

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="thai-gem" aria-label={title}>
      {title && <title>{title}</title>}
      {/* เพชรทรงหยดน้ำเจียระไนสำหรับบอกความหายาก */}
      <path
        d="M12 1.8 C15.8 7.5 19.5 11.5 19.5 15.5 C19.5 19.6 16.1 22.4 12 22.4 C7.9 22.4 4.5 19.6 4.5 15.5 C4.5 11.5 8.2 7.5 12 1.8 Z"
        fill="#120d0a"
        stroke={p.rim}
        strokeWidth="1.5"
      />
      <path d="M12 3.6 L17.6 14.8 L12 13.2 Z" fill={p.top} />
      <path d="M12 3.6 L6.4 14.8 L12 13.2 Z" fill={p.left} />
      <path d="M6.4 14.8 C7.2 18.5 9.4 20.6 12 20.6 L12 13.2 Z" fill={p.left} opacity="0.88" />
      <path d="M17.6 14.8 C16.8 18.5 14.6 20.6 12 20.6 L12 13.2 Z" fill={p.right} />
      <polygon points="12,7.2 14.6,13.5 12,17.2 9.4,13.5" fill="#ffffff" opacity="0.38" />
    </svg>
  )
}

/**
 * เพชรเจียระไนทรงหยดน้ำ (Faceted Teardrop Briolette Gem) แทนดาวแบบยูกิ
 */
export function LevelCrystal({ level }) {
  return (
    <div className="tc-levels" title={`ระดับ ${level}`} aria-label={`ระดับ ${level}`}>
      {Array.from({ length: level }, (_, i) => (
        <svg
          key={i}
          width="11"
          height="14"
          viewBox="0 0 16 20"
          className="tc-level-icon"
          aria-hidden="true"
        >
          {/* กรอบทองทรงหยดน้ำ */}
          <path
            d="M8 1 C11.2 6.2 14.5 9.8 14.5 13.4 C14.5 16.9 11.6 19.2 8 19.2 C4.4 19.2 1.5 16.9 1.5 13.4 C1.5 9.8 4.8 6.2 8 1 Z"
            fill="#140d08"
            stroke="#e5c158"
            strokeWidth="1.2"
          />
          {/* เหลี่ยมเพชรเจียระไนด้านใน */}
          <path d="M8 2.5 L13 12.8 L8 11.5 Z" fill="#fff3b8" />
          <path d="M8 2.5 L3 12.8 L8 11.5 Z" fill="#f0b942" />
          <path d="M3 12.8 C3.6 15.8 5.6 17.6 8 17.6 L8 11.5 Z" fill="#c98418" />
          <path d="M13 12.8 C12.4 15.8 10.4 17.6 8 17.6 L8 11.5 Z" fill="#8c5208" />
          {/* ประกายเพชรกลางหยดน้ำ */}
          <polygon points="8,5.6 10.3,11.6 8,15.2 5.7,11.6" fill="#ffffff" opacity="0.55" />
        </svg>
      ))}
    </div>
  )
}

/**
 * ตราเพชรสามเหลี่ยมโฮโลแกรมกึ่งกลางขอบล่าง (แบบ The One Ring MTG)
 */
export function HolofoilStamp({ rarityId = 'common' }) {
  const isHigh = rarityId === 'gold' || rarityId === 'emerald' || rarityId === 'divine'
  return (
    <svg width="24" height="13" viewBox="0 0 28 15" className="tc__holo-stamp" aria-hidden="true">
      <polygon
        points="2,1.5 26,1.5 14,13.5"
        fill="#0e0b09"
        stroke="#d4af37"
        strokeWidth="1.4"
      />
      <polygon
        points="5,3 14,3 14,11.5"
        fill={isHigh ? '#ffe999' : '#b8c2cc'}
      />
      <polygon
        points="23,3 14,3 14,11.5"
        fill={isHigh ? '#c9972c' : '#6c7682'}
      />
      <polygon
        points="9.5,3 18.5,3 14,8.5"
        fill="#ffffff"
        opacity="0.55"
      />
    </svg>
  )
}

export function SwordIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true" className="tc-stat-icon">
      <path
        d="M13.5 2.5 L6.5 9.5 L4.5 8.5 L3.5 9.5 L5.5 11.5 L2.5 14.5 L1.5 13.5 M13.5 2.5 L11.5 3 L5.5 9 L7 10.5 L13 4.5 Z"
        fill="#e5c158"
      />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true" className="tc-stat-icon">
      <path
        d="M8 1.8 L13.5 3.8 L13.5 8.2 C13.5 11.4 11 13.6 8 14.8 C5 13.6 2.5 11.4 2.5 8.2 L2.5 3.8 Z"
        fill="none"
        stroke="#e5c158"
        strokeWidth="1.5"
      />
    </svg>
  )
}
