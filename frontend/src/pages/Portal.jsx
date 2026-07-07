import { useEffect, useMemo, useState } from 'react'
import { getJSON, postJSON } from '../api.js'
import { C, TYPE, scoreColor, riskLabel, fmt } from '../ui.js'
import Sidebar from '../components/Sidebar.jsx'
import Gauge from '../components/Gauge.jsx'

const ACTIONS = [
  { key: 'DB_QUERY', label: 'Run query', rec: true },
  { key: 'FILE_ACCESS', label: 'Open file' },
  { key: 'CONFIG_CHANGE', label: 'Change config' },
  { key: 'PRIV_CHANGE', label: 'Escalate privilege' },
  { key: 'DB_EXPORT', label: 'Bulk export', rec: true },
]
const TITLES = { dashboard: 'Dashboard', console: 'Action Console', accounts: 'Customer Accounts',
  transactions: 'Transaction Ledger', approvals: 'Approvals', risk: 'My Session Risk', activity: 'Session Activity Log' }
const USER_TYPE = { ext_dsouza: 'malicious', ext_rao: 'negligent' }

// static banking-ops mock content (design flourish — the "real work" staff do while Prahari watches)
const TX = [
  { time: '09:32', desc: 'NEFT outward · vendor payout', acct: 'AC••••7735', amt: '₹ 1,20,000', out: true, status: 'CLEARED', sc: C.good },
  { time: '09:15', desc: 'IMPS inward · salary credit', acct: 'AC••••4821', amt: '₹ 8,500', out: false, status: 'CLEARED', sc: C.good },
  { time: '08:58', desc: 'RTGS outward · settlement', acct: 'AC••••7735', amt: '₹ 5,00,000', out: true, status: 'PENDING', sc: C.seriousInk },
  { time: '08:41', desc: 'UPI collect · merchant', acct: 'AC••••4821', amt: '₹ 2,240', out: false, status: 'CLEARED', sc: C.good },
  { time: '08:22', desc: 'Cheque clearing · inward', acct: 'AC••••3357', amt: '₹ 45,000', out: false, status: 'CLEARED', sc: C.good },
  { time: '08:05', desc: 'Standing instruction · EMI', acct: 'AC••••9042', amt: '₹ 32,100', out: true, status: 'CLEARED', sc: C.good },
]
const ACCTS = [
  { acct: 'AC ••••4821', type: 'Savings', bal: '₹ 2,45,600', branch: 'Fort', status: 'ACTIVE', sc: C.good },
  { acct: 'AC ••••7735', type: 'Current', bal: '₹ 18,90,200', branch: 'BKC', status: 'ACTIVE', sc: C.good },
  { acct: 'AC ••••1188', type: 'Savings', bal: '₹ 76,540', branch: 'Andheri', status: 'DORMANT', sc: C.warnInk },
  { acct: 'AC ••••9042', type: 'Loan', bal: '₹ -4,20,000', branch: 'Fort', status: 'ACTIVE', sc: C.good },
  { acct: 'AC ••••3357', type: 'Current', bal: '₹ 9,12,780', branch: 'Pune', status: 'FROZEN', sc: C.critical },
]
const APPROVALS = [
  { icon: '⚙', ib: 'rgba(57,135,229,.12)', if_: '#1d4ed8', title: 'Config change on core-banking-db · replica lag threshold', maker: 'rmehta', time: '09:48', status: 'AWAITING' },
  { icon: '↥', ib: 'rgba(192,86,33,.12)', if_: C.seriousInk, title: 'Bulk export 2,000 records · report-server', maker: 'ext_rao', time: '19:03', status: 'HELD' },
  { icon: '⚿', ib: 'rgba(14,122,14,.1)', if_: C.good, title: 'Privilege grant · OPS read-only on loans-db', maker: 'nshinde', time: '08:30', status: 'AWAITING' },
]

const T = (s) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export default function Portal({ user, onLogout }) {
  const [boot, setBoot] = useState(null)
  const [section, setSection] = useState('console')
  const [session, setSession] = useState(null)
  const [target, setTarget] = useState('')
  const [records, setRecords] = useState(200)
  const [result, setResult] = useState(null)   // {decision, score, reasons, label, message}
  const [mfaCode, setMfaCode] = useState('')
  const [pending, setPending] = useState(null)  // action awaiting MFA
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    postJSON('/portal/bootstrap').then((b) => {
      setBoot(b); setSession(b.session)
      setTarget(b.my_resources[0] || b.all_resources[0]?.name || '')
    }).catch(console.error)
  }, [])

  // Keep the live gauge / activity / block state fresh without clicking.
  useEffect(() => {
    const t = setInterval(() => {
      getJSON('/portal/session').then((d) => { if (d.session) setSession(d.session) }).catch(() => {})
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const meta = useMemo(() => {
    const u = boot?.user
    const type = u ? USER_TYPE[u.username] : null
    return {
      trusted: u ? !(u.is_vendor || u.is_dormant) : true,
      type: type ? TYPE[type] : null,
      ip: session?.source_ip, device: session?.device, geo: session?.geo,
    }
  }, [boot, session])

  const score = session?.score ?? 0
  const blocked = session?.status === 'BLOCKED'
  const myRes = boot?.my_resources || []
  const otherRes = (boot?.all_resources || []).filter((r) => !myRes.includes(r.name))

  async function run(a) {
    if (blocked) return
    setBusy(true)
    const recs = a.rec ? Number(records) : (boot?.catalog?.[a.key]?.default_records ?? 0)
    try {
      const r = await postJSON('/portal/action', { action: a.key, resource: target, records: recs })
      setSession(r.session)
      if (r.decision === 'STEP_UP_MFA' && !r.allowed) { setPending({ ...a, recs }); setMfaCode('') }
      else setResult({ ...r, label: a.label })
    } catch (e) { setResult({ decision: 'ERROR', message: e.message, reasons: [], label: a.label }) }
    finally { setBusy(false) }
  }

  async function verifyMfa() {
    if (mfaCode.length !== 6) return
    const r = await postJSON('/portal/action', { action: pending.key, resource: target, records: pending.recs, mfa_code: mfaCode })
    setSession(r.session)
    if (r.allowed) { setResult({ ...r, label: pending.label, mfaOk: true }); setPending(null) }
    else setResult({ ...r, label: pending.label })  // still held (wrong code / escalated)
  }

  if (!boot) return <div className="app"><Sidebar kicker="Employee Portal" groups={[]} />
    <div className="content" style={{ display: 'grid', placeItems: 'center', color: C.muted }}>Opening secure session…</div></div>

  const nav = [
    { title: 'WORKSPACE', items: [
      { label: 'Dashboard', icon: '◧', active: section === 'dashboard', onClick: () => setSection('dashboard') },
      { label: 'Action Console', icon: '▤', active: section === 'console', onClick: () => setSection('console') },
    ] },
    { title: 'BANKING OPS', items: [
      { label: 'Customer Accounts', icon: '⊞', active: section === 'accounts', onClick: () => setSection('accounts') },
      { label: 'Transactions', icon: '⇄', active: section === 'transactions', onClick: () => setSection('transactions') },
      { label: 'Approvals', icon: '✓', active: section === 'approvals', onClick: () => setSection('approvals'), badge: '3', badgeBg: C.seriousInk },
    ] },
    { title: 'SECURITY', items: [
      { label: 'Session Risk', icon: '◔', active: section === 'risk', onClick: () => setSection('risk') },
      { label: 'Activity Log', icon: '≣', active: section === 'activity', onClick: () => setSection('activity') },
    ] },
  ]

  return (
    <div className="app">
      <Sidebar kicker="Employee Portal" user={{ name: boot.user.name, role: boot.user.role }} groups={nav} onSignOut={onLogout} />
      <div className="content">
        {/* header */}
        <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '14px 26px',
                      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted2, letterSpacing: .4 }}>Meridian Bank · Privileged Access</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginTop: 2 }}>{TITLES[section]}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {meta.type && <span className="pill" style={{ background: meta.type.bg, color: meta.type.fg, fontSize: 10, letterSpacing: .6, padding: '3px 9px' }}>{meta.type.label}</span>}
            {meta.trusted ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(14,122,14,.07)',
                            border: '1px solid rgba(14,122,14,.3)', borderRadius: 7, padding: '7px 12px',
                            fontSize: 12, color: C.good, fontWeight: 600 }} className="mono">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.goodDot }} />
                ✓ trusted workstation · {meta.ip} · {meta.device}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(192,38,38,.07)',
                            border: '1px solid rgba(192,38,38,.4)', borderRadius: 7, padding: '7px 12px',
                            fontSize: 12, color: C.critical, fontWeight: 600 }} className="mono">
                <span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: C.critical }} />
                ▲ UNTRUSTED · {meta.geo} · {meta.device}
              </div>
            )}
          </div>
        </div>

        <div className="wrap" style={{ padding: '20px 26px', maxWidth: 1240 }}>
          {!meta.trusted && (
            <div style={{ background: 'rgba(192,38,38,.06)', border: '1px solid rgba(192,38,38,.35)',
                          borderRadius: 9, padding: '11px 14px', marginBottom: 16, fontSize: 12.5, color: '#9f1d1d' }}>
              ▲ This session originates from an unrecognized network / device. All actions receive elevated risk scoring and may require additional verification.
            </div>
          )}

          {section === 'dashboard' && <Dashboard score={score} events={session?.events || []} onConsole={() => setSection('console')} />}
          {section === 'console' && (
            <Console {...{ target, setTarget, myRes, otherRes, records, setRecords, run, busy, blocked, result, score }} />
          )}
          {section === 'accounts' && <Accounts />}
          {section === 'transactions' && <Transactions />}
          {section === 'approvals' && <Approvals />}
          {section === 'risk' && <RiskPage score={score} />}
          {section === 'activity' && <Activity events={session?.events || []} />}
        </div>
      </div>

      {pending && (
        <Modal>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(250,178,25,.18)', color: C.warnInk,
                           display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: 'none' }}>!</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.warnInk }}>STEP-UP VERIFICATION REQUIRED</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>Risk {Math.round(score)}/100 — confirm identity to continue</div>
            </div>
          </div>
          <input className="input mono" value={mfaCode} inputMode="numeric" maxLength={6} placeholder="••••••"
                 onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                 style={{ fontSize: 24, letterSpacing: 12, textAlign: 'center' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1, background: C.warn, color: '#3b2f06', padding: 10 }} onClick={verifyMfa}>Verify code</button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
          <div style={{ fontSize: 10.5, color: C.muted3, textAlign: 'center' }}>demo code: 246810</div>
        </Modal>
      )}

      {blocked && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(80,12,12,.96)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ width: 520, maxWidth: '90vw', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            <div className="pulse" style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid #ff9d9d',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#ff9d9d', fontWeight: 700 }}>✕</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color: '#fff' }}>ACCESS BLOCKED</div>
            <div style={{ fontSize: 14, color: '#f3caca' }}>Session terminated · risk {Math.round(score)}/100 · SOC alerted · action sealed in tamper-proof audit log</div>
            <div style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 12,
                          padding: '16px 20px', textAlign: 'left', width: '100%' }}>
              <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#f3caca', marginBottom: 8, fontWeight: 600 }}>BLOCK REASONS</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(session?.reasons || []).map((r, i) => <li key={i} style={{ fontSize: 13, color: '#ffe4e4' }}>{r}</li>)}
              </ul>
            </div>
            <button className="btn" style={{ background: '#fff', color: '#8f1d1d', padding: '11px 22px', fontSize: 13.5 }} onClick={onLogout}>
              Acknowledge · return to sign-in
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Modal({ children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,48,79,.45)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: 360, maxWidth: '90vw', padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="label" style={{ letterSpacing: 1 }}>{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function Dashboard({ score, events, onConsole }) {
  const queries = 42 + events.filter((e) => e.action === 'DB_QUERY' || e.action === 'DB_EXPORT').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <Kpi label="ACCOUNTS MANAGED" value="1,284" sub="across 4 branches" color={C.navy} />
        <Kpi label="PENDING APPROVALS" value="3" sub="awaiting checker" color={C.seriousInk} />
        <Kpi label="QUERIES TODAY" value={String(queries)} sub="this session included" color={C.navy} />
        <Kpi label="SESSION RISK" value={String(Math.round(score))} sub={riskLabel(score)} color={scoreColor(score)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>RECENT TRANSACTIONS</div>
          {TX.slice(0, 4).map((t, i) => (
            <div key={i} className="trow" style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto auto', gap: 12, padding: '9px 0', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11.5, color: C.muted2 }}>{t.time}</span>
              <span style={{ fontSize: 12.5, color: C.ink2 }}>{t.desc}</span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: t.out ? C.critical : C.good, textAlign: 'right' }}>{t.amt}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: t.sc }}>{t.status}</span>
            </div>
          ))}
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="label" style={{ alignSelf: 'flex-start' }}>LIVE SESSION RISK</div>
          <Gauge score={score} size={120} />
          <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor(score) }}>{riskLabel(score)}</div>
          <button className="btn btn-navy" style={{ alignSelf: 'stretch', padding: 9, fontSize: 12 }} onClick={onConsole}>Open Action Console →</button>
        </div>
      </div>
    </div>
  )
}

function Console({ target, setTarget, myRes, otherRes, records, setRecords, run, busy, blocked, result, score }) {
  const res = result
  const band = res && (res.decision === 'ALLOW' ? { fg: C.good, bd: 'rgba(14,122,14,.35)', bg: 'rgba(14,122,14,.06)', icon: '✓', title: res.mfaOk ? 'MFA VERIFIED · ALLOWED' : 'ALLOWED' }
    : res.decision === 'MAKER_CHECKER' ? { fg: C.seriousInk, bd: 'rgba(192,86,33,.4)', bg: 'rgba(192,86,33,.06)', icon: '‖', title: 'MAKER-CHECKER · HELD FOR SECOND APPROVER' }
    : res.decision === 'STEP_UP_MFA' ? { fg: C.warnInk, bd: 'rgba(250,178,25,.4)', bg: 'rgba(250,178,25,.08)', icon: '!', title: 'STEP-UP MFA REQUIRED' }
    : { fg: C.critical, bd: 'rgba(192,38,38,.4)', bg: 'rgba(192,38,38,.06)', icon: '✕', title: res.decision === 'ERROR' ? 'ERROR' : 'BLOCKED' })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
        <div className="label">ACTION CONSOLE</div>
        <label className="field">Target system
          <select className="select mono" value={target} onChange={(e) => setTarget(e.target.value)} disabled={blocked} style={{ fontSize: 13 }}>
            <optgroup label="My systems">{myRes.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
            <optgroup label="Other systems — outside my role">{otherRes.map((r) => <option key={r.name} value={r.name}>{r.name} — {r.owner_role}</option>)}</optgroup>
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: C.ink3 }}>
            <span>Records touched</span>
            <span className="mono" style={{ color: records > 1000 ? C.warnInk : C.muted, fontWeight: 600 }}>{fmt(records)}</span>
          </div>
          <input type="range" min="10" max="10000" step="10" value={records} disabled={blocked} onChange={(e) => setRecords(Number(e.target.value))} />
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.muted3 }}><span>10</span><span>threshold 1,000</span><span>10,000</span></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ACTIONS.map((a) => <button key={a.key} className="btn btn-ghost" disabled={busy || blocked} onClick={() => run(a)}>{a.label}</button>)}
        </div>
        {res && (
          <div style={{ borderRadius: 9, padding: '13px 15px', border: `1px solid ${band.bd}`, background: band.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: band.fg }}>{band.icon} {band.title} · risk {Math.round(res.score ?? score)}/100</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{res.message}</div>
            {res.reasons?.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {res.reasons.map((r, i) => <li key={i} style={{ fontSize: 12, color: C.ink3 }}>{r}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 20 }}>
        <div className="label" style={{ alignSelf: 'flex-start' }}>LIVE SESSION RISK</div>
        <Gauge score={score} size={132} />
        <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>{riskLabel(score)}</div>
      </div>
    </div>
  )
}

function Accounts() {
  return (
    <div className="card card-pad">
      <div className="label" style={{ marginBottom: 12 }}>CUSTOMER ACCOUNTS · MASKED</div>
      <div className="scroll-x"><div style={{ minWidth: 560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr 1fr .8fr auto', gap: 12, padding: '4px 8px', fontSize: 10, letterSpacing: .8, color: C.muted3, fontWeight: 600 }}>
          <span>ACCOUNT</span><span>TYPE</span><span style={{ textAlign: 'right' }}>BALANCE</span><span>BRANCH</span><span>STATUS</span></div>
        {ACCTS.map((a, i) => (
          <div key={i} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr 1fr .8fr auto', gap: 12, padding: '10px 8px', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 12.5, color: C.ink2 }}>{a.acct}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{a.type}</span>
            <span className="mono" style={{ fontSize: 12.5, color: C.ink, textAlign: 'right' }}>{a.bal}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{a.branch}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: a.sc }}>{a.status}</span>
          </div>
        ))}
      </div></div>
    </div>
  )
}

function Transactions() {
  return (
    <div className="card card-pad">
      <div className="label" style={{ marginBottom: 12 }}>TRANSACTION LEDGER · TODAY</div>
      <div className="scroll-x"><div style={{ minWidth: 560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr auto auto', gap: 12, padding: '4px 8px', fontSize: 10, letterSpacing: .8, color: C.muted3, fontWeight: 600 }}>
          <span>TIME</span><span>DESCRIPTION</span><span>ACCOUNT</span><span style={{ textAlign: 'right' }}>AMOUNT</span><span>STATUS</span></div>
        {TX.map((t, i) => (
          <div key={i} className="trow" style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr auto auto', gap: 12, padding: '10px 8px', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11.5, color: C.muted2 }}>{t.time}</span>
            <span style={{ fontSize: 12.5, color: C.ink2 }}>{t.desc}</span>
            <span className="mono" style={{ fontSize: 12, color: C.muted }}>{t.acct}</span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: t.out ? C.critical : C.good, textAlign: 'right' }}>{t.amt}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: t.sc }}>{t.status}</span>
          </div>
        ))}
      </div></div>
    </div>
  )
}

function Approvals() {
  return (
    <div className="card card-pad">
      <div className="label" style={{ marginBottom: 12 }}>MAKER-CHECKER QUEUE · AWAITING SECOND APPROVER</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {APPROVALS.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${C.ring}`, borderRadius: 9, padding: '12px 14px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: a.ib, color: a.if_, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: 'none' }}>{a.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{a.title}</div>
              <div style={{ fontSize: 11.5, color: C.muted2, marginTop: 2 }}>maker {a.maker} · {a.time}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.seriousInk }}>{a.status}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" style={{ background: C.good, color: '#fff', padding: '7px 12px', fontSize: 12 }}>Approve</button>
              <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskPage({ score }) {
  const legend = [['0–39 Allowed', C.good], ['40–59 Step-up MFA', C.warn], ['60–79 Maker-checker', C.serious], ['80–100 Blocked', C.critical]]
  return (
    <div className="card" style={{ padding: 28, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
      <Gauge score={score} size={180} />
      <div style={{ flex: 1, minWidth: 240 }}>
        <div className="label">YOUR SESSION RISK</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: scoreColor(score) }}>{riskLabel(score)}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
          Every action you take is scored live, 0–100, by Prahari's AI + rule engine. Higher scores trigger step-up verification, maker-checker holds, or an immediate block. Keep to your assigned systems and normal record volumes to stay in the green.
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          {legend.map(([t, c]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink3 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EVCOLOR = { LOGIN: C.good, LOGOUT: C.muted, DB_QUERY: C.ink3, FILE_ACCESS: C.ink3, CONFIG_CHANGE: C.warnInk, PRIV_CHANGE: C.seriousInk, DB_EXPORT: C.critical }
function Activity({ events }) {
  return (
    <div className="card card-pad" style={{ padding: 20 }}>
      <div className="label" style={{ marginBottom: 12 }}>SESSION ACTIVITY LOG</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.length === 0 && <div style={{ fontSize: 12, color: C.muted2, padding: '10px 0' }}>No activity yet.</div>}
        {events.map((e, i) => (
          <div key={i} className="trow" style={{ display: 'flex', gap: 12, padding: '9px 0', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 12, color: C.muted2, flex: 'none' }}>{T(e.t)}</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, flex: 'none', minWidth: 104, color: EVCOLOR[e.action] || C.ink3 }}>{e.action}</span>
            <span style={{ fontSize: 12.5, color: C.ink3 }}>{e.resource}{e.records ? ` · ${fmt(e.records)} rec` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
