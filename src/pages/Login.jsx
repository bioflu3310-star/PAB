import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { auditLog } from '../lib/supabase'

export default function Login() {
  const { signIn, theme, toggleTheme } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      const admin = await signIn(email.trim().toLowerCase(), password)
      await auditLog('LOGIN', `${admin.full_name} logged in`)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 36px', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🏛</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>
          PAB Information System
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
          Sign in with your admin credentials.
        </p>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 16, border: '1px solid rgba(247,111,111,.3)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@pab.gov.ph" autoComplete="email" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: 11 }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  )
}
