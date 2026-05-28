import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

// Keywords that suggest a SHORT field (1 column)
const SHORT_KEYWORDS = [
  'title', 'prefix', 'gender', 'sex', 'date', 'birth', 'age', 'civil',
  'status', 'nationality', 'region', 'province', 'city', 'zip', 'postal',
  'contact', 'mobile', 'cellular', 'phone', 'fax', 'number', 'no.', 'no ',
  'tin', 'sss', 'gsis', 'id', 'code', 'year', 'month', 'day', 'time',
  'rate', 'salary', 'amount', 'score', 'rating', 'level', 'type',
]

// Keywords that suggest a LONG field (full width)
const LONG_KEYWORDS = [
  'address', 'description', 'remarks', 'comment', 'notes', 'detail',
  'experience', 'background', 'qualification', 'education', 'training',
  'accomplishment', 'achievement', 'publication', 'summary', 'objective',
  'reason', 'explain', 'specify', 'others', 'other', 'name', 'full name',
  'first name', 'middle name', 'last name', 'surname', 'given',
]

function getFieldSize(key) {
  const k = key.toLowerCase()
  if (LONG_KEYWORDS.some(w => k.includes(w))) return 'full'
  if (SHORT_KEYWORDS.some(w => k.includes(w))) return 'short'
  // If answer value is short, make it short
  return 'auto'
}

function smartLayout(keys, answers) {
  // Returns array of rows, each row is array of {key, span}
  const rows = []
  let i = 0
  while (i < keys.length) {
    const k = keys[i]
    const val = String(answers[k] || '')
    const size = getFieldSize(k)
    const isLong = size === 'full' || val.length > 60

    if (isLong) {
      rows.push([{ key: k, span: 3 }])
      i++
    } else {
      // Try to pack 3 short fields in a row
      const group = []
      let j = i
      while (j < keys.length && group.length < 3) {
        const kj = keys[j]
        const vj = String(answers[kj] || '')
        const sj = getFieldSize(kj)
        if (sj === 'full' || vj.length > 60) break
        group.push({ key: kj, span: 1 })
        j++
      }
      if (group.length === 0) {
        rows.push([{ key: k, span: 3 }])
        i++
      } else {
        rows.push(group)
        i = j
      }
    }
  }
  return rows
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

  // Order keys by form field order
  let orderedKeys = []
  if (form?.fields?.length) {
    form.fields.forEach(f => { if (f.type !== 'section' && f.label && f.label in answers) orderedKeys.push(f.label) })
    Object.keys(answers).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k) })
  } else {
    orderedKeys = Object.keys(answers)
  }

  const layout = smartLayout(orderedKeys, answers)

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
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)', paddingBottom: 7, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>Answers</div>

          {layout.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              {row.map(({ key: k, span }) => (
                <div key={k} style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text3)' }}>{k}</label>
                  <div style={{ fontSize: 13, padding: '7px 10px', background: 'var(--surface2)', borderRadius: 5, border: '1px solid var(--border)', minHeight: 32, lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {answers[k] || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>N/A</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
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