import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

export default function FormsLibrary() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [shareLink, setShareLink] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [delTarget, setDelTarget] = useState(null)

  useEffect(() => { loadForms() }, [])

  async function loadForms() {
    const { data } = await supabase.from('custom_forms')
      .select('*').order('created_at', { ascending: false })
    if (data) setForms(data)
  }

  function openShare(id) {
    const base = window.location.origin
    setShareLink(`${base}/form/${id}`)
    setShowShare(true)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink)
    toast('✅', 'Copied!', '')
  }

  async function confirmDel() {
    if (!delTarget) return
    await supabase.from('custom_forms').delete().eq('id', delTarget)
    setForms(prev => prev.filter(f => f.id !== delTarget))
    await auditLog('DELETE_FORM', 'Deleted form ID ' + delTarget)
    setDelTarget(null)
    toast('🗑️', 'Deleted', '')
  }

  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : ''

  return (
    <div className="fade-in">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Forms Library</div>
            <div className="page-sub">Create, edit, and share forms with assessors.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/forms/new')}>＋ Create New Form</button>
        </div>

        <div className="table-card">
          <div className="table-toolbar"><div className="table-title">All Forms</div></div>
          {forms.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No forms</div></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {isAdmin && <th>Author</th>}
                  <th>Form</th><th>Fields</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f, i) => (
                  <tr key={f.id} onClick={() => f.status === 'published' && navigate(`/forms/fill/${f.id}`)}>
                    <td style={{ width: 36, textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                    {isAdmin && <td style={{ fontSize: 12, color: 'var(--text2)' }}>{f.created_by_name || '—'}</td>}
                    <td><strong>{f.title}</strong><br /><small style={{ color: 'var(--text3)', fontSize: 11 }}>{f.description || f.label || ''}</small></td>
                    <td style={{ fontSize: 12 }}>{(f.fields || []).length} fields</td>
                    <td><span className={`badge badge-${f.status}`}>{cap(f.status)}</span></td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => openShare(f.id)}>🔗</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/forms/edit/${f.id}`)}>✏️</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setDelTarget(f.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShare && (
        <Modal onClose={() => setShowShare(false)}>
          <h3>🔗 Share Form</h3>
          <p>Copy and send this link to assessors.</p>
          <div style={{ display: 'flex', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareLink}</span>
            <button className="btn btn-primary btn-xs" onClick={copyLink}>Copy</button>
          </div>
          <div className="modal-acts"><button className="btn btn-ghost btn-sm" onClick={() => setShowShare(false)}>Close</button></div>
        </Modal>
      )}

      {/* Delete Modal */}
      {delTarget && (
        <Modal onClose={() => setDelTarget(null)}>
          <h3>Delete Form</h3>
          <p>Permanently delete this form?</p>
          <div className="modal-acts">
            <button className="btn btn-ghost btn-sm" onClick={() => setDelTarget(null)}>Cancel</button>
            <button className="btn btn-danger btn-sm" onClick={confirmDel}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
