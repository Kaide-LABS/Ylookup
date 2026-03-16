import os
import shutil
import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from extractor import FinancialTableExtractor

app = FastAPI(title="UDINA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_data = {}

@app.on_event("startup")
def startup_event():
    app_data["models"] = {}
    app_data["extractor"] = FinancialTableExtractor(app_data["models"])
    app_data["jobs"] = {}
    os.makedirs("tmp", exist_ok=True)

def process_pdf(job_id: str, filepath: str):
    try:
        extractor = app_data["extractor"]
        result = extractor.extract(filepath)
        app_data["jobs"][job_id] = {
            "status": "completed",
            **result
        }
    except Exception as e:
        app_data["jobs"][job_id] = {
            "status": "failed",
            "error": str(e)
        }
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@app.post("/extract-tables")
async def extract_tables(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    filepath = f"tmp/{job_id}_{file.filename}"
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    app_data["jobs"][job_id] = {"status": "processing"}
    background_tasks.add_task(process_pdf, job_id, filepath)
    
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    if job_id not in app_data["jobs"]:
        return {"status": "not_found"}
    return app_data["jobs"][job_id]

@app.get("/health")
def health():
    return {"status": "ok"}
