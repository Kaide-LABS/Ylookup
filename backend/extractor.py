import time
from marker.converters.table import TableConverter
from marker.config.parser import ConfigParser
from marker.output import json_to_html
from marker.schema import BlockTypes


class FinancialTableExtractor:
    def __init__(self, model_dict):
        self.model_dict = model_dict

    def _extract_tables_from_json(self, rendered):
        """Walk the JSONOutput tree and extract table blocks with their HTML."""
        tables = []
        for page_idx, page in enumerate(rendered.children):
            if not page.children:
                continue
            table_idx = 0
            for block in page.children:
                if block.block_type in (str(BlockTypes.Table), str(BlockTypes.Form)):
                    html = json_to_html(block)
                    tables.append({
                        "page": page_idx + 1,
                        "table_index": table_idx,
                        "raw_html": html,
                        "block_type": block.block_type,
                        "bbox": block.bbox,
                    })
                    table_idx += 1
        return tables

    def _classify_document(self, tables):
        """Simple heuristic classification based on table content."""
        all_html = " ".join(t.get("raw_html", "") for t in tables).lower()
        if "10-k" in all_html:
            return "10-K"
        if "trial balance" in all_html:
            return "trial_balance"
        if "schedule of debt" in all_html or "debt schedule" in all_html:
            return "debt_schedule"
        return "unknown"

    def extract(self, filepath, force_ocr=False):
        start_time = time.time()

        options = {
            "output_format": "json",
            "use_llm": True,
            "force_ocr": force_ocr,
        }

        config_parser = ConfigParser(options)
        config_dict = config_parser.generate_config_dict()
        llm_service = config_parser.get_llm_service()

        converter = TableConverter(
            config=config_dict,
            artifact_dict=self.model_dict,
            processor_list=config_parser.get_processors(),
            renderer=config_parser.get_renderer(),
            llm_service=llm_service,
        )

        rendered = converter(filepath)
        tables = self._extract_tables_from_json(rendered)
        processing_time_ms = int((time.time() - start_time) * 1000)

        return {
            "document_type": self._classify_document(tables),
            "tables": tables,
            "page_count": converter.page_count,
            "processing_time_ms": processing_time_ms,
            "format": "json",
        }
