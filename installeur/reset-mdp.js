// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// ════════════════════════════════════════════════════════════════════════════
//  Réinitialiser un mot de passe (méthode fiable via l'API Admin, sans e-mail).
//  Usage :  node reset-mdp.js
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })
const ask = (q, def='') => rl.question(def ? `${q} [${def}] : ` : `${q} : `).then(r => r.trim() || def)

const main = async () => {
  console.log('\n=== Réinitialisation de mot de passe ===\n')
  const URL   = await ask('URL du serveur Supabase (https://xxxx.supabase.co)')
  const KEY   = await ask('Clé service_role (secrète)')
  const EMAIL = await ask('E-mail du compte', 'laurent.noulin.volontariat@gmail.com')
  const PWD   = await ask('Nouveau mot de passe temporaire', 'LNO2311')
  const FORCE = (await ask('Forcer le changement à la prochaine connexion ? (o/n)', 'o')).toLowerCase().startsWith('o')
  rl.close()

  const sb = createClient(URL, KEY)

  // 1) retrouver l'utilisateur par e-mail
  const { data: list, error: lErr } = await sb.auth.admin.listUsers()
  if (lErr) { console.error('❌ ' + lErr.message); process.exit(1) }
  const user = list?.users?.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (!user) { console.error('❌ Aucun compte avec cet e-mail.'); process.exit(1) }

  // 2) fixer le mot de passe (+ confirmer l'e-mail au cas où)
  const { error: uErr } = await sb.auth.admin.updateUserById(user.id, { password: PWD, email_confirm: true })
  if (uErr) { console.error('❌ ' + uErr.message); process.exit(1) }

  // 3) forcer le changement à la connexion
  if (FORCE) await sb.from('profiles').update({ doit_changer_mdp: true }).eq('id', user.id)

  console.log(`\n✅ Mot de passe réinitialisé pour ${EMAIL}.`)
  console.log(`   Connectez-vous avec : ${PWD}`)
  if (FORCE) console.log('   Un nouveau mot de passe vous sera demandé à la connexion.\n')
}
main().catch(e => { console.error('❌ ' + (e.message || e)); process.exit(1) })
