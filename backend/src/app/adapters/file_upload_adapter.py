"""
Enhanced file upload adapter supporting 15+ file formats with smart parsing.

WHY: Handle diverse file formats with structure preservation
HOW: Format-specific processors with OCR and metadata extraction
BUILDS ON: Existing document_processing_service.py file processing

PSEUDOCODE:
-----------
from typing import Dict, Optional
import os
import magic
from PIL import Image
import pytesseract

class FileUploadAdapter(SourceAdapter):
    \"\"\"
    Enhanced file processing with smart parsing.

    SUPPORTED FORMATS:
    - Documents: PDF, DOCX, DOC, TXT, RTF, ODT
    - Presentations: PPTX, PPT
    - Spreadsheets: XLSX, XLS, CSV, TSV
    - Web: HTML, XML
    - Images: PNG, JPEG, BMP, TIFF, HEIC (with OCR)
    - Email: EML, MSG
    - E-books: EPUB
    - Markup: MD, RST, ORG

    FEATURES:
    - Smart content extraction preserving structure
    - Metadata extraction (author, creation date, etc.)
    - OCR for images and scanned PDFs
    - Table extraction and formatting
    - Multi-language support
    \"\"\"

    def __init__(self):
        self.supported_formats = {
            # Documents
            '.pdf': self._process_pdf,
            '.docx': self._process_docx,
            '.doc': self._process_doc,
            '.txt': self._process_txt,
            '.rtf': self._process_rtf,
            '.odt': self._process_odt,

            # Presentations
            '.pptx': self._process_pptx,
            '.ppt': self._process_ppt,

            # Spreadsheets
            '.xlsx': self._process_xlsx,
            '.xls': self._process_xls,
            '.csv': self._process_csv,
            '.tsv': self._process_tsv,

            # Web formats
            '.html': self._process_html,
            '.htm': self._process_html,
            '.xml': self._process_xml,

            # Images (with OCR)
            '.png': self._process_image_ocr,
            '.jpg': self._process_image_ocr,
            '.jpeg': self._process_image_ocr,
            '.bmp': self._process_image_ocr,
            '.tiff': self._process_image_ocr,
            '.heic': self._process_image_ocr,

            # Email
            '.eml': self._process_eml,
            '.msg': self._process_msg,

            # E-books
            '.epub': self._process_epub,

            # Markup
            '.md': self._process_markdown,
            '.rst': self._process_rst,
            '.org': self._process_org
        }

    async def extract_content(self, source_config: Dict) -> DocumentContent:
        \"\"\"
        Extract content from uploaded file.

        source_config = {
            \"file_path\": \"/path/to/file.pdf\",
            \"original_filename\": \"document.pdf\",
            \"options\": {
                \"preserve_structure\": true,
                \"extract_tables\": true,
                \"ocr_language\": \"eng\",
                \"include_metadata\": true
            }
        }

        PROCESS:
        1. Detect file type by extension and MIME type
        2. Route to appropriate format-specific processor
        3. Extract content, metadata, and structure
        4. Apply OCR if needed for images/scanned PDFs
        5. Return standardized DocumentContent
        \"\"\"

        file_path = source_config[\"file_path\"]
        options = source_config.get(\"options\", {})

        # Detect file type
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext not in self.supported_formats:
            # Try to detect by MIME type
            file_type = magic.from_file(file_path, mime=True)
            file_ext = self._mime_to_extension(file_type)

        if file_ext not in self.supported_formats:
            raise ValueError(f\"Unsupported file format: {file_ext}\")

        # Process file with format-specific handler
        processor = self.supported_formats[file_ext]
        content = await processor(file_path, options)

        # Add file metadata
        file_stats = os.stat(file_path)
        content.metadata.update({
            \"file_size\": file_stats.st_size,
            \"file_extension\": file_ext,
            \"original_filename\": source_config.get(\"original_filename\"),
            \"processing_engine\": f\"enhanced_{file_ext[1:]}_processor\"
        })

        return content

    async def _process_pdf(self, file_path: str, options: Dict) -> DocumentContent:
        \"\"\"
        Enhanced PDF processing with table extraction and OCR.

        FEATURES:
        - Text extraction preserving structure
        - Table detection and extraction using PyMuPDF
        - OCR for scanned PDFs using Tesseract
        - Metadata extraction (author, title, etc.)

        PROCESS:
        1. Open PDF with PyMuPDF (better than PyPDF2)
        2. Extract text and structure from each page
        3. Detect and extract tables
        4. Apply OCR to pages with sparse text
        5. Combine all content preserving page structure
        \"\"\"

        # Use PyMuPDF for better PDF handling
        doc = fitz.open(file_path)
        text_content = \"\"
        tables = []
        metadata = {}

        # Extract metadata
        pdf_metadata = doc.metadata
        if pdf_metadata:
            metadata.update({
                \"title\": pdf_metadata.get(\"title\", \"\"),
                \"author\": pdf_metadata.get(\"author\", \"\"),
                \"subject\": pdf_metadata.get(\"subject\", \"\"),
                \"creator\": pdf_metadata.get(\"creator\", \"\"),
                \"creation_date\": pdf_metadata.get(\"creationDate\", \"\"),
                \"modification_date\": pdf_metadata.get(\"modDate\", \"\")
            })

        # Process each page
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)

            # Extract text with structure preservation
            if options.get(\"preserve_structure\", True):
                page_text = self._extract_structured_pdf_text(page)
            else:
                page_text = page.get_text()

            text_content += f\"\\n\\n--- Page {page_num + 1} ---\\n\\n{page_text}\"

            # Extract tables if requested
            if options.get(\"extract_tables\", True):
                page_tables = self._extract_pdf_tables(page)
                tables.extend(page_tables)

            # OCR for sparse text pages
            if len(page_text.strip()) < 50 and options.get(\"ocr_enabled\", True):
                ocr_text = self._ocr_pdf_page(page, options)
                if ocr_text:
                    text_content += f\"\\n\\n[OCR Content from Page {page_num + 1}]\\n{ocr_text}\"

        doc.close()

        # Add tables to content
        if tables and options.get(\"include_tables\", True):
            text_content += \"\\n\\n--- Extracted Tables ---\\n\\n\"
            for i, table in enumerate(tables):
                text_content += f\"Table {i + 1}:\\n{table}\\n\\n\"

        return DocumentContent(
            text=text_content.strip(),
            metadata={
                **metadata,
                \"page_count\": len(doc),
                \"tables_found\": len(tables),
                \"processing_method\": \"pymupdf_enhanced\"
            },
            preview=text_content[:500],
            word_count=len(text_content.split()),
            character_count=len(text_content),
            page_count=len(doc)
        )

    async def _process_xlsx(self, file_path: str, options: Dict) -> DocumentContent:
        \"\"\"
        Process Excel files with multiple sheet support.

        FEATURES:
        - All sheets or specific sheets
        - Header detection and preservation
        - Data type preservation
        - Formula extraction
        - Cell formatting information

        PROCESS:
        1. Read all sheets using pandas
        2. Process each sheet preserving structure
        3. Extract formulas and formatting if requested
        4. Combine into readable text format
        \"\"\"

        # Read all sheets
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names

        content_text = f\"Excel file with {len(sheet_names)} sheets:\\n\\n\"
        metadata = {
            \"sheet_names\": sheet_names,
            \"total_sheets\": len(sheet_names)
        }

        # Process each sheet
        for sheet_name in sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)

            content_text += f\"## Sheet: {sheet_name}\\n\"
            content_text += f\"Dimensions: {df.shape[0]} rows x {df.shape[1]} columns\\n\\n\"

            # Convert to text format
            if options.get(\"include_data\", True):
                max_rows = options.get(\"max_rows_per_sheet\", 1000)
                df_limited = df.head(max_rows)
                content_text += df_limited.to_string(index=False)
                content_text += \"\\n\\n\"

            # Add column information
            content_text += f\"Columns: {', '.join(df.columns.tolist())}\\n\\n\"

        return DocumentContent(
            text=content_text,
            metadata=metadata,
            preview=content_text[:500],
            word_count=len(content_text.split()),
            character_count=len(content_text)
        )

    async def _process_image_ocr(self, file_path: str, options: Dict) -> DocumentContent:
        \"\"\"
        Process images with OCR.

        FEATURES:
        - Multiple language support
        - Text region detection
        - Confidence scoring
        - Layout preservation

        PROCESS:
        1. Open image with PIL
        2. Configure OCR based on language settings
        3. Extract text with confidence scores
        4. Preserve layout information
        5. Return structured text content
        \"\"\"

        # Open image
        image = Image.open(file_path)

        # OCR configuration
        ocr_lang = options.get(\"ocr_language\", \"eng\")
        ocr_config = f\"--oem 3 --psm 6 -l {ocr_lang}\"

        # Extract text
        extracted_text = pytesseract.image_to_string(image, config=ocr_config)

        # Get confidence data
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        # Image metadata
        image_metadata = {
            \"image_size\": image.size,
            \"image_mode\": image.mode,
            \"ocr_language\": ocr_lang,
            \"ocr_confidence\": avg_confidence,
            \"text_regions\": len([conf for conf in confidences if conf > 50])
        }

        if extracted_text.strip():
            content = f\"[OCR Extracted Text from Image]\\n\\n{extracted_text}\"
        else:
            content = \"[No text detected in image]\"

        return DocumentContent(
            text=content,
            metadata=image_metadata,
            preview=content[:500],
            word_count=len(content.split()),
            character_count=len(content)
        )

    async def _process_docx(self, file_path: str, options: Dict) -> DocumentContent:
        \"\"\"
        Process Word documents with structure preservation.

        FEATURES:
        - Heading hierarchy preservation
        - Table extraction
        - Image captions
        - Comments and tracked changes
        - Style information
        \"\"\"

        # Use python-docx for structure-aware processing
        doc = Document(file_path)
        content_parts = []
        tables = []

        # Process document elements in order
        for element in doc.element.body:
            if element.tag.endswith('p'):  # Paragraph
                paragraph = self._process_docx_paragraph(element, options)
                if paragraph:
                    content_parts.append(paragraph)
            elif element.tag.endswith('tbl'):  # Table
                table = self._process_docx_table(element, options)
                if table:
                    tables.append(table)
                    if options.get(\"include_tables_inline\", True):
                        content_parts.append(f\"\\n[Table]\\n{table}\\n\")

        content = \"\\n\\n\".join(content_parts)

        return DocumentContent(
            text=content,
            metadata={
                \"document_type\": \"docx\",
                \"tables_found\": len(tables),
                \"processing_method\": \"python_docx_structured\"
            },
            preview=content[:500],
            word_count=len(content.split()),
            character_count=len(content)
        )

    # Additional format processors would follow similar patterns...
    # Each format gets a dedicated processor with format-specific optimizations

    def get_source_metadata(self, source_config: Dict) -> Dict:
        \"\"\"Get file upload metadata\"\"\"
        file_path = source_config.get(\"file_path\", \"\")
        file_ext = os.path.splitext(file_path)[1].lower()

        return {
            \"source_type\": \"file_upload\",
            \"file_extension\": file_ext,
            \"supported\": file_ext in self.supported_formats,
            \"capabilities\": {
                \"preserves_structure\": file_ext in ['.pdf', '.docx', '.html'],
                \"extracts_tables\": file_ext in ['.pdf', '.xlsx', '.csv'],
                \"supports_ocr\": file_ext in ['.png', '.jpg', '.pdf'],
                \"extracts_metadata\": True
            }
        }

    def can_update(self) -> bool:
        \"\"\"File uploads cannot be auto-updated\"\"\"
        return False

    def validate_config(self, source_config: Dict) -> bool:
        \"\"\"Validate file upload configuration\"\"\"
        if \"file_path\" not in source_config:
            return False

        file_path = source_config[\"file_path\"]
        if not os.path.exists(file_path):
            return False

        file_ext = os.path.splitext(file_path)[1].lower()
        return file_ext in self.supported_formats

    def _mime_to_extension(self, mime_type: str) -> str:
        \"\"\"Convert MIME type to file extension\"\"\"
        mime_mapping = {
            \"application/pdf\": \".pdf\",
            \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\": \".docx\",
            \"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\": \".xlsx\",
            \"text/plain\": \".txt\",
            \"text/html\": \".html\",
            \"image/png\": \".png\",
            \"image/jpeg\": \".jpg\",
            # Add more mappings as needed
        }
        return mime_mapping.get(mime_type, \".unknown\")

    def _extract_structured_pdf_text(self, page) -> str:
        \"\"\"Extract text preserving structure from PDF page\"\"\"
        # Use PyMuPDF's text extraction with layout information
        blocks = page.get_text(\"dict\")
        formatted_text = self._format_pdf_blocks(blocks)
        return formatted_text

    def _format_pdf_blocks(self, blocks) -> str:
        \"\"\"Format PDF blocks preserving structure\"\"\"
        # Process text blocks maintaining hierarchy
        # Detect headings by font size/weight
        # Preserve spacing and formatting
        pass

    def _extract_pdf_tables(self, page) -> List[str]:
        \"\"\"Extract tables from PDF page\"\"\"
        # Use PyMuPDF or tabula-py for table extraction
        # Return formatted table strings
        pass

    def _ocr_pdf_page(self, page, options: Dict) -> str:
        \"\"\"Apply OCR to PDF page\"\"\"
        # Convert page to image and apply OCR
        pix = page.get_pixmap()
        image_data = pix.tobytes()
        return self._ocr_image_data(image_data, options)

    def _ocr_image_data(self, image_data: bytes, options: Dict) -> str:
        \"\"\"Apply OCR to image data\"\"\"
        # Convert bytes to PIL Image and apply Tesseract OCR
        pass
"""