import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Layout({ user, children }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/', icon: '📊', label: 'Dashboard' },
    { href: '/gastos', icon: '💸', label: 'Gastos' },
    { href: '/vencimientos', icon: '📅', label: 'Vencimientos' },
    { href: '/perfil', icon: '👤', label: 'Perfil' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary-light)', whiteSpace: 'nowrap' }}>
          💰 Mis Gastos
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {navItems.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="btn nav-btn"
              style={{
                background: router.pathname === item.href ? 'var(--primary)' : 'transparent',
                color: router.pathname === item.href ? 'white' : 'var(--text-muted)',
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="user-email" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="btn"
            style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            Salir
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {children}
      </main>
    </div>
  )
}
