// PAM access review: privileged accounts with standing risk flags.
const FLAG_COLOR = {
  DORMANT: 'var(--critical)', EXPIRED: 'var(--serious)', VENDOR: 'var(--warning)',
}
const RISK_COLOR = { HIGH: 'var(--critical)', REVIEW: 'var(--warning)', OK: 'var(--good)' }

export default function AccessReview({ rows }) {
  if (!rows?.length) return null
  const fmt = (d) => (d ? new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: 'var(--muted)' }} className="text-left">
            <th className="pb-1 font-medium">Account</th>
            <th className="pb-1 font-medium">Role</th>
            <th className="pb-1 font-medium">Access expires</th>
            <th className="pb-1 font-medium">Flags</th>
            <th className="pb-1 font-medium text-right">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.username} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5">
                <span className="num" style={{ color: 'var(--ink)' }}>{r.username}</span>
              </td>
              <td style={{ color: 'var(--ink-2)' }}>{r.role}</td>
              <td className="num" style={{ color: r.expired ? 'var(--serious)' : 'var(--muted)' }}>
                {fmt(r.access_expires_at)}
              </td>
              <td>
                <span className="flex flex-wrap gap-1">
                  {r.flags.length === 0 && <span style={{ color: 'var(--muted)' }}>—</span>}
                  {r.flags.map((f) => (
                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: `${FLAG_COLOR[f]}22`, color: FLAG_COLOR[f] }}>{f}</span>
                  ))}
                </span>
              </td>
              <td className="text-right font-semibold" style={{ color: RISK_COLOR[r.risk] }}>{r.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
