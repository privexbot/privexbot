"""
Text input adapter for direct text content.

WHY: Simple adapter for direct text input and text combination
HOW: Minimal processing with optional text enhancement
BUILDS ON: Existing document_processing_service.py text processing

PSEUDOCODE:
-----------
from typing import Dict, Optional

class TextInputAdapter(SourceAdapter):
    \"\"\"
    Simple adapter for direct text input.

    FEATURES:
    - Direct text input processing
    - Text cleaning and normalization
    - Language detection
    - Structure detection from plain text
    - Text combination from multiple sources
    \"\"\"

    async def extract_content(self, source_config: Dict) -> DocumentContent:
        \"\"\"
        Process direct text input.

        source_config = {
            \"text\": \"Raw text content...\",
            \"name\": \"Document name\",
            \"options\": {
                \"clean_text\": true,
                \"detect_language\": true,
                \"preserve_formatting\": true,
                \"detect_structure\": true
            }
        }

        PROCESS:
        1. Get raw text from config
        2. Apply text cleaning if requested
        3. Detect language and structure
        4. Preserve or normalize formatting
        5. Return standardized DocumentContent
        \"\"\"

        text = source_config.get(\"text\", \"\")
        name = source_config.get(\"name\", \"Text Input\")
        options = source_config.get(\"options\", {})

        if not text.strip():
            raise ValueError(\"Text content cannot be empty\")

        # Apply text processing based on options
        processed_text = text
        metadata = {}

        # Clean text if requested
        if options.get(\"clean_text\", True):
            processed_text = self._clean_text(processed_text)

        # Detect language if requested
        if options.get(\"detect_language\", True):
            language = self._detect_language(processed_text)
            metadata[\"detected_language\"] = language

        # Detect structure if requested
        if options.get(\"detect_structure\", True):
            structure_info = self._detect_text_structure(processed_text)
            metadata.update(structure_info)

        # Preserve or normalize formatting
        if options.get(\"preserve_formatting\", True):
            final_text = processed_text
        else:
            final_text = self._normalize_formatting(processed_text)

        return DocumentContent(
            text=final_text,
            metadata={
                \"source_name\": name,
                \"original_length\": len(text),
                \"processed_length\": len(final_text),
                \"processing_applied\": {
                    \"cleaned\": options.get(\"clean_text\", True),
                    \"language_detected\": options.get(\"detect_language\", True),
                    \"structure_detected\": options.get(\"detect_structure\", True)
                },
                **metadata
            },
            preview=final_text[:500],
            word_count=len(final_text.split()),
            character_count=len(final_text)
        )

    def _clean_text(self, text: str) -> str:
        \"\"\"
        Clean text content.

        CLEANING OPERATIONS:
        - Remove excessive whitespace
        - Normalize line breaks
        - Remove control characters
        - Fix encoding issues
        - Normalize Unicode
        \"\"\"

        import re
        import unicodedata

        # Normalize Unicode
        text = unicodedata.normalize('NFKC', text)

        # Remove control characters (except newlines and tabs)
        text = re.sub(r'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', text)

        # Normalize whitespace
        text = re.sub(r'[ \\t]+', ' ', text)  # Multiple spaces/tabs to single space
        text = re.sub(r'\\n\\s*\\n\\s*\\n+', '\\n\\n', text)  # Multiple newlines to double

        # Remove leading/trailing whitespace from lines
        lines = text.split('\\n')
        cleaned_lines = [line.rstrip() for line in lines]
        text = '\\n'.join(cleaned_lines)

        return text.strip()

    def _detect_language(self, text: str) -> str:
        \"\"\"
        Detect text language.

        PROCESS:
        1. Use language detection library (langdetect or polyglot)
        2. Return ISO language code
        3. Fallback to 'unknown' if detection fails
        \"\"\"

        try:
            # Would use langdetect or similar library
            # from langdetect import detect
            # return detect(text)

            # Simple heuristic for common languages
            if self._contains_mostly_ascii(text):
                return \"en\"  # Assume English for ASCII text
            else:
                return \"unknown\"

        except Exception:
            return \"unknown\"

    def _detect_text_structure(self, text: str) -> Dict:
        \"\"\"
        Detect structure in plain text.

        DETECTS:
        - Heading patterns (lines that look like headings)
        - List patterns (bullet points, numbered lists)
        - Code blocks (indented text)
        - Paragraphs and sections
        - Tables (aligned text)
        \"\"\"

        import re

        structure_info = {
            \"has_headings\": False,
            \"has_lists\": False,
            \"has_code\": False,
            \"has_tables\": False,
            \"paragraph_count\": 0,
            \"line_count\": len(text.split('\\n'))
        }

        lines = text.split('\\n')

        # Detect headings (lines that are short and followed by content)
        heading_patterns = [
            r'^[A-Z][^\\n]{5,50}:?$',  # Title case lines
            r'^\\d+\\.\\s+[A-Z][^\\n]{5,50}$',  # Numbered headings
            r'^[A-Z\\s]{5,50}$'  # ALL CAPS lines
        ]

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check heading patterns
            if any(re.match(pattern, line) for pattern in heading_patterns):
                structure_info[\"has_headings\"] = True

            # Check list patterns
            if re.match(r'^\\s*[-*•]\\s+', line) or re.match(r'^\\s*\\d+[.).]\\s+', line):
                structure_info[\"has_lists\"] = True

            # Check code patterns (lines starting with 4+ spaces or tabs)
            if re.match(r'^\\s{4,}\\S', line) or line.startswith('\\t'):
                structure_info[\"has_code\"] = True

            # Check table patterns (lines with multiple aligned columns)
            if '|' in line and line.count('|') >= 2:
                structure_info[\"has_tables\"] = True

        # Count paragraphs (non-empty blocks separated by empty lines)
        paragraphs = re.split(r'\\n\\s*\\n', text.strip())
        structure_info[\"paragraph_count\"] = len([p for p in paragraphs if p.strip()])

        return structure_info

    def _normalize_formatting(self, text: str) -> str:
        \"\"\"
        Normalize text formatting.

        NORMALIZATION:
        - Consistent paragraph spacing
        - Remove excessive formatting
        - Standardize line breaks
        \"\"\"

        import re

        # Normalize paragraph breaks
        text = re.sub(r'\\n\\s*\\n+', '\\n\\n', text)

        # Remove excessive spacing
        text = re.sub(r' {3,}', '  ', text)

        # Ensure consistent line endings
        text = text.replace('\\r\\n', '\\n').replace('\\r', '\\n')

        return text.strip()

    def _contains_mostly_ascii(self, text: str) -> bool:
        \"\"\"Check if text contains mostly ASCII characters\"\"\"
        ascii_chars = sum(1 for char in text if ord(char) < 128)
        total_chars = len(text)
        return (ascii_chars / total_chars) > 0.8 if total_chars > 0 else True

    def get_source_metadata(self, source_config: Dict) -> Dict:
        \"\"\"Get text input metadata\"\"\"
        return {
            \"source_type\": \"text_input\",
            \"supports_cleaning\": True,
            \"supports_language_detection\": True,
            \"supports_structure_detection\": True,
            \"capabilities\": {
                \"preserves_formatting\": True,
                \"detects_structure\": True,
                \"normalizes_text\": True,
                \"detects_language\": True
            }
        }

    def can_update(self) -> bool:
        \"\"\"Text input cannot be auto-updated\"\"\"
        return False

    def validate_config(self, source_config: Dict) -> bool:
        \"\"\"Validate text input configuration\"\"\"
        if \"text\" not in source_config:
            return False

        text = source_config[\"text\"]
        if not isinstance(text, str) or not text.strip():
            return False

        return True

class CombinedSourceAdapter(SourceAdapter):
    \"\"\"
    Special adapter for combining multiple sources into one document.

    WHY: Users want to combine content from different sources
    HOW: Takes multiple DocumentContent objects and combines them intelligently
    \"\"\"

    async def extract_content(self, source_config: Dict) -> DocumentContent:
        \"\"\"
        Combine multiple sources into unified document.

        source_config = {
            \"sources\": [
                {\"type\": \"file_upload\", \"content\": DocumentContent},
                {\"type\": \"web_scraping\", \"content\": DocumentContent},
                {\"type\": \"text_input\", \"content\": DocumentContent}
            ],
            \"combination_method\": \"concatenate\" | \"section_based\" | \"topic_based\",
            \"options\": {
                \"add_source_headers\": true,
                \"separator\": \"\\n\\n---\\n\\n\",
                \"preserve_metadata\": true,
                \"remove_duplicates\": false
            }
        }

        PROCESS:
        1. Get all source contents
        2. Apply combination method
        3. Add source attribution if requested
        4. Merge metadata from all sources
        5. Return unified DocumentContent
        \"\"\"

        sources = source_config.get(\"sources\", [])
        method = source_config.get(\"combination_method\", \"concatenate\")
        options = source_config.get(\"options\", {})

        if not sources:
            raise ValueError(\"No sources provided for combination\")

        if method == \"concatenate\":
            return self._concatenate_sources(sources, options)
        elif method == \"section_based\":
            return self._combine_by_sections(sources, options)
        elif method == \"topic_based\":
            return self._combine_by_topics(sources, options)
        else:
            raise ValueError(f\"Unsupported combination method: {method}\")

    def _concatenate_sources(self, sources: List[Dict], options: Dict) -> DocumentContent:
        \"\"\"
        Simple concatenation of sources.

        PROCESS:
        1. Add source headers if requested
        2. Join content with separator
        3. Combine metadata from all sources
        \"\"\"

        combined_parts = []
        combined_metadata = {
            \"combination_method\": \"concatenate\",
            \"source_count\": len(sources),
            \"sources\": []
        }

        separator = options.get(\"separator\", \"\\n\\n---\\n\\n\")
        add_headers = options.get(\"add_source_headers\", True)

        for i, source in enumerate(sources):
            source_content = source[\"content\"]
            source_type = source[\"type\"]

            # Add source header if requested
            if add_headers:
                header = f\"## Source {i + 1}: {source_type.replace('_', ' ').title()}\"
                combined_parts.append(header)

            combined_parts.append(source_content.text)

            # Collect metadata
            if options.get(\"preserve_metadata\", True):
                combined_metadata[\"sources\"].append({
                    \"type\": source_type,
                    \"metadata\": source_content.metadata,
                    \"word_count\": source_content.word_count,
                    \"character_count\": source_content.character_count
                })

        # Join all parts
        final_content = separator.join(combined_parts)

        return DocumentContent(
            text=final_content,
            metadata=combined_metadata,
            preview=final_content[:500],
            word_count=len(final_content.split()),
            character_count=len(final_content)
        )

    def _combine_by_sections(self, sources: List[Dict], options: Dict) -> DocumentContent:
        \"\"\"Combine sources by organizing into sections\"\"\"
        # Organize content by detected sections/topics
        # Create table of contents
        # Merge similar sections
        pass

    def _combine_by_topics(self, sources: List[Dict], options: Dict) -> DocumentContent:
        \"\"\"Combine sources by topic similarity\"\"\"
        # Use semantic analysis to group similar content
        # Create topic-based organization
        # Remove redundant information
        pass

    def get_source_metadata(self, source_config: Dict) -> Dict:
        \"\"\"Get combined source metadata\"\"\"
        return {
            \"source_type\": \"combined\",
            \"combination_methods\": [\"concatenate\", \"section_based\", \"topic_based\"],
            \"capabilities\": {
                \"preserves_source_attribution\": True,
                \"removes_duplicates\": True,
                \"organizes_by_topic\": True,
                \"creates_table_of_contents\": True
            }
        }

    def can_update(self) -> bool:
        \"\"\"Combined sources can be updated if component sources can be\"\"\"
        return False  # Depends on component sources

    def validate_config(self, source_config: Dict) -> bool:
        \"\"\"Validate combined source configuration\"\"\"
        if \"sources\" not in source_config:
            return False

        sources = source_config[\"sources\"]
        if not isinstance(sources, list) or len(sources) == 0:
            return False

        # Validate each source has required fields
        for source in sources:
            if \"type\" not in source or \"content\" not in source:
                return False

        return True
"""