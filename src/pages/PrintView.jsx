import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

// Keywords that suggest a field has a short answer
const SHORT_FIELD_HINTS = [
  'title', 'name', 'date', 'time', 'gender', 'age', 'year', 'phone', 'contact',
  'number', 'no.', 'region', 'position', 'designation', 'rank', 'level',
  'status', 'type', 'category', 'code', 'id', 'score', 'rating', 'batch',
  'sector', 'field', 'course', 'degree', 'units', 'hours',
]

// Determine if a field's answer is short (to place in compact multi-col grid)
function isShortField(key, value) {
  const keyLower = key.toLowerCase()
  const valueStr = String(value || '')
  // Long answer or textarea-style content → full width
  if (valueStr.length > 80) return false
  if (valueStr.includes('\n')) return false
  // Keyword match on label
  if (SHORT_FIELD_HINTS.some(hint => keyLower.includes(hint))) return true
  // Short value regardless of label
  if (valueStr.length <= 40) return true
  return false
}

function AnswerField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: 'var(--text3)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</label>
      <div style={{
        fontSize: 12.5, padding: '6px 10px',
        background: 'var(--surface2)', borderRadius: 5,
        border: '1px solid var(--border)', minHeight: 30,
        lineHeight: 1.5, wordBreak: 'break-word',
      }}>
        {value || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>N/A</span>}
      </div>
    </div>
  )
}

function AnswersGrid({ orderedKeys, answers, form }) {
  // Group consecutive short fields together, long fields get their own row
  const rows = []
  let shortBuffer = []

  function flushShort() {
    if (!shortBuffer.length) return
    rows.push({ type: 'short-group', items: [...shortBuffer] })
    shortBuffer = []
  }

  orderedKeys.forEach(k => {
    const val = answers[k]
    if (isShortField(k, val)) {
      shortBuffer.push({ key: k, value: val })
    } else {
      flushShort()
      rows.push({ type: 'long', key: k, value: val })
    }
  })
  flushShort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) => {
        if (row.type === 'long') {
          return (
            <AnswerField key={row.key} label={row.key} value={row.value} />
          )
        }
        // Short group: up to 3 per row
        const chunks = []
        for (let j = 0; j < row.items.length; j += 3) {
          chunks.push(row.items.slice(j, j + 3))
        }
        return chunks.map((chunk, ci) => (
          <div key={`${i}-${ci}`} style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${chunk.length}, 1fr)`,
            gap: 10,
          }}>
            {chunk.map(item => (
              <AnswerField key={item.key} label={item.key} value={item.value} />
            ))}
          </div>
        ))
      })}
    </div>
  )
}

export default function PrintView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [sub, setSub] = useState(null)
  const [form, setForm] = useState(null)
  const [showDirector, setShowDirector] = useState(false)
  const [dirData, setDirData] = useState({ qualifiedBy: '', qualifiedDate: '', evaluationRemarks: '', recommendation: '' })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('form_submissions').select('*').eq('id', id).single()
      if (data) {
        setSub(data)
        if (data.director_signoff) setDirData(data.director_signoff)
        if (!data.is_read) {
          await supabase.from('form_submissions').update({ is_read: true }).eq('id', data.id)
        }
        if (data.form_id) {
          const { data: f } = await supabase.from('custom_forms').select('*').eq('id', data.form_id).single()
          if (f) setForm(f)
        }
      }
    }
    load()
  }, [id])

  if (!sub) return <div style={{ padding: 40, color: 'var(--text3)' }}>Loading…</div>

  const answers = sub.answers || {}
  const ref = 'SUB-' + String(sub.id).padStart(4, '0')

  let orderedKeys = []
  if (form?.fields?.length) {
    form.fields.forEach(f => { if (f.type !== 'section' && f.label && f.label in answers) orderedKeys.push(f.label) })
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

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div className="no-print" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Reference</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{ref}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub.assessor_name} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-PH') : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <button className="btn btn-warning btn-sm" onClick={() => setShowDirector(!showDirector)}>
            🏛 {showDirector ? 'Hide' : 'Show'} Sign-Off
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Document */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {/* Banner */}
        <div style={{ background: 'var(--accent)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>{sub.form_title || 'Submission'}</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 3 }}>{sub.assessor_name} · {sub.assessor_email}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,.85)', fontSize: 12 }}>
            <div>Reference</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2 }}>{ref}</div>
          </div>
        </div>

        {/* Answers */}
        <div style={{ padding: '28px 32px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)', paddingBottom: 7, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>Answers</div>
          <AnswersGrid orderedKeys={orderedKeys} answers={answers} form={form} />
        </div>

        {/* Director Sign-Off */}
        {showDirector && (
          <div style={{ borderTop: '2px solid var(--warning)', background: 'rgba(245,166,35,.04)' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(245,166,35,.25)', background: 'rgba(245,166,35,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🏛</span>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700 }}>Director Sign-Off</div>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: 6 }}>QUALIFIED BY</label>
                <input className="input" value={dirData.qualifiedBy} onChange={e => setDirData(p => ({ ...p, qualifiedBy: e.target.value }))} placeholder="e.g. Mr. Roderick Dela Cruz" />
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: 6, marginTop: 14 }}>DATE</label>
                <input className="input" type="date" value={dirData.qualifiedDate} onChange={e => setDirData(p => ({ ...p, qualifiedDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: 6 }}>REMARKS</label>
                <textarea className="input" value={dirData.evaluationRemarks} onChange={e => setDirData(p => ({ ...p, evaluationRemarks: e.target.value }))} placeholder="Evaluation remarks…" />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: 6 }}>RECOMMENDATION</label>
                <textarea className="input" value={dirData.recommendation} onChange={e => setDirData(p => ({ ...p, recommendation: e.target.value }))} placeholder="Recommendation…" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={saveDirector}>💾 Save Sign-Off</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '18px 32px', borderTop: '1px solid var(--border)', background: 'var(--section-bg)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>PAB Information System</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ref: {ref} · {new Date().toLocaleString('en-PH')}</div>
        </div>
      </div>
    </div>
  )
}