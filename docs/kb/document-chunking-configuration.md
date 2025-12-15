# Document-Level Chunking Configuration Implementation

## Current State Analysis

### Backend Support (✅ Already Implemented)
The backend already supports document-level chunking configuration through the processing task parameters:

```python
# In process_document_task (tasks/document_processing_tasks.py)
@shared_task
def process_document_task(document_id: str, content: str, kb_config: dict):
    # The kb_config parameter can include document-specific overrides
    chunking_config = kb_config.get("chunking_config", DEFAULT_CHUNKING_CONFIG)

    chunks = chunking_service.chunk_document(
        text=content,
        strategy=chunking_config.get("strategy", "recursive"),
        chunk_size=chunking_config.get("chunk_size", 1000),
        chunk_overlap=chunking_config.get("chunk_overlap", 200)
    )
```

### Frontend Gap (❌ Not Implemented)
The frontend document creation forms don't expose chunking configuration options. They only pass the content and rely on KB-level defaults.

## Implementation Plan

### 1. Extend Document Creation Request Schema

**Backend Changes (Minimal)**:

```python
# In routes/kb.py - Update CreateDocumentRequest
class CreateDocumentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=50, max_length=10_000_000)
    source_type: str = Field(default="text_input")
    custom_metadata: Optional[Dict[str, Any]] = Field(default=None)
    annotations: Optional[Dict[str, Any]] = Field(default=None)

    # NEW: Optional chunking configuration override
    chunking_config: Optional[ChunkingConfigOverride] = Field(default=None)

class ChunkingConfigOverride(BaseModel):
    """Override chunking configuration for this specific document"""
    use_kb_default: bool = Field(default=True, description="Use KB's chunking config")
    strategy: Optional[str] = Field(default=None, description="Chunking strategy override")
    chunk_size: Optional[int] = Field(default=None, ge=100, le=10000, description="Chunk size override")
    chunk_overlap: Optional[int] = Field(default=None, ge=0, le=1000, description="Chunk overlap override")
```

**Update Document Creation Endpoint**:
```python
@router.post("/kbs/{kb_id}/documents")
async def create_document(
    kb_id: str,
    request: CreateDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ... existing validation code ...

    # Build processing configuration
    kb_config = kb.config or {}

    # Merge KB config with document-specific overrides
    processing_config = _build_document_processing_config(kb_config, request.chunking_config)

    # Queue processing task with merged configuration
    process_document_task.apply_async(
        kwargs={
            "document_id": str(new_document.id),
            "content": request.content,
            "kb_config": processing_config  # Contains document-specific overrides
        },
        queue="default"
    )

def _build_document_processing_config(
    kb_config: dict,
    document_chunking_override: Optional[ChunkingConfigOverride]
) -> dict:
    """
    Build final processing configuration by merging KB defaults with document overrides
    """

    # Start with KB configuration
    processing_config = kb_config.copy()
    kb_chunking = processing_config.get("chunking_config", {})

    # Apply document-level overrides if specified
    if document_chunking_override and not document_chunking_override.use_kb_default:
        document_chunking = {}

        if document_chunking_override.strategy:
            document_chunking["strategy"] = document_chunking_override.strategy

        if document_chunking_override.chunk_size:
            document_chunking["chunk_size"] = document_chunking_override.chunk_size

        if document_chunking_override.chunk_overlap is not None:
            document_chunking["chunk_overlap"] = document_chunking_override.chunk_overlap

        # Merge with KB defaults (document overrides take precedence)
        final_chunking_config = {**kb_chunking, **document_chunking}
        processing_config["chunking_config"] = final_chunking_config

    return processing_config
```

### 2. Frontend Implementation

**Step 1: Create Chunking Configuration Component**

```typescript
// components/kb/DocumentChunkingConfig.tsx
interface DocumentChunkingConfigProps {
  kbChunkingConfig: ChunkingConfig;
  value: DocumentChunkingOverride;
  onChange: (config: DocumentChunkingOverride) => void;
  isVisible?: boolean;
}

interface DocumentChunkingOverride {
  useKbDefault: boolean;
  strategy?: ChunkingStrategy;
  chunk_size?: number;
  chunk_overlap?: number;
}

export function DocumentChunkingConfig({
  kbChunkingConfig,
  value,
  onChange,
  isVisible = false
}: DocumentChunkingConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={isVisible ? "border-primary" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Chunking Configuration</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            <Settings className="h-4 w-4 mr-2" />
            {isExpanded ? 'Hide' : 'Configure'}
          </Button>
        </div>
        <CardDescription>
          Configure how this document will be split into chunks for processing.
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="useKbDefault"
              checked={value.useKbDefault}
              onCheckedChange={(checked) =>
                onChange({ ...value, useKbDefault: checked as boolean })
              }
            />
            <Label htmlFor="useKbDefault">Use KB default settings</Label>
          </div>

          {/* Current KB Settings Display */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>KB Default:</strong> {kbChunkingConfig.strategy} strategy,
              {kbChunkingConfig.chunk_size} chunk size, {kbChunkingConfig.chunk_overlap} overlap
            </AlertDescription>
          </Alert>

          {!value.useKbDefault && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="strategy">Chunking Strategy</Label>
                <Select
                  value={value.strategy || kbChunkingConfig.strategy}
                  onValueChange={(strategy) =>
                    onChange({ ...value, strategy: strategy as ChunkingStrategy })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select chunking strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recursive">Recursive (Default)</SelectItem>
                    <SelectItem value="sentence_based">Sentence-based</SelectItem>
                    <SelectItem value="by_heading">By Heading</SelectItem>
                    <SelectItem value="no_chunking">No Chunking</SelectItem>
                    <SelectItem value="adaptive">Adaptive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {value.strategy !== "no_chunking" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="chunkSize">
                      Chunk Size ({value.chunk_size || kbChunkingConfig.chunk_size} characters)
                    </Label>
                    <Slider
                      id="chunkSize"
                      min={200}
                      max={5000}
                      step={100}
                      value={[value.chunk_size || kbChunkingConfig.chunk_size]}
                      onValueChange={([size]) =>
                        onChange({ ...value, chunk_size: size })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chunkOverlap">
                      Chunk Overlap ({value.chunk_overlap ?? kbChunkingConfig.chunk_overlap} characters)
                    </Label>
                    <Slider
                      id="chunkOverlap"
                      min={0}
                      max={Math.min(500, (value.chunk_size || kbChunkingConfig.chunk_size) / 2)}
                      step={25}
                      value={[value.chunk_overlap ?? kbChunkingConfig.chunk_overlap]}
                      onValueChange={([overlap]) =>
                        onChange({ ...value, chunk_overlap: overlap })
                      }
                    />
                  </div>
                </>
              )}

              {/* Strategy-specific help text */}
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  {getChunkingStrategyDescription(value.strategy || kbChunkingConfig.strategy)}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function getChunkingStrategyDescription(strategy: ChunkingStrategy): string {
  const descriptions = {
    recursive: "Splits text using hierarchical separators (paragraphs → sentences → words). Good for general content.",
    sentence_based: "Splits on sentence boundaries while respecting chunk size limits. Preserves natural language flow.",
    by_heading: "Splits content based on heading structure. Ideal for structured documents with clear sections.",
    no_chunking: "Keeps the entire document as one chunk. Best for short documents or structured data.",
    adaptive: "Automatically selects the best strategy based on content analysis. Recommended for mixed content types.",
  };
  return descriptions[strategy] || "Custom chunking strategy.";
}
```

**Step 2: Update Documents Page**

```typescript
// pages/knowledge-bases/documents.tsx
// Add to textDocumentData state
const [textDocumentData, setTextDocumentData] = useState({
  title: '',
  content: '',
  chunkingConfig: {
    useKbDefault: true,
    strategy: undefined,
    chunk_size: undefined,
    chunk_overlap: undefined
  } as DocumentChunkingOverride
});

// Add chunking config to create document handler
const handleCreateTextDocument = async () => {
  // ... existing validation ...

  const documentData = {
    name: textDocumentData.title.trim(),
    content: textDocumentData.content.trim(),
    source_type: 'text_input',
    chunking_config: textDocumentData.chunkingConfig.useKbDefault
      ? null
      : textDocumentData.chunkingConfig
  };

  const newDocument = await kbClient.kb.createDocument(kbId, documentData);
  // ... rest of handler
};

// Add chunking configuration to dialog
<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle>Create Text Document</DialogTitle>
    <DialogDescription>
      Add a text document directly to the knowledge base
    </DialogDescription>
  </DialogHeader>
  <div className="space-y-4">
    {/* Existing title and content fields */}

    {/* NEW: Chunking Configuration */}
    <DocumentChunkingConfig
      kbChunkingConfig={kb?.config?.chunking_config || DEFAULT_CHUNKING_CONFIG}
      value={textDocumentData.chunkingConfig}
      onChange={(config) => setTextDocumentData(prev => ({
        ...prev,
        chunkingConfig: config
      }))}
      isVisible={!textDocumentData.chunkingConfig.useKbDefault}
    />

    {/* Existing dialog footer */}
  </div>
</DialogContent>
```

**Step 3: Update File Upload Dialog**

```typescript
// Similar pattern for file upload
const [uploadChunkingConfig, setUploadChunkingConfig] = useState<DocumentChunkingOverride>({
  useKbDefault: true
});

const handleFileUpload = async () => {
  if (!selectedFile || !kbId) return;

  setIsUploading(true);
  try {
    const formData = new FormData();
    formData.append('file', selectedFile);

    // Add chunking config if overridden
    if (!uploadChunkingConfig.useKbDefault) {
      formData.append('chunking_config', JSON.stringify(uploadChunkingConfig));
    }

    const newDocument = await kbClient.kb.uploadDocument(kbId, formData);
    // ... rest of handler
  }
};

// Add to upload dialog
<DialogContent className="max-w-3xl">
  {/* Existing file selection */}

  {/* NEW: Chunking Configuration for uploads */}
  <DocumentChunkingConfig
    kbChunkingConfig={kb?.config?.chunking_config || DEFAULT_CHUNKING_CONFIG}
    value={uploadChunkingConfig}
    onChange={setUploadChunkingConfig}
    isVisible={!uploadChunkingConfig.useKbDefault}
  />
</DialogContent>
```

### 3. Enhanced API Client

**Update KB Client**:
```typescript
// lib/kb-client.ts
interface CreateDocumentRequest {
  name: string;
  content: string;
  source_type?: string;
  chunking_config?: DocumentChunkingOverride | null;
}

interface DocumentChunkingOverride {
  useKbDefault: boolean;
  strategy?: ChunkingStrategy;
  chunk_size?: number;
  chunk_overlap?: number;
}

export const kb = {
  createDocument: async (kbId: string, data: CreateDocumentRequest) => {
    const response = await apiClient.post(`/kbs/${kbId}/documents`, data);
    return response.data;
  },

  uploadDocument: async (kbId: string, formData: FormData) => {
    const response = await apiClient.post(
      `/kbs/${kbId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};
```

### 4. Preview Functionality (Bonus)

**Add Chunk Preview Endpoint**:
```python
# routes/kb.py
@router.post("/preview/chunks")
async def preview_chunks(request: ChunkPreviewRequest):
    """Preview how content will be chunked without creating a document"""

    chunks = chunking_service.chunk_document(
        text=request.content,
        strategy=request.strategy,
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap
    )

    # Return preview with statistics
    return ChunkPreviewResponse(
        total_chunks=len(chunks),
        avg_chunk_size=sum(len(c["content"]) for c in chunks) / len(chunks),
        preview_chunks=chunks[:3],  # First 3 chunks
        estimated_tokens=sum(c.get("token_count", 0) for c in chunks),
        strategy_used=request.strategy
    )

class ChunkPreviewRequest(BaseModel):
    content: str
    strategy: str = "recursive"
    chunk_size: int = 1000
    chunk_overlap: int = 200

class ChunkPreviewResponse(BaseModel):
    total_chunks: int
    avg_chunk_size: float
    preview_chunks: List[Dict[str, Any]]
    estimated_tokens: int
    strategy_used: str
```

**Frontend Preview Component**:
```typescript
function ChunkPreview({ content, config }: { content: string; config: ChunkingConfig }) {
  const [preview, setPreview] = useState<ChunkPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPreview = async () => {
    if (content.length < 100) return; // Too short to preview

    setIsLoading(true);
    try {
      const response = await apiClient.post('/preview/chunks', {
        content,
        strategy: config.strategy,
        chunk_size: config.chunk_size,
        chunk_overlap: config.chunk_overlap
      });
      setPreview(response.data);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadPreview, 500); // Debounce
    return () => clearTimeout(timer);
  }, [content, config]);

  if (!preview) return null;

  return (
    <Alert>
      <BarChart className="h-4 w-4" />
      <AlertDescription>
        <strong>Preview:</strong> {preview.total_chunks} chunks,
        avg {Math.round(preview.avg_chunk_size)} characters,
        ~{preview.estimated_tokens} tokens total

        {preview.preview_chunks.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">
              View first {preview.preview_chunks.length} chunks
            </summary>
            <div className="mt-2 space-y-2">
              {preview.preview_chunks.map((chunk, i) => (
                <div key={i} className="p-2 bg-muted rounded text-xs">
                  <strong>Chunk {i + 1}:</strong> {chunk.content.substring(0, 150)}...
                </div>
              ))}
            </div>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

## Summary

This implementation provides:

1. **✅ Document-Level Chunking Configuration**: Users can override KB defaults per document
2. **✅ Consistent with Current Architecture**: Builds on existing backend support
3. **✅ Progressive Enhancement**: Default behavior unchanged, new features are opt-in
4. **✅ Preview Capability**: Users can see how content will be chunked before processing
5. **✅ Clear UI/UX**: Collapsible configuration with helpful descriptions

The key insight is that **the backend already supports this functionality** - we just need to expose it through the frontend UI and update the API request schemas to pass the configuration through to the processing tasks.