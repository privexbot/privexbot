"""
Source adapters for multi-source data ingestion.

WHY: Unified interface for all data sources (web, files, cloud, text)
HOW: Abstract base class with concrete implementations for each source type
BUILDS ON: Existing document_processing_service.py patterns

PSEUDOCODE:
-----------
from abc import ABC, abstractmethod

class DocumentContent:
    text: str
    metadata: Dict[str, Any]
    preview: str  # First 500 chars for UI preview
    word_count: int
    character_count: int
    page_count: Optional[int] = None
    source_specific_metadata: Optional[Dict[str, Any]] = None

class SourceAdapter(ABC):
    \"\"\"
    Abstract base class for all source adapters.

    WHY: Consistent interface regardless of source type
    HOW: Each source type implements this interface
    PATTERN: Strategy pattern for source handling
    \"\"\"

    @abstractmethod
    async def extract_content(source_config: Dict) -> DocumentContent:
        \"\"\"Extract content from source based on configuration\"\"\"
        pass

    @abstractmethod
    def get_source_metadata(source_config: Dict) -> Dict:
        \"\"\"Get source-specific metadata\"\"\"
        pass

    @abstractmethod
    def can_update() -> bool:
        \"\"\"Whether this source supports updates/re-sync\"\"\"
        pass

    @abstractmethod
    def validate_config(source_config: Dict) -> bool:
        \"\"\"Validate source configuration\"\"\"
        pass

# Adapter registry for factory pattern
ADAPTER_REGISTRY = {
    'web_scraping': WebScrapingAdapter,
    'file_upload': FileUploadAdapter,
    'cloud_integration': CloudIntegrationAdapter,
    'text_input': TextInputAdapter,
}

def get_adapter(source_type: str) -> SourceAdapter:
    \"\"\"Factory method to get appropriate adapter\"\"\"
    if source_type not in ADAPTER_REGISTRY:
        raise ValueError(f"Unsupported source type: {source_type}")

    return ADAPTER_REGISTRY[source_type]()
"""