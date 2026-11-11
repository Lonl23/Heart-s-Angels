import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `QA : écrit et lance les tests, edge cases, régressions. N2 sur fichiers de tests + N3 pour exécuter. Déléguer après un build ou avant verifier.`,
});
