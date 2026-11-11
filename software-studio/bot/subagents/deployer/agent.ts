import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `Deployer N4 : seul agent autorisé à publier sur Supabase prod (migrations, RLS, edge functions, hosting). Uniquement après deploy-gate approved et go explicite de Laurent.`,
});
