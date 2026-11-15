import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Le studio lit la carte des parcours et ne modifie rien.",
  async test(t) {
    await t.send("Ne modifie aucun fichier. Quels agents du studio s'occupent de l'application téléphone ? Utilise l'outil parcours.");
    t.succeeded();
    t.calledTool("parcours");
    t.notCalledTool("edit");
  },
});
