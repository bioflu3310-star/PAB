import { useState, useEffect, useMemo } from 'react'
import { supabase, auditLog } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

export default function Settings() {
  const { admin, user, isSuperAdmin, refreshAdmin } = useAuth()
  const toast = useToast()

  // ── State ──
  const [assessors, setAssessors] = useState([])
  const [admins, setAdmins] = useState([])
  const [killSwitch, setKillSwitch] = useState(false)
  const [logs, setLogs] = useState([])
  const [logSearch, setLogSearch] = useState('')
  const [logCat, setLogCat] = useState('all')
  const [logFrom, setLogFrom] = useState('')
  const [logTo, setLogTo] = useState('')

  // Modals
  const [showAddAsr, setShowAddAsr] = useState(false)
  const [showEditAsr, setShowEditAsr] = useState(null)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [showEditAdmin, setShowEditAdmin] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formConfirmPassword, setFormConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [formRole, setFormRole] = useState('viewer')
  const [formErr, setFormErr] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    loadAssessors()
    if (isSuperAdmin) { loadAdmins(); loadKillSwitch(); loadLogs() }
  }, [isSuperAdmin])

  // ── Assessors ──
  async function loadAssessors() {
    const { data } = await supabase.from('assessors').select('*').order('created_at', { ascending: false })
    if (data) setAssessors(data)
  }

  async function addAssessor() {
    setFormErr('')
    if (!formName || !formEmail) { setFormErr('Fill all fields.'); return }
    setFormLoading(true)
    try {
      const { data: ex } = await supabase.from('assessors').select('id').eq('email', formEmail.toLowerCase()).maybeSingle()
      if (ex) { setFormErr('Already registered.'); setFormLoading(false); return }
      const { error } = await supabase.from('assessors').insert({ id: crypto.randomUUID(), email: formEmail.toLowerCase(), full_name: formName, is_active: true, created_by: user?.id })
      if (error) throw error
      await auditLog('ADD_ASSESSOR', `${formName} (${formEmail})`)
      toast('✅', 'Added', formName); setShowAddAsr(false); loadAssessors()
    } catch (e) { setFormErr(e.message) }
    setFormLoading(false)
  }

  async function editAssessor() {
    setFormErr('')
    if (!formName || !formEmail) { setFormErr('Fill all fields.'); return }
    setFormLoading(true)
    try {
      const { error } = await supabase.from('assessors').update({ full_name: formName, email: formEmail.toLowerCase() }).eq('id', showEditAsr)
      if (error) throw error
      await auditLog('EDIT_ASSESSOR', `${formName} (${formEmail})`)
      toast('✅', 'Updated', ''); setShowEditAsr(null); loadAssessors()
    } catch (e) { setFormErr(e.message) }
    setFormLoading(false)
  }

  async function removeAssessor(id, name) {
    if (!confirm(`Remove ${name}?`)) return
    await supabase.from('assessors').delete().eq('id', id)
    await auditLog('DELETE_ASSESSOR', name)
    toast('🗑️', 'Removed', ''); loadAssessors()
  }

  async function toggleAssessorStatus(id, active) {
    await supabase.from('assessors').update({ is_active: !active }).eq('id', id)
    toast('✅', 'Updated', ''); loadAssessors()
  }

  // ── Admins ──
  async function loadAdmins() {
    const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: true })
    if (data) setAdmins(data)
  }

  async function addAdmin() {
    setFormErr('')
    if (!formName || !formEmail || !formPassword || !formConfirmPassword) { setFormErr('Fill all fields.'); return }
    if (formPassword.length < 6) { setFormErr('Password must be at least 6 characters.'); return }
    if (formPassword !== formConfirmPassword) { setFormErr('Passwords do not match.'); return }
    setFormLoading(true)
    try {
      // Try signUp
      const { data: su, error: suErr } = await supabase.auth.signUp({ email: formEmail.toLowerCase(), password: formPassword })
      if (suErr) {
        if (suErr.message?.toLowerCase().includes('already registered')) {
          // Use RPC function to add existing auth user as admin
          const { data: rpc, error: rpcErr } = await supabase.rpc('add_admin_by_email', { p_email: formEmail.toLowerCase(), p_name: formName, p_role: formRole })
          if (rpcErr) throw rpcErr
          if (rpc && !rpc.success) throw new Error(rpc.error)
          await auditLog('ADD_ADMIN', `${formName} (${formEmail}) as ${formRole} [existing user]`)
          toast('✅', 'Added', `${formName} can log in with existing password.`)
          setShowAddAdmin(false); loadAdmins(); setFormLoading(false); return
        }
        throw suErr
      }
      if (!su?.user?.id) throw new Error('Sign up failed.')
      await supabase.from('admins').upsert({ id: su.user.id, email: formEmail.toLowerCase(), full_name: formName, role: formRole, is_active: true }, { onConflict: 'id' })
      await auditLog('ADD_ADMIN', `${formName} (${formEmail}) as ${formRole}`)
      toast('✅', 'Added', `${formName} can now log in.`)
      setShowAddAdmin(false); loadAdmins()
    } catch (e) { setFormErr(e.message) }
    setFormLoading(false)
  }

  async function editAdmin() {
    setFormErr('')
    if (!formName) { setFormErr('Name is required.'); return }
    setFormLoading(true)
    try {
      const { error } = await supabase.from('admins').update({ full_name: formName, role: formRole }).eq('id', showEditAdmin)
      if (error) throw error
      if (showEditAdmin === user?.id) await refreshAdmin()
      await auditLog('EDIT_ADMIN', `${formName} → ${formRole}`)
      toast('✅', 'Updated', ''); setShowEditAdmin(null); loadAdmins()
    } catch (e) { setFormErr(e.message) }
    setFormLoading(false)
  }

  async function removeAdmin(id, name) {
    if (!confirm(`Remove ${name}?`)) return
    const { error } = await supabase.from('admins').delete().eq('id', id)
    if (error) { toast('❌', 'Failed', error.message); return }
    await auditLog('REMOVE_ADMIN', name)
    toast('🗑️', 'Removed', ''); loadAdmins()
  }

  // ── Kill Switch ──
  async function loadKillSwitch() {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'kill_switch').single()
    setKillSwitch(data?.value === 'true')
  }

  async function toggleKill() {
    const nv = !killSwitch
    if (!confirm(nv ? 'Lock login?' : 'Unlock?')) return
    await supabase.from('system_settings').update({ value: String(nv) }).eq('key', 'kill_switch')
    setKillSwitch(nv)
    await auditLog('KILL_SWITCH', nv ? 'ON' : 'OFF')
    toast(nv ? '🔒' : '🔓', nv ? 'Locked' : 'Unlocked', '')
  }

  // ── Audit Logs ──
  async function loadLogs() {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
    if (data) setLogs(data)
  }

  const CATS = {
    auth: ['LOGIN', 'LOGOUT'],
    assessor: ['ADD_ASSESSOR', 'EDIT_ASSESSOR', 'DELETE_ASSESSOR', 'REMOVE_ASSESSOR'],
    form: ['SAVE_FORM', 'DELETE_FORM', 'FORM_SUBMITTED', 'BULK_DELETE', 'DELETE_SUBMISSION', 'DIRECTOR_SIGNOFF'],
    system: ['KILL_SWITCH', 'ADD_ADMIN', 'REMOVE_ADMIN', 'EDIT_ADMIN'],
  }

  const filteredLogs = useMemo(() => {
    let result = logs
    if (logCat !== 'all') {
      const acts = CATS[logCat] || []
      result = result.filter(l => acts.some(a => (l.action || '').toUpperCase().includes(a)))
    }
    if (logSearch) {
      const q = logSearch.toLowerCase()
      result = result.filter(l => `${l.action} ${l.details}`.toLowerCase().includes(q))
    }
    if (logFrom) result = result.filter(l => l.created_at >= logFrom)
    if (logTo) result = result.filter(l => l.created_at <= logTo + 'T23:59:59')
    return result
  }, [logs, logCat, logSearch, logFrom, logTo])

  // ── Helpers for modals ──
  function openModal(type, data) {
    setFormName(data?.name || ''); setFormEmail(data?.email || '')
    setFormPassword(''); setFormConfirmPassword(''); setShowPw(false); setShowConfirmPw(false); setFormRole(data?.role || 'viewer'); setFormErr('')
    if (type === 'addAsr') setShowAddAsr(true)
    else if (type === 'editAsr') setShowEditAsr(data.id)
    else if (type === 'addAdmin') setShowAddAdmin(true)
    else if (type === 'editAdmin') setShowEditAdmin(data.id)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-sub">Manage assessors, admins, security, and activity logs.</div>
      </div>

      {/* ── Assessors ── */}
      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-toolbar">
          <div className="table-title">Registered Assessors</div>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addAsr')}>+ Add Assessor</button>
        </div>
        {assessors.length === 0 ? <div style={{ padding: 24, color: 'var(--text3)' }}>No assessors.</div> : (
          <table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Added</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>{assessors.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.full_name}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{a.email}</td>
                <td><span className={`badge ${a.is_active ? 'badge-read' : 'badge-new'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(a.created_at).toLocaleDateString('en-PH')}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => openModal('editAsr', { id: a.id, name: a.full_name, email: a.email })}>✏️</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => toggleAssessorStatus(a.id, a.is_active)}>{a.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button className="btn btn-danger btn-xs" onClick={() => removeAssessor(a.id, a.full_name)}>Remove</button>
                </td>
              </tr>
            ))}</tbody></table>
        )}
      </div>

      {/* ── Admins (super_admin only) ── */}
      {isSuperAdmin && (
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <div className="table-title">👑 Admins</div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('addAdmin')}>+ Add Admin</button>
          </div>
          <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>{admins.map(a => {
              const isYou = a.id === user?.id
              const roleLabel = { super_admin: '👑 Super Admin', admin: '🔧 Admin', viewer: '👁 Viewer' }[a.role] || a.role
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.full_name}{isYou && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{a.email}</td>
                  <td>{roleLabel}</td>
                  <td><span className={`badge ${a.is_active ? 'badge-read' : 'badge-new'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => openModal('editAdmin', { id: a.id, name: a.full_name, role: a.role })}>✏️ Edit</button>
                    {!isYou && <button className="btn btn-danger btn-xs" onClick={() => removeAdmin(a.id, a.full_name)}>Remove</button>}
                  </td>
                </tr>
              )
            })}</tbody></table>
        </div>
      )}

      {/* ── Kill Switch ── */}
      {isSuperAdmin && (
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar"><div className="table-title">🔒 Kill Switch</div></div>
          <div style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>When ON, login is locked for everyone.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 600, color: killSwitch ? 'var(--danger)' : 'var(--success)' }}>
                {killSwitch ? '🔴 LOCKED' : '🟢 ONLINE'}
              </span>
              <button className={`btn btn-sm ${killSwitch ? 'btn-success' : 'btn-danger'}`} onClick={toggleKill}>
                {killSwitch ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Logs ── */}
      {isSuperAdmin && (
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <div className="table-title">📋 Activity Logs</div>
            <button className="btn btn-ghost btn-sm" onClick={loadLogs}>↺ Refresh</button>
          </div>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box"><span className="search-ico">🔍</span><input placeholder="Search…" value={logSearch} onChange={e => setLogSearch(e.target.value)} /></div>
            <select className="filter-sel" value={logCat} onChange={e => setLogCat(e.target.value)}>
              <option value="all">All</option><option value="auth">🔐 Login/Logout</option>
              <option value="assessor">👤 Assessor</option><option value="form">📋 Forms</option>
              <option value="system">⚙️ System</option>
            </select>
            <input type="date" className="filter-sel" value={logFrom} onChange={e => setLogFrom(e.target.value)} style={{ padding: '6px 8px' }} />
            <input type="date" className="filter-sel" value={logTo} onChange={e => setLogTo(e.target.value)} style={{ padding: '6px 8px' }} />
            <button className="btn btn-ghost btn-xs" onClick={() => { setLogSearch(''); setLogCat('all'); setLogFrom(''); setLogTo('') }}>Clear</button>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredLogs.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No logs found.</div> : (
              <table><thead><tr><th>Time</th><th>Category</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>{filteredLogs.map(l => {
                  let cat = 'system'
                  for (const [c, acts] of Object.entries(CATS)) { if (acts.some(a => (l.action || '').includes(a))) { cat = c; break } }
                  const catIcons = { auth: '🔐', assessor: '👤', form: '📋', system: '⚙️' }
                  return (
                    <tr key={l.id}>
                      <td style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('en-PH')}</td>
                      <td style={{ fontSize: 11 }}>{catIcons[cat]} {cat}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{l.action}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{l.details || '—'}</td>
                    </tr>
                  )
                })}</tbody></table>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {(showAddAsr || showEditAsr) && (
        <Modal onClose={() => { setShowAddAsr(false); setShowEditAsr(null) }}>
          <h3>{showEditAsr ? 'Edit Assessor' : 'Add Assessor'}</h3>
          <p>{showEditAsr ? 'Update name and email.' : 'Register an assessor for form access.'}</p>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Full Name *</label>
            <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Juan Dela Cruz" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Email *</label>
            <input className="input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="assessor@email.com" />
          </div>
          {formErr && <div style={{ padding: '8px 12px', borderRadius: 7, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 14 }}>{formErr}</div>}
          <div className="modal-acts">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddAsr(false); setShowEditAsr(null) }}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={formLoading} onClick={showEditAsr ? editAssessor : addAssessor}>
              {formLoading ? 'Saving…' : showEditAsr ? 'Save' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {(showAddAdmin || showEditAdmin) && (
        <Modal onClose={() => { setShowAddAdmin(false); setShowEditAdmin(null) }}>
          <h3>{showEditAdmin ? 'Edit Admin' : 'Add Admin'}</h3>
          <p>{showEditAdmin ? 'Update name and role.' : 'Create a new admin account.'}</p>
          {!showEditAdmin && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Email *</label>
              <input className="input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="admin@pab.gov.ph" />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Full Name *</label>
            <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Juan Dela Cruz" />
          </div>
          {!showEditAdmin && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPw ? 'text' : 'password'} value={formPassword}
                    onChange={e => setFormPassword(e.target.value)} placeholder="Min 6 characters"
                    style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Confirm Password *</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showConfirmPw ? 'text' : 'password'} value={formConfirmPassword}
                    onChange={e => setFormConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    style={{ paddingRight: 40, borderColor: formConfirmPassword && formPassword !== formConfirmPassword ? 'var(--danger)' : '' }} />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>
                    {showConfirmPw ? '🙈' : '👁'}
                  </button>
                </div>
                {formConfirmPassword && formPassword !== formConfirmPassword && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠️ Passwords do not match</div>
                )}
                {formConfirmPassword && formPassword === formConfirmPassword && (
                  <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✅ Passwords match</div>
                )}
              </div>
            </>
          )}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Role *</label>
            <select className="input" value={formRole} onChange={e => setFormRole(e.target.value)}>
              <option value="viewer">👁 Viewer</option><option value="admin">🔧 Admin</option><option value="super_admin">👑 Super Admin</option>
            </select>
          </div>
          {formErr && <div style={{ padding: '8px 12px', borderRadius: 7, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, marginBottom: 14 }}>{formErr}</div>}
          <div className="modal-acts">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddAdmin(false); setShowEditAdmin(null) }}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={formLoading} onClick={showEditAdmin ? editAdmin : addAdmin}>
              {formLoading ? 'Saving…' : showEditAdmin ? 'Save' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}