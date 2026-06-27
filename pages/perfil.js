import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Perfil() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })
  }, [])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setMsg('')

    if (newPassword !== confirmPassword) {
      setMsg('❌ Las contraseñas no coinciden')
      return
    }

    if (newPassword.length < 6) {
      setMsg('❌ Mínimo 6 caracteres')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMsg('❌ ' + error.message)
    } else {
      setMsg('✅ Contraseña actualizada correctamente')
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600' }}>👤 Mi perfil</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {user?.email}
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="btn"
          style={{ background: 'var(--border)', color: 'var(--text)' }}
        >
          ← Volver
        </button>
      </div>

      {/* Cambiar contraseña */}
      <div className="card" style={{ maxWidth: '420px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
          🔒 Cambiar contraseña
        </h2>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="repetí la contraseña"
              required
            />
          </div>

          {msg && (
            <p style={{
              fontSize: '0.85rem',
              color: msg.startsWith('✅') ? 'var(--success)' : 'var(--danger)'
            }}>
              {msg}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
