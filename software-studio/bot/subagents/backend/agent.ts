import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `Backend N3 local : logique métier, tables, edge functions, auth. Uniquement environnements locaux. Déléguer pour schéma, RPC, functions, auth — jamais pour publier en prod.`,
});
