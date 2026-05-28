import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const FIELD_TYPES = {
  text: { label: '📝 Text Box', hint: 'Short answer' },
  textarea: { label: '📄 Long Text', hint: 'Long answer' },
  number: { label: '🔢 Number', hint: 'Numeric' },
  email: { label: '📧 Email', hint: 'Email address' },
  date: { label: '📅 Date', hint: 'Date picker' },
  time: { label: '🕐 Time', hint: 'Time picker' },
  checkbox: { label: '☑️ Checkboxes', hint: 'Pick multiple' },
  radio: { label: '⚪ Multiple Choice', hint: 'Pick one' },
  dropdown: { label: '🔽 Dropdown', hint: 'Pick from list' },
  section: { label: '📑 Section', hint: 'Divider' },
}

export default function FormBuilder() {
  const { id } = useParams()
  const { admin, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [desc, setDesc] = useState('')
  const [status, setStatus] = useState('draft')
  const [fields, setFields] = useState([])
  const [openMenu, setOpenMenu] = useState(null)
  const isEdit = !!id

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data } = await supabase.from('custom_forms').select('*').eq('id', id).single()
      if (data) {
        setTitle(data.title || '')
        setLabel(data.label || '')
        setDesc(data.description || '')
        setStatus(data.status || 'draft')
        setFields(data.fields || [])
      }
    }
    load()
  }, [id])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!e.target.closest('.add-btn-wrap')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addFieldAt(idx, type) {
    const newField = {
      id: Date.now(), type, label: '', placeholder: '', required: false,
      options: ['checkbox', 'radio', 'dropdown'].includes(type) ? ['Option 1', 'Option 2'] : [],
    }
    setFields(prev => {
      const next = [...prev]
      next.splice(idx, 0, newField)
      return next
    })
    setOpenMenu(null)
  }

  function updateField(idx, key, val) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }

  function removeField(idx) {
    if (confirm('Delete this field?')) setFields(prev => prev.filter((_, i) => i !== idx))
  }

  function moveField(idx, dir) {
    const ni = idx + dir
    if (ni < 0 || ni >= fields.length) return
    setFields(prev => {
      const next = [...prev]
      ;[next[idx], next[ni]] = [next[ni], next[idx]]
      return next
    })
  }

  function duplicateField(idx) {
    setFields(prev => {
      const next = [...prev]
      next.splice(idx + 1, 0, { ...JSON.parse(JSON.stringify(prev[idx])), id: Date.now() })
      return next
    })
  }

  function updateOption(fi, oi, val) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fi) return f
      const opts = [...(f.options || [])]
      opts[oi] = val
      return { ...f, options: opts }
    }))
  }

  function addOption(fi) {
    setFields(prev => prev.map((f, i) => i === fi ? { ...f, options: [...(f.options || []), ''] } : f))
  }

  function removeOption(fi, oi) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fi) return f
      return { ...f, options: f.options.filter((_, j) => j !== oi) }
    }))
  }

  function changeType(idx, type) {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f
      const opts = ['checkbox', 'radio', 'dropdown'].includes(type) && (!f.options || !f.options.length)
        ? ['Option 1', 'Option 2'] : f.options
      return { ...f, type, options: opts }
    }))
  }

  async function save(pubStatus) {
    if (!title.trim()) { toast('⚠️', 'Title required', ''); return }
    if (!fields.length) { toast('⚠️', 'Add at least one field', ''); return }
    const payload = {
      title: title.trim(), label: label.trim(), description: desc.trim(),
      status: pubStatus, fields: JSON.parse(JSON.stringify(fields)),
      updated_at: new Date().toISOString(), created_by: user?.id,
    }
    try {
      if (isEdit) {
        const { error } = await supabase.from('custom_forms').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('custom_forms')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }
      await auditLog('SAVE_FORM', `${pubStatus === 'published' ? 'Published' : 'Saved draft'}: "${title}"`)
      toast(pubStatus === 'published' ? '🚀' : '💾', pubStatus === 'published' ? 'Published!' : 'Saved!', `"${title}"`)
      navigate('/forms')
    } catch (e) { toast('❌', 'Failed', e.message) }
  }

  // Add button component — key fix: stopPropagation on the wrapper
  function AddButton({ idx }) {
    const isOpen = openMenu === idx
    return (
      <div
        className="add-btn-wrap"
        style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 13, height: 28, margin: '-6px 0', opacity: isOpen ? 1 : 0.5, position: 'relative', zIndex: isOpen ? 150 : 1, transition: 'opacity 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.opacity = 0.5 }}
      >
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpenMenu(isOpen ? null : idx) }}
          style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(79,142,247,.3)', flexShrink: 0 }}>+</button>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Click to add a new field</span>
        {isOpen && (
          <div
            style={{ position: 'absolute', top: 32, left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.4)', padding: 6, zIndex: 9999, minWidth: 220, maxHeight: 320, overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {Object.entries(FIELD_TYPES).map(([k, v]) => (
              <button key={k} type="button"
                onClick={e => { e.stopPropagation(); addFieldAt(idx, k) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', background: 'none', border: 'none', width: '100%', fontFamily: "'Inter',sans-serif", textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ width: 22, height: 22, background: 'var(--accent-bg)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>{v.label.split(' ')[0]}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{v.label.substring(v.label.indexOf(' ') + 1)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{v.hint}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div className="page-header">
          <div className="page-title">{isEdit ? 'Edit Form' : 'Create New Form'}</div>
          <div className="page-sub">Type your question, pick the answer type, and see a live preview. Click the blue ⊕ button to add a new field.</div>
        </div>

        {/* Form Details */}
        <div className="fb-card">
          <div className="fb-header">
            <span style={{ fontSize: 14 }}>📋</span>
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>Form Details</div></div>
          </div>
          <div className="fb-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Title *</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. PAB Technical Assessors Form" />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Category</label>
                <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. HR, Assessment" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief summary…" style={{ minHeight: 70 }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Status</label>
                <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="draft">📝 Draft — Not visible to assessors</option>
                  <option value="published">🚀 Published — Live and accepting submissions</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 7, padding: '8px 14px', fontSize: 12, color: 'var(--text2)' }}>
                  ✍️ Attributed to <strong style={{ color: 'var(--accent)' }}>{admin?.full_name || 'you'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="fb-card">
          <div className="fb-header">
            <span style={{ fontSize: 14 }}>⚙️</span>
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>Questions & Fields ({fields.length})</div></div>
          </div>
          <div className="fb-body">
            {fields.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 10, border: '1px dashed var(--border2)' }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📝</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No fields yet</div>
                <div style={{ fontSize: 12, marginBottom: 14 }}>Click the button below to add your first question.</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => addFieldAt(0, 'text')}>⊕ Add First Field</button>
              </div>
            ) : (
              <>
                {fields.map((f, i) => (
                  <div key={f.id || i}>
                    <AddButton idx={i} />
                    {f.type === 'section' ? (
                      <div style={{ background: 'linear-gradient(135deg,rgba(245,166,35,.08),rgba(245,166,35,.02))', border: '1px solid rgba(245,166,35,.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 12, position: 'relative' }}>
                        <input value={f.label} onChange={e => updateField(i, 'label', e.target.value)}
                          placeholder="Section title (e.g. Personal Information)"
                          style={{ background: 'transparent', border: 'none', fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', outline: 'none', width: '90%' }} />
                        <button type="button" onClick={() => removeField(i)}
                          style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                      </div>
                    ) : (
                      <div className="fb-field-card" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 26, height: 26, background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 4 }}>{i + 1}</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input value={f.label} onChange={e => updateField(i, 'label', e.target.value)}
                              placeholder="Type your question here (e.g. What is your full name?)"
                              style={{ background: 'transparent', border: 'none', borderBottom: '1.5px solid var(--border2)', padding: '4px 0 6px', fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--text)', outline: 'none', width: '100%' }} />
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <select value={f.type} onChange={e => changeType(i, e.target.value)}
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', minWidth: 140, fontFamily: "'Inter',sans-serif", outline: 'none' }}>
                                {Object.entries(FIELD_TYPES).filter(([k]) => k !== 'section').map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                                <input type="checkbox" checked={f.required || false}
                                  onChange={e => updateField(i, 'required', e.target.checked)}
                                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} /> Required
                              </label>
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                <button type="button" className="btn btn-ghost btn-xs" onClick={() => duplicateField(i)} title="Duplicate">⎘</button>
                                <button type="button" className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => moveField(i, -1)} title="Move up">▲</button>
                                <button type="button" className="btn btn-ghost btn-xs" disabled={i === fields.length - 1} onClick={() => moveField(i, 1)} title="Move down">▼</button>
                                <button type="button" className="btn btn-danger btn-xs" onClick={() => removeField(i)} title="Delete">🗑</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Preview */}
                        <div style={{ paddingTop: 10, paddingLeft: 36, borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Preview — what the user will see:</div>
                          {['text', 'number', 'email', 'date', 'time'].includes(f.type) && (
                            <div>
                              <input className="input" disabled placeholder={f.placeholder || 'User answer will appear here…'} style={{ opacity: 0.6 }} />
                              <input className="input" placeholder="Placeholder / hint text (optional)" value={f.placeholder || ''}
                                onChange={e => updateField(i, 'placeholder', e.target.value)} style={{ marginTop: 6, fontSize: 11 }} />
                            </div>
                          )}
                          {f.type === 'textarea' && (
                            <div>
                              <textarea className="input" disabled placeholder={f.placeholder || 'User answer will appear here…'} style={{ opacity: 0.6, minHeight: 60 }} />
                              <input className="input" placeholder="Placeholder / hint text (optional)" value={f.placeholder || ''}
                                onChange={e => updateField(i, 'placeholder', e.target.value)} style={{ marginTop: 6, fontSize: 11 }} />
                            </div>
                          )}
                          {['checkbox', 'radio', 'dropdown'].includes(f.type) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(f.options || []).map((o, oi) => (
                                <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 14, height: 14, border: '2px solid var(--text3)', borderRadius: f.type === 'radio' ? '50%' : 3, flexShrink: 0 }} />
                                  <input value={o} onChange={e => updateOption(i, oi, e.target.value)}
                                    placeholder={`Option ${oi + 1}`}
                                    style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '4px 2px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: "'Inter',sans-serif" }} />
                                  <button type="button" onClick={() => removeOption(i, oi)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✕</button>
                                </div>
                              ))}
                              <button type="button" onClick={() => addOption(i)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: '4px 0', fontFamily: "'Inter',sans-serif" }}>+ Add option</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <AddButton idx={fields.length} />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 28 }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/forms')}>Cancel</button>
          <button type="button" className="btn btn-ghost" onClick={() => save('draft')}>Save as Draft</button>
          <button type="button" className="btn btn-primary" onClick={() => save('published')}>Save & Publish →</button>
        </div>
      </div>
    </div>
  )
}