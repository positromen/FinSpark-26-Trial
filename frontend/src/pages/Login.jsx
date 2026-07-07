import { useState } from 'react'
import { login } from '../api.js'
import { C, TYPE } from '../ui.js'
import Sidebar from '../components/Sidebar.jsx'

const DEMO = [
  { id: 'soc_admin', desc: 'SOC analyst — the console', color: '#1d4ed8' },
  { id: 'rmehta', desc: 'DBA — normal staff', color: '#0e7a0e' },
  { id: 'ext_dsouza', desc: 'dormant vendor — the attacker', color: '#c02626', pill: 'MALICIOUS', t: TYPE.malicious },
  { id: 'ext_rao', desc: 'active vendor, access expired', color: '#a16207', pill: 'NEGLIGENT', t: TYPE.negligent },
]
const PW = 'prahari123'

export default function Login({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState(PW)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setErr(false)
    try { onLogin(await login(u.trim(), p)) }
    catch { setErr(true) }
    finally { setBusy(false) }
  }

  return (
    <div className="app">
      <Sidebar kicker="Insider-Threat Detection" groups={[]} />
      <div className="content">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ width: 420, maxWidth: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 26 }}>
              <div style={{ width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(180deg,#1d4370,#14304f)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(20,48,79,.25)' }}>
                <div style={{ width: 22, height: 22, background: '#fff', transform: 'rotate(45deg)', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: 5, color: C.navy }}>PRAHARI</div>
              <div style={{ fontSize: 12.5, color: C.muted, letterSpacing: .5 }}>Privileged-Access Insider-Threat Detection</div>
            </div>

            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 26 }}>
              <label className="field">Username
                <input className="input mono" value={u} autoComplete="off"
                       onChange={(e) => setU(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && submit()} />
              </label>
              <label className="field">Password
                <input className="input" type="password" value={p}
                       onChange={(e) => setP(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && submit()} />
              </label>
              <button className="btn btn-navy" style={{ marginTop: 4 }} disabled={busy} onClick={submit}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {err && <div style={{ fontSize: 12, color: C.critical, fontWeight: 600 }}>▲ Unknown user or password — pick a demo account below.</div>}
            </div>

            <div className="card" style={{ marginTop: 14, padding: '14px 16px' }}>
              <div className="label" style={{ marginBottom: 8 }}>DEMO ACCOUNTS · CLICK TO FILL · PW {PW}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {DEMO.map((d) => (
                  <button key={d.id} onClick={() => { setU(d.id); setP(PW); setErr(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent',
                                   border: '1px solid transparent', borderRadius: 7, padding: 8, cursor: 'pointer',
                                   textAlign: 'left', color: C.ink }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f2f5f9'; e.currentTarget.style.borderColor = C.border }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                    <span className="mono" style={{ fontSize: 13, minWidth: 96, fontWeight: 600, color: d.color }}>{d.id}</span>
                    <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{d.desc}</span>
                    {d.pill && <span className="pill" style={{ background: d.t.bg, color: d.t.fg }}>{d.pill}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
