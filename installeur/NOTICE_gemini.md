# Gemini — analyse documents médicaux / stupéfiants

L’app appelle l’Edge Function Supabase `analyser-document-medical`.
La clé API **ne doit jamais** être dans le front.

## Secret (côté serveur uniquement)

Préféré (comme le SMTP) : **Vault** `ha_gemini_api_key` + RPC `gemini_api_config()`  
(voir `147_gemini_vault.sql`). L’Edge lit d’abord `GEMINI_API_KEY` (secret Edge), sinon le Vault.

Alternative : [Edge Functions → Secrets](https://supabase.com/dashboard/project/vppmvjqbzdeftrhdoert/settings/functions) → `GEMINI_API_KEY`.

Optionnel : `GEMINI_MODEL` (défaut `gemini-3.5-flash-lite`).

**Ne jamais** coller la clé dans le front, le dépôt git, ou un ticket. Si elle a fuité, régénérer sur [AI Studio](https://aistudio.google.com/apikey) puis mettre à jour le Vault.

## Comportement app

| Mode | Local | Gemini |
|------|-------|--------|
| Traitements / protocole / infos | PDF texte d’abord | Si vide, scan ou image |
| Stupéfiants (remise) | — | Toujours (bouton Photo / PDF → IA) |

Toute proposition IA doit être **vérifiée** avant signature / envoi médical.
