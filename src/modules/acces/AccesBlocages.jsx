import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Btn, F, TA, Flash, Loading, Pill } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cleAppareil } from '@/lib/appareil'

export default function AccesBlocages() {
  const { peutBloquerAcces, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [userId, setUserId] = useState('')
  const [appareil, setAppareil] = useState('')
  const [motif, setMotif] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data }, { data: profils }] = await Promise.all([
      supabase.from('acces_blocages').select('*').eq('actif', true).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,prenom,nom,email,actif').neq('role', 'partenaire').order('nom'),
    ])
    setRows(data || [])
    setUsers(profils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (!peutBloquerAcces?.()) {
    return <Page title="Blocages d’accès"><Flash>Réservé au staff des souhaits, à la présidence et à l’informatique.</Flash></Page>
  }

  async function bloquer() {
    setBusy(true); setErr(null)
    if (!userId && !appareil.trim()) {
      setErr('Choisissez un utilisateur et/ou une clé d’appareil.')
      setBusy(false)
      return
    }
    if (!motif.trim() || motif.trim().length < 5) {
      setErr('Indiquez un motif (5 caractères min.).')
      setBusy(false)
      return
    }
    const { error } = await supabase.from('acces_blocages').insert({
      user_id: userId || null,
      appareil_cle: appareil.trim() || null,
      motif: motif.trim(),
      bloque_par: profile?.id || null,
      actif: true,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setUserId(''); setAppareil(''); setMotif('')
    load()
  }

  async function lever(id) {
    await supabase.from('acces_blocages').update({ actif: false }).eq('id', id)
    load()
  }

  const nom = id => {
    const u = users.find(x => x.id === id)
    return u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email : id
  }

  return (
    <Page title="Blocages d’accès" subtitle="Compte et/ou appareil — staff souhaits, présidence, informatique.">
      {err && <Flash kind="err">{err}</Flash>}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Nouveau blocage</div>
        <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Utilisateur</label>
        <select className="ha-input" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">— (appareil seul) —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{`${u.prenom || ''} ${u.nom || ''}`.trim()} {u.email ? `· ${u.email}` : ''}{u.actif === false ? ' (inactif)' : ''}</option>
          ))}
        </select>
        <F label="Clé appareil (optionnel)" value={appareil} set={setAppareil} placeholder="Coller la clé affichée sur l’appareil" />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-4px 0 10px' }}>
          Cet appareil : <code style={{ fontSize: 11 }}>{cleAppareil() || '—'}</code>
          {' '}
          <Btn kind="soft" style={{ padding: '2px 8px' }} onClick={() => setAppareil(cleAppareil())}>Utiliser</Btn>
        </div>
        <TA label="Motif" value={motif} set={setMotif} rows={2} />
        <Btn onClick={bloquer} disabled={busy}>{busy ? '…' : 'Bloquer'}</Btn>
      </Card>

      {loading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.length === 0 && <Flash>Aucun blocage actif.</Flash>}
          {rows.map(r => (
            <Card key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.user_id ? nom(r.user_id) : 'Appareil seul'}</div>
                  {r.appareil_cle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Appareil · <code>{r.appareil_cle}</code></div>}
                  <div style={{ fontSize: 13, marginTop: 4 }}>{r.motif}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('fr-BE') : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Pill color="#A32D2D" bg="#FCEBEB">Bloqué</Pill>
                  <Btn kind="ok" onClick={() => lever(r.id)}>Lever</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}
