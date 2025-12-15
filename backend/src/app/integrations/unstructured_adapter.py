"""
Unstructured Adapter - Universal document parsing integration.

WHY:
- Parse complex document formats (PDF, DOCX, PPT, etc.)
- Extract structured data from unstructured documents
- Better than basic parsers for complex layouts
- Handle tables, images, and formatting

HOW:
- Use Unstructured.io library or API
- Support various file formats
- Extract elements with hierarchy
- Preserve document structure

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional, List
import os


class UnstructuredAdapter:
    """
    Unstructured.io integration for document parsing.

    WHY: Advanced document parsing
    HOW: Use Unstructured library with fallback to API
    """

    def __init__(self):
        """
        Initialize Unstructured adapter.

        WHY: Setup parsing configuration
        HOW: Configure library or API settings
        """
        from app.core.config import settings

        self.api_key = getattr(settings, "UNSTRUCTURED_API_KEY", None)
        self.api_url = "https://api.unstructured.io/general/v0/general"
        self.use_api = self.api_key is not None


    async def parse_document(
        self,
        file_path: str,
        strategy: str = "auto"
    ) -> dict:
        """
        Parse document using Unstructured.

        WHY: Extract structured content from documents
        HOW: Use Unstructured library or API

        ARGS:
            file_path: Path to document file
            strategy: "auto" | "fast" | "hi_res" | "ocr_only"
                - auto: Automatic strategy selection
                - fast: Quick extraction (less accurate)
                - hi_res: High-resolution parsing (better accuracy)
                - ocr_only: OCR for scanned documents

        RETURNS:
            {
                "file_path": "/path/to/file.pdf",
                "title": "Document Title",
                "content": "Extracted text...",
                "elements": [
                    {
                        "type": "Title",
                        "text": "Section 1",
                        "metadata": {"page": 1}
                    },
                    {
                        "type": "NarrativeText",
                        "text": "Paragraph content...",
                        "metadata": {"page": 1}
                    }
                ],
                "metadata": {
                    "format": "pdf",
                    "pages": 10,
                    "tables": 3
                }
            }
        """

        if self.use_api:
            return await self._parse_with_api(file_path, strategy)
        else:
            return await self._parse_with_library(file_path, strategy)


    async def _parse_with_library(
        self,
        file_path: str,
        strategy: str
    ) -> dict:
        """
        Parse document using Unstructured library.

        WHY: Local parsing without API calls
        HOW: Use unstructured Python library
        """

        try:
            # Import unstructured (optional dependency)
            from unstructured.partition.auto import partition

            # Parse document
            elements = partition(
                filename=file_path,
                strategy=strategy
            )

            # Extract text and structure
            content_parts = []
            structured_elements = []

            for element in elements:
                element_dict = {
                    "type": element.category,
                    "text": str(element),
                    "metadata": element.metadata.to_dict() if hasattr(element, 'metadata') else {}
                }

                structured_elements.append(element_dict)
                content_parts.append(str(element))

            content = "\n\n".join(content_parts)

            # Extract title (first Title element)
            title = os.path.basename(file_path)
            for elem in structured_elements:
                if elem["type"] == "Title":
                    title = elem["text"]
                    break

            return {
                "file_path": file_path,
                "title": title,
                "content": content,
                "elements": structured_elements,
                "metadata": {
                    "format": os.path.splitext(file_path)[1].lower(),
                    "element_count": len(structured_elements)
                }
            }

        except ImportError:
            return {
                "file_path": file_path,
                "title": None,
                "content": None,
                "elements": [],
                "metadata": {
                    "error": "Unstructured library not installed. Use: pip install unstructured"
                }
            }
        except Exception as e:
            return {
                "file_path": file_path,
                "title": None,
                "content": None,
                "elements": [],
                "metadata": {"error": str(e)}
            }


    async def _parse_with_api(
        self,
        file_path: str,
        strategy: str
    ) -> dict:
        """
        Parse document using Unstructured API.

        WHY: Parse without local dependencies
        HOW: Upload file to API endpoint
        """

        import requests

        try:
            headers = {
                "unstructured-api-key": self.api_key
            }

            with open(file_path, "rb") as file:
                files = {"files": file}
                data = {"strategy": strategy}

                response = requests.post(
                    self.api_url,
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=120
                )

                response.raise_for_status()
                result = response.json()

            # Parse API response
            elements = []
            content_parts = []

            for elem in result:
                element_dict = {
                    "type": elem.get("type"),
                    "text": elem.get("text"),
                    "metadata": elem.get("metadata", {})
                }

                elements.append(element_dict)
                content_parts.append(elem.get("text", ""))

            content = "\n\n".join(content_parts)

            # Extract title
            title = os.path.basename(file_path)
            for elem in elements:
                if elem["type"] == "Title":
                    title = elem["text"]
                    break

            return {
                "file_path": file_path,
                "title": title,
                "content": content,
                "elements": elements,
                "metadata": {
                    "format": os.path.splitext(file_path)[1].lower(),
                    "element_count": len(elements)
                }
            }

        except Exception as e:
            return {
                "file_path": file_path,
                "title": None,
                "content": None,
                "elements": [],
                "metadata": {"error": str(e)}
            }


    async def parse_with_tables(
        self,
        file_path: str
    ) -> dict:
        """
        Parse document and extract tables.

        WHY: Preserve table structure
        HOW: Use hi_res strategy with table extraction

        RETURNS:
            {
                "content": "Text content...",
                "tables": [
                    {
                        "data": [["header1", "header2"], ["row1col1", "row1col2"]],
                        "page": 3,
                        "text": "Table as text..."
                    }
                ]
            }
        """

        result = await self.parse_document(file_path, strategy="hi_res")

        # Extract table elements
        tables = []
        for elem in result.get("elements", []):
            if elem["type"] == "Table":
                tables.append({
                    "text": elem["text"],
                    "page": elem["metadata"].get("page_number"),
                    "data": None  # Would need additional parsing
                })

        return {
            "content": result.get("content"),
            "tables": tables,
            "metadata": result.get("metadata")
        }


    def supported_formats(self) -> List[str]:
        """
        Get list of supported document formats.

        WHY: Document capabilities
        HOW: Return list of extensions

        RETURNS:
            List of supported file extensions
        """

        return [
            ".pdf", ".docx", ".doc", ".pptx", ".ppt",
            ".xlsx", ".xls", ".txt", ".html", ".htm",
            ".md", ".rtf", ".odt", ".epub", ".csv"
        ]


# Global instance
unstructured_adapter = UnstructuredAdapter()
