import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase, auditLog } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const PAGE_SIZE = 20

export default function Dashboard() {
  const { admin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { loadCounts } = useOutletContext()
  const [allSubs, setAllSubs] = useState([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [formCount, setFormCount] = useState(0)

  useEffect(() => { loadSubs() }, [])

  async function loadSubs() {
    const { data } = await supabase.from('form_submissions')
      .select('*').order('submitted_at', { ascending: false })
    if (data) setAllSubs(data)
    const { count } = await supabase.from('custom_forms').select('*', { count: 'exact', head: true })
    setFormCount(count || 0)
  }

  // Filtered submissions
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allSubs.filter(s => {
      const txt = `${s.assessor_name || ''} ${s.assessor_email || ''} ${s.form_title || ''}`.toLowerCase()
      if (q && !txt.includes(q)) return false
      const src = s.assessor_email === admin?.email ? 'admin' : 'assessor'
      if (sourceFilter && src !== sourceFilter) return false
      if (statusFilter === 'unread' && s.is_read) return false
      if (statusFilter === 'read' && !s.is_read) return false
      return true
    })
  }, [allSubs, search, sourceFilter, statusFilter, admin])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const unread = allSubs.filter(s => !s.is_read).length
  const allPageSelected = pageItems.length > 0 && pageItems.every(s => selected.has(s.id))

  // Actions
  async function markRead(id) {
    await supabase.from('form_submissions').update({ is_read: true }).eq('id', id)
    setAllSubs(prev => prev.map(s => s.id === id ? { ...s, is_read: true } : s))
    loadCounts()
  }

  async function deleteSub(id) {
    if (!confirm('Delete this submission?')) return
    await supabase.from('form_submissions').delete().eq('id', id)
    setAllSubs(prev => prev.filter(s => s.id !== id))
    selected.delete(id)
    setSelected(new Set(selected))
    await auditLog('DELETE_SUBMISSION', 'SUB-' + String(id).padStart(4, '0'))
    toast('🗑️', 'Deleted', '')
    loadCounts()
  }

  async function bulkMarkRead() {
    const ids = [...selected]
    await supabase.from('form_submissions').update({ is_read: true }).in('id', ids)
    setAllSubs(prev => prev.map(s => selected.has(s.id) ? { ...s, is_read: true } : s))
    setSelected(new Set())
    toast('✅', 'Done', `${ids.length} marked as read.`)
    loadCounts()
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} submission(s)?`)) return
    const ids = [...selected]
    await supabase.from('form_submissions').delete().in('id', ids)
    setAllSubs(prev => prev.filter(s => !selected.has(s.id)))
    await auditLog('BULK_DELETE', `Deleted ${ids.length} submission(s)`)
    setSelected(new Set())
    toast('🗑️', 'Deleted', `${ids.length} removed.`)
    loadCounts()
  }

  function toggleSelect(id, checked) {
    const next = new Set(selected)
    checked ? next.add(id) : next.delete(id)
    setSelected(next)
  }

  function toggleSelectAll(checked) {
    const next = new Set(selected)
    pageItems.forEach(s => checked ? next.add(s.id) : next.delete(s.id))
    setSelected(next)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">View and manage all form submissions.</div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-num">{allSubs.length}</div><div className="stat-hint">All submissions</div></div>
        <div className="stat-card"><div className="stat-label">Unread</div><div className="stat-num">{unread}</div><div className="stat-hint">Pending review</div></div>
        <div className="stat-card"><div className="stat-label">Forms</div><div className="stat-num">{formCount}</div><div className="stat-hint">Created</div></div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-title">📋 All Submissions</div>
          <div className="search-box">
            <span className="search-ico">🔍</span>
            <input placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="filter-sel" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1) }}>
            <option value="">All Sources</option>
            <option value="assessor">Assessor</option>
            <option value="admin">Admin</option>
          </select>
          <select className="filter-sel" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--accent-bg)', borderBottom: '1px solid var(--accent-border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{selected.size} selected</span>
            <button className="btn btn-success btn-xs" onClick={bulkMarkRead}>✓ Mark Read</button>
            <button className="btn btn-danger btn-xs" onClick={bulkDelete}>🗑 Delete</button>
            <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>✕ Clear</button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{allSubs.length ? '🔍' : '📭'}</div>
            <div className="empty-title">{allSubs.length ? 'No matches' : 'No submissions yet'}</div>
            <div className="empty-sub">Share a form or fill one yourself.</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={allPageSelected} onChange={e => toggleSelectAll(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </th>
                  <th>Ref</th><th>Name</th><th>Form</th><th>Source</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(s => {
                  const src = s.assessor_email === admin?.email ? 'admin' : 'assessor'
                  const ref = 'SUB-' + String(s.id).padStart(4, '0')
                  return (
                    <tr key={s.id} style={!s.is_read ? { background: 'var(--accent-bg)' } : {}}
                      onClick={() => navigate(`/submission/${s.id}`)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(s.id)}
                          onChange={e => toggleSelect(s.id, e.target.checked)}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12, fontFamily: 'monospace' }}>{ref}</td>
                      <td><strong>{s.assessor_name || '—'}</strong></td>
                      <td style={{ fontSize: 12 }}>{s.form_title || '—'}</td>
                      <td><span className={`badge badge-${src}`}>{src === 'admin' ? '👤 Admin' : '📧 Assessor'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td><span className={`badge ${s.is_read ? 'badge-read' : 'badge-new'}`}>{s.is_read ? 'Read' : 'Unread'}</span></td>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/submission/${s.id}`)}>👁</button>
                        {!s.is_read && <button className="btn btn-primary btn-xs" onClick={() => markRead(s.id)}>✓</button>}
                        <button className="btn btn-danger btn-xs" onClick={() => deleteSub(s.id)}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, i, arr) => (
                    <span key={p}>
                      {i > 0 && p - arr[i - 1] > 1 && <span style={{ padding: '0 4px', color: 'var(--text3)' }}>…</span>}
                      <button className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
                    </span>
                  ))}
                <button className="btn btn-ghost btn-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
