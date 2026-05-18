import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FormsLibrary from './pages/FormsLibrary'
import FormBuilder from './pages/FormBuilder'
import FormFill from './pages/FormFill'
import Settings from './pages/Settings'
import PrintView from './pages/PrintView'
import AssessorForm from './pages/AssessorForm'

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
  if (!admin) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/form/:formId" element={<AssessorForm />} />

      {/* Protected admin routes */}
      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="forms" element={<FormsLibrary />} />
        <Route path="forms/new" element={<FormBuilder />} />
        <Route path="forms/edit/:id" element={<FormBuilder />} />
        <Route path="forms/fill/:id" element={<FormFill />} />
        <Route path="submission/:id" element={<PrintView />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
