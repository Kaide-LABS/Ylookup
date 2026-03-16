# UDINA — Unstructured Data Ingestion and Normalization Agent

## Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-16
**Author:** Claude (Architect) — for Gemini (Implementor)
**Status:** Phase 3 Spec Ready

---

## 1. Overview

UDINA is a pre-processing tool that converts messy financial PDFs (10-Ks, trial balances, debt schedules) into structured, Ylookup-ready data. It does NOT touch Ylookup's core reconciliation engine — it feeds it.

**Target audience:** Daniel Fraai + Matthew Hill (Ylookup founders, non-technical domain experts).
**Demo goal:** Visually impressive, financially literate, zero-hallucination audit-trail thinking.

---

## 2. Architecture — Four-Agent Pipeline

```
PDF Upload -> Agent 1 (Triage + Extract) -> Agent 2 (Semantic Map) -> Agent 3 (Confidence Audit) -> Structured Output
```

| Agent | Model | Role | Why This Model |
|-------|-------|------|----------------|
| 1. Triage + Extract | Marker (LLM-hybrid w/ Gemini 2.5 Flash) | Classify doc type, extract tables via Marker's LLM-hybrid pipeline | 0.907 table accuracy in hybrid mode, native PDF vision, fast |
| 2. Semantic Entity Mapper | Gemini 2.5 Pro | Normalize extracted fields to GAAP taxonomy ("Gross Rev" -> "Revenue") | Large context window holds full GAAP ontology + extracted data |
| 3. Confidence Auditor | GPT-5-mini (OpenAI) | Score confidence per cell, flag anomalies, verify cross-references | Reasoning-intensive, low latency, cost-effective |
| Orchestrator | Next.js API routes (deterministic) | Route data between agents, manage pipeline state | No LLM needed — deterministic routing |

### Key Design Decision: Marker over raw Gemini Vision

Marker (`datalab-to/marker`) provides:
- Built-in LLM-hybrid table extraction (Gemini/Claude/OpenAI pluggable via `GoogleGeminiService`)
- `TableConverter` class extending `PdfConverter` with table-focused processors (`LLMTableProcessor`, `LLMTableMergeProcessor`, `LLMFormProcessor`, `LLMComplexRegionProcessor`)
- Built-in FastAPI server (`marker/scripts/server.py`) with `/marker/upload` endpoint accepting PDF file uploads
- `output_format` param supports `json`, `markdown`, `html`
- `force_ocr` param for scanned documents
- Returns `{ format, output, images, metadata, success }`

**Decision: Marker (LOCKED IN)**

---

## 3. Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16 (Turbopack) | Same as Sentinel |
| Styling | Tailwind CSS + Framer Motion | Same as Sentinel |
| Agent 1 (Extract) | Marker Python backend (FastAPI) | Use Marker's built-in server as base, extend with TableConverter |
| Agent 2 (Semantic) | `@google/genai` (Gemini 2.5 Pro) | Direct from Next.js API route |
| Agent 3 (Confidence) | `openai` SDK (GPT-5-mini) | Direct from Next.js API route |
| PDF handling | Marker handles internally | No need for unpdf |

### Architecture: Hybrid Stack

Unlike Sentinel (pure Next.js), UDINA needs a Python sidecar for Marker.

**Approach: Extend Marker's built-in FastAPI server** — Marker already ships `marker/scripts/server.py` with a working `/marker/upload` endpoint. We extend it with a custom `/extract-tables` endpoint that uses `TableConverter` instead of `PdfConverter` for table-focused extraction.

---

## 4. Phases

### Phase 1: Extraction Pipeline + Basic UI
### Phase 2: Semantic Entity Mapping
### Phase 3: Confidence Scoring + HITL Review
### Phase 4: Export + Demo Polish

---

## 5. Phase 1 Detailed Spec

**Goal:** Upload a PDF -> Marker extracts tables -> display raw extraction in UI

### 5.1 Backend (Python/FastAPI)

#### `backend/main.py`

```python
"""
FastAPI app extending Marker's server pattern using Async Polling.

Endpoints:
  POST /extract-tables — accepts PDF file upload, saves file, spawns background task, returns job_id immediately
  GET /status/{job_id} — returns extraction status ('processing', 'completed', 'failed') and data if completed
  GET /health — health check

Key implementation details:
- Use Marker's `create_model_dict()` in lifespan to preload models (same as marker/scripts/server.py)
- Use `TableConverter` instead of `PdfConverter` for table-focused extraction
- Use `ConfigParser` to generate config with `output_format="json"` and `use_llm=True`
- CORS enabled for localhost:3000 to allow direct uploads from Next.js
- Save uploaded files to temp dir, clean up after processing

Response schema for /status/{job_id}:
{
  "status": "completed",         # "processing", "completed", "failed"
  "document_type": str,          # "10-K", "trial_balance", "debt_schedule", "unknown"
  "tables": [
    {
      "page": int,
      "table_index": int,
      "headers": [str],
      "rows": [[str]],
      "raw_html": str,           # Marker's HTML table output
      "metadata": {}
    }
  ],
  "page_count": int,
  "processing_time_ms": int,
  "format": "json"
}
```

Reference the actual Marker server pattern from `marker/scripts/server.py`:
- `app_data["models"] = create_model_dict()` in lifespan
- `ConfigParser(options).generate_config_dict()` for config
- `config_parser.get_llm_service()` to get the Gemini LLM service
- `converter(filepath)` returns rendered output
- `text_from_rendered(rendered)` extracts text and images

Key difference from Marker's default server: use `TableConverter` instead of `PdfConverter`, parse the JSON output into the structured table schema above, and run in background with job tracking.

#### `backend/extractor.py`

```python
"""
Wrapper around Marker's TableConverter.

Class: FinancialTableExtractor
  - __init__: accepts model_dict (from create_model_dict())
  - extract(filepath, force_ocr=False) -> dict
    - Creates ConfigParser with: output_format="json", use_llm=True, force_ocr=force_ocr
    - Instantiates TableConverter with config, artifact_dict, processors, renderer, llm_service
    - Calls converter(filepath) to get rendered output
    - Parses JSON output into structured table format
    - Classifies document type based on extracted content (simple heuristic: look for keywords like "10-K", "trial balance", "schedule of debt")
    - Returns structured dict matching the response schema

Uses these Marker imports:
  from marker.converters.table import TableConverter
  from marker.config.parser import ConfigParser
  from marker.models import create_model_dict
  from marker.output import text_from_rendered
"""
```

#### `backend/requirements.txt`

```
marker-pdf
fastapi
uvicorn[standard]
python-multipart
```

#### Environment Variables

```
GEMINI_API_KEY=...          # Used by Marker's GoogleGeminiService
MARKER_LLM_SERVICE=marker.services.gemini.GoogleGeminiService
```

### 5.2 Frontend (Next.js)

#### `src/app/page.tsx`

Main page layout:
- Header: "UDINA" branding + subtitle "Financial Document Intelligence"
- `<UploadZone />` component — centered, prominent
- `<ExtractionResults />` component — appears after extraction completes
- State management: `useState` for file, loading, results, error, job_id
- Flow: upload file directly to FastAPI -> get job_id -> poll /status/{job_id} -> display results

#### `src/components/UploadZone.tsx`

Drag-and-drop PDF upload component:
- Accepts `.pdf` files only
- Framer Motion: subtle scale animation on drag-over, success checkmark animation
- States: idle, dragging, uploading, success, error
- Shows file name + size after selection
- "Extract Tables" button triggers direct upload to `http://localhost:8000/extract-tables` (bypassing Next.js API route)
- Max file size: 50MB

#### `src/components/ExtractionResults.tsx`

Displays extracted tables:
- Tab for each table found (Table 1, Table 2, etc.)
- Each table rendered as styled HTML table (from `raw_html`) with Tailwind
- Toggle button: "Formatted" / "Raw JSON" view
- Document type badge at top (e.g., "10-K Annual Report")
- Metadata: page count, processing time, number of tables found
- Empty state if no tables found

#### `src/components/ProcessingStatus.tsx`

Loading indicator during extraction (Polling state):
- Animated spinner/progress with Framer Motion
- Status text: "Uploading PDF..." -> "Extracting tables..." -> "Processing complete"
- Polling `http://localhost:8000/status/{job_id}` every 2 seconds until completion

### 5.3 Project Setup & Docker

```
/Ylookup
  /backend
    main.py
    extractor.py
    requirements.txt
    Dockerfile
  /src
    /app
      page.tsx
      layout.tsx
      globals.css
    /components
      UploadZone.tsx
      ExtractionResults.tsx
      ProcessingStatus.tsx
  package.json
  tsconfig.json
  tailwind.config.ts
  next.config.ts
  docker-compose.yml
```

### 5.4 Acceptance Criteria

- [ ] Can upload a financial PDF (10-K, trial balance, debt schedule) via drag-and-drop
- [ ] Marker extracts tables with LLM hybrid mode (Gemini)
- [ ] Extracted tables displayed as formatted HTML tables in UI
- [ ] Raw JSON toggle shows the underlying extraction data
- [ ] Document type classification shown (basic heuristic)
- [ ] Processing status indicator polls API until success/failure
- [ ] Error handling: backend down, invalid file type, extraction failure
- [ ] Both services start cleanly: `docker-compose up`

---

## 6. Phase 2 Detailed Spec — Semantic Entity Mapping

**Goal:** After Phase 1 extracts raw tables, Phase 2 sends them to Gemini 2.5 Pro to normalize field names/headers to a standardized GAAP taxonomy. The user sees a before/after mapping view with rationale per field.

### 6.1 New Dependency

Add to `package.json`:
```json
"@google/genai": "^1.0.0"
```

### 6.2 Environment

Add to `.env.local` and `docker-compose.yml` frontend env:
```
GEMINI_API_KEY=...   # Same key used by backend Marker, but now also used by Next.js
```

**Important:** This is a server-side env var (no `NEXT_PUBLIC_` prefix). The Gemini call happens in a Next.js API route, NOT in the browser.

### 6.3 Files to Create

#### `src/lib/gemini-client.ts`

```typescript
/**
 * Singleton Gemini client for server-side use in API routes.
 *
 * Usage:
 *   import { gemini } from "@/lib/gemini-client";
 *   const response = await gemini.models.generateContent({ ... });
 *
 * Implementation:
 *   import { GoogleGenAI } from "@google/genai";
 *   export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 */
```

#### `src/lib/gaap-ontology.ts`

```typescript
/**
 * GAAP standard taxonomy — the canonical field names we normalize TO.
 * This is the "target vocabulary" that Gemini maps extracted headers into.
 *
 * Export a flat array of objects:
 *
 * export const GAAP_TAXONOMY: GaapTerm[] = [...]
 *
 * interface GaapTerm {
 *   canonical: string;          // e.g. "Revenue"
 *   category: string;           // e.g. "Income Statement"
 *   aliases: string[];          // e.g. ["Gross Rev", "Net Revenue", "Total Revenue", "Sales"]
 *   description: string;        // e.g. "Total income from goods/services before deductions"
 * }
 *
 * Include at minimum these 20 terms across Income Statement, Balance Sheet, and Cash Flow:
 *
 * Income Statement:
 *   - Revenue (aliases: Gross Rev, Net Revenue, Total Revenue, Sales, Turnover, Net Sales)
 *   - Cost of Goods Sold (aliases: COGS, Cost of Sales, Cost of Revenue)
 *   - Gross Profit (aliases: Gross Margin, Gross Income)
 *   - Operating Expenses (aliases: OpEx, SG&A, Selling General & Administrative)
 *   - Stock-Based Compensation (aliases: SBC, Share-Based Compensation, Equity Compensation)
 *   - Depreciation and Amortization (aliases: D&A, Dep & Amort)
 *   - Operating Income (aliases: EBIT, Operating Profit, Income from Operations)
 *   - Interest Expense (aliases: Int Exp, Finance Costs)
 *   - Net Income (aliases: Net Profit, Net Earnings, Bottom Line, PAT, Profit After Tax)
 *   - Earnings Per Share (aliases: EPS, Basic EPS, Diluted EPS)
 *
 * Balance Sheet:
 *   - Cash and Cash Equivalents (aliases: Cash & Equiv, Cash on Hand, Liquid Assets)
 *   - Accounts Receivable (aliases: A/R, Trade Receivables, Debtors)
 *   - Total Assets (aliases: Total Consolidated Assets)
 *   - Accounts Payable (aliases: A/P, Trade Payables, Creditors)
 *   - Long-Term Debt (aliases: LT Debt, Non-Current Borrowings, Long-Term Borrowings)
 *   - Total Liabilities (aliases: Total Consolidated Liabilities)
 *   - Stockholders' Equity (aliases: Shareholders' Equity, Total Equity, Net Assets)
 *
 * Cash Flow:
 *   - Operating Cash Flow (aliases: CFO, Cash from Operations, Net Cash from Operating)
 *   - Capital Expenditures (aliases: CapEx, PP&E Purchases, Purchase of Property)
 *   - Free Cash Flow (aliases: FCF)
 *
 * This taxonomy is sent as context in the Gemini prompt. Gemini can also map to terms
 * NOT in this list if it recognizes a standard GAAP/IFRS term — the list is a hint, not a constraint.
 */
```

#### `src/app/api/normalize/route.ts`

```typescript
/**
 * POST /api/normalize
 *
 * Accepts: Phase 1 extraction results (the tables array from /status/{job_id})
 * Returns: Normalized mapping for each table's headers
 *
 * Request body:
 * {
 *   tables: Array<{ page: number, table_index: number, raw_html: string, ... }>
 * }
 *
 * Implementation:
 * 1. Import gemini client from "@/lib/gemini-client"
 * 2. Import GAAP_TAXONOMY from "@/lib/gaap-ontology"
 * 3. For each table, extract headers from raw_html (parse with a simple regex or DOMParser-like approach on server)
 *    - Alternatively, pass the raw_html directly to Gemini and let it identify + normalize headers
 * 4. Call gemini.models.generateContent() with:
 *    - model: "gemini-2.5-pro"
 *    - contents: A prompt containing:
 *      a) The GAAP_TAXONOMY as reference context
 *      b) The extracted table HTML
 *      c) Instruction: "For each column header and row label in this financial table,
 *         map it to the closest GAAP standard term. If no match, keep the original.
 *         Provide a brief rationale for each mapping."
 *    - config:
 *        responseMimeType: "application/json"
 *        responseJsonSchema: (the MappingResult schema below)
 *
 * Response JSON Schema (for Gemini structured output):
 * {
 *   type: "object",
 *   properties: {
 *     mappings: {
 *       type: "array",
 *       items: {
 *         type: "object",
 *         properties: {
 *           original_term: { type: "string" },
 *           canonical_term: { type: "string" },
 *           category: { type: "string" },
 *           confidence: { type: "number" },       // 0-1
 *           rationale: { type: "string" }
 *         },
 *         required: ["original_term", "canonical_term", "category", "confidence", "rationale"]
 *       }
 *     }
 *   },
 *   required: ["mappings"]
 * }
 *
 * API Route response:
 * {
 *   success: boolean,
 *   normalized_tables: [
 *     {
 *       page: number,
 *       table_index: number,
 *       mappings: MappingResult[],           // from Gemini
 *       raw_html: string,                     // original HTML passthrough
 *       normalized_html: string               // HTML with headers replaced by canonical terms
 *     }
 *   ]
 * }
 *
 * For normalized_html: do a simple string replace on the raw_html, swapping each
 * original_term with canonical_term. This gives the frontend both versions to display.
 *
 * Error handling:
 * - If Gemini fails, return { success: false, error: "..." }
 * - If a table has no recognizable headers, return it with empty mappings array
 */
```

#### `src/components/MappingView.tsx`

```typescript
/**
 * Visual before/after field mapping display.
 *
 * Props:
 * {
 *   normalizedTables: Array<{
 *     page: number,
 *     table_index: number,
 *     mappings: Array<{
 *       original_term: string,
 *       canonical_term: string,
 *       category: string,
 *       confidence: number,
 *       rationale: string
 *     }>,
 *     raw_html: string,
 *     normalized_html: string
 *   }>
 * }
 *
 * Layout:
 * - Tab bar for each table (reuse pattern from ExtractionResults)
 * - For the active table, show a two-column mapping list:
 *     LEFT column: original term (with strikethrough styling, muted color)
 *     Arrow icon (ArrowRight from lucide-react)
 *     RIGHT column: canonical GAAP term (bold, colored by category)
 *   - Below each mapping row: rationale text in small gray italic
 *   - Confidence shown as a colored dot: green >= 0.9, amber >= 0.7, red < 0.7
 *
 * - Below the mapping list: toggle between "Original Table" and "Normalized Table"
 *   - Original: render raw_html (sanitized with DOMPurify, same pattern as ExtractionResults)
 *   - Normalized: render normalized_html (sanitized)
 *
 * - Category legend at bottom grouping mappings by Income Statement / Balance Sheet / Cash Flow
 *   with colored badges (blue / green / purple)
 *
 * Animations:
 * - Framer Motion: mappings animate in with staggered fade + slide from left
 * - Arrow icon has a subtle pulse animation
 */
```

### 6.4 Files to Modify

#### `src/app/page.tsx`

Extend the page to support a two-step flow:

```typescript
/**
 * Updated state:
 *   - Add: normalizedData, isNormalizing
 *   - After extraction completes and results are shown, add a "Normalize to GAAP" button
 *   - Clicking it: POST results.tables to /api/normalize
 *   - While normalizing: show ProcessingStatus with text "Mapping to GAAP taxonomy..."
 *   - When complete: show MappingView below ExtractionResults
 *
 * Updated layout (after extraction):
 *   <ExtractionResults data={results} />
 *   {!normalizedData && !isNormalizing && (
 *     <button onClick={handleNormalize}>Normalize to GAAP</button>
 *   )}
 *   {isNormalizing && <ProcessingStatus text="Mapping to GAAP taxonomy..." />}
 *   {normalizedData && <MappingView normalizedTables={normalizedData.normalized_tables} />}
 */
```

#### `src/components/ProcessingStatus.tsx`

Make status text configurable:

```typescript
/**
 * Add optional prop: statusMessage?: string
 * If provided, display it instead of the default "Extracting tables..."
 * This allows reuse for Phase 2 ("Mapping to GAAP taxonomy...") and Phase 3
 *
 * Keep the polling behavior when jobId is provided (Phase 1 flow)
 * When jobId is NOT provided, just show the spinner + custom message (Phase 2 flow — no polling needed, the parent manages the async call)
 */
```

### 6.5 Data Flow

```
Phase 1 results (tables with raw_html)
  |
  v
User clicks "Normalize to GAAP"
  |
  v
POST /api/normalize { tables }
  |
  v
Next.js API route:
  - Sends each table's HTML + GAAP_TAXONOMY to Gemini 2.5 Pro
  - Gemini returns structured JSON: { mappings: [...] }
  - Route builds normalized_html by replacing terms
  |
  v
Response: { normalized_tables: [...] }
  |
  v
MappingView renders before/after
```

### 6.6 Project Structure After Phase 2

```
/Ylookup
  /backend                    (unchanged from Phase 1)
  /src
    /app
      page.tsx                 (MODIFIED — add normalize flow)
      layout.tsx
      globals.css
      /api
        /normalize
          route.ts             (NEW)
    /components
      UploadZone.tsx
      ExtractionResults.tsx
      ProcessingStatus.tsx     (MODIFIED — configurable status text)
      MappingView.tsx          (NEW)
    /lib
      gemini-client.ts         (NEW)
      gaap-ontology.ts         (NEW)
  package.json                 (MODIFIED — add @google/genai)
  .env.local                   (MODIFIED — add GEMINI_API_KEY)
```

### 6.7 Acceptance Criteria

- [ ] "Normalize to GAAP" button appears after extraction completes
- [ ] Clicking it calls Gemini 2.5 Pro via `/api/normalize` and returns structured mappings
- [ ] MappingView shows before/after for each header: original -> canonical GAAP term
- [ ] Each mapping shows rationale text and confidence dot (green/amber/red)
- [ ] Normalized table view replaces headers with canonical terms
- [ ] At least 10 common financial term variants are correctly normalized (test with a 10-K)
- [ ] Categories (Income Statement / Balance Sheet / Cash Flow) shown with colored badges
- [ ] Loading state shown during Gemini call ("Mapping to GAAP taxonomy...")
- [ ] Error handling: Gemini timeout/failure shows user-friendly error, extraction results preserved

---

## 7. Phase 3 Detailed Spec — Confidence Scoring + HITL Review

**Goal:** After Phase 2 normalizes fields, Phase 3 sends the normalized tables to GPT-5-mini (OpenAI) to score every cell's confidence, flag anomalies, and provide a human-in-the-loop review interface where the user can Accept/Reject/Edit flagged cells with a full audit trail.

### 7.1 New Dependency

Add to `package.json`:
```json
"openai": "^4.80.0"
```

### 7.2 Environment

Add to `.env.local` and `docker-compose.yml` frontend env:
```
OPENAI_API_KEY=...   # Server-side only (no NEXT_PUBLIC_ prefix)
```

### 7.3 Files to Create

#### `src/lib/openai-client.ts`

```typescript
/**
 * Singleton OpenAI client for server-side use in API routes.
 *
 * Implementation:
 *   import OpenAI from "openai";
 *   export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 */
```

#### `src/app/api/audit/route.ts`

```typescript
/**
 * POST /api/audit
 *
 * Accepts: Phase 2 normalized tables (the normalized_tables array)
 * Returns: Confidence-scored cells with anomaly flags
 *
 * Request body:
 * {
 *   normalized_tables: Array<{
 *     page: number,
 *     table_index: number,
 *     mappings: Array<{ original_term, canonical_term, ... }>,
 *     raw_html: string,
 *     normalized_html: string
 *   }>
 * }
 *
 * Implementation:
 * 1. Import openai client from "@/lib/openai-client"
 * 2. For each normalized table:
 *    a) Use cheerio to parse normalized_html and extract a structured representation:
 *       - Array of rows, each row is an array of { cell_text, row_index, col_index, is_header }
 *    b) Call openai.chat.completions.create() with function calling for structured output:
 *       - model: "gpt-5-mini"
 *       - messages: [
 *           { role: "system", content: "You are an expert financial auditor reviewing extracted data
 *             from financial documents. Score each cell's extraction confidence and flag anomalies." },
 *           { role: "user", content: promptWithTableData }
 *         ]
 *       - User message containing:
 *         a) The structured table data (rows/cells)
 *         b) The field mappings from Phase 2 (for context)
 *         c) Instruction: "For each data cell (not headers), evaluate:
 *            - confidence (0-100): How likely is this value correctly extracted?
 *            - Consider: numeric format consistency, reasonable ranges for the field type,
 *              cross-reference consistency (e.g., do subtotals add up?), OCR artifacts
 *            - Flag cells below 95% confidence with a reason
 *            - Flag any anomalies: values that seem unreasonable for their field type,
 *              missing expected values, sign errors, unit mismatches"
 *       - tools: [{
 *           type: "function",
 *           function: {
 *             name: "score_cells",
 *             description: "Score confidence for each cell in the table",
 *             parameters: {
 *             type: "object",
 *             properties: {
 *               cell_scores: {
 *                 type: "array",
 *                 items: {
 *                   type: "object",
 *                   properties: {
 *                     row_index: { type: "number" },
 *                     col_index: { type: "number" },
 *                     cell_text: { type: "string" },
 *                     confidence: { type: "number", description: "0-100" },
 *                     flag: { type: "string", enum: ["none", "low_confidence", "anomaly", "format_issue"] },
 *                     reason: { type: "string", description: "Why flagged, empty if none" }
 *                   },
 *                   required: ["row_index", "col_index", "cell_text", "confidence", "flag", "reason"]
 *                 }
 *               },
 *               summary: {
 *                 type: "object",
 *                 properties: {
 *                   total_cells: { type: "number" },
 *                   flagged_count: { type: "number" },
 *                   average_confidence: { type: "number" },
 *                   cross_reference_issues: {
 *                     type: "array",
 *                     items: { type: "string" }
 *                   }
 *                 },
 *                 required: ["total_cells", "flagged_count", "average_confidence", "cross_reference_issues"]
 *               }
 *             },
 *             required: ["cell_scores", "summary"]
 *           }}
 *         }]
 *       - tool_choice: { type: "function", function: { name: "score_cells" } }
 *         // Forces the model to use the function, guaranteeing structured output
 *
 *    c) Extract the function call from the response:
 *       - Access response.choices[0].message.tool_calls[0].function.arguments
 *       - JSON.parse the arguments string to get { cell_scores, summary }
 *
 * 3. Build audited HTML using cheerio:
 *    - For each cell in the normalized_html, add data attributes:
 *      data-confidence="85" data-flag="low_confidence" data-reason="..."
 *    - Add CSS classes based on confidence:
 *      >= 95: no extra class (default green/clean)
 *      80-94: "bg-amber-50 border-amber-300" (amber)
 *      < 80: "bg-red-50 border-red-300" (red)
 *
 * API Route response:
 * {
 *   success: boolean,
 *   audited_tables: [
 *     {
 *       page: number,
 *       table_index: number,
 *       cell_scores: CellScore[],
 *       summary: { total_cells, flagged_count, average_confidence, cross_reference_issues },
 *       audited_html: string,          // HTML with confidence classes/data-attrs baked in
 *       normalized_html: string         // passthrough from Phase 2
 *     }
 *   ]
 * }
 *
 * Error handling:
 * - If OpenAI fails, return { success: false, error: "..." }
 * - Timeout: 60s per table (financial tables can be large)
 */
```

#### `src/components/ConfidenceHeatmap.tsx`

```typescript
/**
 * Renders an audited table as a confidence heatmap.
 *
 * Props:
 * {
 *   auditedTable: {
 *     audited_html: string,
 *     cell_scores: CellScore[],
 *     summary: { total_cells, flagged_count, average_confidence, cross_reference_issues }
 *   },
 *   onCellClick?: (cellScore: CellScore) => void   // Opens ReviewPanel for that cell
 * }
 *
 * Layout:
 * - Summary bar at top:
 *   - Average confidence as a percentage badge (green/amber/red based on value)
 *   - "X of Y cells flagged" count
 *   - Cross-reference issues listed as warning chips
 *
 * - Table rendering:
 *   DO NOT use dangerouslySetInnerHTML for the heatmap view.
 *   Instead, build the table from cell_scores data programmatically:
 *   - Render an HTML <table> using the cell_scores array
 *   - Each cell colored by confidence:
 *     >= 95: white/default background
 *     80-94: bg-amber-50, amber left border
 *     < 80: bg-red-50, red left border
 *   - Flagged cells are clickable (cursor-pointer, subtle hover effect)
 *   - Hovering a flagged cell shows a tooltip with the flag reason
 *   - Clicking a flagged cell triggers onCellClick callback
 *
 * - Legend at bottom:
 *   Green (>= 95%) | Amber (80-94%) | Red (< 80%)
 *
 * Animations:
 * - Framer Motion: cells fade in with staggered animation (similar to MappingView)
 * - Flagged cells have a subtle pulse on first render to draw attention
 */
```

#### `src/components/ReviewPanel.tsx`

```typescript
/**
 * Human-in-the-loop review interface for flagged cells.
 *
 * Props:
 * {
 *   cellScore: CellScore | null,       // Currently selected cell (null = panel closed)
 *   onAction: (action: ReviewAction) => void,
 *   onClose: () => void
 * }
 *
 * Types:
 * interface CellScore {
 *   row_index: number;
 *   col_index: number;
 *   cell_text: string;
 *   confidence: number;
 *   flag: "none" | "low_confidence" | "anomaly" | "format_issue";
 *   reason: string;
 * }
 *
 * interface ReviewAction {
 *   type: "accept" | "reject" | "edit";
 *   cell: CellScore;
 *   new_value?: string;           // Only for "edit" actions
 *   reviewer_note?: string;       // Optional note from reviewer
 *   timestamp: string;            // ISO timestamp
 * }
 *
 * Layout:
 * - Slide-in panel from the right (Framer Motion: animate x from 100% to 0)
 * - Header: "Review Cell" + close button (X icon)
 * - Cell info section:
 *   - Current value displayed prominently
 *   - Confidence score with colored badge
 *   - Flag type with icon (AlertTriangle for anomaly, AlertCircle for low_confidence, etc.)
 *   - Reason text from GPT
 * - Action buttons:
 *   - "Accept" (green) — confirms the value is correct despite low confidence
 *   - "Reject" (red) — marks the value as incorrect (will need manual correction later)
 *   - "Edit" (blue) — opens an inline text input to correct the value
 * - Optional reviewer note text area (small, collapsible)
 * - Each action creates a ReviewAction object with timestamp and passes to onAction
 *
 * Animations:
 * - Panel slides in from right with Framer Motion AnimatePresence
 * - Buttons have hover scale effect
 */
```

#### `src/lib/audit-trail.ts`

```typescript
/**
 * Client-side audit trail store.
 * Stores all review actions in memory (for demo purposes).
 * In production, this would persist to a database.
 *
 * Implementation:
 * - Simple module-level array that accumulates ReviewAction objects
 * - Export functions:
 *   addAction(action: ReviewAction): void
 *   getActions(): ReviewAction[]
 *   getActionsForCell(row: number, col: number, tableIndex: number): ReviewAction[]
 *   exportAuditTrail(): string  // Returns JSON string for download
 *   clearAuditTrail(): void
 *
 * Each action stored with:
 * {
 *   ...ReviewAction,
 *   table_index: number,        // Which table
 *   page: number,               // Which page
 * }
 *
 * This is intentionally simple — a plain array in a TS module.
 * React state in page.tsx references this via getActions() to trigger re-renders.
 */
```

### 7.4 Files to Modify

#### `src/app/page.tsx`

Extend to support a three-step flow:

```typescript
/**
 * Updated state:
 *   - Add: auditedData, isAuditing, selectedCell, auditActions
 *   - After normalization completes, add an "Audit Confidence" button
 *   - Clicking it: POST normalized_tables to /api/audit
 *   - While auditing: show ProcessingStatus with "Auditing cell confidence..."
 *   - When complete: show ConfidenceHeatmap below MappingView
 *   - Clicking a flagged cell in heatmap: opens ReviewPanel
 *   - ReviewPanel actions update auditActions state and audit-trail store
 *
 * Updated layout (after normalization):
 *   <ExtractionResults data={results} />
 *   <MappingView normalizedTables={normalizedData.normalized_tables} />
 *   {!auditedData && !isAuditing && normalizedData && (
 *     <button onClick={handleAudit}>Audit Confidence</button>
 *   )}
 *   {isAuditing && <ProcessingStatus statusMessage="Auditing cell confidence..." />}
 *   {auditedData && (
 *     <ConfidenceHeatmap
 *       auditedTable={auditedData.audited_tables[activeTab]}
 *       onCellClick={(cell) => setSelectedCell(cell)}
 *     />
 *   )}
 *   <AnimatePresence>
 *     {selectedCell && (
 *       <ReviewPanel
 *         cellScore={selectedCell}
 *         onAction={handleReviewAction}
 *         onClose={() => setSelectedCell(null)}
 *       />
 *     )}
 *   </AnimatePresence>
 *
 * handleReviewAction:
 *   - Adds action to audit-trail store via addAction()
 *   - Updates auditActions state to trigger re-render
 *   - If action.type === "edit", update the cell_text in auditedData
 *   - Close the ReviewPanel
 */
```

#### `src/components/MappingView.tsx`

Wire the `onOverride` callback (previously a no-op prop from Phase 2):

```typescript
/**
 * When a mapping has confidence < 0.7 (red dot), show a small "Edit" link next to it.
 * Clicking "Edit" opens an inline text input replacing the canonical_term.
 * On confirm, call onOverride(tableIndex, original_term, new_canonical).
 * This is the HITL override that Gemini suggested in Phase 2 feedback.
 *
 * Keep this minimal — just the inline edit, not a full modal.
 */
```

### 7.5 Data Flow

```
Phase 2 results (normalized_tables with mappings + normalized_html)
  |
  v
User clicks "Audit Confidence"
  |
  v
POST /api/audit { normalized_tables }
  |
  v
Next.js API route:
  - Parses each table with cheerio into structured cell data
  - Sends to GPT-5-mini via function calling for structured confidence scoring
  - GPT returns cell_scores + summary via function arguments
  - Route builds audited_html with confidence CSS classes
  |
  v
Response: { audited_tables: [...] }
  |
  v
ConfidenceHeatmap renders color-coded table
  |
  v
User clicks flagged cell -> ReviewPanel slides in
  |
  v
User chooses Accept/Reject/Edit -> ReviewAction logged to audit trail
```

### 7.6 Structured Output Pattern (OpenAI SDK)

The OpenAI SDK uses function calling for structured output. Key pattern:

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-5-mini",
  messages: [
    { role: "system", content: "You are an expert financial auditor..." },
    { role: "user", content: promptWithTableData }
  ],
  tools: [{
    type: "function",
    function: {
      name: "score_cells",
      description: "Score confidence for each cell in the table",
      parameters: { /* JSON Schema */ }
    }
  }],
  tool_choice: { type: "function", function: { name: "score_cells" } }
});

// Extract structured output
const toolCall = response.choices[0].message.tool_calls?.[0];
const result = JSON.parse(toolCall.function.arguments);
// result = { cell_scores: [...], summary: {...} }
```

`tool_choice: { type: "function", function: { name: "score_cells" } }` forces the model to always call the function, guaranteeing the response matches the schema.

### 7.7 Project Structure After Phase 3

```
/Ylookup
  /backend                         (unchanged)
  /src
    /app
      page.tsx                      (MODIFIED — add audit flow + ReviewPanel)
      layout.tsx
      globals.css
      /api
        /normalize
          route.ts
        /audit
          route.ts                  (NEW)
    /components
      UploadZone.tsx
      ExtractionResults.tsx
      ProcessingStatus.tsx
      MappingView.tsx               (MODIFIED — wire onOverride inline edit)
      ConfidenceHeatmap.tsx          (NEW)
      ReviewPanel.tsx                (NEW)
    /lib
      gemini-client.ts
      gaap-ontology.ts
      openai-client.ts              (NEW)
      audit-trail.ts                (NEW)
  package.json                      (MODIFIED — add openai)
  .env.local                        (MODIFIED — add OPENAI_API_KEY)
```

### 7.8 Acceptance Criteria

- [ ] "Audit Confidence" button appears after normalization completes
- [ ] GPT-5-mini scores every data cell with 0-100 confidence via function calling
- [ ] ConfidenceHeatmap renders cells with color coding: green (>= 95%), amber (80-94%), red (< 80%)
- [ ] Clicking a flagged cell opens ReviewPanel slide-in from right
- [ ] ReviewPanel shows cell value, confidence, flag type, and GPT's reason
- [ ] User can Accept, Reject, or Edit each flagged cell
- [ ] Edit action allows inline text correction of cell value
- [ ] Every review action logged to audit trail with timestamp
- [ ] Summary bar shows average confidence, flagged count, and cross-reference issues
- [ ] MappingView onOverride allows inline correction of low-confidence mappings (< 0.7)
- [ ] Loading state shown during OpenAI call ("Auditing cell confidence...")
- [ ] Error handling: OpenAI timeout/failure shows user-friendly error, prior results preserved

---

## 8. Phase 4 Spec (Preview)

**Goal:** Export to Ylookup-ready format, polish UI for pitch.

Files to create/modify:
- `src/app/api/export/route.ts` — Generate JSON/CSV in Ylookup schema
- `src/components/ExportPanel.tsx` — Download buttons + format preview
- `src/components/PipelineProgress.tsx` — 3-phase animated progress (Extract -> Map -> Audit)
- UI polish: animations, loading states, demo-ready styling

Acceptance criteria:
- One-click export to JSON/CSV
- Full pipeline progress indicator
- Audit trail downloadable
- Demo-ready for non-technical founders

---

## 9. Demo Script (What Founders See)

1. Open UDINA — clean, professional UI branded for Ylookup pitch
2. Upload a messy 10-K PDF — drag and drop, animated progress
3. Watch extraction happen — "Extracting tables..." -> "Mapping to GAAP..." -> "Auditing confidence..."
4. See results:
   - Extracted tables with confidence heatmap
   - Field mappings: "Gross Rev" -> "Revenue" with rationale
   - Flagged cells in amber requiring human review
5. Human review: Click Accept/Reject on flagged cells — audit trail logged
6. Export: One-click download of Ylookup-ready JSON
7. **Pitch line:** "This is the on-ramp to your platform. It eliminates the biggest friction point — turning unstructured chaos into structured data your engine can consume. It doesn't touch your IP. It feeds it."

---

## 10. Verification Checklist

- [ ] Upload a real 10-K PDF -> tables extracted correctly
- [ ] Upload a scanned trial balance -> OCR works, tables reconstructed
- [ ] Field mapping normalizes at least 10 common financial term variants
- [ ] Confidence scores render as heatmap, low-confidence cells flagged
- [ ] Export produces valid JSON matching a mock Ylookup schema
- [ ] Full pipeline completes in < 60 seconds for a 10-page document
- [ ] UI is demo-ready (no broken states, smooth animations)
