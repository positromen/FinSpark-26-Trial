import { useEffect, useMemo, useState } from 'react'
import { postJSON, decisionBand } from '../api.js'
import RiskGauge from '../components/RiskGauge.jsx'
import Timeline from '../components/Timeline.jsx'

const RECORD_ACTIONS = new Set(['DB_QUERY', 'DB_EXPORT'])

export default function Portal({ user, onLogout }) {
  const [boot, setBoot] = useState(null)
  const [session, setSession] = useState(null)
  const [resource, setResource] = useState('')
  const [records, setRecords] = useState(50)
  const [result, setResult] = useState(null)      // last action outcome
  const [mfaFor, setMfaFor] = useState(null)       // pending action awaiting MFA
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    postJSON('/portal/bootstrap').then((b) => {
      setBoot(b); setSession(b.session)
      setResource((b.my_resources[0]) || b.all_resources[0]?.name || '')
    }).catch(console.error)
  }, [])

  const blocked = session?.status === 'BLOCKED'
  const myResources = boot?.my_resources || []
  const catalog = boot?.catalog || {}

  const grouped = useMemo(() => {
    const all = boot?.all_resources || []
    const mine = all.filter((r) => myResources.includes(r.name))
    const others = all.filter((r) => !myResources.includes(r.name))
    return { mine, others }
  }, [boot, myResources])

  async function run(action, extra = {}) {
    if (blocked) return
    setBusy(true); setMfaError('')
    const recs = RECORD_ACTIONS.has(action) ? Number(records) : (catalog[action]?.default_records ?? 0)
    try {
      const r = await postJSON('/portal/action', { action, resource, records: recs, ...extra })
      setSession(r.session); setResult(r)
      if (r.decision === 'STEP_UP_MFA' && !r.allowed) { setMfaFor({ action, resource, records: recs }); setMfaCode('') }
      else setMfaFor(null)
    } catch (e) { setResult({ decision: 'ERROR', message: e.message, allowed: false, reasons: [] }) }
    finally { setBusy(false) }
  }

  async function submitMfa() {
    const r = await postJSON('/portal/action', { ...mfaFor, mfa_code: mfaCode })
    setSession(r.session); setResult(r)
    if (r.allowed) setMfaFor(null)
    else setMfaError('Incorrect code. (Demo code: 246810)')
  }

  if (!boot) return <div className="min-h-screen grid place-items-center text-sm"
                          style={{ color: 'var(--muted)' }}>Opening secure session…</div>

  const suspicious = boot.user.is_vendor || boot.user.is_dormant
  const band = result ? decisionBand(result.decision) : null

  return (
    <div className="min-h-screen p-4 max-w-[1100px] mx-auto">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold">Privileged Access Portal</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {boot.user.name} · <span className="num">{boot.user.username}</span> · {boot.user.role}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full border"
                style={{ borderColor: suspicious ? 'var(--critical)' : 'var(--border)',
                         color: suspicious ? 'var(--critical)' : 'var(--ink-2)' }}>
            {suspicious ? '⚠ untrusted connection' : '🖥 trusted workstation'} ·
            <span className="num"> {session?.source_ip}</span> · {session?.device}
          </span>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>Sign out</button>
        </div>
      </header>

      {suspicious && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs"
             style={{ background: 'rgba(208,59,59,0.10)', border: '1px solid var(--critical)', color: 'var(--serious)' }}>
          This account is a <b>dormant vendor</b> connecting from an unrecognized device and network.
          Prahari is monitoring every action.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* action console */}
        <section className="panel p-4 lg:col-span-2">
          <h2 className="panel-title mb-3">Action console</h2>

          <label className="panel-title">Target system</label>
          <select value={resource} onChange={(e) => setResource(e.target.value)} disabled={blocked}
                  className="w-full mt-1 mb-3 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--page)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
            <optgroup label="My systems">
              {grouped.mine.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </optgroup>
            <optgroup label="Other systems (outside my role)">
              {grouped.others.map((r) => <option key={r.name} value={r.name}>{r.name} — {r.owner_role}</option>)}
            </optgroup>
          </select>

          <label className="panel-title">Records (for query / export)</label>
          <div className="flex items-center gap-3 mt-1 mb-4">
            <input type="range" min="1" max="5000" step="1" value={records} disabled={blocked}
                   onChange={(e) => setRecords(e.target.value)} className="flex-1" />
            <input type="number" min="0" max="100000" value={records} disabled={blocked}
                   onChange={(e) => setRecords(e.target.value)}
                   className="w-24 px-2 py-1 rounded-md text-sm num text-right outline-none"
                   style={{ background: 'var(--page)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(catalog).map(([action, meta]) => (
              <button key={action} onClick={() => run(action)} disabled={blocked || busy}
                      className="px-2 py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                {meta.label}
              </button>
            ))}
          </div>

          {result && (
            <div className="mt-4 px-3 py-2.5 rounded-lg text-sm flex items-start gap-2"
                 style={{ background: `${band.color}22`, border: `1px solid ${band.color}`, color: band.color }}>
              <span className="text-base">{band.icon}</span>
              <div>
                <div className="font-semibold">{band.label} · risk {result.score ?? '—'}/100</div>
                <div style={{ color: 'var(--ink-2)' }}>{result.message}</div>
              </div>
            </div>
          )}
        </section>

        {/* live risk + timeline */}
        <section className="panel p-4">
          <h2 className="panel-title mb-2">Your session risk</h2>
          <RiskGauge score={session?.score ?? 0} />
          <div className="mt-3">
            <h3 className="panel-title mb-1">Activity</h3>
            <Timeline events={session?.events || []} sessionLabel={`Session #${session?.id} · ${session?.status}`} />
          </div>
        </section>
      </div>

      {/* MFA modal */}
      {mfaFor && (
        <Modal>
          <div className="text-center">
            <div className="text-3xl">🔐</div>
            <h3 className="font-bold mt-1">Step-up verification required</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              This action was flagged as elevated risk. Enter your MFA code to proceed.
            </p>
            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric"
                   placeholder="6-digit code"
                   className="mt-3 w-40 text-center num tracking-widest px-3 py-2 rounded-lg outline-none"
                   style={{ background: 'var(--page)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            {mfaError && <div className="text-xs mt-2" style={{ color: 'var(--critical)' }}>{mfaError}</div>}
            <div className="flex gap-2 mt-4 justify-center">
              <button onClick={() => setMfaFor(null)}
                      className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>Cancel</button>
              <button onClick={submitMfa}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ background: 'var(--warning)', color: '#1a1a19' }}>Verify & proceed</button>
            </div>
          </div>
        </Modal>
      )}

      {/* full-screen block */}
      {blocked && (
        <div className="fixed inset-0 grid place-items-center z-50 p-6"
             style={{ background: 'rgba(10,4,4,0.86)' }}>
          <div className="text-center max-w-md">
            <div className="text-6xl mb-2">⛔</div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--critical)' }}>ACCESS BLOCKED</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-2)' }}>
              Prahari detected malicious privileged activity and terminated this session.
              The security operations centre has been alerted.
            </p>
            <ul className="text-xs mt-3 text-left inline-block space-y-1" style={{ color: 'var(--muted)' }}>
              {(session?.reasons || []).map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
            <div className="mt-5">
              <button onClick={onLogout}
                      className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                      style={{ background: 'var(--critical)', color: '#fff' }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 grid place-items-center z-40 p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="panel p-6 w-full max-w-xs">{children}</div>
    </div>
  )
}
