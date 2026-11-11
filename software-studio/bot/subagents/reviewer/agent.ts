import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `Reviewer N1 : revue de code, dette, risques. Signale sans corriger. Déléguer après un build, avant ou en parallèle de qa/security.`,
});
