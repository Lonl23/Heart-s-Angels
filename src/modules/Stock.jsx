import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Tabs, Pill, Empty, Loading, Flash, inp } from '@/components/ui'
import { TYPES_LIEU, MODES, VOLUMES_O2, PRESSION_PLEINE, PRESSION_ALERTE, lblLieu, lblMode, cheminLieux, enfantsDe, resteLabel } from './stock/stockSchema'
import { ApercuEtiq, telechargerWord, telechargerPng, copierPng, telechargerCsv } from './stock/QrImg'
import Scanner from './stock/Scanner'

export default function Stock() {
  const { peutGererStock } = useAuth()
  const gerer = peutGererStock()
  const [tab, setTab] = useState('lieux')
  const [lieux, setLieux] = useState([])
  const [cats, setCats] = useState([])
  const [unites, setUnites] = useState([])
  const [loading, setLoading] = useState(true)
  const [scan, setScan] = useState(null) // ranger | inventaire | null
  const [lieuCible, setLieuCible] = useState(null)
  const [flash, setFlash] = useState(null)
  const [err, setErr] = useState(null)
  const [inv, setInv] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [a, b, c] = await Promise.all([
      supabase.from('stock_lieux').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_catalogue').select('*').eq('actif', true).order('nom'),
      supabase.from('stock_unites').select('*, stock_catalogue(nom,mode,unite,volume_l), stock_lieux(nom)').order('created_at', { ascending: false }).limit(400),
    ])
    setLieux(a.data || [])
    setCats(b.data || [])
    setUnites((c.data || []).map(u => ({
      ...u,
      nom: u.stock_catalogue?.nom,
      mode: u.stock_catalogue?.mode,
      unite: u.stock_catalogue?.unite,
      volume_l: u.volume_l || u.stock_catalogue?.volume_l,
      lieu_nom: u.stock_lieux?.nom,
    })))
    setLoading(false)
    if (gerer) supabase.functions.invoke('alertes-stock', { body: { action: 'envoyer' } }).catch(() => {})
  }
  function ok(msg) { setFlash(msg); setErr(null); setTimeout(() => setFlash(null), 2500) }

  async function onScan(token) {
    if (scan === 'ranger') {
      if (token.startsWith('ha:l:')) {
        const { data } = await supabase.rpc('stock_scan', { p_token: token, p_action: 'lire', p_qte: 1, p_souhait: null, p_lieu: null })
        if (data?.lieu) { setLieuCible(data.lieu); ok('Lieu : ' + data.lieu.nom + ' — scannez maintenant l’article'); }
        else setErr(data?.error || 'Lieu inconnu')
        return
      }
      if (!lieuCible) { setErr('Scannez d’abord le QR du lieu.'); return }
      const { data, error } = await supabase.rpc('stock_scan', {
        p_token: token, p_action: 'ranger', p_qte: 1, p_souhait: null, p_lieu: lieuCible.id,
      })
      if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
      ok((data.unite?.nom || 'Article') + ' → ' + (lieuCible.nom))
      load()
      return
    }
    if (scan === 'inventaire') {
      const { data, error } = await supabase.rpc('stock_scan', { p_token: token, p_action: 'inventaire', p_qte: 1, p_souhait: null, p_lieu: null })
      if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
      setInv(data)
      setScan(null)
      setTab('inventaire')
    }
  }

  if (!gerer) {
    return (
      <Page title="Stock" subtitle="Réservé à la logistique.">
        <Empty title="Inventaire et recharge" hint="Le volontaire scanne le matériel utilisé depuis Mes missions. Les responsables rechargent et inventorient ici." />
      </Page>
    )
  }

  return (
    <Page title="Stock" subtitle="QR par pièce ou boîte. Nom et lot sur l’étiquette pour coller au bon endroit."
      action={<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn kind="soft" onClick={() => { setLieuCible(null); setScan('ranger') }}>Ranger (scan)</Btn>
        <Btn onClick={() => setScan('inventaire')}>Inventaire (scan lieu)</Btn>
      </div>}>
      {flash && <Flash>{flash}</Flash>}
      {err && <Flash kind="err">{err}</Flash>}
      {lieuCible && scan === 'ranger' && (
        <div style={{ fontSize:13.5, marginBottom:10, color:'var(--heading)' }}>Lieu cible : <strong>{lieuCible.nom}</strong> — scannez les articles à y placer.</div>
      )}
      <Tabs items={[
        { v:'lieux', l:'Lieux' },
        { v:'articles', l:'Types d’articles' },
        { v:'unites', l:'Pièces & boîtes' },
        { v:'alertes', l:'Alertes' },
        ...(inv ? [{ v:'inventaire', l:'Inventaire' }] : []),
      ]} value={tab} onChange={setTab} />

      {loading ? <Loading /> : (
        <>
          {tab === 'lieux' && <OngletLieux lieux={lieux} unites={unites} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'articles' && <OngletCatalogue cats={cats} lieux={lieux} unites={unites} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'unites' && <OngletUnites unites={unites} lieux={lieux} onChange={load} onOk={ok} onErr={setErr} />}
          {tab === 'alertes' && <OngletAlertes />}
          {tab === 'inventaire' && inv && <OngletInventaire inv={inv} onChange={load} />}
        </>
      )}
      {scan && (
        <Scanner
          titre={scan === 'ranger' ? (lieuCible ? 'Article à ranger ici' : 'D’abord le QR du lieu') : 'QR de l’emplacement'}
          onCode={onScan}
          onClose={() => setScan(null)}
        />
      )}
    </Page>
  )
}
