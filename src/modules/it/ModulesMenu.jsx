import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Flash, Btn, Loading } from '@/components/ui'
import { DEPARTEMENTS, cleMaintenance } from '@/navigation'
import { MESSAGE_MAINTENANCE_DEFAUT } from '@/components/PageMaintenance'

/** Onglets que l’IT ne peut pas couper (sinon plus de levier). */
const PROTEGES = new Set(['modules_menu', 'helpdesk'])
/** Affichés via le même interrupteur que leur clé partagée. */
const ALIAS_CACHES = new Set(['ouvertures', 'flotte'])

export default function ModulesMenu() {
  const auth = useAuth()
  const { peutGererHelpdesk, modulesMaintenance, reloadModulesMaintenance } = auth
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(null)
  const [brouillon, setBrouillon] = useState({})

  useEffect(() => {
    const map = {}
    for (const [k, v] of Object.entries(modulesMaintenance || {})) {
      map[k] = v?.message || ''
    }
    setBrouillon(map)
  }, [modulesMaintenance])

  const lignes = useMemo(() => (
    DEPARTEMENTS.flatMap(d => d.modules.map(m => ({
      ...m,
      departement: d.label,
      deptId: d.id,
    })))
  ), [])

  if (!peutGererHelpdesk()) return <Navigate to="/app" replace />

  async function poser(key, actif, message) {
    setBusy(key)
    setMsg(null)
    const { error } = await supabase.from('app_modules_maintenance').upsert({
      module_key: key,
      actif,
      message: message?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'module_key' })
    setBusy(null)
    if (error) {
      setMsg({ kind: 'err', t: error.message })
      return
    }
    await reloadModulesMaintenance?.()
    setMsg({
      kind: 'ok',
      t: actif
        ? `« ${labelOf(key)} » est à nouveau ouvert aux volontaires.`
        : `« ${labelOf(key)} » est en maintenance pour les volontaires (vous gardez l’accès).`,
    })
  }

  function labelOf(key) {
    return lignes.find(l => l.key === key)?.label || key
  }

  if (!modulesMaintenance) return <div style={{ padding: 24 }}><Loading /></div>

  return (
    <Page
      title="Onglets & mises à jour"
      subtitle="Équipe informatique. Coupez un onglet pendant une mise à jour : les volontaires voient une page d’attente, vous gardez l’accès au contenu."
    >
      {msg && <Flash kind={msg.kind === 'err' ? 'err' : 'ok'}>{msg.t}</Flash>}
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.45 }}>
        Message vu par les volontaires (modifiable par onglet) : « {MESSAGE_MAINTENANCE_DEFAUT} »
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DEPARTEMENTS.map(d => {
          const mods = d.modules.filter(m => m.key !== 'modules_menu' && !ALIAS_CACHES.has(m.key))
          if (!mods.length) return null
          return (
            <section key={d.id} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '14px 16px',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 10 }}>
                {d.icon} {d.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mods.map(m => {
                  const cle = cleMaintenance(m.key)
                  const etat = modulesMaintenance[cle]
                  const actif = etat ? etat.actif !== false : true
                  const protege = PROTEGES.has(cle)
                  const noteAlias = cle === 'evenements'
                    ? 'Couvre aussi « Inscriptions ouvertes ».'
                    : cle === 'stock'
                      ? 'Couvre aussi « Flotte ».'
                      : null
                  return (
                    <div key={m.key} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 10,
                      alignItems: 'start',
                      padding: '10px 0',
                      borderTop: '1px solid var(--border)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>{m.icon} {m.label}</span>
                          {!actif && (
                            <span style={{
                              fontSize: 11.5, fontWeight: 700, color: '#BA7517',
                              background: '#FAEEDA', borderRadius: 6, padding: '2px 8px',
                            }}>
                              Maintenance
                            </span>
                          )}
                          {protege && (
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>toujours ouvert</span>
                          )}
                        </div>
                        {m.desc && (
                          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{m.desc}</div>
                        )}
                        {noteAlias && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{noteAlias}</div>
                        )}
                        {!actif && !protege && (
                          <textarea
                            value={brouillon[cle] ?? ''}
                            onChange={e => setBrouillon(s => ({ ...s, [cle]: e.target.value }))}
                            onBlur={() => {
                              const next = (brouillon[cle] || '').trim()
                              const prev = (etat?.message || '').trim()
                              if (next !== prev) poser(cle, false, next || null)
                            }}
                            rows={2}
                            placeholder={MESSAGE_MAINTENANCE_DEFAUT}
                            style={{
                              width: '100%', marginTop: 8, boxSizing: 'border-box',
                              borderRadius: 8, border: '1px solid var(--border)',
                              padding: '8px 10px', fontFamily: 'inherit', fontSize: 13,
                              background: 'var(--surface)', color: 'var(--text)',
                            }}
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {protege ? (
                          <Btn kind="soft" disabled>Ouvert</Btn>
                        ) : actif ? (
                          <Btn
                            kind="soft"
                            disabled={busy === cle}
                            onClick={() => poser(cle, false, brouillon[cle])}
                          >
                            {busy === cle ? '…' : 'Mettre en maintenance'}
                          </Btn>
                        ) : (
                          <Btn
                            disabled={busy === cle}
                            onClick={() => poser(cle, true, brouillon[cle])}
                          >
                            {busy === cle ? '…' : 'Réouvrir'}
                          </Btn>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
