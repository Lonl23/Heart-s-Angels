# software-studio

Studio logiciel Agent SDK (`@grok/agent-sdk`) : CEO + 19 spécialistes
pour créer et améliorer les applis (NexOS, Supabase, terrain AMU/ATNUP),
dont codage métier **RH**, **logistique**, **finance**, **secours** et coque **Android**.

Le prompt servi est `bot/instructions.md` (CEO). Les spécialistes sont
sous `bot/subagents/<id>/`.

## Loop

```bash
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk info --dir . --json
npx @grok/agent-sdk run --dir . --message "..."
npx @grok/agent-sdk eval --dir .
npm run check
npx @grok/agent-sdk dev
```

Node only — never Bun.

## Accréditations

Niveaux N1–N4 = consignes (les subagents héritent des outils du CEO).
Seul `deployer` (N4) publie en prod, et seulement après `deploy-gate`
`approved` + go explicite de Laurent.

## Do not

- Faire publier `backend` ou le CEO en prod.
- Laisser `reviewer` patcher le code.
- Activer les 14 agents pour un correctif trivial.
