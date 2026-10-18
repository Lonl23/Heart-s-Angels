import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, TA, Loading } from '@/components/ui'
import { resteLabel, lblCommande, estMateriel, lblEntretien } from './stockSchema'
import CommandeSuivi from './CommandeSuivi'
import { PhotoArticle } from './photoStock'
import { sacsIncomplets } from './dotationStock'
import { fmtDlc } from './lotsStock'

function LieuLot({ u }) {
  const lieu = u.lieu_chemin || u.lieu_nom
  return (
    <span>
      {u.lot ? `lot ${u.lot}` : ''}
      {u.lot && lieu ? ' · ' : ''}
      {lieu || ''}
      {u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ''}
    </span>
  )
}

export default function OngletAlertes({ cats, fournisseurs, lieux, unites, dotations, onOk, onErr, onPerime, onCommander }) {
  const [a, setA] = useState(null)
  const [cmds, setCmds] = useState([])
  const [edit, setEdit] = useState(null)
  const [voirFermees, setVoirFermees] = useState(false)
  const [suiviId, setSuiviId] = useState(null)

  async function load() {
    const [{ data }, c] = await Promise.all([
      supabase.rpc('stock_alertes'),
      supabase.from('stock_commandes').select('*, stock_catalogue(nom,photo_path,mode,nature), stock_fournisseurs(nom)')
        .order('date_rappel', { ascending: true, nullsFirst: false }).limit(200),
    ])
    setA(data)
    setCmds((c.data || []).map(x => ({
      ...x,
      article: x.stock_catalogue?.nom,
      photo_path: x.stock_catalogue?.photo_path,
      fournisseur_nom: x.stock_fournisseurs?.nom,
    })))
  }
  useEffect(() => {
    load()
    const ch = supabase
      .channel('ha-stock-alertes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_unites' }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_catalogue' }, () => { load() })
      .subscribe()
    const t = setInterval(load, 20000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [])

  async function statutCmd(cmd, statut) {
    const patch = { statut }
    if (statut === 'commandee' && !cmd.date_commande) patch.date_commande = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('stock_commandes').update(patch).eq('id', cmd.id)
    if (error) { onErr?.(error.message); return }
    onOk?.(statut === 'recue' ? 'Commande reçue — faites une réception pour créer les QR.' : 'Commande mise à jour.')
    load()
  }

  if (!a) return <Loading />
  const ouvertes = cmds.filter(c => c.statut === 'a_commander' || c.statut === 'commandee')
  const cmdsAffichees = voirFermees ? cmds : ouvertes
  const incomplets = sacsIncomplets(lieux, cats, dotations, unites)
  const j15 = a.proches_j15 || []
  const bouteilles = a.o2_bouteilles || []
  const entretiens = a.entretiens || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, color: '#854F0B', marginBottom: 8 }}>
          Entretiens du matériel ({entretiens.length})
        </div>
        {entretiens.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun entretien dû dans les 30 jours.</div>
        ) : entretiens.map((u, i) => (
          <Card key={u.id || i} style={{ padding: '10px 14px', marginBottom: 6 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={u.photo_path} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.nom}{u.numero_serie ? ` · n° ${u.numero_serie}` : ''}</div>
                <div style={{ fontSize: 12.5, color: u.en_retard ? '#A32D2D' : '#854F0B' }}>
                  {lblEntretien(u.type)}
                  {u.date_fait ? ` · fait le ${fmtDlc(u.date_fait)}` : ''}
                  {u.date_prochain ? ` · prochain ${fmtDlc(u.date_prochain)}` : ''}
                  {u.en_retard ? ' · en retard' : ' · dans les 30 jours'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {u.lieu_chemin || u.lieu_nom || 'sans lieu'}
                  {u.lot ? ` · lot ${u.lot}` : ''}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: 700, color: '#BA7517', marginBottom: 8 }}>
          Péremptions à J-15 ({j15.length})
        </div>
        {j15.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun lot n’expire dans les 15 jours.</div>
        ) : j15.map((u, i) => (
          <Card key={u.id || i} style={{ padding: '10px 14px', marginBottom: 6 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={u.photo_path} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.nom}</div>
                <div style={{ fontSize: 12.5, color: '#BA7517' }}><LieuLot u={u} /></div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: 700, color: '#A32D2D', marginBottom: 8 }}>
          Périmés à retirer ({(a.perimes || []).length})
        </div>
        {(a.perimes || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Rien.</div>
        ) : (a.perimes || []).map((u, i) => (
          <Card key={u.id || i} style={{ padding: '10px 14px', marginBottom: 6 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={u.photo_path} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.nom}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}><LieuLot u={u} />{u.qte_restante != null ? ` · ${resteLabel(u)}` : ''}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <Btn kind="danger" onClick={async () => { await onPerime?.(u); load() }} style={{ padding: '5px 10px' }}>Retirer du stock</Btn>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: 700, color: '#185FA5', marginBottom: 8 }}>
          Bouteilles O2 ({bouteilles.length})
        </div>
        {bouteilles.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune bouteille en stock.</div>
        ) : bouteilles.map((u, i) => {
          const bas = Number(u.pression_bar) <= 50
          return (
            <Card key={u.id || i} style={{ padding: '10px 14px', marginBottom: 6 }}>
              <div className="ha-stock-row">
                <PhotoArticle path={u.photo_path} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{u.nom}{u.lot ? ` · lot ${u.lot}` : ''}</div>
                  <div style={{ fontSize: 12.5, color: bas ? '#A32D2D' : 'var(--text-muted)' }}>
                    {u.pression_bar == null ? '— bar' : `${Number(u.pression_bar)} bar`}
                    {u.niveau_pct != null ? ` · ${Number(u.niveau_pct)} %` : ''}
                    {u.capacite_l != null ? ` · ${Number(u.capacite_l)} L restants` : ''}
                    {u.volume_l ? ` (${Number(u.volume_l)} L)` : ''}
                    {bas ? ' — à recharger' : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {u.lieu_chemin || u.lieu_nom || 'sans lieu'}
                    {u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ''}
                  </div>
                  <div className="ha-o2-jauge" aria-hidden>
                    <span style={{ width: `${Math.min(100, Math.max(0, Number(u.niveau_pct) || 0))}%`, background: bas ? '#A32D2D' : '#185FA5' }} />
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div>
        <div style={{ fontWeight: 700, color: '#A32D2D', marginBottom: 8 }}>
          Sous le seuil — à commander ({(a.bas || []).length})
        </div>
        {(a.bas || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Rien.</div>
        ) : (a.bas || []).map((u, i) => (
          <Card key={`${u.id || i}-${u.zone || 'reserve'}`} style={{ padding: '10px 14px', marginBottom: 6 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={u.photo_path} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.nom}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Reste {u.reste} / mini {u.stock_minimal}
                  {u.zone === 'sacs' ? ' · sacs' : ' · réserve'}
                  {u.fournisseur_nom ? ` · ${u.fournisseur_nom}` : ''}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <Btn onClick={() => setEdit({
                catalogue_id: u.id,
                fournisseur_id: u.fournisseur_id || '',
                quantite: String(Math.max(Number(u.stock_minimal) - Number(u.reste) || 1, 1)),
                date_rappel: new Date().toISOString().slice(0, 10),
                notes: u.ref_fournisseur ? `Réf. ${u.ref_fournisseur}` : '',
                statut: 'a_commander',
              })} style={{ padding: '5px 10px' }}>Créer un rappel de commande</Btn>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--heading)' }}>Commandes ({ouvertes.length} ouvertes)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cmds.length > ouvertes.length && (
              <Btn kind="soft" onClick={() => setVoirFermees(v => !v)}>
                {voirFermees ? 'Masquer reçues / annulées' : 'Voir l’historique'}
              </Btn>
            )}
            <Btn onClick={() => setEdit({ catalogue_id: cats[0]?.id || '', fournisseur_id: '', quantite: '1', date_rappel: '', notes: '', statut: 'a_commander' })}>+ Rappel / commande</Btn>
          </div>
        </div>
        {edit && (
          <FormCommande item={edit} cats={cats} fournisseurs={fournisseurs}
            onDone={() => { setEdit(null); load() }} onOk={onOk} onErr={onErr} />
        )}
        {cmdsAffichees.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune commande enregistrée.</div> : cmdsAffichees.map(cmd => {
          const article = (cats || []).find(c => c.id === cmd.catalogue_id) || cmd.stock_catalogue
          const materiel = estMateriel(article)
          return (
          <Card key={cmd.id} style={{ padding: '10px 14px', marginBottom: 6, opacity: cmd.statut === 'annulee' || cmd.statut === 'recue' ? 0.65 : 1 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={cmd.photo_path} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{cmd.article}</strong>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{lblCommande(cmd.statut)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Qté {Number(cmd.quantite)}
                  {cmd.fournisseur_nom ? ` · ${cmd.fournisseur_nom}` : ''}
                  {materiel ? ' · matériel' : ' · consommable'}
                  {cmd.date_rappel ? ` · rappel ${cmd.date_rappel}` : ''}
                  {cmd.date_commande ? ` · commandé le ${cmd.date_commande}` : ''}
                  {materiel && cmd.garantie_fin ? ` · garantie jusqu’au ${cmd.garantie_fin}` : ''}
                </div>
                {cmd.notes && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{cmd.notes}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {cmd.statut === 'a_commander' && <Btn kind="soft" onClick={() => statutCmd(cmd, 'commandee')} style={{ padding: '5px 10px' }}>Marquer commandée</Btn>}
              {(cmd.statut === 'a_commander' || cmd.statut === 'commandee') && (
                <Btn onClick={() => { statutCmd(cmd, 'recue'); onCommander?.(cmd) }} style={{ padding: '5px 10px' }}>Reçue → réception</Btn>
              )}
              {cmd.statut !== 'annulee' && cmd.statut !== 'recue' && (
                <Btn kind="danger" onClick={() => statutCmd(cmd, 'annulee')} style={{ padding: '5px 10px' }}>Annuler</Btn>
              )}
              <Btn kind="soft" onClick={() => setSuiviId(id => id === cmd.id ? null : cmd.id)} style={{ padding: '5px 10px' }}>
                {suiviId === cmd.id ? 'Masquer le suivi' : 'Suivi et documents'}
              </Btn>
            </div>
            {suiviId === cmd.id && (
              <CommandeSuivi cmd={cmd} materiel={materiel} onOk={m => { onOk?.(m); load() }} onErr={onErr} />
            )}
          </Card>
          )
        })}
      </div>

      <div>
        <div style={{ fontWeight: 700, color: '#A32D2D', marginBottom: 8 }}>
          Sacs incomplets ({incomplets.length})
        </div>
        {incomplets.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Tous les contenus prévus sont en place, ou aucun contenu prévu n’est défini.
          </div>
        ) : incomplets.map(s => (
          <Card key={s.lieu.id} style={{ padding: '10px 14px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600 }}>{s.lieu.nom}</div>
            <div style={{ fontSize: 12.5, color: '#A32D2D', marginTop: 2 }}>
              {s.nbOk}/{s.nbPrevu} types en place
            </div>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {s.pochettes.filter(p => p.manque.length).map(p => (
                <li key={p.lieu.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{p.lieu.nom}</span>
                  {' — '}
                  {p.manque.slice(0, 4).map(c => c.nom).join(', ')}
                  {p.manque.length > 4 ? ` et ${p.manque.length - 4} autre${p.manque.length - 4 > 1 ? 's' : ''}` : ''}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {(a.proches || []).length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Péremption 16–90 jours ({a.proches.length})
          </div>
          {a.proches.map((u, i) => (
            <Card key={u.id || i} style={{ padding: '10px 14px', marginBottom: 6 }}>
              <div className="ha-stock-row">
                <PhotoArticle path={u.photo_path} size={44} />
                <div>
                  <div style={{ fontWeight: 600 }}>{u.nom}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}><LieuLot u={u} /></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function FormCommande({ item, cats, fournisseurs, onDone, onOk, onErr }) {
  const [f, setF] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.catalogue_id) { onErr?.('Choisissez un article.'); return }
    if (!(Number(f.quantite) > 0)) { onErr?.('Quantité invalide.'); return }
    setSaving(true)
    const { data: auth } = await supabase.auth.getUser()
    const article = cats.find(c => c.id === f.catalogue_id)
    const payload = {
      catalogue_id: f.catalogue_id,
      fournisseur_id: f.fournisseur_id || article?.fournisseur_id || null,
      quantite: Number(f.quantite),
      statut: f.statut || 'a_commander',
      date_rappel: f.date_rappel || null,
      notes: f.notes?.trim() || null,
      par: auth?.user?.id || null,
      garantie_debut: estMateriel(article) ? (f.garantie_debut || null) : null,
      garantie_fin: estMateriel(article) ? (f.garantie_fin || null) : null,
      garantie_notes: estMateriel(article) ? (f.garantie_notes?.trim() || null) : null,
    }
    const { error } = await supabase.from('stock_commandes').insert(payload)
    setSaving(false)
    if (error) { onErr?.(error.message); return }
    onOk?.('Rappel de commande enregistré.')
    onDone()
  }
  const optsCat = (cats || []).map(c => ({ v: c.id, l: c.nom }))
  const optsF = [{ v: '', l: '— Fournisseur de l’article —' }, ...(fournisseurs || []).filter(x => x.actif !== false).map(x => ({ v: x.id, l: x.nom }))]
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong>Nouveau rappel de commande</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <Sel label="Article" value={f.catalogue_id} set={v => setF(s => ({ ...s, catalogue_id: v }))} options={optsCat} />
      <Sel label="Fournisseur" value={f.fournisseur_id || ''} set={v => setF(s => ({ ...s, fournisseur_id: v }))} options={optsF} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Quantité" type="number" value={f.quantite} set={v => setF(s => ({ ...s, quantite: v }))} required />
        <F label="Date de rappel" type="date" value={f.date_rappel} set={v => setF(s => ({ ...s, date_rappel: v }))} />
      </div>
      <TA label="Notes" value={f.notes} set={v => setF(s => ({ ...s, notes: v }))} rows={2} placeholder="N° de commande, conditionnement…" />
      {estMateriel(cats.find(c => c.id === f.catalogue_id)) && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>Garantie du matériel. Elle ne s’affiche pas pour un consommable.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <F label="Garantie — début" type="date" value={f.garantie_debut || ''} set={v => setF(s => ({ ...s, garantie_debut: v }))} />
            <F label="Garantie — valide jusqu’au" type="date" value={f.garantie_fin || ''} set={v => setF(s => ({ ...s, garantie_fin: v }))} />
          </div>
        </>
      )}
      <Btn onClick={save} disabled={saving} style={{ width: '100%' }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}
