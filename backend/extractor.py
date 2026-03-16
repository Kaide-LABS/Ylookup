import time
import json
from marker.converters.table import TableConverter
from marker.config.parser import ConfigParser
from marker.output import text_from_rendered

class FinancialTableExtractor:
    def __init__(self, model_dict):
        self.model_dict = model_dict

    def extract(self, filepath, force_ocr=False):
        start_time = time.time()
        
        options = {
            "output_format": "json",
            "use_llm": True,
            "force_ocr": force_ocr
        }
        
        config_parser = ConfigParser(options)
        config_dict = config_parser.generate_config_dict()
        llm_service = config_parser.get_llm_service()
        
        converter = TableConverter(
            config=config_dict,
            artifact_dict=self.model_dict,
            processor_list=config_parser.get_processors(),
            renderer=config_parser.get_renderer(),
            llm_service=llm_service
        )
        
        rendered = converter(filepath)
        text, _, images = text_from_rendered(rendered)
        
        try:
            data = json.loads(text)
        except Exception:
            data = {"raw": text}
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        doc_content = text.lower()
        doc_type = "unknown"
        if "10-k" in doc_content:
            doc_type = "10-K"
        elif "trial balance" in doc_content:
            doc_type = "trial_balance"
        elif "schedule of debt" in doc_content or "debt schedule" in doc_content:
            doc_type = "debt_schedule"
            
        return {
            "document_type": doc_type,
            "tables": data if isinstance(data, list) else [data], 
            "page_count": getattr(rendered, 'page_count', 0),
            "processing_time_ms": processing_time_ms,
            "format": "json"
        }
