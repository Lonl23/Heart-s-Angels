import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `Security : RGPD, données patients, policies RLS, secrets, dépendances vulnérables. N1 lecture + N3 commandes d'audit locales. Signale ; ne déploie pas.`,
});
