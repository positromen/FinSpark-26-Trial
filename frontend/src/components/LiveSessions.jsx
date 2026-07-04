import { riskBand } from '../api.js'

// Currently-open privileged sessions with their live risk. A blocked row is
// held in red; the selected row drives the timeline / why panels.
export default function LiveSessions({ sessions, selectedId, onSelect, flashId }) {
  if (!sessions.length) {
    return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>
      No active privileged sessions. When staff use the portal they appear here live.
    </div>
  }
  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {sessions.map((s) => {
        const band = riskBand(s.score)
        const isSel = s.id === selectedId
        return (
          <li key={s.id}>
            <button onClick={() => onSelect(s.id)}
                    className="w-full text-left rounded-lg p-2.5 cursor-pointer transition"
                    style={{
                      background: isSel ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${s.status === 'BLOCKED' ? 'var(--critical)' : 'var(--border)'}`,
                      animation: s.id === flashId ? 'flash 1s ease' : 'none',
                    }}>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{s.user}</span>
                <span style={{ color: 'var(--muted)' }}>{s.role}</span>
                {s.status === 'BLOCKED' &&
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--critical)', color: '#fff' }}>BLOCKED</span>}
                <span className="ml-auto num font-bold text-base" style={{ color: band.color }}>
                  {Math.round(s.score)}
                </span>
              </div>
              <div className="text-[10px] mt-0.5 num" style={{ color: 'var(--muted)' }}>
                {s.source_ip} · {s.device} · {s.geo}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
