# Implementation Plan: MVP Architecture Refactor

## Overview

Convert dual-service architecture (Hono API + Next.js) to single Next.js app with App Router, Route Handlers, Vercel AI SDK streaming, and async render workers. Implement project-as-conversation pattern with typed messages and checkpoints.

## Tasks

- [ ] 1. Database schema and migrations
  - Create project, message, checkpoint, render_job, idempotency_key tables
  - Add indexes for performance (userId, projectId, createdAt, status)
  - Set up Drizzle ORM with singular table naming
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.6_

- [ ] 2. Shared types and schemas
  - [ ] 2.1 Define message type schemas with Zod
    - Create discriminated union for all message types (url_submitted, generation_progress, generation_result, checkpoint_created, checkpoint_applied, scene_regenerated, render_requested, render_progress, render_completed)
    - Include version field in all schemas
    - Define artifact reference types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [ ] 2.2 Define storyboard, script, and brand kit schemas
    - Create Zod schemas for TStoryboard, TScript, TBrandKit
    - Include version fields
    - Define scene structure with all required fields
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

  - [ ] 2.3 Define format specifications
    - Create FORMAT_SPECS constant with dimensions, safe areas, text constraints
    - Support 1:1 (1080x1080), 9:16 (1080x1920), 16:9 (1920x1080)
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7_

- [ ] 3. Better Auth setup in Next.js
  - Configure Better Auth with magic link
  - Set up session management with HTTP-only cookies
  - Create auth middleware for Route Handlers
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [ ] 4. Core Route Handlers
  - [ ] 4.1 POST /api/projects - Create project
    - Validate auth
    - Create project with userId and title
    - Return project data
    - _Requirements: 12.1_

  - [ ] 4.2 GET /api/projects - List projects
    - Validate auth
    - Query projects for userId, sort by updatedAt desc
    - Return project list
    - _Requirements: 12.2, 12.3, 12.4_

  - [ ] 4.3 GET /api/projects/:id - Get project with messages and checkpoints
    - Validate auth and ownership
    - Load project, messages (ordered by createdAt), checkpoints
    - Return complete project data
    - _Requirements: 12.5, 12.6, 4.7, 4.8_

- [ ] 5. Generation flow with AI SDK streaming
  - [ ] 5.1 POST /api/projects/:id/generate - Stream storyboard generation
    - Validate auth, ownership, input (url, format, tone)
    - Create user message (url_submitted)
    - Use createDataStreamResponse() with execute callback
    - Send initial progress event via dataStream.writeData()
    - Call streamObject() with Gemini + urlContext tool
    - Stream partial objects via dataStream.writeData()
    - Create checkpoint with storyboard/script/brandKit
    - Create assistant message (generation_result) with artifact refs
    - Update project.activeCheckpointId
    - Send completion event via dataStream.writeData()
    - Use export const runtime = 'nodejs'
    - _Requirements: 2.2, 2.5, 2.6, 2.7, 4.2, 4.3, 6.1, 8.1, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ] 5.2 Write property test for streaming delivery
    - **Property 1: Streaming Response Delivery**
    - **Validates: Requirements 2.2**

  - [ ] 5.3 Write property test for required extraction fields
    - **Property 2: Required Extraction Fields**
    - **Validates: Requirements 2.6**

  - [ ] 5.4 Write property test for best-effort extraction
    - **Property 3: Best-Effort Extraction**
    - **Validates: Requirements 2.7**

- [ ] 6. Checkpoint management
  - [ ] 6.1 Implement checkpoint creation helper
    - Accept projectId, sourceMessageId, parentCheckpointId, storyboard, script, brandKit
    - Validate schemas with Zod
    - Insert checkpoint with version fields
    - Create checkpoint_created message
    - Update project.activeCheckpointId
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.10, 22.3_

  - [ ] 6.2 POST /api/projects/:id/checkpoints/:checkpointId/restore - Restore checkpoint
    - Validate auth and ownership
    - Load checkpoint data
    - Update project.activeCheckpointId
    - Create checkpoint_applied message
    - Return checkpoint data
    - _Requirements: 6.8, 6.9, 22.4_

  - [ ] 6.3 Write property test for checkpoint creation rules
    - **Property 12: Checkpoint Creation Rules**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 22.3**

  - [ ] 6.4 Write property test for checkpoint source linkage
    - **Property 13: Checkpoint Source Linkage**
    - **Validates: Requirements 6.6**

- [ ] 7. Scene editing and regeneration
  - [ ] 7.1 PATCH /api/projects/:id/scenes/:sceneId - Edit scene
    - Validate auth and ownership
    - Load active checkpoint
    - Update scene in storyboard
    - Create new checkpoint
    - Create checkpoint_created message
    - Update project.activeCheckpointId
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 7.2 POST /api/projects/:id/regenerate-scene - Regenerate scene with AI
    - Validate auth, ownership, input (checkpointId, sceneId, instruction)
    - Load checkpoint
    - Call Gemini to regenerate scene
    - Replace scene in storyboard
    - Create new checkpoint
    - Create scene_regenerated message with artifact refs
    - Update project.activeCheckpointId
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ] 7.3 Write property test for scene regeneration isolation
    - **Property 24: Scene Regeneration Isolation**
    - **Validates: Requirements 14.6**

- [ ] 8. Render job queue and worker
  - [ ] 8.1 POST /api/projects/:id/render - Enqueue render job
    - Validate auth, ownership, input (checkpointId, format)
    - Create render_job (status: pending)
    - Create render_requested message with artifact refs
    - Enqueue { renderJobId } to SQS
    - Return render job ID immediately
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 8.2 Create SQS queue and worker Lambda
    - Define RenderQueue in SST config (infra/compute.ts)
    - Create worker handler at apps/functions/src/handlers/queue/render-worker.handler
    - Subscribe worker to queue
    - _Requirements: 15.4_

  - [ ] 8.3 Implement render worker logic
    - Receive { renderJobId } from SQS
    - Load render_job and checkpoint
    - Update status to 'rendering'
    - Invoke Remotion Lambda with checkpoint data and format
    - Poll Remotion Lambda for progress
    - Update render_job.progress in DB
    - Check cancelRequested flag on each poll iteration
    - On completion: check cancelRequested
    - If cancelled: update status to 'cancelled', don't store output
    - If not cancelled: store outputS3Key, update status to 'completed'
    - Create render_completed message
    - _Requirements: 15.5, 15.6, 15.7, 15.8, 7.4, 7.5_

  - [ ] 8.4 Write property test for render state transitions
    - **Property 25: Render State Transitions**
    - **Validates: Requirements 15.5, 15.6, 15.7, 16.3**

- [ ] 9. Render progress and cancellation
  - [ ] 9.1 GET /api/render-jobs/:id/progress - Poll render progress
    - Validate auth and ownership
    - Query render_job status, progress
    - Return current state
    - Set Cache-Control: no-cache, no-transform
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.8_

  - [ ] 9.2 POST /api/render-jobs/:id/cancel - Soft-cancel render
    - Validate auth and ownership
    - Set cancelRequested=true
    - Update status to 'cancel_requested'
    - Return updated status
    - _Requirements: 7.1, 7.2, 7.7_

  - [ ] 9.3 GET /api/render-jobs/:id/download-url - Generate signed URL
    - Validate auth and ownership
    - Check status is 'completed' and not cancelled
    - Generate signed S3 URL with 1 hour expiration
    - Return signed URL
    - _Requirements: 25.1, 25.2, 25.4, 25.5_

  - [ ] 9.4 Write property test for soft-cancel state machine
    - **Property 16: Soft-Cancel State Machine**
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5**

- [ ] 10. Idempotency system (post-MVP: implement after core flows work)
  - [ ] 10.1 Implement idempotency check helper
    - Query idempotency_key table by userId, operation, key
    - Return existing result if found (message or render_job)
    - Return null if not found
    - _Requirements: 20.4, 20.5_

  - [ ] 10.2 Implement idempotency store helper
    - Insert idempotency_key with userId, projectId, operation, key, resultRef
    - Handle unique constraint violations gracefully
    - _Requirements: 20.6, 20.7_

  - [ ] 10.3 Add idempotency to generate endpoint
    - Accept idempotencyKey parameter
    - Check idempotency before processing
    - Store idempotency key after completion
    - _Requirements: 20.1, 20.4, 20.5, 20.6_

  - [ ] 10.4 Add idempotency to regenerate-scene endpoint
    - Accept idempotencyKey parameter
    - Check idempotency before processing
    - Store idempotency key after completion
    - _Requirements: 20.2, 20.4, 20.5, 20.6_

  - [ ] 10.5 Add idempotency to render endpoint
    - Accept idempotencyKey parameter
    - Check idempotency before processing
    - Store idempotency key after completion
    - _Requirements: 20.3, 20.4, 20.5, 20.6_

  - [ ] 10.6 Write property test for idempotency guarantee
    - **Property 26: Idempotency Guarantee**
    - **Validates: Requirements 20.5, 20.7**

- [ ] 11. Rate limiting (post-MVP: implement after core flows work)
  - [ ] 11.1 Implement rate limit middleware
    - Track per-user operation counts in memory or Redis
    - Enforce limits for generate, regenerate-scene, render
    - Return 429 with retry-after header when exceeded
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [ ] 11.2 Write property test for rate limit enforcement
    - **Property 28: Rate Limit Enforcement**
    - **Validates: Requirements 23.4**

- [ ] 12. Observability
  - [ ] 12.1 Implement correlation ID middleware
    - Generate UUID for each request
    - Store in request context
    - Include in all log entries
    - Include in error responses
    - Store with render jobs
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

  - [ ] 12.2 Write property test for correlation ID propagation
    - **Property 29: Correlation ID Propagation**
    - **Validates: Requirements 24.2, 24.4**

- [ ] 13. UI - Empty state
  - [ ] 13.1 Create empty state component
    - Full-page centered URL input
    - Recent projects list (5 most recent, sorted by updatedAt desc)
    - Example URLs and "Try demo project" button if no projects
    - _Requirements: 11.1, 11.4, 12.5, 12.6_

  - [ ] 13.2 Write unit test for empty state rendering
    - Test with no projects
    - Test with recent projects
    - _Requirements: 11.1, 11.4_

- [ ] 14. UI - Generating state
  - [ ] 14.1 Create generating state component
    - Split view: 50% editor (left) | 50% chat (right)
    - Editor: locked with placeholders, disabled inputs, scene list skeleton, loading composition
    - Chat: streaming progress messages
    - "Generating…" indicator
    - _Requirements: 11.2, 11.5, 11.7, 11.8, 11.9_

  - [ ] 14.2 Implement AI SDK stream consumer
    - Use readDataStream() from 'ai' package to parse events
    - Handle generation_progress, generation_partial, generation_complete events
    - Update UI state for each event type
    - Or use useChat() hook for chat-like UI
    - _Requirements: 2.2_

  - [ ] 14.3 Write unit test for AI SDK stream parsing
    - Test event parsing with readDataStream()
    - Test UI state updates for each event type
    - _Requirements: 2.2_

- [ ] 15. UI - Generated state
  - [ ] 15.1 Create generated state component
    - Split view: 60% editor (left) | 40% chat (right)
    - Editor: Remotion Player (responsive), scene list, timeline
    - Chat: message history + input
    - All controls enabled
    - _Requirements: 11.3, 11.10, 11.11_

  - [ ] 15.2 Implement Remotion Player with responsive scaling
    - Container with width: 100%, aspect ratio based on format
    - Player with compositionWidth/Height from FORMAT_SPECS
    - Player style: width: 100%, height: 100%
    - No horizontal overflow
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 15.3 Write property test for no horizontal overflow
    - **Property 4: No Horizontal Overflow**
    - **Validates: Requirements 3.4**

  - [ ] 15.4 Write property test for aspect ratio preservation
    - **Property 5: Aspect Ratio Preservation**
    - **Validates: Requirements 3.5**

- [ ] 16. UI - Scene editing
  - [ ] 16.1 Create scene list component
    - Display scenes from active checkpoint
    - Show duration, on-screen text, voiceover
    - Click to select scene
    - _Requirements: 13.1_

  - [ ] 16.2 Create scene editor component
    - Editable fields for duration, on-screen text, voiceover
    - Save button to create new checkpoint
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

  - [ ] 16.3 Write unit test for scene editing
    - Test field updates
    - Test save creates checkpoint
    - _Requirements: 13.4, 13.5_

- [ ] 17. UI - Render progress
  - [ ] 17.1 Create render progress component
    - Progress bar with percentage
    - Status indicator (pending, rendering, completed, failed, cancelled)
    - Cancel button (soft-cancel)
    - Download button when completed
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 7.3_

  - [ ] 17.2 Implement progress polling
    - Poll every 3-5 seconds initially
    - Back off to 10 seconds after 60 seconds
    - Stop polling on terminal states
    - _Requirements: 16.5, 16.6, 16.7_

  - [ ] 17.3 Write unit test for polling backoff
    - Test initial interval
    - Test backoff after 60s
    - Test stop on completion
    - _Requirements: 16.5, 16.6, 16.7_

- [ ] 18. UI - Message renderers
  - [ ] 18.1 Create message renderer components
    - One component per message type
    - Render based on message.type discriminator
    - Display artifact references as links
    - _Requirements: 5.12_

  - [ ] 18.2 Write unit tests for message renderers
    - Test each message type renders correctly
    - _Requirements: 5.12_

- [ ] 19. Error handling
  - [ ] 19.1 Implement error response helpers
    - 400 for validation errors with field details
    - 401 for authentication errors
    - 403 for authorization errors
    - 404 for not found errors
    - 429 for rate limit errors with retry-after
    - 500 for server errors
    - Include correlationId in all error responses
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [ ] 19.2 Implement Gemini retry logic
    - Retry up to 2 times with exponential backoff (1s, 2s)
    - Store generationError on message if all retries fail
    - _Requirements: 19.5, 19.6_

  - [ ] 19.3 Implement error handling in render worker
    - Store lastError on render_job for Lambda failures
    - Update status to 'failed'
    - Create render_completed message with error
    - _Requirements: 19.7_

  - [ ] 19.4 Write unit tests for error responses
    - Test each error type returns correct status and format
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Schema versioning
  - [ ] 21.1 Add version validation to message schemas
    - Check version field exists in all message contentJson
    - Validate against type-specific schema
    - _Requirements: 26.1, 26.3_

  - [ ] 21.2 Add version validation to checkpoint schemas
    - Check version field exists in storyboard, script, brandKit
    - Validate against versioned schemas
    - _Requirements: 26.2, 26.3_

  - [ ] 21.3 Write property test for schema version presence
    - **Property 31: Schema Version Presence**
    - **Validates: Requirements 26.1, 26.2**

- [ ] 22. Property-based tests
  - [ ] 22.1 Write property test for message type correctness
    - **Property 6: Message Type Correctness**
    - **Validates: Requirements 4.2, 4.3, 6.9, 6.10, 8.8**

  - [ ] 22.2 Write property test for artifact reference linkage
    - **Property 7: Artifact Reference Linkage**
    - **Validates: Requirements 4.6**

  - [ ] 22.3 Write property test for chronological message ordering
    - **Property 8: Chronological Message Ordering**
    - **Validates: Requirements 4.7**

  - [ ] 22.4 Write property test for complete message history
    - **Property 9: Complete Message History**
    - **Validates: Requirements 4.8**

  - [ ] 22.5 Write property test for message schema versioning
    - **Property 10: Message Schema Versioning**
    - **Validates: Requirements 5.10**

  - [ ] 22.6 Write property test for message content validation
    - **Property 11: Message Content Validation**
    - **Validates: Requirements 5.11**

  - [ ] 22.7 Write property test for checkpoint restoration
    - **Property 14: Checkpoint Restoration**
    - **Validates: Requirements 6.8**

  - [ ] 22.8 Write property test for render from any checkpoint
    - **Property 15: Render from Any Checkpoint**
    - **Validates: Requirements 6.11**

  - [ ] 22.9 Write property test for generated artifact completeness
    - **Property 17: Generated Artifact Completeness**
    - **Validates: Requirements 8.5, 8.6, 8.7**

  - [ ] 22.10 Write property test for format-agnostic content
    - **Property 18: Format-Agnostic Content**
    - **Validates: Requirements 9.5**

  - [ ] 22.11 Write property test for format-specific layout
    - **Property 19: Format-Specific Layout Application**
    - **Validates: Requirements 9.6, 9.7**

  - [ ] 22.12 Write property test for multi-format rendering
    - **Property 20: Multi-Format Rendering**
    - **Validates: Requirements 9.8**

  - [ ] 22.13 Write property test for scene structure completeness
    - **Property 21: Scene Structure Completeness**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

  - [ ] 22.14 Write property test for total duration calculation
    - **Property 22: Total Duration Calculation**
    - **Validates: Requirements 10.6**

  - [ ] 22.15 Write property test for storyboard schema validation
    - **Property 23: Storyboard Schema Validation**
    - **Validates: Requirements 10.7**

  - [ ] 22.16 Write property test for active checkpoint synchronization
    - **Property 27: Active Checkpoint Synchronization**
    - **Validates: Requirements 22.3, 22.4**

  - [ ] 22.17 Write property test for signed URL security
    - **Property 30: Signed URL Security**
    - **Validates: Requirements 25.2, 25.3**

- [ ] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- **Use AI SDK Data Stream (SSE) for generation streaming** - leverages AI SDK's built-in protocol for chat + custom events
- Use SQS + Lambda worker for async rendering (not inline in Route Handler)
- Store S3 keys, generate signed URLs on demand (1 hour expiration for MVP)
- **Idempotency and rate limiting moved to post-MVP** - implement after core happy path is stable
- Correlation IDs enable request tracing across services
- Worker checks cancelRequested flag on each poll iteration for truthful soft-cancel
