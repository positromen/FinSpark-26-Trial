import { riskBand } from '../api.js'

const SEV_ICON = { CRITICAL: '⛔', WARNING: '⚠', INFO: 'ℹ' }
const SEV_COLOR = { CRITICAL: 'var(--critical)', WARNING: 'var(--warning)', INFO: 'var(--good)' }

export default function AlertsFeed({ alerts, flashId }) {
  if (!alerts.length) {
    return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>
      No alerts — all privileged activity within normal behaviour.
    </div>
  }
  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {alerts.map((a) => (
        <li key={a.id ?? a.created_at} className="rounded-lg p-2.5 text-xs"
            style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${SEV_COLOR[a.severity] ?? 'var(--muted)'}`,
                     animation: a.session_id === flashId ? 'flash 1s ease' : 'none' }}>
          <div className="flex items-center gap-2">
            <span>{SEV_ICON[a.severity] ?? ''}</span>
            <span className="font-semibold" style={{ color: SEV_COLOR[a.severity] }}>
              {a.severity}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: 'var(--grid)', color: 'var(--ink-2)' }}>
              {a.action_taken}
            </span>
            <span className="ml-auto num" style={{ color: 'var(--muted)' }}>
              {new Date(a.created_at).toLocaleTimeString()}
            </span>
          </div>
          <p className="mt-1 leading-snug" style={{ color: 'var(--ink-2)' }}>{a.message}</p>
        </li>
      ))}
    </ul>
  )
}
