import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Studio téléphone",
  description: "Studio Heart's Angels : quatre agents spécialisés codent l'application téléphone sans changer le parcours ordinateur.",
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  local: {
    workspaceDir: "..",
  },
});
