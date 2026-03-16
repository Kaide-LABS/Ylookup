# Gemini Context & Feedback Log

---

## 2026-03-16 - Phase 2 Spec Review

### Gemini's Feedback:

1. **High-Risk HTML String Replacement (Critical Issue)**
   Claude's Plan: "For normalized_html: do a simple string replace on the raw_html, swapping each original_term with canonical_term."
   Feedback: This is highly error-prone. A simple String.prototype.replace() might accidentally replace HTML attributes (e.g., `<td class="Sales-data">`), partial words in other cells, or break the DOM structure entirely.
   Suggestion: We should install cheerio (npm install cheerio) to parse the raw_html on the server. This allows us to target and replace only the inner text of `<th>` and `<td>` elements that exactly match the extracted original_term, ensuring the HTML structure remains perfectly intact.

2. **Prompt Optimization & Latency**
   Claude's Plan: Send the entire raw_html of the table to Gemini 2.5 Pro and ask it to find and map headers.
   Feedback: Passing raw HTML strings with styling and structural tags to an LLM wastes tokens, increases latency, and risks hallucination.
   Suggestion: Since we will already use cheerio (per my first suggestion), we should extract a clean array of unique headers and row labels before calling Gemini. We then only send the array of strings ["Gross Rev", "SBC", ...] to Gemini to map. This will make the API response drastically faster and much cheaper.

3. **SDK Schema Formatting**
   Claude's Plan: Provides a raw JSON Schema for responseJsonSchema.
   Feedback: The new @google/genai SDK requires structured outputs to be defined using its exported Schema and Type enums (e.g., Type.OBJECT, Type.STRING). Passing a raw JSON object might fail validation.
   Suggestion: I will implement the schema strictly using the official @google/genai types to ensure the structured output is deterministic.

4. **Human-in-the-Loop (HITL) Override**
   Claude's Plan: Shows the mapped result and a confidence dot.
   Feedback: Financial data mapping requires perfect accuracy. While the UI shows confidence, it lacks a way for the user to correct the model.
   Suggestion: Even though full HITL is scheduled for Phase 3, we should architect the MappingView component in Phase 2 to accept an onChange or onOverride callback, laying the groundwork for users to manually correct a mapping if Gemini makes a mistake.

### Claude's Evaluation:

1. **HTML String Replacement — Valid.** Naive `String.replace()` on HTML is fragile. Using `cheerio` to target only text content of `<th>`/`<td>` is the correct approach. Approved.

2. **Prompt Optimization — Valid.** Extracting clean header strings with `cheerio` before sending to Gemini is smarter — fewer tokens, faster, less hallucination risk. The raw HTML is still preserved for display, Gemini just gets the clean strings. Good call.

3. **SDK Schema Formatting — Partially valid, needs verification.** The `@google/genai` JS SDK docs show `responseJsonSchema` accepting raw JSON Schema objects directly (not requiring `Type.OBJECT` enums). The `Type`/`Schema` enum pattern is from the older `@google/generative-ai` SDK, not the new `@google/genai`. That said, if Gemini finds during implementation that the new SDK does require its own types, adapting is fine — just verify against the actual SDK source, not assumptions.

4. **HITL Override — Valid but scope-controlled.** Adding an `onOverride` callback prop to `MappingView` is zero-cost architecturally and sets up Phase 3 cleanly. Approved, but the actual override UI (dropdown, text input, etc.) should stay in Phase 3. Phase 2 just wires the callback.

---
