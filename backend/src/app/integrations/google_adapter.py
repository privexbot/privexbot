"""
Google Adapter - Google Docs, Sheets, and Drive integration.

WHY:
- Import content from Google Workspace
- Sync Google Docs to knowledge base
- Access Google Sheets data
- Support collaborative documentation

HOW:
- Use Google Drive API v3
- OAuth2 authentication
- Export docs to text/markdown
- Handle sheets as structured data

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional, List
from uuid import UUID


class GoogleAdapter:
    """
    Google Workspace integration (Docs, Sheets, Drive).

    WHY: Import content from Google Workspace
    HOW: Google Drive API with OAuth2
    """

    def __init__(self):
        """
        Initialize Google adapter.

        WHY: Setup API configuration
        HOW: Load credentials from settings
        """
        # Placeholder - production would use google-auth library
        self.scopes = [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/documents.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly'
        ]


    async def export_google_doc(
        self,
        document_id: str,
        access_token: str,
        format: str = "text/plain"
    ) -> dict:
        """
        Export Google Doc content.

        WHY: Import Google Doc to KB
        HOW: Use Drive API export endpoint

        ARGS:
            document_id: Google Doc ID from URL
            access_token: OAuth2 access token
            format: "text/plain" | "text/html" | "text/markdown"

        RETURNS:
            {
                "document_id": "abc123",
                "title": "Document Title",
                "content": "Document text...",
                "metadata": {
                    "created_time": "2025-01-15T10:30:00Z",
                    "modified_time": "2025-01-20T14:22:00Z",
                    "owner": "user@example.com"
                }
            }

        EXAMPLE URL:
            https://docs.google.com/document/d/DOCUMENT_ID/edit
        """

        import requests

        try:
            # Get document metadata
            metadata_url = f"https://www.googleapis.com/drive/v3/files/{document_id}"
            metadata_params = {
                "fields": "id,name,createdTime,modifiedTime,owners"
            }
            headers = {"Authorization": f"Bearer {access_token}"}

            metadata_response = requests.get(
                metadata_url,
                params=metadata_params,
                headers=headers,
                timeout=30
            )
            metadata_response.raise_for_status()
            metadata = metadata_response.json()

            # Export document content
            export_url = f"https://www.googleapis.com/drive/v3/files/{document_id}/export"
            export_params = {"mimeType": format}

            content_response = requests.get(
                export_url,
                params=export_params,
                headers=headers,
                timeout=60
            )
            content_response.raise_for_status()

            content = content_response.text

            return {
                "document_id": document_id,
                "title": metadata.get("name", "Untitled"),
                "content": content,
                "metadata": {
                    "created_time": metadata.get("createdTime"),
                    "modified_time": metadata.get("modifiedTime"),
                    "owner": metadata.get("owners", [{}])[0].get("emailAddress"),
                    "source": "google_docs"
                }
            }

        except Exception as e:
            return {
                "document_id": document_id,
                "title": None,
                "content": None,
                "metadata": {"error": str(e)}
            }


    def _rows_to_markdown_table(self, sheet_title: str, rows: List[list]) -> str:
        """
        Convert sheet rows to a markdown table with a heading.

        ARGS:
            sheet_title: Name of the sheet (used as heading)
            rows: List of row lists from Sheets API

        RETURNS:
            Markdown string with ## heading and pipe-delimited table
        """
        if not rows:
            return f"## Sheet: {sheet_title}\n\n*Empty sheet*"

        # Find max column count across all rows
        max_cols = max(len(row) for row in rows)
        if max_cols == 0:
            return f"## Sheet: {sheet_title}\n\n*Empty sheet*"

        def escape_cell(val: str) -> str:
            return str(val).replace("|", "\\|")

        def pad_row(row: list) -> List[str]:
            padded = [escape_cell(cell) for cell in row]
            while len(padded) < max_cols:
                padded.append("")
            return padded

        # Header row
        headers = pad_row(rows[0])
        header_line = "| " + " | ".join(headers) + " |"
        separator = "| " + " | ".join(["---"] * max_cols) + " |"

        lines = [f"## Sheet: {sheet_title}", "", header_line, separator]

        # Data rows
        for row in rows[1:]:
            cells = pad_row(row)
            lines.append("| " + " | ".join(cells) + " |")

        return "\n".join(lines)

    async def export_google_sheet(
        self,
        spreadsheet_id: str,
        access_token: str,
        sheet_name: Optional[str] = None
    ) -> dict:
        """
        Export Google Sheet data as markdown tables.

        WHY: Import structured data from Sheets in RAG-friendly format
        HOW: Use Sheets API with FORMATTED_VALUE to get evaluated data,
             iterate all sheets (or specific sheet), convert to markdown tables

        ARGS:
            spreadsheet_id: Google Sheet ID
            access_token: OAuth2 access token
            sheet_name: Specific sheet name (or None for all sheets)

        RETURNS:
            {
                "spreadsheet_id": "abc123",
                "title": "Spreadsheet Title",
                "content": "Markdown formatted tables...",
                "data": [[row1], [row2]],
                "metadata": {...}
            }
        """

        import requests

        try:
            # Get spreadsheet metadata
            metadata_url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            headers = {"Authorization": f"Bearer {access_token}"}

            metadata_response = requests.get(
                metadata_url,
                headers=headers,
                timeout=30
            )
            metadata_response.raise_for_status()
            metadata = metadata_response.json()

            sheets = metadata.get("sheets", [])
            title = metadata.get("properties", {}).get("title", "Untitled")

            # Determine which sheets to export
            if sheet_name:
                sheets_to_export = [s for s in sheets if s["properties"]["title"] == sheet_name]
                if not sheets_to_export:
                    sheets_to_export = [sheets[0]]
            else:
                sheets_to_export = sheets

            all_markdown_parts = []
            all_rows = []
            total_row_count = 0

            for sheet in sheets_to_export:
                sheet_title = sheet["properties"]["title"]
                # Escape single quotes for API range notation
                safe_title = sheet_title.replace("'", "''")
                range_name = f"'{safe_title}'!A1:ZZ"

                values_url = (
                    f"https://sheets.googleapis.com/v4/spreadsheets/"
                    f"{spreadsheet_id}/values/{range_name}"
                )
                params = {"valueRenderOption": "FORMATTED_VALUE"}

                values_response = requests.get(
                    values_url,
                    params=params,
                    headers=headers,
                    timeout=30
                )
                values_response.raise_for_status()
                values_data = values_response.json()

                rows = values_data.get("values", [])
                all_rows.extend(rows)
                total_row_count += len(rows)

                md = self._rows_to_markdown_table(sheet_title, rows)
                all_markdown_parts.append(md)

            content = "\n\n".join(all_markdown_parts)

            return {
                "spreadsheet_id": spreadsheet_id,
                "title": title,
                "content": content,
                "data": all_rows,
                "metadata": {
                    "sheet_count": len(sheets_to_export),
                    "row_count": total_row_count,
                    "source": "google_sheets"
                }
            }

        except Exception as e:
            return {
                "spreadsheet_id": spreadsheet_id,
                "title": None,
                "content": None,
                "data": [],
                "metadata": {"error": str(e)}
            }


    async def list_drive_files(
        self,
        access_token: str,
        folder_id: Optional[str] = None,
        file_type: Optional[str] = None
    ) -> List[dict]:
        """
        List files in Google Drive.

        WHY: Discover files to import
        HOW: Use Drive API files.list

        ARGS:
            access_token: OAuth2 access token
            folder_id: Limit to specific folder
            file_type: "document" | "spreadsheet" | "presentation"

        RETURNS:
            [
                {
                    "id": "file_id",
                    "name": "File Name",
                    "type": "document",
                    "modified_time": "2025-01-20T14:22:00Z"
                }
            ]
        """

        import requests

        try:
            url = "https://www.googleapis.com/drive/v3/files"

            # Build query
            query_parts = []
            query_parts.append("trashed=false")
            if folder_id:
                query_parts.append(f"'{folder_id}' in parents")
            if file_type == "document":
                query_parts.append("mimeType='application/vnd.google-apps.document'")
            elif file_type == "spreadsheet":
                query_parts.append("mimeType='application/vnd.google-apps.spreadsheet'")
            elif not file_type:
                query_parts.append(
                    "(mimeType='application/vnd.google-apps.document' or "
                    "mimeType='application/vnd.google-apps.spreadsheet')"
                )

            params = {
                "fields": "files(id,name,mimeType,modifiedTime)",
                "pageSize": 100,
                "q": " and ".join(query_parts),
            }

            headers = {"Authorization": f"Bearer {access_token}"}

            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            files = []

            for file in data.get("files", []):
                mime_type = file.get("mimeType", "")
                file_type_str = "unknown"

                if "document" in mime_type:
                    file_type_str = "document"
                elif "spreadsheet" in mime_type:
                    file_type_str = "spreadsheet"
                elif "presentation" in mime_type:
                    file_type_str = "presentation"

                files.append({
                    "id": file.get("id"),
                    "name": file.get("name"),
                    "type": file_type_str,
                    "modified_time": file.get("modifiedTime")
                })

            return files

        except Exception as e:
            print(f"Error listing Drive files: {e}")
            return []


    def extract_document_id_from_url(self, url: str) -> Optional[str]:
        """
        Extract document ID from Google Docs/Sheets URL.

        WHY: Convert URL to document ID for API calls
        HOW: Parse URL pattern

        EXAMPLES:
            https://docs.google.com/document/d/DOCUMENT_ID/edit
            https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit

        RETURNS:
            Document/Spreadsheet ID or None
        """

        import re

        # Pattern: /d/DOCUMENT_ID/
        pattern = r'/d/([a-zA-Z0-9-_]+)/'
        match = re.search(pattern, url)

        if match:
            return match.group(1)

        return None


    async def send_gmail(
        self,
        access_token: str,
        to: str,
        subject: str,
        body: str,
        body_type: str = "html",
        cc: str = None,
        bcc: str = None,
        reply_to: str = None,
        from_name: str = None
    ) -> dict:
        """
        Send email via Gmail API.

        WHY: Gmail OAuth integration for chatflow email nodes
        HOW: Build RFC 2822 message, base64url encode, POST to Gmail API

        ARGS:
            access_token: Gmail OAuth access token
            to: Recipient email address(es)
            subject: Email subject
            body: Email body content
            body_type: "html" or "plain"
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            reply_to: Reply-To address (optional)
            from_name: Display name for From header (optional)

        RETURNS:
            {"success": True, "message_id": "...", "thread_id": "..."} or
            {"success": False, "error": "..."}
        """
        import base64
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import httpx

        try:
            # Build RFC 2822 message
            msg = MIMEMultipart("alternative")
            msg["To"] = to
            msg["Subject"] = subject

            if cc:
                msg["Cc"] = cc
            if reply_to:
                msg["Reply-To"] = reply_to

            # Attach body
            if body_type == "html":
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))

            # Base64url encode the message (Gmail API requirement)
            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

            # Send via Gmail API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json={"raw": raw_message},
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message_id": data.get("id"),
                        "thread_id": data.get("threadId"),
                        "label_ids": data.get("labelIds", [])
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    return {"success": False, "error": f"Gmail API error ({response.status_code}): {error_msg}"}

        except Exception as e:
            return {"success": False, "error": f"Failed to send Gmail: {str(e)}"}

    async def refresh_gmail_token(
        self,
        refresh_token: str,
        client_id: str = None,
        client_secret: str = None
    ) -> dict:
        """
        Refresh expired Gmail OAuth access token.

        WHY: Gmail access tokens expire after ~1 hour
        HOW: POST to Google OAuth token endpoint with refresh_token grant

        RETURNS:
            {"access_token": "ya29...", "expires_in": 3599} or
            {"error": "..."}
        """
        import httpx
        from app.core.config import settings

        if not client_id:
            client_id = settings.GOOGLE_CLIENT_ID
        if not client_secret:
            client_secret = settings.GOOGLE_CLIENT_SECRET

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id": client_id,
                        "client_secret": client_secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10.0
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    return {"error": f"Token refresh failed ({response.status_code}): {response.text}"}

        except Exception as e:
            return {"error": f"Token refresh exception: {str(e)}"}


# Global instance
google_adapter = GoogleAdapter()
