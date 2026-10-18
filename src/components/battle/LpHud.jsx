import { AI, PLAYER, RULES, formatNumber } from '../../engine'

// แถบ LP ย่อ ติดขอบบนจอ — เห็น LP ทั้งสองฝ่ายตลอดแม้เลื่อนดูกระดาน
export default function LpHud({ game }) {
  const side = (id, icon, label) => {
    const p = game.players[id]
    const active = game.activePlayer === id && !game.winner
    return (
      // data-player / data-lp: ชั้นแอนิเมชันใช้หาตำแหน่ง LP (ตัวเลขความเสียหายเด้งที่แถบนี้ซึ่งเห็นตลอด)
      <span className={`lp-hud__side lp-hud__side--${id}${active ? ' lp-hud__side--active' : ''}`} data-player={id}>
        <span aria-hidden="true">{icon}</span>
        <span className="lp-hud__name">{label}</span>
        <strong key={p.lp} className="lp-hud__lp" data-lp>
          {formatNumber(p.lp)}
        </strong>
        <span className="lp-hud__hand" title="การ์ดในมือ">✋{p.hand.length}</span>
      </span>
    )
  }
  return (
    <div className="lp-hud" aria-label="LP ทั้งสองฝ่าย">
      {side(AI, '👹', 'คู่ต่อสู้')}
      <span className="lp-hud__turn">เทิร์น {game.turn}</span>
      {side(PLAYER, '🧑', 'คุณ')}
    </div>
  )
}

// ป้าย LP บนกระดานฝั่งของแต่ละคน (จอ PC) — ตัวเลข + หลอดพลังเล็ก
export function SideLp({ player, isOpponent, isActive }) {
  const percent = Math.max(0, Math.min(100, (player.lp / RULES.startingLP) * 100))
  return (
    <div
      className={`side-lp side-lp--${isOpponent ? 'opp' : 'me'}${isActive ? ' side-lp--active' : ''}`}
      data-player={player.id}
    >
      <span className="side-lp__name">
        <span aria-hidden="true">{isOpponent ? '👹' : '🧑'}</span> {isOpponent ? 'คู่ต่อสู้' : 'คุณ'}
        <span className="side-lp__hand" title="การ์ดในมือ">✋{player.hand.length}</span>
      </span>
      <strong key={player.lp} className="side-lp__lp" data-lp>
        LP {formatNumber(player.lp)}
      </strong>
      <span className="side-lp__track" aria-hidden="true">
        <span className="side-lp__fill" style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}
