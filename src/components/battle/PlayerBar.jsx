import { PLAYER_NAMES, RULES, formatNumber } from '../../engine'

export default function PlayerBar({ player, isActive, isOpponent }) {
  const lpPercent = Math.max(0, Math.min(100, (player.lp / RULES.startingLP) * 100))
  return (
    <div
      className={`player-bar${isActive ? ' player-bar--active' : ''}${isOpponent ? ' player-bar--opponent' : ''}`}
      data-player={player.id}
    >
      <div className="player-bar__name">
        <span aria-hidden="true">{isOpponent ? '👹' : '🧑'}</span> {PLAYER_NAMES[player.id]}
      </div>
      <div className="player-bar__lp">
        <span className="player-bar__lp-label">LP</span>
        {/* key ทำให้แอนิเมชันกะพริบเล่นใหม่ทุกครั้งที่ LP เปลี่ยน */}
        <strong key={player.lp} className="player-bar__lp-num" data-lp>{formatNumber(player.lp)}</strong>
        <span className="player-bar__lp-track" aria-hidden="true">
          <span className="player-bar__lp-fill" style={{ width: `${lpPercent}%` }} />
        </span>
      </div>
      <div className="player-bar__counts">
        <span title="การ์ดในมือ">✋ {player.hand.length} ใบ</span>
      </div>
    </div>
  )
}
