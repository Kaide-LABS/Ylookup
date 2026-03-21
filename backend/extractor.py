import os
import re
import time
import json
import logging

from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MOCK_TABLE = {
    "page": 29,
    "table_index": 0,
    "raw_html": "<table><tr><th>Line Item</th><th>September 27, 2025</th><th>September 28, 2024</th><th>September 30, 2023</th></tr><tr><td>Net sales: Products</td><td>$307,003</td><td>$294,866</td><td>$298,085</td></tr><tr><td>Net sales: Services</td><td>109,158</td><td>96,169</td><td>85,200</td></tr><tr><td>Total net sales</td><td>416,161</td><td>391,035</td><td>383,285</td></tr><tr><td>Cost of sales: Products</td><td>194,116</td><td>185,233</td><td>189,282</td></tr><tr><td>Cost of sales: Services</td><td>26,844</td><td>25,119</td><td>24,855</td></tr><tr><td>Total cost of sales</td><td>220,960</td><td>210,352</td><td>214,137</td></tr><tr><td>Gross margin</td><td>195,201</td><td>180,683</td><td>169,148</td></tr><tr><td>Operating expenses: Research and development</td><td>34,550</td><td>31,370</td><td>29,915</td></tr><tr><td>Operating expenses: Selling, general and administrative</td><td>27,601</td><td>26,097</td><td>24,932</td></tr><tr><td>Total operating expenses</td><td>62,151</td><td>57,467</td><td>54,847</td></tr><tr><td>Operating income</td><td>133,050</td><td>123,216</td><td>114,301</td></tr><tr><td>Other income/(expense), net</td><td>(321)</td><td>269</td><td>(565)</td></tr><tr><td>Income before provision for income taxes</td><td>132,729</td><td>123,485</td><td>113,736</td></tr><tr><td>Provision for income taxes</td><td>20,719</td><td>29,749</td><td>16,741</td></tr><tr><td>Net income</td><td>$112,010</td><td>$93,736</td><td>$96,995</td></tr><tr><td>Earnings per share: Basic</td><td>$7.49</td><td>$6.11</td><td>$6.16</td></tr><tr><td>Earnings per share: Diluted</td><td>$7.46</td><td>$6.08</td><td>$6.13</td></tr><tr><td>Shares used in computing earnings per share: Basic</td><td>14,948,500</td><td>15,343,783</td><td>15,744,231</td></tr><tr><td>Shares used in computing earnings per share: Diluted</td><td>15,004,697</td><td>15,408,095</td><td>15,812,547</td></tr></table>",
}

EXTRACT_ALL_PROMPT = """You are a financial document table extractor. Analyze this entire PDF document and extract ALL financial data tables.

Focus on tables that contain NUMERICAL financial data, such as:
- Consolidated Statements of Operations / Income Statements
- Consolidated Balance Sheets
- Consolidated Statements of Cash Flows
- Consolidated Statements of Shareholders' Equity
- Consolidated Statements of Comprehensive Income
- Revenue breakdowns, segment data, tax schedules
- Any notes tables with numerical financial data

Do NOT extract:
- Table of contents
- Text-only tables (risk factors, descriptions without numbers)
- Signature pages
- Tables that are just lists without financial figures

For each table found, return a JSON object with:
- "page": the PDF page number (1-indexed)
- "table_index": integer starting at 0 for each table on that page
- "raw_html": the full table as an HTML <table> string with all headers (<th>) and data cells (<td>)

Rules:
- Preserve EXACT dollar amounts, percentages, and parenthetical negatives as shown
- Include ALL rows — never skip, truncate, or summarize
- Each table should be complete and self-contained

Return a JSON object with this structure:
{
  "document_type": "10-K" or "10-Q" or other classification,
  "tables": [array of table objects as described above]
}

Respond with ONLY the JSON, no markdown fences, no explanation."""


class FinancialTableExtractor:
    def __init__(self, model_dict=None):
        self.model_dict = model_dict
        self.mock_mode = os.environ.get("MOCK_EXTRACTION", "").lower() == "true"

        if not self.mock_mode:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY environment variable is required (or set MOCK_EXTRACTION=true)")
            self.client = genai.Client(api_key=api_key)
            self.model = "gemini-2.5-flash"

    def extract(self, filepath: str, force_ocr: bool = False) -> dict:
        start_time = time.time()

        if self.mock_mode:
            time.sleep(2)
            return {
                "document_type": "10-K",
                "tables": [MOCK_TABLE],
                "page_count": 1,
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "format": "json",
            }

        # Read the PDF file
        with open(filepath, "rb") as f:
            pdf_bytes = f.read()

        logger.info("Uploading entire PDF (%.1f MB) to Gemini in a single request...", len(pdf_bytes) / 1024 / 1024)

        # Send the ENTIRE PDF as one request — Gemini handles PDF natively
        # Retry up to 3 times on network errors (DNS, timeout, etc.)
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[
                        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                        EXTRACT_ALL_PROMPT,
                    ],
                )
                break
            except Exception as e:
                logger.warning("Gemini API attempt %d/%d failed: %s", attempt, max_retries, e)
                if attempt == max_retries:
                    raise
                time.sleep(2 * attempt)  # backoff: 2s, 4s

        raw = response.text.strip()
        logger.info("Gemini responded in %.1fs", time.time() - start_time)

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Failed to parse Gemini response as JSON: %s", raw[:500])
            return {
                "document_type": "unknown",
                "tables": [],
                "page_count": 0,
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "format": "json",
                "error": "Failed to parse extraction results",
            }

        tables = result.get("tables", [])
        doc_type = result.get("document_type", "unknown")

        processing_time_ms = int((time.time() - start_time) * 1000)
        logger.info(
            "Extraction complete: %d tables, doc_type=%s, %.1fs",
            len(tables), doc_type, processing_time_ms / 1000,
        )

        return {
            "document_type": doc_type,
            "tables": tables,
            "page_count": len(tables),  # approximate
            "processing_time_ms": processing_time_ms,
            "format": "json",
        }
