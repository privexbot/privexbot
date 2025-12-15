# KB Components - Complete Implementation

All 12 Knowledge Base components have been successfully created with production-ready code.

---

## ✅ Created Components

### 1. **SourceSelector.tsx** `/src/components/kb/SourceSelector.tsx`
**Purpose**: Choose document source type

**Features**:
- 6 source types: File Upload, Text Paste, URL, Website Crawl, Notion, Google Drive
- Categorized display (Direct, Web, Cloud)
- Icon-based selection cards
- Hover effects and visual feedback
- Premium badge support

**Props**:
```typescript
interface SourceSelectorProps {
  onSelectSource: (sourceType: SourceType) => void;
}

type SourceType = 'file_upload' | 'website_crawl' | 'notion' | 'google_docs' | 'text_paste' | 'url';
```

---

### 2. **FileUploader.tsx** `/src/components/kb/FileUploader.tsx`
**Purpose**: Drag & drop file upload with progress tracking

**Features**:
- react-dropzone integration
- Multiple file upload support
- Supported formats: PDF, DOCX, TXT, MD, CSV
- 10MB max file size
- Progress tracking per file
- Success/error states
- File size display
- Remove uploaded files

**Backend Integration**:
- `POST /kb-drafts/{id}/documents/upload` - Upload file with FormData

**Dependencies**: react-dropzone

---

### 3. **WebsiteCrawler.tsx** `/src/components/kb/WebsiteCrawler.tsx`
**Purpose**: Configure website scraping

**Features**:
- Base URL input with validation
- Sitemap detection/manual URL
- Max depth and max pages configuration
- Include/exclude URL patterns
- Pattern tags with add/remove
- URL validation
- Crawl status tracking

**Backend Integration**:
- `POST /kb-drafts/{id}/documents/crawl` - Start website crawl

**Configuration**:
- Max depth: 1-10 levels
- Max pages: 1-1000 pages
- Include/exclude patterns support

---

### 4. **NotionIntegration.tsx** `/src/components/kb/NotionIntegration.tsx`
**Purpose**: Import from Notion workspace

**Features**:
- OAuth connection flow
- Page/database browser
- Search functionality
- Select/deselect all
- Multi-select with checkboxes
- Page type badges (Page/Database)
- External link to Notion
- Icon display
- Connection status check

**Backend Integration**:
- `GET /credentials/` - Check if Notion connected
- `GET /integrations/notion/pages` - Fetch pages
- `POST /kb-drafts/{id}/documents/notion` - Add selected pages
- OAuth URL redirect

---

### 5. **GoogleDocsIntegration.tsx** `/src/components/kb/GoogleDocsIntegration.tsx`
**Purpose**: Import from Google Drive

**Features**:
- OAuth connection flow
- File/folder browser
- Folder navigation with breadcrumbs
- File type filtering (Docs, Sheets, Slides, PDFs)
- Search functionality
- Select/deselect all files
- File type icons and labels
- Modified date display
- External link to Drive

**Backend Integration**:
- `GET /credentials/` - Check if Google Drive connected
- `GET /integrations/google-drive/files` - Fetch files
- `POST /kb-drafts/{id}/documents/google-drive` - Add selected files
- OAuth URL redirect

---

### 6. **TextPasteInput.tsx** `/src/components/kb/TextPasteInput.tsx`
**Purpose**: Direct text paste input

**Features**:
- Large textarea for content
- Optional title and description
- Word count and character count
- Minimum length validation (100 chars recommended)
- Auto-clear after submission
- Content length indicators

**Backend Integration**:
- `POST /kb-drafts/{id}/documents/text` - Add pasted text

**Validation**:
- Content required
- Title optional
- Description optional

---

### 7. **DocumentAnnotationForm.tsx** `/src/components/kb/DocumentAnnotationForm.tsx`
**Purpose**: Add metadata to documents

**Features**:
- Tag input with add/remove
- Category dropdown (9 predefined categories)
- Author field
- Source field
- Custom metadata fields (key-value pairs)
- Real-time metadata updates via onChange callback

**Metadata Structure**:
```typescript
interface DocumentMetadata {
  tags: string[];
  category?: string;
  author?: string;
  source?: string;
  custom_fields: Record<string, string>;
}
```

**Categories**: Documentation, FAQ, Tutorial, API Reference, Blog Post, Product Info, Support, Legal, Other

---

### 8. **ChunkConfigPanel.tsx** `/src/components/kb/ChunkConfigPanel.tsx`
**Purpose**: Configure chunking settings

**Features**:
- 4 chunking strategies: Recursive, Sentence, Token, Semantic
- Chunk size slider (100-4000 chars)
- Chunk overlap slider (0-500 chars)
- Custom separator input (for recursive)
- Effective size calculation
- Overlap ratio display
- Estimated chunks calculation
- Visual feedback for size appropriateness

**Configuration**:
```typescript
interface ChunkConfig {
  strategy: 'recursive' | 'sentence' | 'token' | 'semantic';
  chunk_size: number;
  chunk_overlap: number;
  separator?: string;
}
```

**Recommendations**:
- 1000-2000 chars for most docs
- 10-20% overlap
- Recursive strategy recommended

---

### 9. **IndexingConfigPanel.tsx** `/src/components/kb/IndexingConfigPanel.tsx`
**Purpose**: Configure indexing and embedding settings

**Features**:
- 5 embedding models with specs:
  - OpenAI Ada 002 (1536 dims)
  - OpenAI Embedding 3 Small (1536 dims)
  - OpenAI Embedding 3 Large (3072 dims)
  - Cohere English v3 (1024 dims)
  - Voyage AI v2 (1024 dims)
- 3 distance metrics: Cosine, Euclidean, Dot Product
- Hybrid search toggle
- AI reranking toggle
- Performance impact summary
- Model comparison table

**Configuration**:
```typescript
interface IndexingConfig {
  embedding_model: string;
  distance_metric: 'cosine' | 'euclidean' | 'dot_product';
  enable_hybrid_search: boolean;
  enable_reranking: boolean;
}
```

---

### 10. **ChunkPreview.tsx** `/src/components/kb/ChunkPreview.tsx`
**Purpose**: Preview how documents will be chunked

**Features**:
- Summary statistics (total, avg, min, max size)
- Chunk navigation (prev/next)
- Chunk grid navigator
- Overlap visualization (yellow for start, blue for end)
- Character and word count per chunk
- Chunk index display
- Visual feedback for natural breaks
- Scrollable chunk content

**Backend Integration**:
- `POST /kb-drafts/{id}/preview-chunks` - Generate chunk preview

**Visualization**:
- Yellow highlights: Overlap from previous chunk
- Blue highlights: Overlap to next chunk
- Main content in monospace font

---

### 11. **SourcesList.tsx** `/src/components/kb/SourcesList.tsx`
**Purpose**: List all added sources in draft

**Features**:
- Source list with status badges (Pending, Processing, Completed, Error)
- Type icons for each source type
- Search functionality
- Status summary cards (Total, Completed, Processing, Error)
- Delete confirmation dialog
- File size display
- URL links to external sources
- Error message display
- Auto-refresh every 5 seconds (polling)

**Source Types**:
- File, URL, Website Crawl, Notion, Google Docs, Text

**Backend Integration**:
- `GET /kb-drafts/{id}/sources` - Fetch sources (polled every 5s)
- `DELETE /kb-drafts/{id}/sources/{sourceId}` - Remove source

---

### 12. **KBDraftSummary.tsx** `/src/components/kb/KBDraftSummary.tsx`
**Purpose**: Final summary before finalization

**Features**:
- KB info display (name, description)
- Source statistics (count, documents, chunks)
- Chunking configuration summary
- Indexing configuration summary
- Cost estimation (based on OpenAI pricing)
- Processing time estimation
- Warning indicators for empty/incomplete drafts
- "What happens next" explanation
- Gradient cost card

**Estimations**:
- Indexing cost: $0.10 per 1M tokens (Ada pricing)
- Processing time: ~100 chunks per second
- Token calculation: chars / 4

**Props**:
```typescript
interface KBDraftSummaryProps {
  draftData: {
    name: string;
    description?: string;
    sources_count: number;
    total_documents: number;
    estimated_chunks: number;
    chunking_config: ChunkConfig;
    indexing_config: IndexingConfig;
  };
}
```

---

## Common Patterns

### 1. **OAuth Integration** (Notion, Google Drive)
- Check credential existence first
- Redirect to OAuth URL if not connected
- Show connection prompt with external link button
- Poll for pages/files after connection
- Refresh functionality

### 2. **Multi-select with Search**
- Search input with real-time filtering
- Select All / Deselect All buttons
- Checkbox selection
- Selected count display
- Bulk add button

### 3. **Status Tracking** (SourcesList)
- Status badges with icons and colors
- Auto-refresh/polling
- Error state handling
- Visual feedback per item

### 4. **Configuration Panels** (Chunk, Indexing)
- Sliders for numeric values
- Dropdowns for options
- Real-time calculation/preview
- Impact summary cards
- Recommendations and tips

### 5. **Preview & Validation** (ChunkPreview, Summary)
- Before finalization
- Visual feedback
- Statistics display
- Warning indicators
- Cost/time estimations

---

## Component Relationships

### Wizard Flow Integration

These components work together in the KBCreationWizard:

```
Step 1: Basic Info
  └─ (Built into wizard)

Step 2: Add Documents
  ├─ SourceSelector → Choose source type
  ├─ FileUploader → Upload files
  ├─ WebsiteCrawler → Crawl website
  ├─ NotionIntegration → Import from Notion
  ├─ GoogleDocsIntegration → Import from Google Drive
  ├─ TextPasteInput → Paste text directly
  └─ DocumentAnnotationForm → Add metadata

Step 3: Configure
  ├─ ChunkConfigPanel → Chunking settings
  ├─ IndexingConfigPanel → Embedding settings
  └─ ChunkPreview → Preview chunks

Step 4: Review
  ├─ SourcesList → Review added sources
  └─ KBDraftSummary → Final review
```

---

## Usage Example

```tsx
import { useState } from 'react';
import SourceSelector from '@/components/kb/SourceSelector';
import FileUploader from '@/components/kb/FileUploader';
import WebsiteCrawler from '@/components/kb/WebsiteCrawler';
import ChunkConfigPanel from '@/components/kb/ChunkConfigPanel';
import KBDraftSummary from '@/components/kb/KBDraftSummary';

function KBCreationWizard() {
  const [draftId, setDraftId] = useState('draft-123');
  const [selectedSource, setSelectedSource] = useState(null);
  const [chunkConfig, setChunkConfig] = useState({
    strategy: 'recursive',
    chunk_size: 1000,
    chunk_overlap: 200,
  });

  return (
    <div>
      {/* Step 1: Choose Source */}
      <SourceSelector onSelectSource={setSelectedSource} />

      {/* Step 2: Add Documents */}
      {selectedSource === 'file_upload' && (
        <FileUploader draftId={draftId} onFilesUploaded={(files) => {}} />
      )}
      {selectedSource === 'website_crawl' && (
        <WebsiteCrawler draftId={draftId} onCrawlStarted={() => {}} />
      )}

      {/* Step 3: Configure */}
      <ChunkConfigPanel config={chunkConfig} onChange={setChunkConfig} />

      {/* Step 4: Review */}
      <KBDraftSummary draftData={draftData} />
    </div>
  );
}
```

---

## Dependencies

All components use these shared dependencies:

```bash
# Core
npm install react @tanstack/react-query react-hook-form @hookform/resolvers zod

# File upload (FileUploader)
npm install react-dropzone

# UI components (shadcn/ui)
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-label @radix-ui/react-alert-dialog

# Icons
npm install lucide-react

# State management
npm install zustand
```

---

## Backend API Endpoints Used

### Draft Management
- `POST /kb-drafts/` - Create draft
- `GET /kb-drafts/{id}` - Get draft
- `PATCH /kb-drafts/{id}` - Update draft
- `POST /kb-drafts/{id}/finalize` - Finalize KB

### Document Sources
- `POST /kb-drafts/{id}/documents/upload` - Upload file
- `POST /kb-drafts/{id}/documents/url` - Add URL
- `POST /kb-drafts/{id}/documents/crawl` - Start website crawl
- `POST /kb-drafts/{id}/documents/notion` - Add Notion pages
- `POST /kb-drafts/{id}/documents/google-drive` - Add Google Drive files
- `POST /kb-drafts/{id}/documents/text` - Add pasted text

### Source Management
- `GET /kb-drafts/{id}/sources` - List sources
- `DELETE /kb-drafts/{id}/sources/{sourceId}` - Remove source

### Preview & Testing
- `POST /kb-drafts/{id}/preview-chunks` - Preview chunking

### Integrations
- `GET /credentials/` - Check credentials
- `GET /integrations/notion/pages` - Fetch Notion pages
- `GET /integrations/google-drive/files` - Fetch Google Drive files
- `/credentials/oauth/authorize` - OAuth redirect

---

## Design Principles

### 1. **Progressive Disclosure**
Components reveal complexity gradually:
- Start with simple source selection
- Show advanced options when needed
- Hide OAuth complexity behind "Connect" button

### 2. **Visual Feedback**
- Status badges (Pending, Processing, Completed, Error)
- Progress indicators
- Color coding (green=success, red=error, yellow=warning, blue=info)
- Icons for each source type

### 3. **Validation & Guidance**
- URL validation
- Minimum content length warnings
- Cost/time estimations
- Best practice tips
- Configuration recommendations

### 4. **Real-time Updates**
- Polling for status changes (SourcesList)
- Optimistic UI updates
- Auto-refresh buttons

### 5. **Error Handling**
- Error message display
- Retry mechanisms
- Fallback states
- Empty state messaging

---

## File Structure

```
/frontend/src/
└── components/
    └── kb/
        ├── SourceSelector.tsx              ✅ Created
        ├── FileUploader.tsx                ✅ Created
        ├── WebsiteCrawler.tsx              ✅ Created
        ├── NotionIntegration.tsx           ✅ Created
        ├── GoogleDocsIntegration.tsx       ✅ Created
        ├── TextPasteInput.tsx              ✅ Created
        ├── DocumentAnnotationForm.tsx      ✅ Created
        ├── ChunkConfigPanel.tsx            ✅ Created
        ├── IndexingConfigPanel.tsx         ✅ Created
        ├── ChunkPreview.tsx                ✅ Created
        ├── SourcesList.tsx                 ✅ Created
        └── KBDraftSummary.tsx              ✅ Created
```

---

## Testing Recommendations

### Unit Tests

```typescript
// SourceSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import SourceSelector from './SourceSelector';

test('calls onSelectSource when source is clicked', () => {
  const mockOnSelect = jest.fn();
  render(<SourceSelector onSelectSource={mockOnSelect} />);

  fireEvent.click(screen.getByText(/Upload Files/i));
  expect(mockOnSelect).toHaveBeenCalledWith('file_upload');
});
```

### Integration Tests

```typescript
// ChunkConfigPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ChunkConfigPanel from './ChunkConfigPanel';

test('updates config when slider changes', () => {
  const mockOnChange = jest.fn();
  const config = { strategy: 'recursive', chunk_size: 1000, chunk_overlap: 200 };

  render(<ChunkConfigPanel config={config} onChange={mockOnChange} />);

  const slider = screen.getByLabelText(/chunk size/i);
  fireEvent.change(slider, { target: { value: '2000' } });

  expect(mockOnChange).toHaveBeenCalledWith({
    ...config,
    chunk_size: 2000,
  });
});
```

---

## Status: ✅ COMPLETE

All 12 KB components are production-ready with:
- Full TypeScript implementation
- OAuth integration for cloud sources
- Multi-select functionality
- Real-time status tracking
- Cost/time estimations
- Preview capabilities
- Beautiful UI with Tailwind CSS
- Consistent error handling
- Comprehensive validation

These components can be integrated into the KBCreationWizard page for a complete knowledge base creation flow.
