// Users × day risk heatmap. Sequential red ramp (dark mode: low recedes toward
// the surface, high burns bright); cells ≥40 carry a direct numeric label so
// meaning never rides on color alone. Hover shows exact value.
const RAMP = ['#261412', '#3f1d1a', '#5e2420', '#832d27', '#ab372f', '#d64438', '#ff5c4d']

function cellColor(score) {
  if (score == null) return 'transparent'
  const idx = Math.min(Math.floor((score / 100) * RAMP.length), RAMP.length - 1)
  return RAMP[idx]
}

export default function Heatmap({ heatmap }) {
  const { dates, rows } = heatmap
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-left text-[10px] font-medium pr-2" style={{ color: 'var(--muted)' }}>user</th>
            {dates.map((d) => (
              <th key={d} className="text-[10px] font-medium num" style={{ color: 'var(--muted)' }}>{fmt(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user}>
              <td className="text-xs pr-2 whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>
                {row.user}
                <span className="ml-1 text-[9px]" style={{ color: 'var(--muted)' }}>{row.role}</span>
              </td>
              {row.cells.map((score, i) => (
                <td key={i}
                    title={score == null ? 'no activity' : `${row.user} · ${fmt(dates[i])} · risk ${score}`}
                    className="h-7 min-w-9 rounded text-center text-[10px] font-semibold num"
                    style={{
                      background: cellColor(score),
                      border: score == null ? '1px dashed var(--grid)' : '1px solid transparent',
                      color: score >= 40 ? 'var(--ink)' : 'transparent',
                    }}>
                  {score != null ? Math.round(score) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>
        low
        {RAMP.map((c) => <span key={c} className="inline-block w-4 h-2 rounded-sm" style={{ background: c }} />)}
        high
      </div>
    </div>
  )
}
