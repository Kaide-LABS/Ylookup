import os
import shutil
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from extractor import FinancialTableExtractor
from marker.models import create_model_dict

app_data = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app_data["models"] = create_model_dict()
    app_data["extractor"] = FinancialTableExtractor(app_data["models"])
    app_data["jobs"] = {}
    os.makedirs("tmp", exist_ok=True)
    yield
    del app_data["models"]


app = FastAPI(title="UDINA Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def process_pdf(job_id: str, filepath: str, force_ocr: bool = False):
    try:
        extractor = app_data["extractor"]
        result = extractor.extract(filepath, force_ocr=force_ocr)
        app_data["jobs"][job_id] = {
            "status": "completed",
            **result,
        }
    except Exception as e:
        app_data["jobs"][job_id] = {
            "status": "failed",
            "error": str(e),
        }
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.post("/extract-tables")
async def extract_tables(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    force_ocr: Optional[bool] = Form(default=False),
):
    job_id = str(uuid.uuid4())
    filepath = f"tmp/{job_id}_{file.filename}"

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    app_data["jobs"][job_id] = {"status": "processing"}
    background_tasks.add_task(process_pdf, job_id, filepath, force_ocr)

    return {"job_id": job_id}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    if job_id not in app_data["jobs"]:
        return {"status": "not_found"}
    return app_data["jobs"][job_id]


@app.get("/health")
def health():
    return {"status": "ok"}
