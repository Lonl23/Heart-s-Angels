import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "CEO records a brief for a small app using record-brief.",
  async test(t) {
    await t.send(
      'Enregistre un brief avec record-brief : app "demo", goal "smoke test", stage "intake", agents ["product"]. Réponds ensuite en une phrase.',
    );
    t.succeeded();
    t.calledTool("record-brief");
  },
});
