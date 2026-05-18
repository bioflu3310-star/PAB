import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function FormFill() {
  const { id } = useParams()
  const { admin, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [answers, setAnswers] = useState({})
  const [otherVals, setOtherVals] = useState({})

  useEffect(() => {
    supabase.from('custom_forms').select('*').eq('id', id).single()
      .then(({ data }) => { if (data) setForm(data) })
  }, [id])

  if (!form) return <div style={{ padding: 40, color: 'var(--text3)' }}>Loading…</div>

  function setAnswer(key, val) { setAnswers(prev => ({ ...prev, [key]: val })) }
  function setOther(key, val) { setOtherVals(prev => ({ ...prev, [key]: val })) }

  async function submit() {
    const finalAnswers = {}
    ;(form.fields || []).forEach((f, i) => {
      if (f.type === 'section') return
      const key = f.label || 'Field ' + (i + 1)
      let val = answers[key] || ''
      // Handle "Other" for radio/dropdown
      if (val === '__other__' && otherVals[key]) val = 'Other: ' + otherVals[key]
      // Handle checkbox arrays
      if (Array.isArray(val)) {
        val = val.map(v => v === '__other__' && otherVals[key] ? 'Other: ' + otherVals[key] : v)
          .filter(v => v !== '__other__').join(', ')
      }
      finalAnswers[key] = val
    })
    try {
      const { error } = await supabase.from('form_submissions').insert({
        form_id: Number(form.id), form_title: form.title,
        assessor_name: admin?.full_name || 'Admin', assessor_email: user?.email || '',
        answers: finalAnswers, is_read: false, submitted_at: new Date().toISOString(),
      })
      if (error) throw error
      await auditLog('FORM_SUBMITTED', `Admin "${admin?.full_name}" submitted "${form.title}"`)
      toast('✅', 'Submitted!', 'Saved to dashboard.')
      setAnswers({}); setOtherVals({})
    } catch (e) { toast('❌', 'Failed', e.message) }
  }

  // Render fields
  let inSection = false
  const sections = []
  let currentSection = { title: '', fields: [] }

  ;(form.fields || []).forEach((f, i) => {
    if (f.type === 'section') {
      if (currentSection.fields.length || currentSection.title) sections.push({ ...currentSection })
      currentSection = { title: f.label, fields: [] }
    } else {
      currentSection.fields.push({ ...f, idx: i })
    }
  })
  if (currentSection.fields.length || currentSection.title) sections.push(currentSection)

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Filling Form</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{form.title}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/forms')}>← Back</button>
      </div>

      {sections.map((sec, si) => (
        <div key={si} className="ff-section">
          {sec.title && <div className="ff-section-head"><div style={{ fontWeight: 700, fontSize: 13 }}>{sec.title}</div></div>}
          <div className="ff-section-body">
            {sec.fields.map(f => {
              const key = f.label || 'Field ' + (f.idx + 1)
              const req = f.required ? <span style={{ color: 'var(--danger)' }}> *</span> : null
              return (
                <div key={f.idx} className="ff-field">
                  <label>{key}{req}</label>
                  {['text', 'email', 'number', 'date', 'time'].includes(f.type) && (
                    <input className="input" type={f.type} value={answers[key] || ''} onChange={e => setAnswer(key, e.target.value)} placeholder={f.placeholder || ''} />
                  )}
                  {f.type === 'textarea' && (
                    <textarea className="input" value={answers[key] || ''} onChange={e => setAnswer(key, e.target.value)} placeholder={f.placeholder || ''} />
                  )}
                  {f.type === 'dropdown' && (
                    <>
                      <select className="input" value={answers[key] || ''} onChange={e => setAnswer(key, e.target.value)}>
                        <option value="">Select…</option>
                        {(f.options || []).map(o => <option key={o}>{o}</option>)}
                        <option value="__other__">Other…</option>
                      </select>
                      {answers[key] === '__other__' && <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…" value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />}
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
                      {answers[key] === '__other__' && <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…" value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />}
                    </>
                  )}
                  {f.type === 'checkbox' && (
                    <>
                      <div className="cb-grid">
                        {(f.options || []).map(o => {
                          const vals = answers[key] || []
                          return (
                            <label key={o} className="cb-item">
                              <input type="checkbox" checked={vals.includes(o)}
                                onChange={e => {
                                  const next = e.target.checked ? [...vals, o] : vals.filter(v => v !== o)
                                  setAnswer(key, next)
                                }} />
                              <span>{o}</span>
                            </label>
                          )
                        })}
                        <label className="cb-item">
                          <input type="checkbox" checked={(answers[key] || []).includes('__other__')}
                            onChange={e => {
                              const vals = answers[key] || []
                              setAnswer(key, e.target.checked ? [...vals, '__other__'] : vals.filter(v => v !== '__other__'))
                            }} />
                          <span>Other</span>
                        </label>
                      </div>
                      {(answers[key] || []).includes('__other__') && <input className="input" style={{ marginTop: 6 }} placeholder="Please specify…" value={otherVals[key] || ''} onChange={e => setOther(key, e.target.value)} />}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 28 }}>
        <button className="btn btn-ghost" onClick={() => { setAnswers({}); setOtherVals({}) }}>↺ Reset</button>
        <button className="btn btn-primary" onClick={submit}>Submit →</button>
      </div>
    </div>
  )
}
