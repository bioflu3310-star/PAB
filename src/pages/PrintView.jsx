import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

export default function PrintView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [sub, setSub] = useState(null)
  const [form, setForm] = useState(null)
  const [showDirector, setShowDirector] = useState(false)
  const [dirData, setDirData] = useState({
    qualifiedBy: '', qualifiedDate: '', evaluationRemarks: '', recommendation: ''
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('form_submissions').select('*').eq('id', id).single()
      if (data) {
        setSub(data)
        if (data.director_signoff) setDirData(data.director_signoff)
        if (!data.is_read) await supabase.from('form_submissions').update({ is_read: true }).eq('id', data.id)
        if (data.form_id) {
          const { data: f } = await supabase.from('custom_forms').select('*').eq('id', data.form_id).single()
          if (f) setForm(f)
        }
      }
    }
    load()
  }, [id])

  if (!sub) return <div style={{ padding: 40, color: 'var(--text3)', textAlign: 'center' }}>Loading…</div>

  const answers = sub.answers || {}
  const ref = 'SUB-' + String(sub.id).padStart(4, '0')

  // Order keys by original form field order
  let orderedKeys = []
  if (form?.fields?.length) {
    form.fields.forEach(f => {
      if (f.type !== 'section' && f.label && f.label in answers) orderedKeys.push(f.label)
    })
    Object.keys(answers).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k) })
  } else {
    orderedKeys = Object.keys(answers)
  }

  async function saveDirector() {
    try {
      const { error } = await supabase.from('form_submissions').update({ director_signoff: dirData }).eq('id', sub.id)
      if (error) throw error
      toast('✅', 'Saved!', 'Director sign-off recorded.')
      await auditLog('DIRECTOR_SIGNOFF', ref)
    } catch (e) { toast('❌', 'Failed', e.message) }
  }

  // Field style — label on top, answer box below, full width
  function AnswerField({ label, value }) {
    const isEmpty = !value || value.trim() === '' || value === 'N/A'
    return (
      <div style={{ marginBottom: 18 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 6,
        }}>
          {label}
        </label>
        <div style={{
          width: '100%',
          padding: '10px 14px',
          background: 'var(--input-bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: isEmpty ? 400 : 500,
          color: isEmpty ? 'var(--text3)' : 'var(--text)',
          fontStyle: isEmpty ? 'italic' : 'normal',
          minHeight: 42,
          lineHeight: 1.6,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}>
          {isEmpty ? 'N/A' : value}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 18, flexWrap: 'wrap', gap: 10, boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Reference</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{ref}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {sub.assessor_name} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-PH') : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <button className="btn btn-warning btn-sm" onClick={() => setShowDirector(!showDirector)}>
            🏛 {showDirector ? 'Hide' : 'Show'} Sign-Off
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Document */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)'
      }}>

        {/* Banner */}
        <div style={{ background: 'var(--accent)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {sub.form_title || 'Submission'}
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 3 }}>
              {sub.assessor_name} · {sub.assessor_email}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,.85)', fontSize: 12 }}>
            <div>Reference</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2 }}>{ref}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </div>
          </div>
        </div>

        {/* Answers — full width stacked like the form */}
        <div style={{ padding: '28px 32px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: 'var(--accent)',
            paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 24
          }}>Answers</div>

          {orderedKeys.map(k => (
            <AnswerField key={k} label={k} value={answers[k]} />
          ))}
        </div>

        {/* Director Sign-Off */}
        {showDirector && (
          <div style={{ borderTop: '2px solid var(--warning)', background: 'rgba(245,166,35,.04)' }}>
            <div style={{
              padding: '12px 32px', borderBottom: '1px solid rgba(245,166,35,.25)',
              background: 'rgba(245,166,35,.08)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🏛</span>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700 }}>Director Sign-Off</div>
              </div>
              <button className="btn btn-primary btn-sm no-print" onClick={saveDirector}>💾 Save</button>
            </div>
            <div style={{ padding: '20px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Qualified By</label>
                  <input className="input" value={dirData.qualifiedBy}
                    onChange={e => setDirData(p => ({ ...p, qualifiedBy: e.target.value }))}
                    placeholder="e.g. Mr. Roderick Dela Cruz" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Date</label>
                  <input className="input" type="date" value={dirData.qualifiedDate}
                    onChange={e => setDirData(p => ({ ...p, qualifiedDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Evaluation Remarks</label>
                <textarea className="input" value={dirData.evaluationRemarks}
                  onChange={e => setDirData(p => ({ ...p, evaluationRemarks: e.target.value }))}
                  placeholder="Evaluation remarks…" style={{ minHeight: 90 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Recommendation</label>
                <textarea className="input" value={dirData.recommendation}
                  onChange={e => setDirData(p => ({ ...p, recommendation: e.target.value }))}
                  placeholder="Recommendation…" style={{ minHeight: 90 }} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '18px 32px', borderTop: '1px solid var(--border)',
          background: 'var(--section-bg)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>PAB Information System</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ref: {ref} · {new Date().toLocaleString('en-PH')}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Philippine Accreditation Bureau · DTI</div>
        </div>
      </div>
    </div>
  )
}