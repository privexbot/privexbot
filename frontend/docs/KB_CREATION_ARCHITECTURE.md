# Knowledge Base Creation - Frontend Architecture Design

## Overview

This document outlines the frontend architecture for the Knowledge Base creation feature in PrivexBot, focusing on a human-centered design approach with real-time pipeline monitoring and intuitive configuration options.

## Design Principles

1. **Progressive Disclosure**: Start simple, reveal complexity as needed
2. **Real-time Feedback**: Instant preview, live validation, progress monitoring
3. **Draft-First**: All changes saved to Redis draft before committing
4. **Extensible**: Designed to support multiple source types (starting with web URLs)
5. **Error Recovery**: Graceful handling of failures with clear recovery paths

## Page Architecture

### 1. Knowledge Base List Page (`/knowledge-bases`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Knowledge Bases                                   [+ Create KB] │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [All Workspaces ▼] [All Status ▼] [All Context ▼]     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📚 Product Documentation          Status: Ready          │    │
│  │ 50 documents • 847 chunks • Updated 2 hours ago         │    │
│  │ [View] [Edit] [Re-index] [Delete]                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📚 API Reference                  Status: Processing     │    │
│  │ Processing... 45% complete                              │    │
│  │ [View Progress]                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Knowledge Base Creation Page (`/knowledge-bases/create`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Knowledge Bases                                      │
│                                                                  │
│  Create Knowledge Base                                          │
│  Build a comprehensive knowledge source for your chatbots       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Basic Information                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Name *              [Product Documentation            ] │    │
│  │ Description         [Comprehensive product docs       ] │    │
│  │ Workspace *         [Customer Support ▼               ] │    │
│  │ Context *           (•) Both  ( ) Chatbot  ( ) Chatflow │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Step 2: Add Sources                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Choose Source Type:                                     │    │
│  │ [📄 Files] [🌐 Website] [📝 Text] [🔗 Integrations]      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  │ Website URLs                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ URL: [https://docs.example.com                       ] │    │
│  │ □ Include subdomains                                  │    │
│  │                                                        │    │
│  │ Advanced Options ▼                                    │    │
│  │ ├─ Crawl Method: [Crawl ▼] (Single Page/Crawl/Map)   │    │
│  │ ├─ Max Pages: [50] (1-1000)                           │    │
│  │ ├─ Max Depth: [3] (1-10)                              │    │
│  │ ├─ Include Patterns: [/docs/**, /api/**]             │    │
│  │ └─ Exclude Patterns: [/admin/**, /auth/**]           │    │
│  │                                                        │    │
│  │ [+ Add URL]                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Added Sources (2):                                             │
│  • https://docs.example.com (crawl, max 50 pages) [Remove]      │
│  • https://api.example.com (single page) [Remove]               │
│                                                                  │
│  Step 3: Configure Processing                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Chunking Strategy                                      │    │
│  │ Strategy: [By Heading (Recommended) ▼]                │    │
│  │   • Recursive (General purpose)                       │    │
│  │   • By Heading (Documentation) ✓                      │    │
│  │   • Semantic (Smart topics)                           │    │
│  │   • Adaptive (Auto-select)                            │    │
│  │                                                        │    │
│  │ Chunk Size: [1000] ━━━━━━━━━━━━━━━━ (100-5000)        │    │
│  │ Chunk Overlap: [200] ━━━━━━━━━ (0-1000)               │    │
│  │                                                        │    │
│  │ [Preview Chunking] (Optional but recommended)         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Estimated Processing: ~5 minutes for 50 pages                  │
│                                                                  │
│  [Cancel]                              [Create Knowledge Base]   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Processing Monitor Page (`/knowledge-bases/{id}/processing`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Processing Knowledge Base                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Product Documentation"                                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ████████████████████░░░░░░░░░░░ 46%                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Current Step: Chunking Documents                               │
│  Processing document 23 of 50: "Getting Started Guide"          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Pipeline Status                                        │    │
│  │ ✅ Fetching URLs           (50 pages fetched)         │    │
│  │ ✅ Parsing Content         (50 documents parsed)      │    │
│  │ ⏳ Chunking Documents      (23/50 complete)           │    │
│  │ ⏸️ Generating Embeddings   (Waiting...)               │    │
│  │ ⏸️ Indexing Vectors        (Waiting...)               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Estimated time remaining: ~3 minutes                           │
│                                                                  │
│  [Run in Background]                    [View Details ▼]        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Chunking Preview Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Preview Chunking Strategy                                  [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Analyzing 5 sample pages...                                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Preview Results                                        │    │
│  │                                                        │    │
│  │ Strategy: By Heading (Optimized for documentation)    │    │
│  │ Pages Analyzed: 5 of 50                               │    │
│  │ Total Chunks Generated: 123                           │    │
│  │ Estimated Total: ~450 chunks                          │    │
│  │                                                        │    │
│  │ Page Breakdown:                                        │    │
│  │ ├─ intro.html: 23 chunks                              │    │
│  │ ├─ getting-started.html: 31 chunks                    │    │
│  │ ├─ api-reference.html: 42 chunks                      │    │
│  │ ├─ examples.html: 15 chunks                           │    │
│  │ └─ faq.html: 12 chunks                                │    │
│  │                                                        │    │
│  │ Sample Chunks:                                        │    │
│  │ ┌──────────────────────────────────────────────┐      │    │
│  │ │ Chunk 1 (456 tokens):                       │      │    │
│  │ │ "# Introduction                              │      │    │
│  │ │  Welcome to our product documentation..."   │      │    │
│  │ │ [View Full Content ▼]                       │      │    │
│  │ └──────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Try Different Strategy]              [Use This Strategy]      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Structure

```
frontend/src/
├── pages/
│   ├── knowledge-bases/
│   │   ├── index.tsx                 # KB list page
│   │   ├── create.tsx                # KB creation page
│   │   └── [id]/
│   │       ├── index.tsx             # KB details page
│   │       └── processing.tsx        # Processing monitor
│
├── components/
│   └── knowledge-base/
│       ├── KBList.tsx                # KB list component
│       ├── KBCard.tsx                # Individual KB card
│       ├── KBFilters.tsx             # Filter controls
│       ├── KBCreationWizard.tsx      # Main creation wizard
│       ├── KBBasicInfoStep.tsx       # Step 1: Basic info
│       ├── KBSourcesStep.tsx         # Step 2: Add sources
│       ├── KBWebSourceForm.tsx       # Web URL source form
│       ├── KBProcessingConfig.tsx    # Step 3: Processing config
│       ├── KBChunkingPreview.tsx     # Chunking preview modal
│       ├── KBPipelineMonitor.tsx     # Pipeline progress monitor
│       └── KBProcessingStatus.tsx    # Processing status display
│
├── types/
│   └── knowledge-base.ts             # TypeScript types for KB
│
├── store/
│   └── kb-store.ts                   # Zustand store for KB state
│
├── api/
│   └── knowledge-base.ts             # KB API client functions
│
├── hooks/
│   ├── useKBDraft.ts                 # Draft management hook
│   ├── useKBPipeline.ts              # Pipeline polling hook
│   └── useKBPreview.ts               # Chunking preview hook
│
└── utils/
    └── kb-validation.ts              # Validation utilities
```

## State Management

### KB Store (Zustand)

```typescript
interface KBStore {
  // List State
  kbs: KnowledgeBase[];
  filters: KBFilters;
  isLoading: boolean;

  // Draft State
  currentDraft: KBDraft | null;
  draftSources: KBSource[];
  chunkingConfig: ChunkingConfig;

  // Pipeline State
  activePipelines: Map<string, PipelineStatus>;

  // Actions
  fetchKBs: (filters?: KBFilters) => Promise<void>;
  createDraft: (workspaceId: string) => Promise<void>;
  addSource: (source: KBSource) => Promise<void>;
  removeSource: (sourceId: string) => void;
  updateChunkingConfig: (config: ChunkingConfig) => void;
  finalizeDraft: () => Promise<{ kbId: string; pipelineId: string }>;
  pollPipeline: (pipelineId: string) => void;
  clearDraft: () => void;
}
```

## API Integration

### Endpoints to Implement

```typescript
// KB Draft Management
POST   /api/v1/kb-drafts/                    // Create draft
GET    /api/v1/kb-drafts/{draft_id}          // Get draft
POST   /api/v1/kb-drafts/{id}/sources/web    // Add web source
DELETE /api/v1/kb-drafts/{id}/sources/{sid}  // Remove source
POST   /api/v1/kb-drafts/{id}/chunking       // Update chunking
POST   /api/v1/kb-drafts/{id}/preview        // Preview chunking
GET    /api/v1/kb-drafts/{id}/validate       // Validate draft
POST   /api/v1/kb-drafts/{id}/finalize       // Finalize draft

// KB Management
GET    /api/v1/kbs/                          // List KBs
GET    /api/v1/kbs/{kb_id}                   // Get KB details
DELETE /api/v1/kbs/{kb_id}                   // Delete KB
POST   /api/v1/kbs/{kb_id}/reindex           // Re-index KB

// Pipeline Monitoring
GET    /api/v1/pipelines/{id}/status         // Get pipeline status
GET    /api/v1/pipelines/{id}/logs           // Get pipeline logs
```

## User Experience Flows

### Flow 1: Quick KB Creation (Minimal Configuration)

1. User clicks "Create KB"
2. Enters name and selects workspace
3. Adds single URL
4. Uses default chunking settings
5. Clicks "Create" → Processing starts
6. Auto-redirects to processing page
7. Shows completion notification

### Flow 2: Advanced KB Creation (With Preview)

1. User clicks "Create KB"
2. Fills basic information
3. Adds multiple URLs with patterns
4. Clicks "Preview Chunking"
5. Reviews preview results
6. Adjusts chunking parameters
7. Re-previews if needed
8. Clicks "Create" → Processing starts
9. Monitors real-time progress
10. Views completed KB

### Flow 3: Error Recovery

1. URL fetch fails → Show error inline
2. Draft expires → Auto-recovery from local storage
3. Pipeline fails → Show retry option
4. Network interruption → Exponential backoff retry

## Validation Rules

### Frontend Validation

- **Name**: Required, 3-100 characters
- **Workspace**: Required, must be valid UUID
- **Context**: Required, must be one of: chatbot, chatflow, both
- **URLs**: At least one source required
- **URL Format**: Must be valid HTTP/HTTPS URL
- **Max Pages**: 1-1000
- **Max Depth**: 1-10
- **Chunk Size**: 100-5000
- **Chunk Overlap**: 0-1000, must be less than chunk size

### Backend Validation

- Workspace access permission
- URL accessibility
- Resource limits (based on plan)
- Draft expiration

## Error Handling

### User-Friendly Error Messages

```typescript
const ERROR_MESSAGES = {
  DRAFT_EXPIRED: "Your session has expired. Would you like to start over?",
  URL_UNREACHABLE: "Unable to access this URL. Please check and try again.",
  QUOTA_EXCEEDED: "You've reached your plan limit. Upgrade to add more KBs.",
  PROCESSING_FAILED: "Processing failed. Click to retry or contact support.",
  NETWORK_ERROR: "Connection lost. We'll retry automatically...",
};
```

### Error Recovery Strategies

1. **Auto-save drafts** every 30 seconds
2. **Local storage backup** for draft recovery
3. **Retry mechanisms** with exponential backoff
4. **Graceful degradation** when services unavailable
5. **Clear action items** for user recovery

## Performance Optimizations

1. **Lazy Loading**: Load sources list on demand
2. **Debounced Updates**: 500ms debounce for form changes
3. **Optimistic UI**: Update UI before API confirms
4. **Progressive Enhancement**: Show basic UI, enhance with features
5. **Virtualized Lists**: For large KB lists
6. **Caching**: SWR for KB list and details

## Accessibility

1. **Keyboard Navigation**: Full keyboard support
2. **Screen Reader**: ARIA labels and live regions
3. **Focus Management**: Proper focus on modals/dialogs
4. **Error Announcements**: Live region for errors
5. **Loading States**: Clear loading indicators

## Mobile Responsiveness

1. **Responsive Grid**: Stack on mobile
2. **Touch-Friendly**: Large tap targets (44x44px)
3. **Swipe Gestures**: Swipe to delete/edit
4. **Bottom Sheets**: Replace modals on mobile
5. **Simplified Forms**: Progressive disclosure

## Future Enhancements

### Phase 2: Additional Sources
- File uploads (drag & drop)
- Direct text paste
- Google Docs integration
- Notion integration

### Phase 3: Advanced Features
- Scheduled re-indexing
- Version control for KBs
- A/B testing different strategies
- Custom chunking strategies
- Bulk operations

### Phase 4: Analytics
- Query performance metrics
- Chunk usage analytics
- Source contribution analysis
- Optimization recommendations

## Testing Strategy

### Unit Tests
- Form validation logic
- Draft state management
- Pipeline polling logic
- Error handling utilities

### Integration Tests
- Complete KB creation flow
- Preview generation
- Pipeline monitoring
- Error recovery

### E2E Tests
- Full user journey from creation to completion
- Network failure scenarios
- Draft expiration handling
- Multi-tab synchronization

## Deployment Considerations

1. **Feature Flags**: Gradual rollout
2. **Monitoring**: Track creation success rates
3. **Analytics**: User behavior tracking
4. **A/B Testing**: Test different UI variations
5. **Performance**: Monitor API response times

## Success Metrics

1. **Creation Success Rate**: > 95%
2. **Average Time to Create**: < 2 minutes
3. **Preview Usage**: > 60% use preview
4. **Error Recovery Rate**: > 90% recover from errors
5. **User Satisfaction**: > 4.5/5 rating

---

This architecture provides a solid foundation for building an intuitive, robust Knowledge Base creation feature that scales with user needs while maintaining simplicity for beginners.