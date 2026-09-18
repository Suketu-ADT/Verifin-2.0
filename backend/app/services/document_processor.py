import fitz  # PyMuPDF
from typing import List, Dict, Any
import uuid

def process_pdf_document(file_path: str) -> List[Dict[str, Any]]:
    """
    Extracts text from a PDF document page by page.
    Returns a list of dictionaries with page numbers and text chunks.
    """
    pages_data = []
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text("text").strip()
            if text:
                pages_data.append({
                    "id": str(uuid.uuid4()),
                    "page_number": page_num + 1,
                    "text": text,
                    "embedding_reference": None
                })
        doc.close()
    except Exception as e:
        print(f"Error processing document: {e}")
    return pages_data
