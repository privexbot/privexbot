"""
Cloud integration adapter for Google Docs, Notion, Microsoft 365, etc.

WHY: Sync content from cloud services with real-time updates
HOW: OAuth2 authentication with service-specific APIs
BUILDS ON: Existing integration_service.py patterns

PSEUDOCODE:
-----------
from typing import Dict, List, Optional
import json
from datetime import datetime

class CloudIntegrationAdapter(SourceAdapter):
    \"\"\"
    Cloud service integration with OAuth and sync capabilities.

    SUPPORTED SERVICES:
    - Google Workspace: Docs, Sheets, Drive folders
    - Notion: Pages, databases, workspaces
    - Microsoft 365: SharePoint, OneDrive, Word Online
    - Dropbox: Files and Paper documents
    - Confluence: Spaces and pages
    - Slack: Channel exports

    FEATURES:
    - OAuth2 authentication flow
    - Real-time sync capabilities
    - Incremental updates
    - Metadata preservation
    - Access control integration
    \"\"\"

    def __init__(self):
        self.supported_services = {
            \"google_docs\": self._process_google_docs,
            \"google_sheets\": self._process_google_sheets,
            \"google_drive\": self._process_google_drive,
            \"notion\": self._process_notion,
            \"microsoft_365\": self._process_microsoft_365,
            \"dropbox\": self._process_dropbox,
            \"confluence\": self._process_confluence,
            \"slack\": self._process_slack
        }

    async def extract_content(self, source_config: Dict) -> DocumentContent:
        \"\"\"
        Extract content from cloud service.

        source_config = {
            \"service\": \"google_docs\" | \"notion\" | \"microsoft_365\" | ...,
            \"resource_id\": \"document_id_or_url\",
            \"credentials\": {
                \"access_token\": \"oauth_token\",
                \"refresh_token\": \"refresh_token\",
                \"expires_at\": \"2024-12-31T23:59:59Z\"
            },
            \"options\": {
                \"include_comments\": false,
                \"export_format\": \"markdown\",
                \"sync_enabled\": true,
                \"include_metadata\": true
            }
        }

        PROCESS:
        1. Validate service and credentials
        2. Refresh token if needed
        3. Route to service-specific processor
        4. Extract content with metadata
        5. Return standardized DocumentContent
        \"\"\"

        service = source_config.get(\"service\")
        if service not in self.supported_services:
            raise ValueError(f\"Unsupported cloud service: {service}\")

        # Refresh credentials if needed
        await self._ensure_valid_credentials(source_config)

        processor = self.supported_services[service]
        return await processor(source_config)

    async def _process_google_docs(self, config: Dict) -> DocumentContent:
        \"\"\"
        Process Google Docs document.

        FEATURES:
        - Export as Markdown, HTML, or plain text
        - Preserve formatting and structure
        - Include comments and suggestions (optional)
        - Track revision history
        - Extract document metadata

        PROCESS:
        1. Setup Google API credentials from config
        2. Initialize Docs and Drive services
        3. Get document content and metadata
        4. Format according to export_format
        5. Include comments if requested
        \"\"\"

        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials

        # Setup credentials
        creds_data = config[\"credentials\"]
        credentials = Credentials(
            token=creds_data[\"access_token\"],
            refresh_token=creds_data.get(\"refresh_token\"),
            token_uri=\"https://oauth2.googleapis.com/token\",
            client_id=os.getenv(\"GOOGLE_CLIENT_ID\"),
            client_secret=os.getenv(\"GOOGLE_CLIENT_SECRET\")
        )

        # Initialize services
        docs_service = build('docs', 'v1', credentials=credentials)
        drive_service = build('drive', 'v3', credentials=credentials)

        document_id = config[\"resource_id\"]
        options = config.get(\"options\", {})

        try:
            # Get document content
            document = docs_service.documents().get(documentId=document_id).execute()

            # Get document metadata from Drive
            file_metadata = drive_service.files().get(
                fileId=document_id,
                fields=\"name,createdTime,modifiedTime,owners,description,mimeType\"
            ).execute()

            # Extract text content with structure
            content = self._extract_google_docs_text(document, options)

            # Get comments if requested
            comments = []
            if options.get(\"include_comments\", False):
                comments_response = drive_service.comments().list(fileId=document_id).execute()
                comments = comments_response.get('comments', [])

            # Format content based on export format
            export_format = options.get(\"export_format\", \"markdown\")
            if export_format == \"markdown\":
                formatted_content = self._format_google_docs_as_markdown(document)
            elif export_format == \"html\":
                formatted_content = self._format_google_docs_as_html(document)
            else:
                formatted_content = content

            # Add comments if included
            if comments:
                formatted_content += \"\\n\\n--- Comments ---\\n\\n\"
                for comment in comments:
                    author = comment['author']['displayName']
                    content_text = comment['content']
                    formatted_content += f\"**{author}**: {content_text}\\n\\n\"

            return DocumentContent(
                text=formatted_content,
                metadata={
                    \"document_title\": file_metadata.get(\"name\"),
                    \"created_time\": file_metadata.get(\"createdTime\"),
                    \"modified_time\": file_metadata.get(\"modifiedTime\"),
                    \"owners\": [owner.get(\"displayName\") for owner in file_metadata.get(\"owners\", [])],
                    \"description\": file_metadata.get(\"description\", \"\"),
                    \"google_doc_id\": document_id,
                    \"comments_count\": len(comments),
                    \"service\": \"google_docs\",
                    \"can_sync\": True
                },
                preview=formatted_content[:500],
                word_count=len(formatted_content.split()),
                character_count=len(formatted_content)
            )

        except Exception as e:
            raise ValueError(f\"Failed to process Google Doc: {e}\")

    async def _process_notion(self, config: Dict) -> DocumentContent:
        \"\"\"
        Process Notion page or database.

        FEATURES:
        - Page content with blocks
        - Database entries with properties
        - Nested pages and hierarchies
        - Rich content preservation (tables, callouts, etc.)
        - Property values and formulas

        PROCESS:
        1. Setup Notion API client with token
        2. Get page/database information
        3. Retrieve all blocks/content recursively
        4. Convert Notion blocks to readable text
        5. Include database properties if applicable
        \"\"\"

        import requests

        notion_token = config[\"credentials\"][\"access_token\"]
        resource_id = config[\"resource_id\"]
        options = config.get(\"options\", {})

        headers = {
            \"Authorization\": f\"Bearer {notion_token}\",
            \"Notion-Version\": \"2022-06-28\",
            \"Content-Type\": \"application/json\"
        }

        try:
            # Get page/database info
            response = requests.get(
                f\"https://api.notion.com/v1/pages/{resource_id}\",
                headers=headers
            )

            if response.status_code != 200:
                # Try as database
                response = requests.get(
                    f\"https://api.notion.com/v1/databases/{resource_id}\",
                    headers=headers
                )

            if response.status_code != 200:
                raise ValueError(f\"Could not access Notion resource: {response.text}\")

            resource_data = response.json()

            # Get blocks (content)
            blocks_response = requests.get(
                f\"https://api.notion.com/v1/blocks/{resource_id}/children\",
                headers=headers
            )

            if blocks_response.status_code == 200:
                blocks = blocks_response.json().get(\"results\", [])
                content = self._notion_blocks_to_text(blocks, headers)
            else:
                title = self._extract_notion_title(resource_data)
                content = f\"Notion {resource_data.get('object', 'resource')}: {title}\"

            # If it's a database, also get entries
            if resource_data.get('object') == 'database':
                database_content = await self._process_notion_database(resource_id, headers, options)
                content += \"\\n\\n\" + database_content

            return DocumentContent(
                text=content,
                metadata={
                    \"notion_id\": resource_id,
                    \"notion_type\": resource_data.get(\"object\"),
                    \"title\": self._extract_notion_title(resource_data),
                    \"created_time\": resource_data.get(\"created_time\"),
                    \"last_edited_time\": resource_data.get(\"last_edited_time\"),
                    \"created_by\": resource_data.get(\"created_by\", {}).get(\"id\"),
                    \"service\": \"notion\",
                    \"can_sync\": True
                },
                preview=content[:500],
                word_count=len(content.split()),
                character_count=len(content)
            )

        except Exception as e:
            raise ValueError(f\"Failed to process Notion resource: {e}\")

    async def _process_microsoft_365(self, config: Dict) -> DocumentContent:
        \"\"\"
        Process Microsoft 365 documents (Word Online, SharePoint, OneDrive).

        FEATURES:
        - Word Online documents
        - SharePoint lists and documents
        - OneDrive files
        - Teams channel files
        - Metadata and version history

        PROCESS:
        1. Setup Microsoft Graph API client
        2. Authenticate with Azure AD
        3. Get document content via Graph API
        4. Extract text while preserving structure
        5. Include Office-specific metadata
        \"\"\"

        # Microsoft Graph API integration
        graph_token = config[\"credentials\"][\"access_token\"]
        resource_id = config[\"resource_id\"]  # Can be file ID or SharePoint URL
        options = config.get(\"options\", {})

        headers = {
            \"Authorization\": f\"Bearer {graph_token}\",
            \"Content-Type\": \"application/json\"
        }

        try:
            # Get file metadata
            file_response = requests.get(
                f\"https://graph.microsoft.com/v1.0/me/drive/items/{resource_id}\",
                headers=headers
            )

            if file_response.status_code != 200:
                raise ValueError(f\"Could not access Microsoft 365 file: {file_response.text}\")

            file_data = file_response.json()

            # Download file content
            download_url = file_data.get(\"@microsoft.graph.downloadUrl\")
            if download_url:
                content_response = requests.get(download_url)
                if content_response.status_code == 200:
                    # Process based on file type
                    file_name = file_data.get(\"name\", \"\")
                    if file_name.endswith(('.docx', '.doc')):
                        content = self._process_office_document(content_response.content, options)
                    elif file_name.endswith(('.xlsx', '.xls')):
                        content = self._process_office_spreadsheet(content_response.content, options)
                    else:
                        content = content_response.text

            return DocumentContent(
                text=content,
                metadata={
                    \"file_id\": resource_id,
                    \"file_name\": file_data.get(\"name\"),
                    \"created_time\": file_data.get(\"createdDateTime\"),
                    \"modified_time\": file_data.get(\"lastModifiedDateTime\"),
                    \"created_by\": file_data.get(\"createdBy\", {}).get(\"user\", {}).get(\"displayName\"),
                    \"file_size\": file_data.get(\"size\"),
                    \"service\": \"microsoft_365\",
                    \"can_sync\": True
                },
                preview=content[:500],
                word_count=len(content.split()),
                character_count=len(content)
            )

        except Exception as e:
            raise ValueError(f\"Failed to process Microsoft 365 document: {e}\")

    async def _process_dropbox(self, config: Dict) -> DocumentContent:
        \"\"\"Process Dropbox files and Paper documents\"\"\"
        # Dropbox API integration for files and Paper docs
        pass

    async def _process_confluence(self, config: Dict) -> DocumentContent:
        \"\"\"Process Confluence pages and spaces\"\"\"
        # Confluence REST API integration
        pass

    async def _process_slack(self, config: Dict) -> DocumentContent:
        \"\"\"Process Slack channel exports and messages\"\"\"
        # Slack Web API integration for channel content
        pass

    # Helper methods
    async def _ensure_valid_credentials(self, source_config: Dict) -> None:
        \"\"\"
        Ensure credentials are valid and refresh if needed.

        PROCESS:
        1. Check if access token is expired
        2. Use refresh token to get new access token
        3. Update credentials in source_config
        4. Store updated credentials for future use
        \"\"\"

        credentials = source_config[\"credentials\"]
        expires_at = credentials.get(\"expires_at\")

        if expires_at:
            expires_datetime = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if datetime.now() >= expires_datetime:
                # Token is expired, refresh it
                new_credentials = await self._refresh_oauth_token(
                    source_config[\"service\"],
                    credentials[\"refresh_token\"]
                )
                source_config[\"credentials\"].update(new_credentials)

    async def _refresh_oauth_token(self, service: str, refresh_token: str) -> Dict:
        \"\"\"Refresh OAuth token for specific service\"\"\"
        # Service-specific OAuth token refresh logic
        # This would integrate with existing OAuth flows
        pass

    def _extract_google_docs_text(self, document: Dict, options: Dict) -> str:
        \"\"\"Extract text from Google Docs API response\"\"\"
        # Parse Google Docs structure and extract text
        # Preserve formatting based on options
        pass

    def _format_google_docs_as_markdown(self, document: Dict) -> str:
        \"\"\"Convert Google Docs to Markdown format\"\"\"
        # Convert Google Docs structure to Markdown
        # Preserve headings, lists, tables, etc.
        pass

    def _notion_blocks_to_text(self, blocks: List[Dict], headers: Dict) -> str:
        \"\"\"
        Convert Notion blocks to readable text.

        PROCESS:
        1. Iterate through blocks in order
        2. Convert each block type to text representation
        3. Handle nested blocks recursively
        4. Preserve structure and formatting
        \"\"\"

        content_parts = []

        for block in blocks:
            block_type = block.get(\"type\")
            block_content = block.get(block_type, {})

            if block_type == \"paragraph\":
                text = self._extract_notion_rich_text(block_content.get(\"rich_text\", []))
                if text.strip():
                    content_parts.append(text)

            elif block_type in [\"heading_1\", \"heading_2\", \"heading_3\"]:
                level = int(block_type.split(\"_\")[1])
                heading_text = self._extract_notion_rich_text(block_content.get(\"rich_text\", []))
                markdown_heading = \"#\" * level + \" \" + heading_text
                content_parts.append(markdown_heading)

            elif block_type == \"bulleted_list_item\":
                text = self._extract_notion_rich_text(block_content.get(\"rich_text\", []))
                content_parts.append(f\"• {text}\")

            elif block_type == \"numbered_list_item\":
                text = self._extract_notion_rich_text(block_content.get(\"rich_text\", []))
                content_parts.append(f\"1. {text}\")

            elif block_type == \"table\":
                table_content = self._process_notion_table(block, headers)
                content_parts.append(table_content)

            # Handle nested blocks
            if block.get(\"has_children\"):
                children_response = requests.get(
                    f\"https://api.notion.com/v1/blocks/{block['id']}/children\",
                    headers=headers
                )
                if children_response.status_code == 200:
                    children = children_response.json().get(\"results\", [])
                    nested_content = self._notion_blocks_to_text(children, headers)
                    if nested_content.strip():
                        content_parts.append(nested_content)

        return \"\\n\\n\".join(content_parts)

    def _extract_notion_rich_text(self, rich_text_array: List[Dict]) -> str:
        \"\"\"Extract plain text from Notion rich text array\"\"\"
        return \"\".join([rt.get(\"plain_text\", \"\") for rt in rich_text_array])

    def _extract_notion_title(self, resource_data: Dict) -> str:
        \"\"\"Extract title from Notion page or database\"\"\"
        properties = resource_data.get(\"properties\", {})

        # Try to find title property
        for prop_name, prop_data in properties.items():
            if prop_data.get(\"type\") == \"title\":
                title_array = prop_data.get(\"title\", [])
                return self._extract_notion_rich_text(title_array)

        # Fallback to object type
        return resource_data.get(\"object\", \"Untitled\").title()

    def get_source_metadata(self, source_config: Dict) -> Dict:
        \"\"\"Get cloud integration metadata\"\"\"
        service = source_config.get(\"service\")

        return {
            \"source_type\": \"cloud_integration\",
            \"service\": service,
            \"requires_oauth\": True,
            \"supports_sync\": True,
            \"capabilities\": {
                \"real_time_updates\": service in [\"notion\", \"google_docs\"],
                \"export_formats\": [\"markdown\", \"html\", \"text\"],
                \"includes_metadata\": True,
                \"preserves_formatting\": True,
                \"supports_comments\": service in [\"google_docs\", \"microsoft_365\"]
            }
        }

    def can_update(self) -> bool:
        \"\"\"Cloud sources support real-time updates\"\"\"
        return True

    def validate_config(self, source_config: Dict) -> bool:
        \"\"\"Validate cloud integration configuration\"\"\"
        required_fields = [\"service\", \"resource_id\", \"credentials\"]

        for field in required_fields:
            if field not in source_config:
                return False

        service = source_config[\"service\"]
        if service not in self.supported_services:
            return False

        credentials = source_config[\"credentials\"]
        if \"access_token\" not in credentials:
            return False

        return True
"""