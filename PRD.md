# UDINA — Unstructured Data Ingestion and Normalization Agent

## Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-16
**Author:** Claude (Architect) — for Gemini (Implementor)
**Status:** Phase 1 Spec Ready

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
| 3. Confidence Auditor | Claude Sonnet 4.6 (or GPT 5 mini) | Score confidence per cell, flag anomalies, verify cross-references | Reasoning-intensive, low latency |
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
| Agent 3 (Confidence) | `@anthropic-ai/sdk` (Claude Sonnet 4.6) | Direct from Next.js API route |
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

## 6. Phase 2 Spec (Preview — detailed spec added before implementation)

**Goal:** Normalize extracted fields to GAAP taxonomy using Gemini 2.5 Pro.

Files to create/modify:
- `src/app/api/normalize/route.ts` — Gemini 2.5 Pro API route
- `src/lib/gaap-ontology.ts` — GAAP field mapping taxonomy (common financial term variants)
- `src/lib/gemini-client.ts` — Gemini client wrapper using `@google/genai`
- `src/components/MappingView.tsx` — Before/after field mapping visualization

Acceptance criteria:
- Extracted raw fields mapped to standardized GAAP terms
- Visual before/after: "Gross Rev" -> "Revenue", "SBC" -> "Stock-Based Compensation"
- Mapping rationale shown per field

---

## 7. Phase 3 Spec (Preview)

**Goal:** Score every extracted cell's confidence, flag low-confidence for human review.

Files to create/modify:
- `src/app/api/audit/route.ts` — Claude Sonnet 4.6 confidence scoring route
- `src/components/ConfidenceHeatmap.tsx` — Color-coded cell confidence
- `src/components/ReviewPanel.tsx` — Accept/reject interface for flagged cells

Acceptance criteria:
- Every cell has a confidence score (0-100%)
- Cells below 95% threshold flagged in amber/red
- Human can Accept/Reject/Edit flagged cells
- Audit trail logged for every human decision

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
