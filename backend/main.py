import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from extractor import FinancialTableExtractor

app = FastAPI(title="UDINA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_data = {}

@app.on_event("startup")
def startup_event():
    mock_mode = os.environ.get("MOCK_EXTRACTION", "").lower() == "true"
    if not mock_mode and not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is required. "
            "Set MOCK_EXTRACTION=true to use mock data instead."
        )
    app_data["models"] = {}
    app_data["extractor"] = FinancialTableExtractor(app_data["models"])
    os.makedirs("tmp", exist_ok=True)

@app.post("/extract-tables")
async def extract_tables(file: UploadFile = File(...)):
    """Synchronous extraction — waits for Gemini to finish and returns results directly."""
    filepath = f"tmp/{uuid.uuid4()}_{file.filename}"

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        extractor = app_data["extractor"]
        result = extractor.extract(filepath)
        return {
            "status": "completed",
            **result,
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
        }
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@app.get("/health")
def health():
    return {"status": "ok"}
