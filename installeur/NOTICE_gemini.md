# Gemini — analyse documents médicaux / stupéfiants

L’app appelle l’Edge Function Supabase `analyser-document-medical`.
La clé API **ne doit jamais** être dans le front.

## Secret à poser (une fois)

1. Ouvrir [Supabase → Project Settings → Edge Functions → Secrets](https://supabase.com/dashboard/project/vppmvjqbzdeftrhdoert/settings/functions)
2. Ajouter :
   - `GEMINI_API_KEY` = clé [Google AI Studio](https://aistudio.google.com/apikey) (Gemini Developer API)
3. Optionnel : `GEMINI_MODEL` (défaut `gemini-3.5-flash-lite`)

Sans ce secret, l’analyse locale PDF texte continue de marcher ; les scans / photos / stups IA renvoient un message clair.

## Comportement app

| Mode | Local | Gemini |
|------|-------|--------|
| Traitements / protocole / infos | PDF texte d’abord | Si vide, scan ou image |
| Stupéfiants (remise) | — | Toujours (bouton Photo / PDF → IA) |

Toute proposition IA doit être **vérifiée** avant signature / envoi médical.
