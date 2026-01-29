# Design Document: MVP Architecture Refactor

## Overview

This design consolidates the AI-powered video ad generation tool from a dual-service architecture (Hono API + Next.js) into a single Next.js application using App Router and Route Handlers. The refactor eliminates routing duplication, authentication complexity, and streaming protocol overhead while implementing a "project as conversation thread" pattern where every generation and edit becomes a typed message with artifact references.

**Key Architectural Changes:**
- Single Next.js app with App Router + Route Handlers (no Hono)
- **AI SDK Data Stream (SSE) for streaming** - uses Vercel AI SDK's built-in protocol for chat + custom events (not hand-rolled JSONL)
- Vercel AI SDK for Gemini streaming + structured output (no json-render.dev)
- Remotion Player scaling fix (responsive container, 1920px composition)
- Project as conversation thread with typed messages and checkpoints
- **SQS + Lambda worker for async rendering** - keeps Route Handlers thin, avoids Next.js/Vercel function duration limits
- Soft-cancel for render jobs with truthful state transitions (worker checks cancelRequested flag on each poll)
- **Short-lived signed URLs (1 hour)** - generate on demand, never store long-lived or public URLs
- **Idempotency and rate limiting post-MVP** - implement after core happy path is stable

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│  App Router (UI)          │  Route Handlers (API)           │
│  - Empty State            │  - POST /api/projects           │
│  - Generating State       │  - POST /api/projects/:id/      │
│  - Generated State        │      messages                   │
│  - Editor + Chat          │  - POST /api/projects/:id/      │
│                           │      generate                   │
│                           │  - POST /api/projects/:id/      │
│                           │      regenerate-scene           │
│                           │  - POST /api/projects/:id/      │
│                           │      render                     │
│                           │  - GET /api/render-jobs/:id/    │
│                           │      progress                   │
│                           │  - POST /api/render-jobs/:id/   │
│                           │      cancel                     │
│                           │  - GET /api/render-jobs/:id/    │
│                           │      download-url               │
├─────────────────────────────────────────────────────────────┤
│                    Vercel AI SDK Layer                       │
│  - streamObject() for storyboard generation                 │
│  - google.tools.urlContext() for URL extraction             │
│  - Zod schemas for structured output validation             │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                         │
│  - Drizzle ORM                                              │
│  - PostgreSQL (project, message, checkpoint, render_job)    │
├─────────────────────────────────────────────────────────────┤
│                   External Services                          │
│  - Better Auth (magic link)                                 │
│  - Gemini 2.5 Flash (via AI SDK)                           │
│  - SQS (render job queue)                                   │
│  - Lambda Worker (render orchestration)                     │
│  - Remotion Lambda (video rendering)                        │
│  - S3 (asset storage with signed URLs)                      │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow Examples

**Generation Flow:**
```
User submits URL
  → POST /api/projects/:id/generate
    → Validate auth + input
    → Check idempotency
    → Create user message (url_submitted)
    → Return createDataStreamResponse with execute callback
      → Send initial progress event via dataStream.writeData()
      → Call streamObject() with Gemini + urlContext
      → Stream partial objects via dataStream.writeData()
      → Generate storyboard + script + brandKit
      → Create checkpoint
      → Create assistant message (generation_result)
      → Update project.activeCheckpointId
      → Store idempotency key
      → Send completion event via dataStream.writeData()
```

**Render Flow:**
```
User requests render
  → POST /api/projects/:id/render
    → Validate auth + input
    → Check idempotency
    → Create render_job (status: pending)
    → Create message (render_requested)
    → Enqueue { renderJobId } to SQS
    → Return render job ID immediately

SQS Worker (async)
  → Receive { renderJobId } from queue
    → Load render_job + checkpoint
    → Mark status: rendering
    → Invoke Remotion Lambda
    → Poll Remotion Lambda progress
    → Update render_job progress in DB
    → Check cancelRequested flag on each poll
    → On completion:
      → If cancelRequested: mark cancelled, don't surface output
      → Else: store outputS3Key, mark completed
      → Create render_completed message

User polls progress
  → GET /api/render-jobs/:id/progress (every 3-5s)
    → Read render_job status/progress from DB
    → Return current state
    → (After 60s, back off to 10s polling)
```

## Components and Interfaces

### Database Schema

**project table:**
```typescript
{
  id: string (uuid, primary key)
  userId: string (foreign key to user)
  title: string
  activeCheckpointId: string | null (foreign key to checkpoint)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**message table:**
```typescript
{
  id: string (uuid, primary key)
  projectId: string (foreign key to project)
  role: 'user' | 'assistant' | 'system'
  type: MessageType (discriminated union)
  contentJson: JSONB (versioned, type-specific schema)
  createdAt: timestamp
}
```

**checkpoint table:**
```typescript
{
  id: string (uuid, primary key)
  projectId: string (foreign key to project)
  name: string
  sourceMessageId: string (foreign key to message)
  parentCheckpointId: string | null (foreign key to checkpoint)
  storyboardJson: JSONB (versioned)
  scriptJson: JSONB (versioned)
  brandKitJson: JSONB (versioned)
  createdAt: timestamp
}
```

**render_job table:**
```typescript
{
  id: string (uuid, primary key)
  projectId: string (foreign key to project)
  sourceCheckpointId: string (foreign key to checkpoint)
  sourceMessageId: string (foreign key to message)
  format: '1:1' | '9:16' | '16:9'
  status: 'pending' | 'rendering' | 'completed' | 'failed' | 'cancel_requested' | 'cancelled'
  progress: number (0-100)
  outputS3Key: string | null
  cancelRequested: boolean
  lastError: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

**idempotency_key table:**
```typescript
{
  id: string (uuid, primary key)
  userId: string (foreign key to user)
  projectId: string (foreign key to project)
  operation: 'generate' | 'regenerate_scene' | 'render'
  key: string
  resultRef: string (messageId or renderJobId)
  createdAt: timestamp

  unique constraint on (userId, operation, key)
}
```

### Message Type Schemas

**Message Type Discriminated Union:**
```typescript
type TMessageContent =
  | TUrlSubmitted
  | TGenerationProgress
  | TGenerationResult
  | TCheckpointCreated
  | TCheckpointApplied
  | TSceneRegenerated
  | TRenderRequested
  | TRenderProgress
  | TRenderCompleted

interface TMessageBase {
  version: string
  artifactRefs: TArtifactRef[]
}

interface TArtifactRef {
  type: 'checkpoint' | 'render_job'
  id: string
}
```

**url_submitted:**
```typescript
interface TUrlSubmitted extends TMessageBase {
  type: 'url_submitted'
  url: string
  format: '1:1' | '9:16' | '16:9'
  tone?: string
}
```

**generation_progress:**
```typescript
interface TGenerationProgress extends TMessageBase {
  type: 'generation_progress'
  message: string
  progress: number
}
```

**generation_result:**
```typescript
interface TGenerationResult extends TMessageBase {
  type: 'generation_result'
  checkpointId: string
  summary: string
}
```

**checkpoint_created:**
```typescript
interface TCheckpointCreated extends TMessageBase {
  type: 'checkpoint_created'
  checkpointId: string
  reason: 'generation' | 'manual_edit' | 'scene_regeneration' | 'brand_kit_update'
}
```

**checkpoint_applied:**
```typescript
interface TCheckpointApplied extends TMessageBase {
  type: 'checkpoint_applied'
  checkpointId: string
  previousCheckpointId: string | null
}
```

**scene_regenerated:**
```typescript
interface TSceneRegenerated extends TMessageBase {
  type: 'scene_regenerated'
  checkpointId: string
  sceneId: string
  instruction: string
}
```

**render_requested:**
```typescript
interface TRenderRequested extends TMessageBase {
  type: 'render_requested'
  renderJobId: string
  format: '1:1' | '9:16' | '16:9'
}
```

**render_progress:**
```typescript
interface TRenderProgress extends TMessageBase {
  type: 'render_progress'
  renderJobId: string
  progress: number
  status: string
}
```

**render_completed:**
```typescript
interface TRenderCompleted extends TMessageBase {
  type: 'render_completed'
  renderJobId: string
  outputUrl: string | null
  status: 'completed' | 'failed' | 'cancelled'
}
```

### Storyboard Data Model

```typescript
interface TStoryboard {
  version: string
  format: '1:1' | '9:16' | '16:9'
  totalDuration: number
  scenes: TScene[]
}

interface TScene {
  id: string
  duration: number
  onScreenText: string
  voiceoverText: string
  assetSuggestions: TAssetSuggestion[]
}

interface TAssetSuggestion {
  type: 'image' | 'video'
  description: string
  placeholderUrl?: string
}
```

### Script Data Model

```typescript
interface TScript {
  version: string
  tone: string
  scenes: TScriptScene[]
}

interface TScriptScene {
  sceneId: string
  voiceover: string
  timing: {
    start: number
    end: number
  }
}
```

### Brand Kit Data Model

```typescript
interface TBrandKit {
  version: string
  productName: string
  tagline: string
  benefits: string[]
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  fonts: {
    heading: string
    body: string
  }
  tone: string
  pricing?: string
  testimonials?: string[]
  logoUrl?: string
}
```

## Data Models

### Route Handler Patterns

**Authentication Middleware:**
```typescript
async function requireAuth(request: Request): Promise<{ userId: string }> {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  return { userId: session.user.id }
}
```

**Idempotency Check:**
```typescript
async function checkIdempotency(
  key: string,
  projectId: string,
  userId: string,
  operation: 'generate' | 'regenerate_scene' | 'render'
): Promise<{ existing: TMessage | TRenderJob | null }> {
  // Check for existing operation with this idempotency key
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.operation, operation),
        eq(idempotencyKeys.key, key)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Return existing result
    const resultRef = existing[0].resultRef
    if (operation === 'render') {
      return { existing: await getRenderJob(resultRef) }
    } else {
      return { existing: await getMessage(resultRef) }
    }
  }

  return { existing: null }
}

async function storeIdempotencyKey(
  key: string,
  projectId: string,
  userId: string,
  operation: 'generate' | 'regenerate_scene' | 'render',
  resultRef: string
): Promise<void> {
  await db.insert(idempotencyKeys).values({
    id: generateUuid(),
    userId,
    projectId,
    operation,
    key,
    resultRef,
    createdAt: new Date()
  })
}
```

**Streaming Generation Pattern (AI SDK Data Stream):**
```typescript
import { createDataStreamResponse, streamObject } from 'ai'
import { google } from '@ai-sdk/google'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await requireAuth(request)
  const { url, format, tone, idempotencyKey } = await request.json()

  // Check idempotency
  const { existing } = await checkIdempotency(idempotencyKey, params.id, userId)
  if (existing) return Response.json(existing)

  // Create user message
  const userMessage = await createMessage({
    projectId: params.id,
    role: 'user',
    type: 'url_submitted',
    contentJson: { version: '1', url, format, tone, artifactRefs: [] }
  })

  // Stream generation using AI SDK Data Stream
  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Send initial progress event
      dataStream.writeData({
        type: 'generation_progress',
        message: 'Extracting page content',
        progress: 10
      })

      // Stream object generation
      const result = await streamObject({
        model: google('gemini-2.5-flash'),
        schema: storyboardSchema,
        prompt: buildPrompt(url, format, tone),
        tools: {
          url_context: google.tools.urlContext({})
        }
      })

      // Stream partial object updates
      for await (const partial of result.partialObjectStream) {
        dataStream.writeData({
          type: 'generation_partial',
          storyboard: partial
        })
      }

      // Finalize: create checkpoint + message
      const finalObject = await result.object // validated object
      const checkpoint = await createCheckpoint({
        projectId: params.id,
        sourceMessageId: userMessage.id,
        storyboardJson: finalObject.storyboard,
        scriptJson: finalObject.script,
        brandKitJson: finalObject.brandKit
      })

      const assistantMessage = await createMessage({
        projectId: params.id,
        role: 'assistant',
        type: 'generation_result',
        contentJson: {
          version: '1',
          checkpointId: checkpoint.id,
          summary: `${finalObject.storyboard.scenes.length} scenes, ${finalObject.storyboard.totalDuration}s`,
          artifactRefs: [{ type: 'checkpoint', id: checkpoint.id }]
        }
      })

      await updateProject({ id: params.id, activeCheckpointId: checkpoint.id })

      // Store idempotency key
      await storeIdempotencyKey(idempotencyKey, params.id, userId, 'generate', assistantMessage.id)

      // Send completion event
      dataStream.writeData({
        type: 'generation_complete',
        checkpointId: checkpoint.id,
        summary: `${finalObject.storyboard.scenes.length} scenes, ${finalObject.storyboard.totalDuration}s`
      })
    }
  })
}

// Use Node.js runtime for better streaming
export const runtime = 'nodejs'
```

**AI SDK Data Stream Event Types:**
```typescript
type TStreamEvent =
  | { type: 'generation_progress', message: string, progress: number }
  | { type: 'generation_partial', storyboard: Partial<TStoryboard> }
  | { type: 'generation_complete', checkpointId: string, summary: string }
  | { type: 'generation_error', error: string }
```

**Client-Side Consumption (AI SDK):**
```typescript
import { readDataStream } from 'ai'

const response = await fetch('/api/projects/123/generate', {
  method: 'POST',
  body: JSON.stringify({ url, format, tone, idempotencyKey })
})

// Use AI SDK's readDataStream utility
for await (const event of readDataStream(response.body)) {
  handleStreamEvent(event)
}

// Or use React hooks for chat-like UI
import { useChat } from 'ai/react'

const { messages, append, isLoading } = useChat({
  api: '/api/projects/123/generate',
  onFinish: (message) => {
    // Handle completion
  }
})
```

### UI State Management

**Three States:**

1. **Empty State** (activeCheckpointId === null):
   - Full-page centered URL input
   - Recent projects list (5 most recent, sorted by updatedAt desc)
   - Example URLs + "Try demo project" button if no projects

2. **Generating State** (generation in progress):
   - Split view: 50% editor (left) | 50% chat (right)
   - Editor: Locked with placeholders, disabled inputs, scene list skeleton, loading composition
   - Chat: Streaming progress messages
   - "Generating…" indicator

3. **Generated State** (activeCheckpointId !== null):
   - Split view: 60% editor (left) | 40% chat (right)
   - Editor: Remotion Player (responsive), scene list, timeline
   - Chat: Message history + input for commands
   - All controls enabled

### Remotion Player Scaling

**Problem:** Fixed 1920px width causes horizontal overflow

**Solution:**
```typescript
<div style={{ width: '100%', aspectRatio: getAspectRatio(format) }}>
  <Player
    component={AdComposition}
    compositionWidth={FORMAT_SPECS[format].width}
    compositionHeight={FORMAT_SPECS[format].height}
    durationInFrames={getDuration(storyboard)}
    fps={30}
    style={{ width: '100%', height: '100%' }}
    inputProps={{ storyboard, format }}
  />
</div>
```

**Key Points:**
- Container uses `width: '100%'` for responsiveness
- Player uses `style={{ width: '100%' }}` to fill container
- `compositionWidth` and `compositionHeight` set per format for render quality
- Browser scales player proportionally

### Format-Specific Layout Rules

**Content vs Layout Separation:**
- Storyboard content (scenes, text, voiceover) remains identical across formats
- Layout rules applied at render/preview time based on format parameter
- Text positioning, safe areas, and composition dimensions vary by format

**Format Specifications:**
```typescript
const FORMAT_SPECS = {
  '1:1': {
    width: 1080,
    height: 1080,
    safeArea: { top: 100, bottom: 100, left: 100, right: 100 },
    textMaxLength: 80
  },
  '9:16': {
    width: 1080,
    height: 1920,
    safeArea: { top: 200, bottom: 200, left: 50, right: 50 },
    textMaxLength: 60
  },
  '16:9': {
    width: 1920,
    height: 1080,
    safeArea: { top: 100, bottom: 100, left: 200, right: 200 },
    textMaxLength: 100
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Streaming Response Delivery
*For any* generation request, progress events should be delivered incrementally before the final result, not all at once after completion.
**Validates: Requirements 2.2**

### Property 2: Required Extraction Fields
*For any* URL with product information, the extracted data should include product name, tagline, and benefits as minimum fields.
**Validates: Requirements 2.6**

### Property 3: Best-Effort Extraction
*For any* URL containing pricing, testimonials, images, or brand colors, those fields should be extracted when present in the source.
**Validates: Requirements 2.7**

### Property 4: No Horizontal Overflow
*For any* viewport width, the Remotion Player should not cause horizontal scrolling.
**Validates: Requirements 3.4**

### Property 5: Aspect Ratio Preservation
*For any* format (1:1, 9:16, 16:9), scaling the player should maintain the correct aspect ratio.
**Validates: Requirements 3.5**

### Property 6: Message Type Correctness
*For any* event that creates a message (URL submission, generation completion, checkpoint creation/restoration, scene regeneration, render request/completion), the message type field should match the event type.
**Validates: Requirements 4.2, 4.3, 6.9, 6.10, 8.8**

### Property 7: Artifact Reference Linkage
*For any* message that references artifacts (checkpoints or render jobs), the artifactRefs array should contain references to those artifacts.
**Validates: Requirements 4.6**

### Property 8: Chronological Message Ordering
*For any* project, messages should be ordered by createdAt timestamp in ascending order.
**Validates: Requirements 4.7**

### Property 9: Complete Message History
*For any* project, displaying the project should show all messages without omission.
**Validates: Requirements 4.8**

### Property 10: Message Schema Versioning
*For any* message, the contentJson should include a version field.
**Validates: Requirements 5.10**

### Property 11: Message Content Validation
*For any* message, the contentJson should validate against the type-specific Zod schema, and invalid content should be rejected.
**Validates: Requirements 5.11**

### Property 12: Checkpoint Creation Rules
*For any* generation completion, manual edit, scene regeneration, or brand kit update, a checkpoint should be created with a checkpoint_created message, and activeCheckpointId should be updated. For any render-related message (render_requested, render_progress, render_completed), no checkpoint should be created. A checkpoint_applied message should only be created when restoring an older checkpoint into the editor.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 22.3**

### Property 13: Checkpoint Source Linkage
*For any* checkpoint, it should link to the sourceMessageId that triggered its creation.
**Validates: Requirements 6.6**

### Property 14: Checkpoint Restoration
*For any* checkpoint, restoring it should load that checkpoint's storyboard, script, and brand kit data into the editor.
**Validates: Requirements 6.8**

### Property 15: Render from Any Checkpoint
*For any* checkpoint, creating a render job from that checkpoint should succeed.
**Validates: Requirements 6.11**

### Property 16: Soft-Cancel State Machine
*For any* render job, when cancellation is requested: (1) cancel_requested should be set to true, (2) status should transition to 'cancel_requested', (3) when the job completes, status should transition to 'cancelled', (4) outputUrl should not be surfaced to the client.
**Validates: Requirements 7.1, 7.2, 7.4, 7.5**

### Property 17: Generated Artifact Completeness
*For any* generation completion, the storyboard should include scenes with durations/text/voiceover/assets, the script should include tone and per-scene voiceover, and the brand kit should be present.
**Validates: Requirements 8.5, 8.6, 8.7**

### Property 18: Format-Agnostic Content
*For any* storyboard, the scene content (text, voiceover, assets) should remain identical regardless of which format is used for rendering.
**Validates: Requirements 9.5**

### Property 19: Format-Specific Layout Application
*For any* format, rendering or previewing should apply the format-specific layout rules (dimensions, safe areas, text constraints).
**Validates: Requirements 9.6, 9.7**

### Property 20: Multi-Format Rendering
*For any* checkpoint, rendering with different formats (1:1, 9:16, 16:9) should all succeed and produce format-appropriate outputs.
**Validates: Requirements 9.8**

### Property 21: Scene Structure Completeness
*For any* scene in a storyboard, it should include all required fields: id, duration, onScreenText, voiceoverText, and assetSuggestions array.
**Validates: Requirements 10.2, 10.3, 10.4, 10.5**

### Property 22: Total Duration Calculation
*For any* storyboard, the totalDuration should equal the sum of all scene durations.
**Validates: Requirements 10.6**

### Property 23: Storyboard Schema Validation
*For any* storyboard, it should validate against the Zod schema before being saved, and invalid storyboards should be rejected.
**Validates: Requirements 10.7**

### Property 24: Scene Regeneration Isolation
*For any* scene regeneration, only the specified scene should be modified, and all other scenes should remain unchanged.
**Validates: Requirements 14.6**

### Property 25: Render State Transitions
*For any* render job, the status should transition through valid states only:
- pending → rendering → (completed | failed)
- pending → cancel_requested → cancelled
- rendering → cancel_requested → cancelled
- rendering → cancel_requested → completed (output URL not surfaced)
**Validates: Requirements 15.5, 15.6, 15.7, 16.3**

### Property 26: Idempotency Guarantee
*For any* duplicate request with the same idempotencyKey, the system should return the existing result without creating duplicate work.
**Validates: Requirements 20.5, 20.7**

### Property 27: Active Checkpoint Synchronization
*For any* checkpoint creation or restoration, the project's activeCheckpointId should be updated to point to the new or restored checkpoint.
**Validates: Requirements 22.3, 22.4**

### Property 28: Rate Limit Enforcement
*For any* user exceeding the rate limit for an operation, the system should return a 429 status with retry-after header.
**Validates: Requirements 23.4**

### Property 29: Correlation ID Propagation
*For any* API request, a correlation ID should be generated and included in all log entries and error responses for that request.
**Validates: Requirements 24.2, 24.4**

### Property 30: Signed URL Security
*For any* rendered video output, the system should store the S3 key and generate short-lived signed URLs (1 hour expiration) on demand, not long-lived or public URLs.
**Validates: Requirements 25.2, 25.3**

### Property 31: Schema Version Presence
*For any* message or checkpoint artifact (storyboard, script, brand kit), the JSON should include a version field.
**Validates: Requirements 26.1, 26.2**

## Error Handling

### Error Categories

**Validation Errors (400):**
- Missing required fields
- Invalid format values
- Malformed JSON
- Schema validation failures

**Authentication Errors (401):**
- Missing session
- Expired session
- Invalid credentials

**Authorization Errors (403):**
- User doesn't own project
- User doesn't own render job

**Rate Limit Errors (429):**
- Rate limit exceeded

**Not Found Errors (404):**
- Project not found
- Checkpoint not found
- Render job not found

**Server Errors (500):**
- Gemini API failures (after retries)
- Database errors
- Remotion Lambda failures

### Retry Strategy

**Gemini API Calls:**
- Retry up to 2 times
- Exponential backoff: 1s, 2s
- Store generationError on message if all retries fail

**Remotion Lambda:**
- No automatic retries (user can manually retry)
- Store lastError on render_job

### Error Response Format

```typescript
interface TErrorResponse {
  error: string
  details?: Record<string, string[]>
  correlationId: string
  retryAfter?: number
}
```

## Testing Strategy

### Unit Testing

**Route Handlers:**
- Mock auth, database, and external services
- Test validation logic
- Test error handling
- Test idempotency checks

**Message Type Schemas:**
- Test Zod validation for each message type
- Test version field presence
- Test artifact reference validation

**Storyboard/Script/BrandKit Schemas:**
- Test Zod validation
- Test required field presence
- Test version field presence

**Format Specifications:**
- Test layout rule application
- Test text length constraints
- Test safe area calculations

### Property-Based Testing

Each correctness property should be implemented as a property-based test with minimum 100 iterations. Tests should be tagged with:

```typescript
// Feature: mvp-architecture-refactor, Property 1: Streaming Response Delivery
```

**Key Properties to Test:**
- Property 6: Message Type Correctness (generate random events, verify message types)
- Property 8: Chronological Message Ordering (generate random messages, verify ordering)
- Property 12: Checkpoint Creation Rules (generate random events, verify checkpoint creation)
- Property 16: Soft-Cancel State Machine (generate random cancel requests, verify state transitions)
- Property 18: Format-Agnostic Content (generate random storyboards, verify content identity across formats)
- Property 22: Total Duration Calculation (generate random scenes, verify sum)
- Property 26: Idempotency Guarantee (generate duplicate requests, verify single execution)

### Integration Testing with Chrome DevTools MCP

**Complete User Flows:**
1. Empty state → URL submission → generation → checkpoint creation
2. Generated state → scene edit → checkpoint creation → render request
3. Render progress → soft-cancel → status transitions
4. Checkpoint restoration → editor state update
5. Multi-format rendering from single checkpoint

**UI State Transitions:**
- Empty → Generating → Generated
- Editor locking/unlocking
- Remotion Player scaling across viewport sizes

**Authentication:**
- Magic link flow
- Protected endpoint access
- Session expiration

## Migration Strategy

### Phase 1: Setup New Next.js Structure
- Create Route Handlers for all API endpoints
- Set up Better Auth in Next.js
- Configure Vercel AI SDK with Gemini

### Phase 2: Database Schema
- Create new tables (project, message, checkpoint, render_job)
- Add indexes for performance
- Set up Drizzle ORM

### Phase 3: Core Generation Flow
- Implement POST /api/projects/:id/generate
- Integrate Vercel AI SDK streamObject
- Implement message and checkpoint creation

### Phase 4: Editor UI
- Implement three-state layout
- Fix Remotion Player scaling
- Implement scene list and editing

### Phase 5: Rendering
- Implement POST /api/projects/:id/render
- Implement progress polling
- Implement soft-cancel

### Phase 6: Migration
- Migrate existing projects to new schema
- Migrate existing data to message/checkpoint format
- Deprecate old Hono API

## Performance Considerations

### Generation Performance
- Target P50 < 20s, P95 < 60s
- Stream progress within 1s of request start
- Use Gemini 2.5 Flash for speed

### Render Performance
- Poll every 3-5s initially
- Back off to 10s after 60s
- Cache-Control: no-cache on progress endpoint

### Database Performance
- Index on project.userId, project.activeCheckpointId
- Index on message.projectId, message.createdAt
- Index on checkpoint.projectId, checkpoint.sourceMessageId
- Index on render_job.projectId, render_job.status

### Rate Limiting
- Per-user limits on generate/regenerate/render
- Track windows per user per operation type
- Return 429 with retry-after header

## Security Considerations

### Authentication
- Better Auth magic link
- HTTP-only secure cookies
- Session expiration after 30 days inactivity

### Authorization
- Verify user owns project before any operation
- Verify user owns render job before progress/cancel

### Secure Asset Storage

**Asset Storage:**
- Private S3 buckets only
- Store S3 key in render_job.outputS3Key
- Generate signed URLs on demand via GET /api/render-jobs/:id/download-url
- Signed URL expiration: 1 hour (MVP - short-lived for security)
- Regenerate signed URLs on each request (no caching)
- Never use public S3 buckets or long-lived URLs

### Input Validation
- Zod schemas for all inputs
- Sanitize URLs before passing to Gemini
- Validate format parameter against allowed values

### Correlation IDs
- Generate UUID for each request
- Include in all logs and error responses
- Store with render jobs for traceability

## Deployment Considerations

### Environment Variables
- GEMINI_API_KEY
- DATABASE_URL
- BETTER_AUTH_SECRET
- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
- S3_BUCKET_NAME
- REMOTION_LAMBDA_FUNCTION_NAME

### Infrastructure
- Next.js deployed to Vercel
- PostgreSQL (managed service)
- S3 for asset storage
- Remotion Lambda for rendering

### Monitoring
- Log all API requests with correlation IDs
- Track generation latency (P50, P95, P99)
- Track render success/failure rates
- Alert on rate limit violations
- Alert on Gemini API failures

### Cost Control
- Rate limiting per user
- Render job timeout (5 minutes)
- Cleanup cancelled render outputs
- Monitor Gemini API usage
- Monitor Remotion Lambda costs


## Concurrency Rules

### Render Concurrency
- Render jobs bind to a specific checkpointId (immutable snapshot)
- Multiple renders can run simultaneously on different checkpoints
- Editing creates new checkpoints without affecting in-progress renders
- Idempotency keys prevent duplicate renders from double-clicks

### Editing Concurrency
- Last write wins on activeCheckpointId
- Each edit creates a new checkpoint with updated activeCheckpointId
- Two tabs editing simultaneously will create separate checkpoint branches
- No optimistic locking in MVP (eventual consistency)

### Message Ordering
- Messages ordered by createdAt timestamp
- Concurrent operations may create messages in non-deterministic order
- UI displays messages chronologically regardless of creation order
