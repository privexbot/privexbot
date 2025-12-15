"""
Smart document parsing service that preserves structure and context.

WHY: Maintain document hierarchy for better chunking and retrieval
HOW: Parse documents into structural elements before chunking
BUILDS ON: Existing document_processing_service.py patterns

PSEUDOCODE:
-----------
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum

class ElementType(Enum):
    \"\"\"Document element types for structure preservation\"\"\"
    HEADING_1 = \"h1\"
    HEADING_2 = \"h2\"
    HEADING_3 = \"h3\"
    HEADING_4 = \"h4\"
    PARAGRAPH = \"paragraph\"
    LIST_ITEM = \"list_item\"
    TABLE = \"table\"
    CODE_BLOCK = \"code_block\"
    QUOTE = \"quote\"
    IMAGE = \"image\"
    FOOTNOTE = \"footnote\"
    METADATA = \"metadata\"

@dataclass
class DocumentElement:
    \"\"\"Structured document element with context\"\"\"
    type: ElementType
    content: str
    metadata: Dict
    parent_id: Optional[str] = None
    children_ids: List[str] = None
    position: int = 0

    def __post_init__(self):
        if self.children_ids is None:
            self.children_ids = []

class SmartParsingService:
    \"\"\"
    Intelligent document parsing that preserves structure.

    PHILOSOPHY: Structure-aware parsing enables better chunking and retrieval
    BUILDS ON: Existing document_processing_service.py
    \"\"\"

    def __init__(self):
        self.parsers = {
            \"pdf\": self._parse_pdf_structure,
            \"docx\": self._parse_docx_structure,
            \"html\": self._parse_html_structure,
            \"markdown\": self._parse_markdown_structure,
            \"txt\": self._parse_text_structure
        }

    async def parse_document(
        self,
        content: str,
        source_type: str,
        parse_config: Dict
    ) -> List[DocumentElement]:
        \"\"\"
        Parse document into structured elements.

        parse_config = {
            \"preserve_hierarchy\": true,
            \"extract_tables\": true,
            \"detect_sections\": true,
            \"merge_short_paragraphs\": false,
            \"min_element_length\": 50
        }

        PROCESS:
        1. Route to appropriate parser based on source_type
        2. Parse content into DocumentElement objects
        3. Apply post-processing based on config
        4. Return list of structured elements
        \"\"\"

        parser = self.parsers.get(source_type, self._parse_text_structure)
        elements = await parser(content, parse_config)

        # Post-processing based on config
        if parse_config.get(\"merge_short_paragraphs\", False):
            elements = self._merge_short_paragraphs(elements, parse_config)

        if parse_config.get(\"detect_sections\", True):
            elements = self._detect_sections(elements)

        return elements

    async def _parse_pdf_structure(self, content: str, config: Dict) -> List[DocumentElement]:
        \"\"\"
        Parse PDF with structure awareness.

        FEATURES:
        - Heading detection by font size/style patterns
        - Table boundary detection
        - Page break preservation
        - Reading order maintenance

        PROCESS:
        1. Split content by page markers
        2. Analyze each line for element type
        3. Detect headings by common patterns
        4. Preserve table structures
        5. Maintain reading order
        \"\"\"

        elements = []
        current_position = 0

        # Split by pages first (if page markers exist)
        pages = content.split(\"--- Page \")

        for page_num, page_content in enumerate(pages):
            if not page_content.strip():
                continue

            # Detect headings by looking for common patterns
            lines = page_content.split('\\n')

            for line_num, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue

                element_type = self._detect_element_type(line, lines, line_num)

                element = DocumentElement(
                    type=element_type,
                    content=line,
                    metadata={
                        \"page_number\": page_num + 1,
                        \"line_number\": line_num,
                        \"confidence\": self._get_detection_confidence(line, element_type),
                        \"source_format\": \"pdf\"
                    },
                    position=current_position
                )

                elements.append(element)
                current_position += 1

        return elements

    async def _parse_markdown_structure(self, content: str, config: Dict) -> List[DocumentElement]:
        \"\"\"
        Parse Markdown with perfect structure preservation.

        FEATURES:
        - Native heading hierarchy (# ## ### ####)
        - Code block detection (```)
        - List and table parsing
        - Link and image extraction

        PROCESS:
        1. Split content by lines
        2. Parse each line for Markdown syntax
        3. Handle multi-line blocks (code, tables)
        4. Preserve hierarchy and nesting
        \"\"\"

        import re

        elements = []
        lines = content.split('\\n')
        current_position = 0
        in_code_block = False
        code_block_content = []

        for line_num, line in enumerate(lines):
            # Handle code blocks
            if line.strip().startswith('```'):
                if in_code_block:
                    # End of code block
                    elements.append(DocumentElement(
                        type=ElementType.CODE_BLOCK,
                        content='\\n'.join(code_block_content),
                        metadata={
                            \"language\": code_block_content[0] if code_block_content else \"\",
                            \"source_format\": \"markdown\"
                        },
                        position=current_position
                    ))
                    code_block_content = []
                    in_code_block = False
                else:
                    # Start of code block
                    in_code_block = True
                    if len(line.strip()) > 3:
                        code_block_content.append(line.strip()[3:])  # Language
                current_position += 1
                continue

            if in_code_block:
                code_block_content.append(line)
                continue

            # Detect element type
            if re.match(r'^#{1,6}\\s+', line):
                # Heading
                level = len(line.split()[0])
                heading_type = {
                    1: ElementType.HEADING_1,
                    2: ElementType.HEADING_2,
                    3: ElementType.HEADING_3,
                    4: ElementType.HEADING_4
                }.get(level, ElementType.HEADING_4)

                elements.append(DocumentElement(
                    type=heading_type,
                    content=line.lstrip('#').strip(),
                    metadata={
                        \"heading_level\": level,
                        \"raw_markdown\": line,
                        \"source_format\": \"markdown\"
                    },
                    position=current_position
                ))

            elif re.match(r'^\\s*[-*+]\\s+', line):
                # List item
                elements.append(DocumentElement(
                    type=ElementType.LIST_ITEM,
                    content=re.sub(r'^\\s*[-*+]\\s+', '', line),
                    metadata={
                        \"list_marker\": re.search(r'[-*+]', line).group(),
                        \"indent_level\": len(line) - len(line.lstrip()),
                        \"source_format\": \"markdown\"
                    },
                    position=current_position
                ))

            elif line.strip().startswith('|') and line.strip().endswith('|'):
                # Table row
                elements.append(DocumentElement(
                    type=ElementType.TABLE,
                    content=line.strip(),
                    metadata={
                        \"is_table_row\": True,
                        \"source_format\": \"markdown\"
                    },
                    position=current_position
                ))

            elif line.strip():
                # Regular paragraph
                elements.append(DocumentElement(
                    type=ElementType.PARAGRAPH,
                    content=line.strip(),
                    metadata={\"source_format\": \"markdown\"},
                    position=current_position
                ))

            current_position += 1

        return elements

    async def _parse_html_structure(self, content: str, config: Dict) -> List[DocumentElement]:
        \"\"\"
        Parse HTML with structure preservation.

        FEATURES:
        - DOM structure preservation
        - Heading hierarchy (h1-h6)
        - List structures (ul, ol)
        - Table parsing
        - Semantic elements (article, section)

        PROCESS:
        1. Parse HTML with BeautifulSoup
        2. Walk DOM tree in document order
        3. Convert HTML elements to DocumentElements
        4. Preserve hierarchy and attributes
        \"\"\"

        from bs4 import BeautifulSoup

        soup = BeautifulSoup(content, 'html.parser')
        elements = []
        current_position = 0

        # Walk through elements in document order
        for element in soup.find_all(text=False):
            tag_name = element.name.lower()
            element_content = element.get_text(strip=True)

            if not element_content:
                continue

            # Map HTML tags to DocumentElement types
            if tag_name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                heading_level = int(tag_name[1])
                heading_type = {
                    1: ElementType.HEADING_1,
                    2: ElementType.HEADING_2,
                    3: ElementType.HEADING_3,
                    4: ElementType.HEADING_4
                }.get(heading_level, ElementType.HEADING_4)

                elements.append(DocumentElement(
                    type=heading_type,
                    content=element_content,
                    metadata={
                        \"heading_level\": heading_level,
                        \"html_tag\": tag_name,
                        \"html_attributes\": dict(element.attrs),
                        \"source_format\": \"html\"
                    },
                    position=current_position
                ))

            elif tag_name in ['p', 'div']:
                elements.append(DocumentElement(
                    type=ElementType.PARAGRAPH,
                    content=element_content,
                    metadata={
                        \"html_tag\": tag_name,
                        \"html_attributes\": dict(element.attrs),
                        \"source_format\": \"html\"
                    },
                    position=current_position
                ))

            elif tag_name == 'li':
                elements.append(DocumentElement(
                    type=ElementType.LIST_ITEM,
                    content=element_content,
                    metadata={
                        \"parent_list_type\": element.parent.name if element.parent else \"ul\",
                        \"html_attributes\": dict(element.attrs),
                        \"source_format\": \"html\"
                    },
                    position=current_position
                ))

            elif tag_name in ['table', 'tr', 'td', 'th']:
                elements.append(DocumentElement(
                    type=ElementType.TABLE,
                    content=element_content,
                    metadata={
                        \"table_element\": tag_name,
                        \"html_attributes\": dict(element.attrs),
                        \"source_format\": \"html\"
                    },
                    position=current_position
                ))

            elif tag_name in ['pre', 'code']:
                elements.append(DocumentElement(
                    type=ElementType.CODE_BLOCK,
                    content=element_content,
                    metadata={
                        \"html_tag\": tag_name,
                        \"language\": element.get('class', [''])[0],
                        \"source_format\": \"html\"
                    },
                    position=current_position
                ))

            current_position += 1

        return elements

    async def _parse_docx_structure(self, content: str, config: Dict) -> List[DocumentElement]:
        \"\"\"
        Parse DOCX content with structure preservation.

        NOTE: This assumes content has already been extracted from DOCX
        and includes style/structure information

        PROCESS:
        1. Parse structured DOCX content
        2. Identify headings by style names
        3. Preserve table structures
        4. Maintain document hierarchy
        \"\"\"

        # This would work with structured DOCX content that includes style info
        # For now, treat as structured text
        return await self._parse_text_structure(content, config)

    async def _parse_text_structure(self, content: str, config: Dict) -> List[DocumentElement]:
        \"\"\"
        Parse plain text with structure detection.

        FEATURES:
        - Heading detection by patterns
        - List detection
        - Paragraph separation
        - Code block detection

        PROCESS:
        1. Split content into lines
        2. Analyze each line for patterns
        3. Detect structural elements
        4. Group related content
        \"\"\"

        elements = []
        lines = content.split('\\n')
        current_position = 0

        for line_num, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            element_type = self._detect_element_type(line, lines, line_num)

            elements.append(DocumentElement(
                type=element_type,
                content=line,
                metadata={
                    \"line_number\": line_num,
                    \"confidence\": self._get_detection_confidence(line, element_type),
                    \"source_format\": \"text\"
                },
                position=current_position
            ))

            current_position += 1

        return elements

    def _detect_element_type(self, line: str, all_lines: List[str], line_num: int) -> ElementType:
        \"\"\"
        Intelligent element type detection for plain text.

        PATTERNS:
        - Headings: Short lines, title case, followed by content
        - Lists: Lines starting with bullets or numbers
        - Code: Lines with consistent indentation
        - Tables: Lines with alignment patterns
        \"\"\"

        import re

        # Heading patterns
        if (line.isupper() and len(line) < 100) or \\
           (line.endswith(':') and len(line.split()) <= 8) or \\
           (len(line) < 50 and not line.endswith('.') and line[0].isupper()):
            return ElementType.HEADING_2

        # List patterns
        if re.match(r'^\\s*[-•*]\\s+', line) or re.match(r'^\\s*\\d+[.).]\\s+', line):
            return ElementType.LIST_ITEM

        # Table patterns (lines with multiple aligned columns)
        if '|' in line and line.count('|') >= 2:
            return ElementType.TABLE

        # Code patterns (high indentation or code-like syntax)
        if line.strip().startswith(('def ', 'class ', 'function ', 'import ', 'from ')):
            return ElementType.CODE_BLOCK

        # Indented content (could be code or quotes)
        if line.startswith('    ') or line.startswith('\\t'):
            return ElementType.CODE_BLOCK

        return ElementType.PARAGRAPH

    def _get_detection_confidence(self, line: str, element_type: ElementType) -> float:
        \"\"\"
        Calculate confidence score for element type detection.

        SCORING:
        - High confidence: Clear patterns (markdown headings, obvious lists)
        - Medium confidence: Heuristic matches
        - Low confidence: Fallback classifications
        \"\"\"

        if element_type == ElementType.HEADING_2:
            if line.isupper():
                return 0.9
            elif line.endswith(':'):
                return 0.8
            else:
                return 0.6
        elif element_type == ElementType.LIST_ITEM:
            return 0.95
        elif element_type == ElementType.TABLE:
            return 0.85
        elif element_type == ElementType.CODE_BLOCK:
            return 0.8
        else:
            return 0.7

    def _merge_short_paragraphs(self, elements: List[DocumentElement], config: Dict) -> List[DocumentElement]:
        \"\"\"
        Merge short paragraphs with adjacent content.

        LOGIC:
        - Paragraphs < min_length get merged with next paragraph
        - Preserve headings and other structure elements
        - Maintain overall document flow
        \"\"\"

        min_length = config.get(\"min_element_length\", 50)
        merged_elements = []
        i = 0

        while i < len(elements):
            current = elements[i]

            # Don't merge non-paragraph elements
            if current.type != ElementType.PARAGRAPH:
                merged_elements.append(current)
                i += 1
                continue

            # If paragraph is too short, try to merge
            if len(current.content) < min_length and i + 1 < len(elements):
                next_element = elements[i + 1]

                # Only merge with another paragraph
                if next_element.type == ElementType.PARAGRAPH:
                    merged_content = current.content + \" \" + next_element.content
                    merged_element = DocumentElement(
                        type=ElementType.PARAGRAPH,
                        content=merged_content,
                        metadata={
                            **current.metadata,
                            \"merged_from\": [current.position, next_element.position]
                        },
                        position=current.position
                    )
                    merged_elements.append(merged_element)
                    i += 2  # Skip next element as it's been merged
                    continue

            merged_elements.append(current)
            i += 1

        return merged_elements

    def _detect_sections(self, elements: List[DocumentElement]) -> List[DocumentElement]:
        \"\"\"
        Detect document sections and add section metadata.

        PROCESS:
        1. Find heading elements
        2. Group content under each heading
        3. Add section metadata to elements
        4. Create section hierarchy
        \"\"\"

        enhanced_elements = []
        current_section = None
        section_stack = []  # For nested sections

        for element in elements:
            # Update section context for headings
            if element.type in [ElementType.HEADING_1, ElementType.HEADING_2,
                              ElementType.HEADING_3, ElementType.HEADING_4]:

                level = int(element.type.value[1])  # Extract level from h1, h2, etc.

                # Pop sections from stack if we're at a higher level
                while section_stack and section_stack[-1][\"level\"] >= level:
                    section_stack.pop()

                # Create new section
                section_info = {
                    \"title\": element.content,
                    \"level\": level,
                    \"start_position\": element.position
                }
                section_stack.append(section_info)
                current_section = section_info

                # Add section hierarchy to element metadata
                element.metadata[\"section_hierarchy\"] = [s[\"title\"] for s in section_stack]

            else:
                # Add current section info to non-heading elements
                if current_section:
                    element.metadata[\"section_title\"] = current_section[\"title\"]
                    element.metadata[\"section_level\"] = current_section[\"level\"]

            enhanced_elements.append(element)

        return enhanced_elements
"""