import { useState, type FormEvent } from 'react'
import { GraduationCap, LogIn, TriangleAlert } from 'lucide-react'
import { ApiError, login } from './api'
import { API, DEMO_PASSWORD, MODO_AWS, TENANTS, USUARIOS_DEMO, correoDemo } from './config'
import type { Sesion } from './types'

export function Login({ onEntrar }: { onEntrar: (s: Sesion) => void }) {
  const [tenant, setTenant] = useState<string>(TENANTS[0].id)
  const [email, setEmail] = useState(correoDemo(TENANTS[0].id, 'profe'))
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  /** Al cambiar de institución se reescribe el dominio del correo. */
  function cambiarTenant(id: string) {
    setTenant(id)
    const usuario = email.split('@')[0] || 'profe'
    setEmail(correoDemo(id, usuario))
    setError('')
  }

  function usarDemo(usuario: string) {
    setEmail(correoDemo(tenant, usuario))
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      const s = await login(tenant, email.trim(), password)
      onEntrar({ token: s.token, expira_epoch: s.expira_epoch, usuario: s.usuario })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  const faltantes = Object.entries(API).filter(([, v]) => !v).map(([k]) => `VITE_API_${k.toUpperCase()}`)

  return <div className="login-shell">
    <div className="login-card">
      <div className="login-brand">
        <div className="brand-mark">C<span>S</span></div>
        <div className="brand-name">Canva<span>SLS</span></div>
      </div>
      <h1>Entra a tu institución</h1>
      <p className="muted">
        El sistema identifica tu institución a partir del token, no de esta pantalla:
        cada quien ve únicamente los datos de su tenant.
      </p>

      {!MODO_AWS && <div className="login-alert">
        <TriangleAlert size={18} />
        <span>Falta <code>VITE_API_AUTH</code>. Copia <code>.env.example</code> a <code>.env.local</code> con las URLs de las APIs.</span>
      </div>}

      <form onSubmit={enviar}>
        <label className="field-label" htmlFor="l-tenant">Institución</label>
        <select id="l-tenant" value={tenant} onChange={(e) => cambiarTenant(e.target.value)}>
          {TENANTS.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.id}</option>)}
        </select>

        <label className="field-label" htmlFor="l-email">Correo</label>
        <input id="l-email" type="email" autoComplete="username" value={email}
          onChange={(e) => setEmail(e.target.value)} required />

        <label className="field-label" htmlFor="l-pass">Contraseña</label>
        <input id="l-pass" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />

        <div className="login-quick">
          <span className="muted">Usuarios de prueba:</span>
          {USUARIOS_DEMO.map((u) => (
            <button key={u.usuario} type="button" className="button secondary" onClick={() => usarDemo(u.usuario)}>
              {u.etiqueta}
            </button>
          ))}
        </div>

        {error && <div className="login-alert error" role="alert"><TriangleAlert size={18} /><span>{error}</span></div>}

        <button className="button primary login-submit" type="submit" disabled={enviando || !MODO_AWS}>
          {enviando ? 'Entrando…' : <><LogIn size={17} /> Iniciar sesión</>}
        </button>
      </form>

      <div className="login-foot">
        <GraduationCap size={16} />
        <span>
          Para la demostración de aislamiento, entra como <b>UTEC</b> y luego como <b>NORTE</b>
          {' '}(sus correos son <code>@inorte.edu.pe</code>).
        </span>
      </div>

      {MODO_AWS && faltantes.length > 0 && (
        <p className="login-missing">Sin configurar: {faltantes.join(', ')}. Esas secciones aparecerán vacías.</p>
      )}
    </div>
  </div>
}
