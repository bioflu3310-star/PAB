import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase, auditLog } from '../lib/supabase'
import './Layout.css'

export default function Layout() {
  const { admin, user, signOut, theme, toggleTheme, isSuperAdmin } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [submissions, setSubmissions] = useState([])
  const [formCount, setFormCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  // Load counts
  useEffect(() => {
    loadCounts()
    // Realtime subscription for new submissions
    const channel = supabase.channel('rt-submissions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'form_submissions' },
        (payload) => {
          loadCounts()
          toast('🔔', 'New Submission!', `${payload.new.assessor_name || 'Someone'} submitted "${payload.new.form_title || 'a form'}"`)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadCounts() {
    const { data: subs } = await supabase.from('form_submissions')
      .select('*').order('submitted_at', { ascending: false }).limit(25)
    if (subs) setSubmissions(subs)
    const { count } = await supabase.from('custom_forms')
      .select('*', { count: 'exact', head: true })
    setFormCount(count || 0)
  }

  const unread = submissions.filter(s => !s.is_read).length

  async function handleSignOut() {
    await auditLog('LOGOUT', `${admin?.full_name} logged out`)
    await signOut()
  }

  async function markAllRead() {
    await supabase.from('form_submissions').update({ is_read: true }).eq('is_read', false)
    setSubmissions(prev => prev.map(s => ({ ...s, is_read: true })))
    toast('✅', 'Done', 'All marked as read.')
  }

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return 'Just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    return Math.floor(s / 86400) + 'd ago'
  }

  // Current page title
  const pageTitle = {
    '/': 'Dashboard', '/forms': 'Forms Library', '/settings': 'Settings',
  }[location.pathname] || 'Dashboard'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-top">
            <div className="logo-emblem">🏛</div>
            <div>
              <div className="logo-title">PAB Information System</div>
              <div className="logo-sub">DTI · Accreditation Bureau</div>
            </div>
          </div>
          <div className="logo-ver">ver.2 · React</div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-group">Overview</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⊞</span> Dashboard
            <span className="nav-badge">{submissions.length}</span>
          </NavLink>
          <div className="nav-group">Forms</div>
          <NavLink to="/forms" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📂</span> Forms Library
            <span className="nav-badge">{formCount}</span>
          </NavLink>
          <div className="nav-group">System</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span> Settings
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <div className="user-name">{admin?.full_name || user?.email}</div>
          <div className="user-role">
            {{ super_admin: '👑 Super Admin', admin: '🔧 Admin', viewer: '👁 Viewer' }[admin?.role] || admin?.role}
          </div>
          <div className="user-email">{user?.email}</div>
          <button className="signout-btn" onClick={handleSignOut}>⏻ Sign Out</button>
        </div>
      </nav>

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <span>PAB</span> <span className="topbar-sep">›</span>
            <span className="topbar-current">{pageTitle}</span>
          </div>
          <div className="topbar-right">
            {/* Notification Bell */}
            <div className="notif-wrap">
              <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
                🔔
                {unread > 0 && <span className="notif-count">{unread}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="notif-header">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🔔 Notifications</span>
                    <button className="notif-mark-btn" onClick={markAllRead}>Mark all read</button>
                  </div>
                  <div className="notif-list">
                    {submissions.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>No notifications</div>
                    ) : submissions.map(n => (
                      <NavLink key={n.id} to={`/submission/${n.id}`}
                        className={`notif-item ${n.is_read ? '' : 'unread'}`}
                        onClick={() => setNotifOpen(false)}>
                        <span className="notif-icon">{n.is_read ? '📬' : '🔔'}</span>
                        <div>
                          <div className="notif-text">
                            <strong>{n.assessor_name || 'Someone'}</strong> submitted{' '}
                            <strong>{n.form_title || 'a form'}</strong>
                          </div>
                          <div className="notif-time">{timeAgo(n.submitted_at)}</div>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="content">
          <Outlet context={{ submissions, setSubmissions, loadCounts }} />
        </div>
      </div>

      {/* Close notif dropdown on outside click */}
      {notifOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setNotifOpen(false)} />}
    </div>
  )
}
