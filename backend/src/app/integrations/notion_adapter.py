"""
Notion Adapter - Notion pages and databases integration.

WHY:
- Import content from Notion workspace
- Sync Notion pages to knowledge base
- Access Notion databases
- Support team documentation

HOW:
- Use Notion API v1
- OAuth2 or internal integration
- Export pages to markdown
- Handle nested pages and blocks

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional, List


class NotionAdapter:
    """
    Notion API integration.

    WHY: Import content from Notion
    HOW: Notion API with OAuth2 or integration token
    """

    def __init__(self):
        """
        Initialize Notion adapter.

        WHY: Setup API configuration
        HOW: Configure API endpoint and version
        """
        self.api_url = "https://api.notion.com/v1"
        self.api_version = "2022-06-28"


    async def get_page_content(
        self,
        page_id: str,
        access_token: str
    ) -> dict:
        """
        Get Notion page content.

        WHY: Import Notion page to KB
        HOW: Fetch blocks and convert to markdown

        ARGS:
            page_id: Notion page ID (32-char UUID)
            access_token: Notion integration token or OAuth token

        RETURNS:
            {
                "page_id": "abc-123",
                "title": "Page Title",
                "content": "Markdown formatted content...",
                "metadata": {
                    "created_time": "2025-01-15T10:30:00Z",
                    "last_edited_time": "2025-01-20T14:22:00Z",
                    "created_by": {"id": "user_id"},
                    "url": "https://notion.so/..."
                }
            }

        EXAMPLE URL:
            https://www.notion.so/PAGE_TITLE-PAGE_ID
        """

        import requests

        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Notion-Version": self.api_version,
                "Content-Type": "application/json"
            }

            # Get page metadata
            page_url = f"{self.api_url}/pages/{page_id}"
            page_response = requests.get(page_url, headers=headers, timeout=30)
            page_response.raise_for_status()
            page_data = page_response.json()

            # Extract title
            title = self._extract_title(page_data)

            # Get page blocks (content)
            blocks_url = f"{self.api_url}/blocks/{page_id}/children"
            blocks_response = requests.get(blocks_url, headers=headers, timeout=30)
            blocks_response.raise_for_status()
            blocks_data = blocks_response.json()

            # Convert blocks to markdown
            content = self._blocks_to_markdown(blocks_data.get("results", []))

            return {
                "page_id": page_id,
                "title": title,
                "content": content,
                "metadata": {
                    "created_time": page_data.get("created_time"),
                    "last_edited_time": page_data.get("last_edited_time"),
                    "created_by": page_data.get("created_by"),
                    "url": page_data.get("url"),
                    "source": "notion"
                }
            }

        except Exception as e:
            return {
                "page_id": page_id,
                "title": None,
                "content": None,
                "metadata": {"error": str(e)}
            }


    def _extract_title(self, page_data: dict) -> str:
        """
        Extract page title from page properties.

        WHY: Get page title
        HOW: Parse properties.title field
        """

        properties = page_data.get("properties", {})

        # Look for title property
        for prop_name, prop_value in properties.items():
            if prop_value.get("type") == "title":
                title_array = prop_value.get("title", [])
                if title_array:
                    return title_array[0].get("plain_text", "Untitled")

        return "Untitled"


    def _blocks_to_markdown(self, blocks: List[dict]) -> str:
        """
        Convert Notion blocks to markdown.

        WHY: Format content for KB
        HOW: Map block types to markdown syntax
        """

        markdown = ""

        for block in blocks:
            block_type = block.get("type")

            if block_type == "paragraph":
                text = self._rich_text_to_plain(block["paragraph"].get("rich_text", []))
                markdown += f"{text}\n\n"

            elif block_type == "heading_1":
                text = self._rich_text_to_plain(block["heading_1"].get("rich_text", []))
                markdown += f"# {text}\n\n"

            elif block_type == "heading_2":
                text = self._rich_text_to_plain(block["heading_2"].get("rich_text", []))
                markdown += f"## {text}\n\n"

            elif block_type == "heading_3":
                text = self._rich_text_to_plain(block["heading_3"].get("rich_text", []))
                markdown += f"### {text}\n\n"

            elif block_type == "bulleted_list_item":
                text = self._rich_text_to_plain(block["bulleted_list_item"].get("rich_text", []))
                markdown += f"- {text}\n"

            elif block_type == "numbered_list_item":
                text = self._rich_text_to_plain(block["numbered_list_item"].get("rich_text", []))
                markdown += f"1. {text}\n"

            elif block_type == "code":
                code = self._rich_text_to_plain(block["code"].get("rich_text", []))
                language = block["code"].get("language", "")
                markdown += f"```{language}\n{code}\n```\n\n"

            elif block_type == "quote":
                text = self._rich_text_to_plain(block["quote"].get("rich_text", []))
                markdown += f"> {text}\n\n"

        return markdown.strip()


    def _rich_text_to_plain(self, rich_text: List[dict]) -> str:
        """
        Convert Notion rich text to plain text.

        WHY: Extract text content
        HOW: Concatenate plain_text fields
        """

        return "".join([text.get("plain_text", "") for text in rich_text])


    async def list_workspace_pages(
        self,
        access_token: str,
        filter_type: Optional[str] = None
    ) -> List[dict]:
        """
        List pages in Notion workspace.

        WHY: Discover pages to import
        HOW: Use search endpoint

        ARGS:
            access_token: Notion integration token
            filter_type: "page" | "database" | None

        RETURNS:
            [
                {
                    "id": "page_id",
                    "title": "Page Title",
                    "last_edited": "2025-01-20T14:22:00Z",
                    "url": "https://notion.so/..."
                }
            ]
        """

        import requests

        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Notion-Version": self.api_version,
                "Content-Type": "application/json"
            }

            url = f"{self.api_url}/search"

            payload = {}
            if filter_type:
                payload["filter"] = {"property": "object", "value": filter_type}

            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()

            data = response.json()
            pages = []

            for result in data.get("results", []):
                if result.get("object") == "page":
                    title = self._extract_title(result)

                    pages.append({
                        "id": result.get("id"),
                        "title": title,
                        "last_edited": result.get("last_edited_time"),
                        "url": result.get("url")
                    })

            return pages

        except Exception as e:
            print(f"Error listing Notion pages: {e}")
            return []


    def extract_page_id_from_url(self, url: str) -> Optional[str]:
        """
        Extract page ID from Notion URL.

        WHY: Convert URL to page ID for API calls
        HOW: Parse URL pattern

        EXAMPLES:
            https://www.notion.so/PAGE_TITLE-abc123def456
            https://notion.so/workspace/abc123def456

        RETURNS:
            Page ID (32-char UUID with hyphens) or None
        """

        import re

        # Notion URLs end with a 32-character ID (no hyphens in URL)
        # Pattern: last 32 alphanumeric characters
        pattern = r'([a-f0-9]{32})(?:\?|$)'
        match = re.search(pattern, url)

        if match:
            page_id = match.group(1)
            # Add hyphens to convert to UUID format
            formatted_id = f"{page_id[:8]}-{page_id[8:12]}-{page_id[12:16]}-{page_id[16:20]}-{page_id[20:]}"
            return formatted_id

        return None


# Global instance
notion_adapter = NotionAdapter()
