import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, auditLog } from '../lib/supabase'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

function getLock() {
  try { return JSON.parse(localStorage.getItem('pab_login_attempts') || '{"count":0,"time":0}') } catch { return { count: 0, time: 0 } }
}
function saveLock(d) { localStorage.setItem('pab_login_attempts', JSON.stringify(d)) }
function clearLock() { saveLock({ count: 0, time: 0 }) }

export default function Login() {
  const { signIn, theme, toggleTheme } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockRemaining, setLockRemaining] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const honeypot = useRef('')
  const timerRef = useRef(null)

  // Check lockout every second
  useEffect(() => {
    function tick() {
      const d = getLock()
      if (d.count >= MAX_ATTEMPTS) {
        const remaining = LOCKOUT_MS - (Date.now() - d.time)
        if (remaining > 0) { setLockRemaining(Math.ceil(remaining / 1000)); setAttempts(d.count) }
        else { clearLock(); setLockRemaining(0); setAttempts(0); setError('') }
      } else { setAttempts(d.count); setLockRemaining(0) }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Check kill switch on mount
  useEffect(() => {
    async function checkKill() {
      try {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'kill_switch').single()
        if (data?.value === 'true') { setError('🔒 System is under maintenance. Contact your administrator.') }
      } catch (e) {}
    }
    checkKill()
  }, [])

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  function isMalicious(s) {
    return [/<script/i, /javascript:/i, /union\s+select/i, /drop\s+table/i].some(p => p.test(s))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setWarn(''); setOk('')

    // Honeypot bot check
    if (honeypot.current) { setError('🤖 Bot detected.'); return }

    // Lockout check
    const d = getLock()
    if (d.count >= MAX_ATTEMPTS) {
      const remaining = LOCKOUT_MS - (Date.now() - d.time)
      if (remaining > 0) { setError(`🔒 Too many failed attempts. Try again in ${formatTime(Math.ceil(remaining / 1000))}.`); return }
      else clearLock()
    }

    if (!email || !password) { setError('Please fill in all fields.'); return }
    if (isMalicious(email)) { setError('⚠️ Invalid input detected.'); return }

    setLoading(true)
    try {
      const admin = await signIn(email.trim().toLowerCase(), password)
      clearLock()
      await auditLog('LOGIN', `${admin.full_name} logged in`)
      setOk(`✅ Welcome back, ${admin.full_name}! Redirecting…`)
      setTimeout(() => navigate('/', { replace: true }), 1000)
    } catch (err) {
      const current = getLock()
      const newCount = (current.count || 0) + 1
      saveLock({ count: newCount, time: Date.now() })
      setAttempts(newCount)
      if (newCount >= MAX_ATTEMPTS) {
        setError(`🔒 Too many failed attempts. Locked for 15 minutes.`)
        setLockRemaining(LOCKOUT_MS / 1000)
      } else {
        const left = MAX_ATTEMPTS - newCount
        setError(`❌ Invalid email or password.`)
        if (left <= 2) setWarn(`⚠️ ${left} attempt${left !== 1 ? 's' : ''} remaining before lockout.`)
      }
    }
    setLoading(false)
  }

  async function handleReset() {
    setError(''); setWarn(''); setOk('')
    if (!email.trim()) { setError('Enter your email address first.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/'
    })
    if (error) { setError('❌ ' + error.message); return }
    setOk('✅ Password reset email sent! Check your inbox.')
  }

  const isLocked = lockRemaining > 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      {/* Theme toggle */}
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '36px 32px', boxShadow: 'var(--shadow)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏛</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>PAB Information System</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 2 }}>DTI · Accreditation Bureau</div>
            </div>
          </div>

          {/* Admin note */}
          <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
            🔐 Admin access only. Assessors use the form link provided to them by the admin.
          </div>

          {/* Alerts */}
          {isLocked && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 16, border: '1px solid rgba(247,111,111,.3)', textAlign: 'center' }}>
              🔒 Account locked. Try again in <strong>{formatTime(lockRemaining)}</strong>
            </div>
          )}
          {ok && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success)', fontSize: 12, marginBottom: 16, border: '1px solid rgba(62,207,142,.3)' }}>{ok}</div>}
          {error && !isLocked && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 16, border: '1px solid rgba(247,111,111,.3)' }}>{error}</div>}
          {warn && !isLocked && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,166,35,.1)', color: 'var(--warning)', fontSize: 12, marginBottom: 16, border: '1px solid rgba(245,166,35,.3)' }}>{warn}</div>}

          {/* Honeypot */}
          <input type="text" style={{ position: 'absolute', left: -9999, opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1} autoComplete="off" onChange={e => honeypot.current = e.target.value} />

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Email Address *</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@pab.gov.ph" autoComplete="email" disabled={isLocked} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                  autoComplete="current-password" disabled={isLocked} style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: 4 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading || isLocked}
              style={{ width: '100%', justifyContent: 'center', padding: 11, opacity: isLocked ? 0.6 : 1 }}>
              {isLocked ? `🔒 Locked (${formatTime(lockRemaining)})` : loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
            Forgot your password?{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={handleReset}>Reset it</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 20, lineHeight: 1.6 }}>
          PAB Technical Assessors & Experts Information System<br />
          Philippine Accreditation Bureau · DTI · ver.2<br />
          <span style={{ color: 'var(--danger)' }}>🔒 Secured with end-to-end encryption</span>
        </div>
      </div>
    </div>
  )
}