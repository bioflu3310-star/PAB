import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Smart layout helpers (shared with PrintView) ──────────────────────────────
const SHORT_KEYWORDS = ['title','prefix','gender','sex','date','birth','age','civil','status',
  'nationality','region','province','city','zip','postal','contact','mobile','cellular','phone',
  'fax','number','no.','no ','tin','sss','gsis','id','code','year','month','day','time',
  'rate','salary','amount','score','rating','level','type']
const LONG_KEYWORDS = ['address','description','remarks','comment','notes','detail','experience',
  'background','qualification','education','training','accomplishment','achievement','publication',
  'summary','objective','reason','explain','specify','others','other','name','full name',
  'first name','middle name','last name','surname','given']

function getFieldSize(label) {
  const k = (label || '').toLowerCase()
  if (LONG_KEYWORDS.some(w => k.includes(w))) return 'full'
  if (SHORT_KEYWORDS.some(w => k.includes(w))) return 'short'
  return 'auto'
}

// Groups fields into rows of up to 3 short fields, or 1 full-width field
function groupFields(fields) {
  const rows = []
  let i = 0
  while (i < fields.length) {
    const f = fields[i]
    const size = getFieldSize(f.label)
    const isLong = size === 'full' || ['textarea', 'checkbox', 'radio'].includes(f.type)
    if (isLong) {
      rows.push([f])
      i++
    } else {
      const group = []
      let j = i
      while (j < fields.length && group.length < 3) {
        const fj = fields[j]
        const sj = getFieldSize(fj.label)
        const isLongJ = sj === 'full' || ['textarea', 'checkbox', 'radio'].includes(fj.type)
        if (isLongJ) break
        group.push(fj)
        j++
      }
      if (group.length === 0) { rows.push([f]); i++ }
      else { rows.push(group); i = j }
    }
  }
  return rows
}

export default function AssessorForm() {
  const { formId } = useParams()
  const [screen, setScreen] = useState('gate')
  const [form, setForm] = useState(null)
  const [assessor, setAssessor] = useState(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})
  const [otherVals, setOtherVals] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('pab_theme') || 'dark')

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  useEffect(() => {
    async function load() {
      if (!formId) { setScreen('error'); return }
      const { data, error } = await supabase.from('custom_forms')
        .select('*').eq('id', formId).eq('status', 'published').single()
      if (error || !data) { setScreen('error'); return }
      setForm(data)
    }
    load()
  }, [formId])

  async function verifyEmail() {
    setError('')
    const e = email.trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Enter a valid email.'); return }
    const { data: asr } = await supabase.from('assessors').select('*').eq('email', e).eq('is_active', true).single()
    if (!asr) { setError('Not registered. Contact your admin.'); return }
    const { data: existing } = await supabase.from('form_submissions').select('id').eq('form_id', formId).eq('assessor_id', asr.id).single()
    if (existing) { setScreen('done'); return }
    setAssessor(asr)
    setScreen('form')
  }

  function setAnswer(key, val) { setAnswers(prev => ({ ...prev, [key]: val })) }
  function setOther(key, val) { setOtherVals(prev => ({ ...prev, [key]: val })) }

  async function submit() {
    const finalAnswers = {}
    ;(form.fields || []).forEach((f, i) => {
      if (f.type === 'section') return
      const key = f.label || 'Field ' + (i + 1)
      let val = answers[key] || ''
      if (val === '__other__' && otherVals[key]) val = 'Other: ' + otherVals[key]
      if (Array.isArray(val)) {
        val = val.map(v => v === '__other__' && otherVals[key] ? 'Other: ' + otherVals[key] : v)
          .filter(v => v !== '__other__').join(', ')
      }
      finalAnswers[key] = val
    })
    setSubmitting(true)
    try {
      const { error } = await supabase.from('form_submissions').insert({
        form_id: Number(form.id), form_title: form.title,
        assessor_id: assessor.id, assessor_name: assessor.full_name, assessor_email: assessor.email,
        answers: finalAnswers, is_read: false, submitted_at: new Date().toISOString(),
      })
      if (error) throw error
      try { await supabase.from('audit_logs').insert({ action: 'FORM_SUBMITTED', details: `Assessor "${assessor.full_name}" submitted "${form.title}"`, ip_address: 'client' }) } catch (e) {}
      setScreen('thanks')
    } catch (e) { alert('Failed: ' + e.message) }
    setSubmitting(false)
  }

  function renderFieldInput(f) {
    const key = f.label || 'Field ' + (f.idx + 1)
    const req = f.required ? <span style={{ color: 'var(--danger)' }}> *</span> : null
    return (
      <div key={f.idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)' }}>{key}{req}</label>
        {['text', 'email', 'number', 'date', 'time'].includes(f.type) && (
          <input className="input" type={f.type} value={answers[key] || ''}
            onChange={e => setAnswer(key, e.target.value)} placeholder={f.placeholder} />
        )}
        {f.type === 'textarea' && (
          <textarea className="input" value={answers[key] || ''}
            onChange={e => setAnswer(key, e.target.value)} placeholder={f.placeholder}
            style={{ minHeight: 80 }} />
        )}
        {f.type === 'dropdown' && (
          <>
            <select className="input" value={answers[key] || ''} onChange={e => setAnswer(key, e.target.value)}>
              <option value="">Select…</option>
              {(f.options || []).map(o => <option key={o}>{o}</option>)}
              <option value="__other__">Other…</option>
            </select>
            {answers[key] === '__other__' && (
              <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…"
                value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />
            )}
          </>
        )}
        {f.type === 'radio' && (
          <>
            <div className="ff-radio-row">
              {(f.options || []).map(o => (
                <label key={o} className="ff-radio-pill">
                  <input type="radio" name={`r-${f.idx}`} value={o} checked={answers[key] === o} onChange={() => setAnswer(key, o)} />
                  <span>{o}</span>
                </label>
              ))}
              <label className="ff-radio-pill">
                <input type="radio" name={`r-${f.idx}`} value="__other__" checked={answers[key] === '__other__'} onChange={() => setAnswer(key, '__other__')} />
                <span>Other</span>
              </label>
            </div>
            {answers[key] === '__other__' && (
              <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…"
                value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />
            )}
          </>
        )}
        {f.type === 'checkbox' && (
          <>
            <div className="cb-grid">
              {(f.options || []).map(o => (
                <label key={o} className="cb-item">
                  <input type="checkbox" checked={(answers[key] || []).includes(o)}
                    onChange={e => { const v = answers[key] || []; setAnswer(key, e.target.checked ? [...v, o] : v.filter(x => x !== o)) }} />
                  <span>{o}</span>
                </label>
              ))}
              <label className="cb-item">
                <input type="checkbox" checked={(answers[key] || []).includes('__other__')}
                  onChange={e => { const v = answers[key] || []; setAnswer(key, e.target.checked ? [...v, '__other__'] : v.filter(x => x !== '__other__')) }} />
                <span>Other</span>
              </label>
            </div>
            {(answers[key] || []).includes('__other__') && (
              <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…"
                value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />
            )}
          </>
        )}
      </div>
    )
  }

  function renderForm() {
    const sections = []
    let current = { title: '', fields: [] }
    ;(form.fields || []).forEach((f, i) => {
      if (f.type === 'section') {
        if (current.fields.length || current.title) sections.push({ ...current })
        current = { title: f.label, fields: [] }
      } else {
        current.fields.push({ ...f, idx: i })
      }
    })
    if (current.fields.length || current.title) sections.push(current)

    return sections.map((sec, si) => {
      const rows = groupFields(sec.fields)
      return (
        <div key={si} className="ff-section">
          {sec.title && (
            <div className="ff-section-head">
              <div style={{ fontWeight: 700, fontSize: 13 }}>{sec.title}</div>
            </div>
          )}
          <div className="ff-section-body">
            {rows.map((row, ri) => (
              <div key={ri} style={{
                display: 'grid',
                gridTemplateColumns: row.length === 1 ? '1fr' : `repeat(${row.length}, 1fr)`,
                gap: 14,
                marginBottom: 14
              }}>
                {row.map(f => renderFieldInput(f))}
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 36px', maxWidth: 480, margin: '60px auto 0', textAlign: 'center', boxShadow: 'var(--shadow)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏛</div>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700 }}>PAB Information System</span>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); localStorage.setItem('pab_theme', t) }}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
        {/* Gate */}
        {screen === 'gate' && (
          <div style={{ ...cardStyle, textAlign: 'left', maxWidth: 420 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 6 }}>Access Form</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Enter your registered email to access this form.</p>
            {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 16 }}>{error}</div>}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Email *</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="yourname@email.com" onKeyDown={e => e.key === 'Enter' && verifyEmail()} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={verifyEmail}>Continue →</button>
          </div>
        )}

        {/* Form */}
        {screen === 'form' && form && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700 }}>{form.title}</h1>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{form.description}</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 10 }}>
                📧 {assessor.email}
              </div>
            </div>
            {renderForm()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setAnswers({}); setOtherVals({}) }}>↺ Reset</button>
              <button className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit Form →'}</button>
            </div>
          </>
        )}

        {/* Thank you */}
        {screen === 'thanks' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, marginBottom: 12 }}>Thank You!</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
              Your response has been submitted, <strong style={{ color: 'var(--accent)' }}>{assessor?.full_name}</strong>.
              <br /><br />The PAB team will review your submission.
            </p>
          </div>
        )}

        {/* Already submitted */}
        {screen === 'done' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>📬</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22 }}>Already Submitted</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 12 }}>You have already submitted this form.</p>
          </div>
        )}

        {/* Error */}
        {screen === 'error' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Not Available</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>This form doesn't exist or isn't published.</p>
          </div>
        )}
      </div>
    </div>
  )
}