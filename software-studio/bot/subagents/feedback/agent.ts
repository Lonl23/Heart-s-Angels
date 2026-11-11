import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    `Feedback N1 : trie les retours utilisateurs et les transforme en tickets pour product. Déléguer quand Laurent colle des retours, plaintes, ou notes de terrain.`,
});
