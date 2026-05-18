import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)          // Supabase auth user
  const [admin, setAdmin] = useState(null)         // admins table record
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('pab_theme') || 'dark')

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pab_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  // Check session on mount
  useEffect(() => {
    async function init() {
      try {
        // Check kill switch
        const { data: ks } = await supabase
          .from('system_settings').select('value').eq('key', 'kill_switch').single()
        if (ks?.value === 'true') {
          setLoading(false)
          return
        }
        // Get session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        setUser(session.user)
        // Get admin record
        const { data: ad } = await supabase
          .from('admins').select('*').eq('id', session.user.id).single()
        if (ad?.is_active) {
          setAdmin(ad)
        } else {
          await supabase.auth.signOut()
        }
      } catch (e) {
        console.error('Auth init error:', e)
      }
      setLoading(false)
    }
    init()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setAdmin(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    const { data: ad } = await supabase
      .from('admins').select('*').eq('id', data.user.id).single()
    if (!ad || !ad.is_active) {
      await supabase.auth.signOut()
      throw new Error('Account not authorized or deactivated.')
    }
    setAdmin(ad)
    return ad
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAdmin(null)
  }

  // Role checks
  const isSuperAdmin = admin?.role === 'super_admin'
  const isAdmin = admin?.role === 'admin' || isSuperAdmin
  const isViewer = admin?.role === 'viewer'

  // Update admin locally (after edit)
  const refreshAdmin = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('admins').select('*').eq('id', user.id).single()
    if (data) setAdmin(data)
  }, [user])

  return (
    <AuthContext.Provider value={{
      user, admin, loading, theme, toggleTheme,
      signIn, signOut, isSuperAdmin, isAdmin, isViewer, refreshAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
