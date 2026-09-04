// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// ════════════════════════════════════════════════════════════════════════════
//  INSTALLEUR — à lancer UNE FOIS à la mise en place d'un nouveau serveur.
//  Applique le schéma, crée le bucket de stockage et le premier compte admin.
//  Aucune dépendance Supabase CLI. Usage :  npm install  puis  npm start
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })
const ask = async (q, def = '') => {
  const r = (await rl.question(def ? `${q} [${def}] : ` : `${q} : `)).trim()
  return r || def
}

function lireSQL(nom) {
  return readFileSync(new URL('./' + nom, import.meta.url), 'utf8')
}

async function main() {
  console.log('\n=== Installation Heart\'s Angels ===\n')
  const SUPABASE_URL = await ask('URL du serveur Supabase (https://xxxx.supabase.co)')
  const SERVICE_KEY  = await ask('Clé service_role (secrète)')
  const DB_URL       = await ask('Chaîne de connexion PostgreSQL (postgresql://postgres:MDP@db.xxxx.supabase.co:5432/postgres)')
  console.log('\n-- Premier compte administrateur --')
  const ADMIN_EMAIL  = await ask('E-mail de l\'admin')
  const ADMIN_PWD    = await ask('Mot de passe provisoire de l\'admin')
  const ADMIN_PRENOM = await ask('Prénom de l\'admin', 'Admin')
  const ADMIN_NOM    = await ask('Nom de l\'admin', '')
  rl.close()

  if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL || !ADMIN_EMAIL || !ADMIN_PWD) {
    console.error('\n❌ Informations incomplètes. Installation annulée.'); process.exit(1)
  }

  // 1) Schéma SQL (connexion PostgreSQL directe)
  console.log('\n① Application du schéma…')
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(lireSQL('01_rebuild_interne.sql'))
    await client.query(lireSQL('02_acces_partenaire.sql'))
    await client.query(lireSQL('03_invitations.sql'))
    await client.query(lireSQL('04_checklist_traitements.sql'))
    await client.query(lireSQL('05_mission.sql'))
    await client.query(lireSQL('06_prises.sql'))
    await client.query(lireSQL('07_fiche_volontaire.sql'))
    await client.query(lireSQL('08_acces'))
    await client.query(lireSQL('09_missions_volontaires'))
    await client.query(lireSQL('10_mission_terrain.sql'))
    await client.query(lireSQL('11_photos_terrain.sql'))
    await client.query(lireSQL('12_calendrier_dispos.sql'))
    await client.query(lireSQL('13_dispos_equipe.sql'))
    await client.query(lireSQL('14_quals_implicites.sql'))
    await client.query(lireSQL('15_affectation_dispos.sql'))
    await client.query(lireSQL('16_stock_qr.sql'))
    await client.query(lireSQL('17_stock_oxygene.sql'))
    await client.query(lireSQL('18_stock_emporter.sql'))
    await client.query(lireSQL('19_calendrier_rdv_base.sql'))
    await client.query(lireSQL('20_roles_par_vecteur.sql'))
    await client.query(lireSQL('21_statuts_terrain.sql'))
    await client.query(lireSQL('22_checklist_extras.sql'))
    await client.query(lireSQL('23_parcours_terrain.sql'))
    await client.query(lireSQL('24_parcours_statuts.sql'))
    await client.query(lireSQL('25_statut_base_personnel.sql'))
    await client.query(lireSQL('26_stock_logistique.sql'))
    await client.query(lireSQL('27_stock_excel.sql'))
    await client.query(lireSQL('28_annuaire_beneficiaires.sql'))
    await client.query(lireSQL('29_stock_lots.sql'))
    console.log('   ✓ Schéma, fonctions et RLS appliqués.')
  } finally {
    await client.end()
  }

  // 2) Bucket de stockage
  console.log('② Création du bucket de stockage « uploads »…')
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const { error: bErr } = await sb.storage.createBucket('uploads', { public: false })
  if (bErr && !/already exists/i.test(bErr.message)) console.warn('   ⚠️ ' + bErr.message)
  else console.log('   ✓ Bucket prêt.')

  // 3) Premier compte admin
  console.log('③ Création du premier compte administrateur…')
  let adminId
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: ADMIN_EMAIL, password: ADMIN_PWD, email_confirm: true,
    user_metadata: { prenom: ADMIN_PRENOM, nom: ADMIN_NOM },
  })
  if (cErr && /already/i.test(cErr.message)) {
    // Déjà créé lors d'un précédent passage : on retrouve son id
    const { data: list } = await sb.auth.admin.listUsers()
    adminId = list?.users?.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())?.id
    console.log('   ℹ️ Admin déjà existant, mise à jour du profil.')
  } else if (cErr) { console.error('   ❌ ' + cErr.message); process.exit(1) }
  else { adminId = created.user.id }
  if (!adminId) { console.error('   ❌ Impossible de retrouver l\'admin.'); process.exit(1) }
  const { error: pErr } = await sb.from('profiles').upsert({
    id: adminId, email: ADMIN_EMAIL, prenom: ADMIN_PRENOM, nom: ADMIN_NOM,
    role: 'admin', doit_changer_mdp: true, actif: true,
  })
  if (pErr) { console.error('   ❌ ' + pErr.message); process.exit(1) }
  console.log('   ✓ Admin prêt (devra changer son mot de passe à la 1re connexion).')

  console.log('\n✅ Installation terminée — aucune autre étape technique.')
  console.log('   ⚠️ Dans Supabase → Authentication → désactivez « Confirm email »')
  console.log('      (obligatoire pour l\'inscription par code sans serveur mail).')
  console.log(`   Connectez-vous ensuite avec : ${ADMIN_EMAIL}\n`)
}

main().catch(e => { console.error('\n❌ Erreur : ' + (e.message || e)); process.exit(1) })
