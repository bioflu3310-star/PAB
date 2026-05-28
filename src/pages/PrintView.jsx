import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

const SHORT_KEYWORDS = ['title','prefix','gender','sex','date','birth','age','civil','status',
  'nationality','region','province','city','zip','postal','contact','mobile','cellular','phone',
  'fax','number','no.','tin','sss','gsis','id','code','year','month','day','time',
  'rate','salary','amount','score','rating','level','type']
const LONG_KEYWORDS = ['address','description','remarks','comment','notes','detail','experience',
  'background','qualification','education','training','accomplishment','achievement',
  'summary','objective','reason','explain','specify','others','other','name','full name',
  'first name','middle name','last name','surname','given']

function getFieldSize(key, val) {
  const k = (key || '').toLowerCase()
  const v = String(val || '')
  if (LONG_KEYWORDS.some(w => k.includes(w))) return 'full'
  if (v.length > 60) return 'full'
  if (SHORT_KEYWORDS.some(w => k.includes(w))) return 'short'
  return 'auto'
}

function smartLayout(keys, answers) {
  const rows = []
  let i = 0
  while (i < keys.length) {
    const k = keys[i]
    const isLong = getFieldSize(k, answers[k]) === 'full'
    if (isLong) {
      rows.push([{ key: k, span: 3 }]); i++
    } else {
      const group = []
      let j = i
      while (j < keys.length && group.length < 3) {
        const kj = keys[j]
        if (getFieldSize(kj, answers[kj]) === 'full') break
        group.push({ key: kj, span: 1 }); j++
      }
      if (!group.length) { rows.push([{ key: k, span: 3 }]); i++ }
      else { rows.push(group); i = j }
    }
  }
  return rows
}

// Answer box style — consistent height based on content
function AnswerBox({ value }) {
  const isEmpty = !value || value === 'N/A' || value.trim() === ''
  return (
    <div style={{
      fontSize: 13,
      fontWeight: 600,
      padding: '9px 12px',
      background: 'var(--surface2)',
      borderRadius: 6,
      border: '1px solid var(--border)',
      minHeight: 38,
      lineHeight: 1.5,
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      color: isEmpty ? 'var(--text3)' : 'var(--text)',
      fontStyle: isEmpty ? 'italic' : 'normal',
      fontWeight: isEmpty ? 600 : 800,
    }}>
      {isEmpty ? 'N/A' : value}
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
  const [dirSaved, setDirSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('form_submissions').select('*').eq('id', id).single()
      if (data) {
        setSub(data)
        if (data.director_signoff) {
          setDirData(data.director_signoff)
          if (data.director_signoff.qualifiedBy) setDirSaved(true)
        }
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
      setDirSaved(true)
      toast('✅', 'Saved!', 'Director sign-off recorded.')
      await auditLog('DIRECTOR_SIGNOFF', ref)
    } catch (e) { toast('❌', 'Failed', e.message) }
  }

  // Label style — consistent, uppercase, fixed height
  const labelStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'var(--text3)',
    display: 'block',
    marginBottom: 5,
    lineHeight: 1.4,
    minHeight: 24, // ← keeps all labels same height so answer boxes align
    wordBreak: 'break-word',
  }

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div className="no-print" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Reference</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700 }}>{ref}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub.assessor_name} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-PH') : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <button className="btn btn-warning btn-sm" onClick={() => setShowDirector(!showDirector)}>
            🏛 {showDirector ? 'Hide Director' : 'Director'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Document */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>

        {/* Banner */}
        <div style={{ background: 'var(--accent)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>{sub.form_title || 'Submission'}</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>{sub.assessor_name} · {sub.assessor_email}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,.85)', fontSize: 12, flexShrink: 0 }}>
            <div style={{ marginBottom: 2 }}>Reference</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{ref}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,.7)' }}>
              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </div>
          </div>
        </div>

        {/* Answers */}
        <div style={{ padding: '28px 32px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>Answers</div>

          {layout.map((row, ri) => (
            <div key={ri} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 12,
              alignItems: 'end', // ← aligns answer boxes to bottom so they line up
            }}>
              {row.map(({ key: k, span }) => (
                <div key={k} style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column' }}>
                  <label style={labelStyle}>{k}</label>
                  <AnswerBox value={answers[k]} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Director Sign-Off */}
        {showDirector && (
          <div style={{ borderTop: '2px solid var(--warning)', background: 'rgba(245,166,35,.03)' }}>
            <div style={{ padding: '14px 32px', borderBottom: '1px solid rgba(245,166,35,.2)', background: 'rgba(245,166,35,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🏛</span>
                {/* ← Only shows "Director" not "Director Sign-Off" */}
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700 }}>Director</div>
              </div>
              <button className="btn btn-warning btn-sm" onClick={saveDirector}>
                {dirSaved ? '✅ Saved' : '💾 Save'}
              </button>
            </div>
            <div style={{ padding: '20px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div>
                  <label style={{ ...labelStyle, color: 'var(--warning)' }}>Qualified By</label>
                  <input className="input" value={dirData.qualifiedBy}
                    onChange={e => { setDirData(p => ({ ...p, qualifiedBy: e.target.value })); setDirSaved(false) }}
                    placeholder="" />
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={{ ...labelStyle, color: 'var(--warning)' }}>Date</label>
                  <input className="input" type="date" value={dirData.qualifiedDate}
                    onChange={e => { setDirData(p => ({ ...p, qualifiedDate: e.target.value })); setDirSaved(false) }} />
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, color: 'var(--warning)' }}>Evaluation Remarks</label>
                <textarea className="input" value={dirData.evaluationRemarks}
                  onChange={e => { setDirData(p => ({ ...p, evaluationRemarks: e.target.value })); setDirSaved(false) }}
                  placeholder="" style={{ minHeight: 120 }} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: 'var(--warning)' }}>Recommendation</label>
                <textarea className="input" value={dirData.recommendation}
                  onChange={e => { setDirData(p => ({ ...p, recommendation: e.target.value })); setDirSaved(false) }}
                  placeholder="" style={{ minHeight: 120 }} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid var(--border)', background: 'var(--section-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>PAB Information System</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ref: {ref} · Generated: {new Date().toLocaleString('en-PH')}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>Philippine Accreditation Bureau · DTI</div>
        </div>
      </div>
    </div>
  )
}