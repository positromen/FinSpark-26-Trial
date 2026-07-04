const ACTION_STYLE = {
  LOGIN: 'var(--accent)',
  LOGOUT: 'var(--muted)',
  DB_QUERY: 'var(--ink-2)',
  FILE_ACCESS: 'var(--ink-2)',
  CONFIG_CHANGE: 'var(--warning)',
  PRIV_CHANGE: 'var(--serious)',
  DB_EXPORT: 'var(--critical)',
}

// Who did what, when — events of the selected session.
export default function Timeline({ events, sessionLabel }) {
  if (!events.length) {
    return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>
      Select a session on the trend chart area or trigger the attack.
    </div>
  }
  return (
    <div>
      <div className="text-xs mb-2" style={{ color: 'var(--ink-2)' }}>{sessionLabel}</div>
      <ol className="relative ml-2 space-y-2.5 border-l" style={{ borderColor: 'var(--baseline)' }}>
        {events.map((e, i) => (
          <li key={i} className="ml-3 text-xs">
            <span className="absolute -left-[5px] mt-1 w-2 h-2 rounded-full"
                  style={{ background: ACTION_STYLE[e.action] ?? 'var(--muted)' }} />
            <span className="num" style={{ color: 'var(--muted)' }}>
              {new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>{' '}
            <span className="font-semibold" style={{ color: ACTION_STYLE[e.action] ?? 'var(--ink-2)' }}>
              {e.action}
            </span>{' '}
            <span style={{ color: 'var(--ink-2)' }}>{e.resource}</span>
            {e.records > 0 && (
              <span className="num" style={{ color: e.records >= 1000 ? 'var(--critical)' : 'var(--muted)' }}>
                {' '}· {e.records.toLocaleString()} records
              </span>
            )}
            <span style={{ color: 'var(--muted)' }}> · {e.ip}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
