// ตราสัญลักษณ์ลายไทยแบบ Vector SVG แทนการใช้ Emoji เพื่อให้หน้าการ์ดเหมือนการ์ดจริงระดับสะสม

export function ElementSeal({ elementId, size = 26, title }) {
  const configs = {
    fire: {
      bg1: '#ff6b35',
      bg2: '#8f1407',
      rim: '#f7c873',
      // ลายกนกเปลวเพลิงสามยอด
      path: (
        <g fill="#fff3d1">
          <path d="M12 2.5 C15 7 18.5 10.5 17.5 15.5 C16.8 18.8 14.5 21 12 21 C9.5 21 7.2 18.8 6.5 15.5 C5.5 10.5 9 7 12 2.5 Z" />
          <path d="M12 6.5 C10 10 9 13 10.2 16 C11 17.8 13 17.8 13.8 16 C15 13 14 10 12 6.5 Z" fill="#c82812" />
          <path d="M12 10.5 C12.9 12.2 13.2 14 12 16 C10.8 14 11.1 12.2 12 10.5 Z" fill="#ffe89e" />
        </g>
      ),
    },
    water: {
      bg1: '#3898dc',
      bg2: '#0b3559',
      rim: '#b6e3ff',
      // หยดน้ำทิพย์และเกลียวคลื่นบาดาล
      path: (
        <g fill="#e6f6ff">
          <path d="M12 3 C15.8 8.5 18 11.8 18 15.2 C18 18.6 15.3 21 12 21 C8.7 21 6 18.6 6 15.2 C6 11.8 8.2 8.5 12 3 Z" />
          <path d="M8.2 15.2 C9.5 17 12.5 17.5 14.8 15 C13.5 18.2 9.5 18.5 8.2 15.2 Z" fill="#0d4b7a" />
          <circle cx="10.2" cy="12.5" r="1.3" fill="#ffffff" />
        </g>
      ),
    },
    earth: {
      bg1: '#6f9c3d',
      bg2: '#1f3b12',
      rim: '#d4e89e',
      // ลายพุ่มข้าวบิณฑ์พฤกษาปฐวี
      path: (
        <g fill="#eef9d2">
          <path d="M12 3 L16.5 9.5 L14.5 14.5 L18 16 L12 21 L6 16 L9.5 14.5 L7.5 9.5 Z" />
          <path d="M12 6.5 L12 18.5" stroke="#264716" strokeWidth="1.4" />
          <path d="M12 11 L15 9 M12 13.5 L9 11.5" stroke="#264716" strokeWidth="1.2" />
        </g>
      ),
    },
    wind: {
      bg1: '#48c9b0',
      bg2: '#0e4d42',
      rim: '#b8f5e8',
      // ลายก้นขดวายุเมฆา
      path: (
        <g fill="none" stroke="#eafffa" strokeWidth="2" strokeLinecap="round">
          <path d="M5 10.5 C8 7 14 7 16.5 10 C18 11.8 16.5 14.2 14.2 13.8 C12.5 13.5 12.5 11.2 14 11" />
          <path d="M4.5 15 C8.5 13 15.5 14 18.5 17" />
          <path d="M7.5 18.5 C10.5 17.5 14 18 16 19.5" strokeWidth="1.6" />
        </g>
      ),
    },
    lightning: {
      bg1: '#f0c43e',
      bg2: '#6b4704',
      rim: '#fff2b2',
      // วัชระสายฟ้าพระอินทร์
      path: (
        <g fill="#fff9db">
          <polygon points="13.8,2.5 6.5,13 11.8,13 9.8,21.5 17.8,10.5 12.4,10.5" />
        </g>
      ),
    },
    dark: {
      bg1: '#7e52c8',
      bg2: '#220d47',
      rim: '#d4bfff',
      // จันทรคราสราหู
      path: (
        <g fill="#efe6ff">
          <path d="M14.8 4.2 C10.2 4.8 7 8.5 7 12.8 C7 17.2 10.5 20.5 15 20.2 C11.8 18.8 10.2 15.8 10.2 12.2 C10.2 8.6 12 5.8 14.8 4.2 Z" />
          <circle cx="15.8" cy="9.5" r="1.8" fill="#c7a6ff" />
        </g>
      ),
    },
    light: {
      bg1: '#f5d156',
      bg2: '#8a5a08',
      rim: '#fff8d6',
      // ดาราธรรมจักรแปดแฉก
      path: (
        <g fill="#fffdf0">
          <polygon points="12,2.5 14.2,8.8 20.5,8.8 15.4,12.6 17.4,19 12,15 6.6,19 8.6,12.6 3.5,8.8 9.8,8.8" />
          <circle cx="12" cy="11.8" r="2.2" fill="#9c690c" />
        </g>
      ),
    },
    void: {
      bg1: '#8b95a8',
      bg2: '#252b38',
      rim: '#dce3f0',
      // วงแหวนศูนยตา
      path: (
        <g fill="none" stroke="#f0f4fa" strokeWidth="1.8">
          <circle cx="12" cy="12" r="6.2" />
          <circle cx="12" cy="12" r="2.2" fill="#f0f4fa" />
          <path d="M12 3.2 L12 5.5 M12 18.5 L12 20.8 M3.2 12 L5.5 12 M18.5 12 L20.8 12" strokeLinecap="round" />
        </g>
      ),
    },
  }

  const cfg = configs[elementId] || configs.void
  const gradId = `el-grad-${elementId}`

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
      {/* กรอบประจำยาม 8 มุม */}
      <polygon
        points="12,0.8 15.5,3.2 19.8,3.2 20.8,7.5 23.2,12 20.8,16.5 19.8,20.8 15.5,20.8 12,23.2 8.5,20.8 4.2,20.8 3.2,16.5 0.8,12 3.2,7.5 4.2,3.2 8.5,3.2"
        fill="#1a120b"
        stroke={cfg.rim}
        strokeWidth="1.2"
      />
      <circle cx="12" cy="12" r="9.2" fill={`url(#${gradId})`} stroke={cfg.rim} strokeWidth="0.8" />
      {cfg.path}
    </svg>
  )
}

export function RarityGem({ rarityId, size = 20, title }) {
  const palettes = {
    common: { top: '#b8b5ad', left: '#7d7a72', right: '#4f4d47', rim: '#c7c2b6' },
    copper: { top: '#f0b684', left: '#b86b35', right: '#6e3814', rim: '#f5cfa6' },
    silver: { top: '#ffffff', left: '#c2c9d6', right: '#768094', rim: '#eef2f7' },
    gold: { top: '#fff4b8', left: '#e0b236', right: '#8c620a', rim: '#ffe885' },
    emerald: { top: '#a7f3d0', left: '#10b981', right: '#065f46', rim: '#ffd76b' },
    divine: { top: '#fff7d6', left: '#f43f5e', right: '#7e22ce', rim: '#ffe47a' },
  }
  const p = palettes[rarityId] || palettes.common

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="thai-gem" aria-label={title}>
      {title && <title>{title}</title>}
      {/* อัญมณีทรงพุ่มข้าวบิณฑ์เจียระไน */}
      <polygon
        points="12,1.5 20.5,12 12,22.5 3.5,12"
        fill="#17100b"
        stroke={p.rim}
        strokeWidth="1.5"
      />
      <polygon points="12,3 19,12 12,12" fill={p.top} />
      <polygon points="12,3 5,12 12,12" fill={p.left} />
      <polygon points="5,12 12,21 12,12" fill={p.left} opacity="0.85" />
      <polygon points="19,12 12,21 12,12" fill={p.right} />
      <polygon points="12,7 15.5,12 12,17 8.5,12" fill={p.top} opacity="0.65" />
    </svg>
  )
}

export function LevelCrystal({ level }) {
  return (
    <div className="tc-levels" title={`ระดับดาว ${level}`}>
      {Array.from({ length: level }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 16 16" className="tc-level-icon" aria-hidden="true">
          <polygon
            points="8,0.8 10.2,5.6 15.2,8 10.2,10.4 8,15.2 5.8,10.4 0.8,8 5.8,5.6"
            fill="#f5cf64"
            stroke="#5c3b09"
            strokeWidth="1.1"
          />
          <circle cx="8" cy="8" r="1.8" fill="#fff9db" />
        </svg>
      ))}
    </div>
  )
}

export function SwordIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" className="tc-stat-icon">
      <path
        d="M13.5 2.5 L6.5 9.5 L4.5 8.5 L3.5 9.5 L5.5 11.5 L2.5 14.5 L1.5 13.5 M13.5 2.5 L11.5 3 L5.5 9 L7 10.5 L13 4.5 Z"
        fill="#d4af37"
        stroke="#e8c96b"
        strokeWidth="0.6"
      />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" className="tc-stat-icon">
      <path
        d="M8 1.8 L13.5 3.8 L13.5 8.2 C13.5 11.4 11 13.6 8 14.8 C5 13.6 2.5 11.4 2.5 8.2 L2.5 3.8 Z"
        fill="none"
        stroke="#d4af37"
        strokeWidth="1.5"
      />
      <path d="M8 4 L11 5.2 L11 8 C11 10 9.6 11.5 8 12.4 C6.4 11.5 5 10 5 8 L5 5.2 Z" fill="#d4af37" opacity="0.65" />
    </svg>
  )
}
