import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, Flash } from '@/components/ui'
import { PhotoArticle } from './photoStock'
import { calculerBesoinsMrp, nomenclaturesParLieu } from './mrpStock'
export default function OngletMrp({ cats, lieux, unites, dotations, onOk, onErr, onCommander, onGotoLieux }) {
  const [vue, setVue] = useState('besoins') // besoins | bom
  const [rpc, setRpc] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cmds, setCmds] = useState([])

  useEffect(() => { charger() }, [cats, lieux, unites, dotations])

  async function charger() {
    setBusy(true)
    setErr(null)
    const [r, c] = await Promise.all([
      supabase.rpc('stock_mrp_besoins'),
      supabase.from('stock_commandes').select('id,catalogue_id,quantite,statut').in('statut', ['a_commander', 'commandee', 'en_attente']),
    ])
    if (!c.error) setCmds(c.data || [])
    if (r.error || r.data?.ok === false) {
      // Fallback client (migration absente ou droit)
      const local = calculerBesoinsMrp({
        cats, lieux, unites, dotations, commandes: c.data || [],
      })
      setRpc(local)
      if (r.error) setErr('Calcul local (RPC MRP indisponible) : ' + (r.error.message || ''))
    } else {
      setRpc(r.data)
    }
    setBusy(false)
  }

  const lignes = rpc?.lignes || []
  const totaux = rpc?.totaux || { articles: 0, a_acheter: 0, a_doter: 0 }
  const bom = useMemo(() => nomenclaturesParLieu(lieux, cats, dotations), [lieux, cats, dotations])
  const aAcheter = lignes.filter(l => Number(l.a_acheter) > 0)
  const aDoter = lignes.filter(l => Number(l.a_doter) > 0)

  async function creerRappel(l) {
    const payload = {
      catalogue_id: l.catalogue_id,
      fournisseur_id: l.fournisseur_id || null,
      quantite: Math.max(1, Number(l.a_acheter) || 1),
      statut: 'a_commander',
      date_rappel: new Date().toISOString().slice(0, 10),
      notes: [
        'MRP',
        l.ref_fournisseur ? `Réf. ${l.ref_fournisseur}` : null,
        l.manque_bom ? `BOM −${l.manque_bom}` : null,
      ].filter(Boolean).join(' · '),
    }
    if (onCommander) {
      onCommander(payload)
      return
    }
    const { error } = await supabase.from('stock_commandes').insert(payload)
    if (error) { onErr?.(error.message); return }
    onOk?.('Rappel de commande créé.')
    charger()
  }

  return (
    <div>
      {err && <Flash kind="err">{err}</Flash>}
      <Card style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>MRP — planification matériel</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Nomenclatures (contenu prévu × quantité) + stocks mini + commandes ouvertes
          → besoins nets : <strong>à doter</strong> (réfection kits) et <strong>à acheter</strong> (réappro).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Btn kind={vue === 'besoins' ? 'primary' : 'soft'} onClick={() => setVue('besoins')}>Besoins nets</Btn>
          <Btn kind={vue === 'bom' ? 'primary' : 'soft'} onClick={() => setVue('bom')}>Nomenclatures</Btn>
          <Btn kind="soft" onClick={charger} disabled={busy}>{busy ? '…' : 'Recalculer'}</Btn>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13.5 }}>
          <span><strong>{totaux.articles || 0}</strong> articles concernés</span>
          <span style={{ color: '#A32D2D' }}><strong>{Number(totaux.a_acheter) || 0}</strong> à acheter</span>
          <span style={{ color: '#185FA5' }}><strong>{Number(totaux.a_doter) || 0}</strong> à doter / ranger</span>
          <span style={{ color: 'var(--text-muted)' }}>{cmds.length} commande(s) ouverte(s)</span>
        </div>
      </Card>

      {vue === 'besoins' && (
        <>
          <Section titre={`À acheter (${aAcheter.length})`} ton="#A32D2D">
            {aAcheter.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Rien à commander pour l’instant.</p>
            ) : aAcheter.map(l => (
              <LigneMrp key={l.catalogue_id} l={l} mode="acheter" onAction={() => creerRappel(l)} />
            ))}
          </Section>
          <Section titre={`À doter / ranger (${aDoter.length})`} ton="#185FA5">
            {aDoter.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Kits couverts ou stock insuffisant (passe en achat).</p>
            ) : aDoter.map(l => (
              <LigneMrp key={l.catalogue_id} l={l} mode="doter" onAction={onGotoLieux} />
            ))}
          </Section>
        </>
      )}

      {vue === 'bom' && (
        <Section titre={`Nomenclatures (${bom.length} emplacements)`} ton="var(--heading)">
          {bom.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Aucune nomenclature. Dans Lieux → Contenu prévu, cochez les articles et indiquez les quantités.
              {onGotoLieux && <> <button type="button" onClick={onGotoLieux} style={{ color: 'var(--accent)', background: 'none', border: 0, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Ouvrir les lieux</button></>}
            </p>
          ) : bom.map(g => (
            <Card key={g.lieu_id} style={{ padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ fontWeight: 650, marginBottom: 6 }}>{g.chemin || g.lieu?.nom || '—'}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {g.lignes.map(ligne => (
                  <li key={ligne.id || `${ligne.catalogue_id}`}>
                    <strong>{ligne.qte}</strong> × {ligne.article?.nom || 'Article'}
                    {ligne.article?.mode ? ` · ${ligne.article.mode}` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ titre, ton, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 700, color: ton, marginBottom: 8 }}>{titre}</div>
      {children}
    </div>
  )
}

function LigneMrp({ l, mode, onAction }) {
  return (
    <Card style={{ padding: '10px 14px', marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <PhotoArticle path={l.photo_path} size={44} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600 }}>{l.nom}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Dispo {l.qte_dispo} (réserve {l.qte_reserve} · mission {l.qte_mission})
            {' · '}mini {l.stock_minimal}/{l.stock_minimal_sacs}
            {l.manque_bom ? ` · BOM −${l.manque_bom}` : ''}
            {l.en_commande ? ` · cmd ${l.en_commande}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 1.1, color: mode === 'acheter' ? '#A32D2D' : '#185FA5' }}>
            {mode === 'acheter' ? l.a_acheter : l.a_doter}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mode === 'acheter' ? 'à acheter' : 'à doter'}</div>
        </div>
      </div>
      {onAction && (
        <div style={{ marginTop: 8 }}>
          <Btn onClick={onAction} style={{ padding: '5px 10px' }}>
            {mode === 'acheter' ? 'Créer un rappel de commande' : 'Voir les lieux / ranger'}
          </Btn>
        </div>
      )}
    </Card>
  )
}
