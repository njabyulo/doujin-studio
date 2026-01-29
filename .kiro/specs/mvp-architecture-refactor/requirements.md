# Requirements Document: MVP Architecture Refactor

## Introduction

This specification defines the requirements for refactoring the AI-powered video ad generation tool from a dual-service architecture (Hono API + Next.js) to a consolidated single Next.js application. The refactor addresses critical architectural issues including routing duplication, authentication complexity, streaming protocol overhead, and missing core features. The new architecture implements a "project as conversation thread" pattern where every generation and edit becomes a typed message with artifact references, enabling natural version control through checkpoints.

**MVP Goal:** URL → storyboard + script quickly → render draft video in 2–5 min → iterate via chat + per-scene regenerate → maintain history via messages + checkpoints

## Glossary

- **System**: The consolidated Next.js application with App Router and Route Handlers
- **Project**: A conversation thread containing messages, checkpoints, and render jobs for a single ad creation workflow
- **Message**: A single entry in the project conversation thread with role (user/assistant/system), typed content, and artifact references
- **Message_Type**: Discriminated union type for message content (url_submitted, generation_progress, generation_result, checkpoint_created, checkpoint_applied, scene_regenerated, render_requested, render_progress, render_completed)
- **Artifact_Reference**: Link from a message to a checkpoint, render job, or other resource
- **Checkpoint**: A named snapshot of project state (storyboard, script, brand kit) linked to a source message
- **Storyboard**: Structured JSON defining scenes with durations, text, voiceover, and asset suggestions
- **Render_Job**: An asynchronous video rendering task with progress tracking and soft-cancel support
- **Scene**: A single segment in the storyboard with timing, visuals, text overlays, and voiceover
- **Brand_Kit**: Extracted brand information including colors, fonts, logo, and tone (best-effort)
- **Gemini**: Google's AI model used for content generation via Vercel AI SDK
- **Remotion_Player**: React component for previewing video compositions
- **Soft_Cancel**: Marking a render job as cancel_requested, transitioning to cancel_requested status, then cancelled when complete

## Requirements

### Requirement 1: Consolidated Next.js Architecture

**User Story:** As a developer, I want a single Next.js application with App Router and Route Handlers, so that I can eliminate routing duplication, authentication complexity, and CORS issues.

#### Acceptance Criteria

1. THE System SHALL use Next.js App Router for all routing
2. THE System SHALL use Route Handlers for all API endpoints
3. THE System SHALL NOT use a separate Hono API service
4. WHEN authentication is required, THE System SHALL use Better Auth with a single cookie domain
5. THE System SHALL share types between frontend and backend in a single codebase
6. THE System SHALL eliminate CORS configuration requirements

### Requirement 2: Vercel AI SDK Integration

**User Story:** As a developer, I want to use Vercel AI SDK for Gemini streaming and structured output, so that I can eliminate json-render.dev protocol complexity and get native streaming support.

#### Acceptance Criteria

1. THE System SHALL use Vercel AI SDK for all Gemini API interactions
2. WHEN generating content, THE System SHALL stream responses using Vercel AI SDK streaming primitives
3. THE System SHALL use Vercel AI SDK structured output for storyboard JSON generation
4. THE System SHALL NOT use json-render.dev for streaming
5. WHEN URL context is provided, THE System SHALL use Gemini URL Context API for best-effort content extraction
6. THE System SHALL extract product name, tagline, and benefits as minimum viable data
7. THE System SHALL extract pricing, testimonials, images, and brand colors when present

### Requirement 3: Remotion Player Scaling Fix

**User Story:** As a user, I want the video preview to fit within the viewport without horizontal scrolling, so that I can view the entire composition without layout issues.

#### Acceptance Criteria

1. THE Remotion_Player SHALL use style={{width: '100%'}} for responsive container sizing
2. THE Remotion_Player SHALL maintain compositionWidth=1920 for render quality
3. WHEN the viewport is smaller than 1920px, THE Remotion_Player SHALL scale proportionally
4. THE System SHALL NOT cause horizontal overflow or scrolling
5. THE Remotion_Player SHALL preserve aspect ratio during scaling

### Requirement 4: Project as Conversation Thread with Typed Messages

**User Story:** As a user, I want my project to be organized as a conversation thread with typed messages, so that I can see the history of generations, edits, and decisions with clear artifact linkage.

#### Acceptance Criteria

1. THE System SHALL represent each project as a conversation thread
2. WHEN content is generated, THE System SHALL create an assistant message with type 'generation_result'
3. WHEN a user provides input, THE System SHALL create a user message with type 'url_submitted'
4. WHEN system events occur, THE System SHALL create system messages with appropriate types
5. THE System SHALL store message content as JSON with a discriminated union type field
6. THE Message SHALL include artifactRefs array linking to checkpoints, render jobs, or other resources
7. THE System SHALL order messages chronologically by createdAt timestamp
8. WHEN displaying a project, THE System SHALL show the complete message history

### Requirement 5: Message Types for Audit Trail

**User Story:** As a developer, I want well-defined message types with versioned schemas, so that I can render different message content appropriately, maintain a clear audit trail, and safely migrate data.

#### Acceptance Criteria

1. THE System SHALL support message type 'url_submitted' for user URL input
2. THE System SHALL support message type 'generation_progress' for streaming updates
3. THE System SHALL support message type 'generation_result' for completed storyboard/script
4. THE System SHALL support message type 'checkpoint_created' for new checkpoint snapshots
5. THE System SHALL support message type 'checkpoint_applied' for checkpoint restoration only
6. THE System SHALL support message type 'scene_regenerated' for individual scene updates
6. THE System SHALL support message type 'render_requested' for render job creation
7. THE System SHALL support message type 'render_progress' for render status updates
8. THE System SHALL support message type 'render_completed' for finished renders
9. THE System SHALL define a Zod schema for each message type
10. THE System SHALL include a version field in contentJson for schema versioning
11. THE System SHALL validate message content against the type-specific schema
12. THE System SHALL provide a renderer component for each message type

### Requirement 6: Checkpoint System for Version Control

**User Story:** As a user, I want to save checkpoints of my project state, so that I can restore previous versions or branch from specific points in the conversation.

#### Acceptance Criteria

1. THE System SHALL create a checkpoint when generation completes (generation_result message)
2. THE System SHALL create a checkpoint when a user manually saves edits to storyboard or script
3. THE System SHALL create a checkpoint when a scene is regenerated (scene_regenerated message)
4. THE System SHALL create a checkpoint when brand kit updates change storyboard, script, or brand kit
5. THE System SHALL NOT create a checkpoint for render_requested, render_progress, or render_completed messages
6. THE Checkpoint SHALL link to sourceMessageId
7. THE Checkpoint SHALL optionally link to parentCheckpointId for branching
8. WHEN a user requests restoration, THE System SHALL load checkpoint data into the editor
9. THE System SHALL create a 'checkpoint_applied' message when restoring a checkpoint
10. THE System SHALL create a 'checkpoint_created' message when creating a new checkpoint
11. THE System SHALL allow rendering from any checkpoint

### Requirement 7: Truthful Soft-Cancel for Render Jobs

**User Story:** As a user, I want to cancel a render job that is taking too long, so that I can stop wasting resources and try a different approach.

#### Acceptance Criteria

1. WHEN a user requests cancellation, THE System SHALL set cancel_requested=true on the render job
2. THE System SHALL update render job status to 'cancel_requested'
3. THE System SHALL stop polling for progress after cancel is requested
4. WHEN a cancelled job completes, THE System SHALL update status to 'cancelled'
5. WHEN a cancelled job completes, THE System SHALL NOT surface the output URL
6. THE System SHALL optionally run a cleanup job later to remove cancelled outputs
7. THE System SHALL allow users to retry rendering after cancellation
8. THE System SHALL NOT immediately terminate the Lambda function

### Requirement 8: URL to Storyboard Generation (Best-Effort)

**User Story:** As a user, I want to provide a URL and get a storyboard with script quickly, so that I can create ad drafts from existing content.

#### Acceptance Criteria

1. WHEN a URL is provided, THE System SHALL extract content using Gemini URL Context API
2. THE System SHALL target P50 generation completion under 20 seconds
3. THE System SHALL target P95 generation completion under 60 seconds
4. THE System SHALL stream progress events within 1 second of request start
4. THE Storyboard SHALL include scenes with durations, on-screen text, voiceover text, and asset suggestions
5. THE System SHALL generate scriptJson with global tone and per-scene voiceover
6. THE System SHALL generate brandKitJson with best-effort extraction of colors, fonts, and tone
7. WHEN generation completes, THE System SHALL create a 'generation_result' message with artifact references
8. THE System SHALL handle URL extraction failures gracefully with fallback prompts

### Requirement 9: Multiple Ad Format Support

**User Story:** As a user, I want to generate ads in different formats (feed, stories, YouTube), so that I can create platform-specific content from a single project.

#### Acceptance Criteria

1. THE System SHALL support 1:1 aspect ratio for feed ads
2. THE System SHALL support 9:16 aspect ratio for stories and reels
3. THE System SHALL support 16:9 aspect ratio for YouTube ads
4. WHEN generating content, THE System SHALL accept format as input parameter
5. THE Storyboard content SHALL remain the same across all formats
6. THE System SHALL apply format-specific layout rules at render time and preview time
7. THE System SHALL apply format-specific text length constraints (e.g., safe areas for 9:16)
8. THE System SHALL allow rendering the same checkpoint in multiple formats
9. THE System SHALL NOT fork the entire storyboard for different formats

### Requirement 10: Structured Storyboard Data Model

**User Story:** As a developer, I want a well-defined storyboard JSON schema, so that I can reliably parse, validate, and render video compositions.

#### Acceptance Criteria

1. THE Storyboard SHALL define scenes as an array of scene objects
2. WHEN defining a scene, THE System SHALL include duration in seconds
3. WHEN defining a scene, THE System SHALL include on-screen text content
4. WHEN defining a scene, THE System SHALL include voiceover text
5. WHEN defining a scene, THE System SHALL include asset suggestions (type, description)
6. THE Storyboard SHALL include total duration calculated from scene durations
7. THE System SHALL validate storyboard JSON using Zod schemas before saving

### Requirement 11: Three-State Editor Layout

**User Story:** As a user, I want clear visual feedback about generation state, so that I know when I can interact with the editor versus when content is being generated.

#### Acceptance Criteria

1. WHEN no content exists, THE System SHALL display an empty state with centered URL input
2. WHEN generation is in progress, THE System SHALL display a split view with locked editor and streaming chat
3. WHEN generation completes, THE System SHALL display a split view with interactive editor and chat
4. THE Empty_State SHALL show a list of recent projects
5. THE Generating_State SHALL show "Generating…" indicator in the editor panel
6. THE Generating_State SHALL stream progress messages in the chat panel
7. THE Generating_State SHALL display the editor with placeholders and disabled inputs
8. THE Generating_State SHALL show a scene list skeleton
9. THE Generating_State SHALL show a loading composition in the preview (not blank)
10. WHEN generation completes, THE System SHALL transition the editor to active state with the generated checkpoint auto-applied
11. THE Generated_State SHALL show Remotion Player, scene list, and timeline in the editor panel

### Requirement 12: Project Management

**User Story:** As a user, I want to create, list, and open projects, so that I can organize multiple ad creation workflows.

#### Acceptance Criteria

1. THE System SHALL allow users to create new projects with a title
2. THE System SHALL list all projects for the authenticated user
3. WHEN listing projects, THE System SHALL show title, creation date, and last update date
4. THE System SHALL sort projects by updatedAt descending
5. THE Empty_State SHALL show up to 5 recent projects sorted by updatedAt descending
6. WHEN no projects exist, THE Empty_State SHALL show example URLs and a "Try demo project" button
7. THE System SHALL allow users to open existing projects
8. THE System SHALL load all messages and checkpoints when opening a project
9. THE System SHALL update project updatedAt timestamp on any modification

### Requirement 13: Scene Editing Interface (MVP Scope)

**User Story:** As a user, I want to edit individual scenes in my storyboard, so that I can refine timing, text, and voiceover without regenerating the entire ad.

#### Acceptance Criteria

1. THE System SHALL display a list of scenes from the current storyboard
2. WHEN a user selects a scene, THE System SHALL show editable fields for duration, on-screen text, and voiceover text
3. WHEN a user modifies a scene, THE System SHALL update the storyboard JSON
4. WHEN scene edits are saved, THE System SHALL create a new checkpoint
5. WHEN scene edits are saved, THE System SHALL create a 'checkpoint_created' assistant message
6. THE System SHALL NOT support drag-and-drop reordering in MVP
7. THE System SHALL NOT support adding or deleting scenes in MVP

### Requirement 14: Scene Regeneration

**User Story:** As a user, I want to regenerate a specific scene with new instructions, so that I can iterate on individual parts without affecting the rest of the storyboard.

#### Acceptance Criteria

1. WHEN a user requests scene regeneration, THE System SHALL accept checkpointId, sceneId, and instruction
2. THE System SHALL generate a new version of the specified scene using Gemini
3. THE System SHALL replace the scene in the storyboard JSON
4. THE System SHALL create a new checkpoint with the updated storyboard
5. THE System SHALL create a 'scene_regenerated' assistant message with artifact references
6. THE System SHALL preserve other scenes unchanged

### Requirement 15: Asynchronous Video Rendering

**User Story:** As a user, I want to render my storyboard to a video file, so that I can download and share the final ad.

#### Acceptance Criteria

1. WHEN a user requests rendering, THE System SHALL create a render job with status 'pending'
2. THE System SHALL accept checkpointId and format as input parameters
3. THE System SHALL link render job to sourceMessageId
4. THE System SHALL invoke Remotion Lambda for video rendering
5. THE System SHALL update render job status to 'rendering' when Lambda starts
6. WHEN rendering completes, THE System SHALL update status to 'completed' and store outputUrl
7. WHEN rendering fails, THE System SHALL update status to 'failed' and store lastError
8. THE System SHALL create a 'render_completed' message when rendering finishes

### Requirement 16: Render Progress Tracking

**User Story:** As a user, I want to see real-time progress of my video render, so that I know how long to wait and whether the render is progressing.

#### Acceptance Criteria

1. THE System SHALL expose a progress endpoint for render jobs
2. WHEN polling progress, THE System SHALL return current progress percentage (0-100)
3. THE System SHALL return render job status (pending, rendering, completed, failed, cancel_requested, cancelled)
4. WHEN rendering completes, THE System SHALL return the output URL
5. THE System SHALL poll every 3-5 seconds initially
6. THE System SHALL stop polling when status is completed, failed, or cancelled
7. THE System SHALL back off polling to 10 seconds after 60 seconds of rendering
8. THE Progress endpoint SHALL disable caching
9. THE System SHALL handle Lambda timeout errors gracefully

### Requirement 17: Authentication Flow

**User Story:** As a user, I want to authenticate with magic link, so that I can securely access my projects without managing passwords.

#### Acceptance Criteria

1. THE System SHALL use Better Auth for authentication
2. WHEN a user provides an email, THE System SHALL send a magic link
3. WHEN a user clicks the magic link, THE System SHALL create a session
4. THE System SHALL store session in a secure HTTP-only cookie
5. THE System SHALL protect all project and render endpoints with authentication
6. WHEN a user is not authenticated, THE System SHALL redirect to the login page
7. THE System SHALL allow users to sign out and clear their session

### Requirement 18: Data Persistence

**User Story:** As a developer, I want all project data persisted to PostgreSQL, so that users can access their work across sessions and devices.

#### Acceptance Criteria

1. THE System SHALL store projects in a project table with id, userId, title, activeCheckpointId, createdAt, updatedAt
2. THE System SHALL store messages in a message table with id, projectId, role, type, contentJson, createdAt
3. THE System SHALL store checkpoints in a checkpoint table with id, projectId, name, sourceMessageId, parentCheckpointId, storyboardJson, scriptJson, brandKitJson, createdAt
4. THE System SHALL store render jobs in a render_job table with id, projectId, sourceCheckpointId, sourceMessageId, format, status, progress, outputUrl, cancelRequested, lastError, createdAt, updatedAt
5. THE System SHALL use Drizzle ORM for database access
6. THE System SHALL use singular table naming (project, message, checkpoint, render_job)

### Requirement 20: Idempotency for Generation and Render Operations

**User Story:** As a user, I want duplicate requests to be handled safely, so that network retries or accidental double-clicks don't create duplicate work or charge me twice.

#### Acceptance Criteria

1. THE System SHALL accept an idempotencyKey parameter for POST /api/projects/:id/generate
2. THE System SHALL accept an idempotencyKey parameter for POST /api/projects/:id/regenerate-scene
3. THE System SHALL accept an idempotencyKey parameter for POST /api/projects/:id/render
4. WHEN an idempotencyKey is provided, THE System SHALL check for existing operations with that key
5. WHEN a matching operation exists, THE System SHALL return the existing job or message
6. WHEN no matching operation exists, THE System SHALL create a new operation and store the idempotencyKey
7. THE System SHALL NOT create duplicate render jobs or messages for the same idempotencyKey

### Requirement 19: Error Handling and Validation

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can understand what happened and how to fix it.

#### Acceptance Criteria

1. WHEN validation fails, THE System SHALL return a 400 status with field-specific error messages
2. WHEN authentication fails, THE System SHALL return a 401 status with a clear message
3. WHEN a resource is not found, THE System SHALL return a 404 status
4. WHEN a server error occurs, THE System SHALL return a 500 status and log the error
5. WHEN Gemini API fails, THE System SHALL retry up to 2 times with exponential backoff
6. WHEN Gemini generation fails, THE System SHALL store generationError on the message
7. WHEN Remotion Lambda fails, THE System SHALL update render job status to 'failed' with lastError details
8. THE System SHALL validate all input using Zod schemas before processing
9. THE System SHALL validate AI output JSON using Zod schemas before saving


### Requirement 22: Active Checkpoint Tracking

**User Story:** As a user, I want the editor to automatically load my current working state, so that I can continue where I left off without manually selecting a checkpoint.

#### Acceptance Criteria

1. THE Project SHALL maintain an activeCheckpointId field pointing to the current working state
2. WHEN opening a project, THE System SHALL load the activeCheckpointId by default
3. WHEN a new checkpoint is created, THE System SHALL update activeCheckpointId to the new checkpoint
4. WHEN a user restores a previous checkpoint, THE System SHALL update activeCheckpointId to the restored checkpoint
5. WHEN activeCheckpointId is null, THE System SHALL display the empty state


### Requirement 23: Rate Limiting

**User Story:** As a system operator, I want to enforce per-user rate limits, so that I can control costs and prevent abuse.

#### Acceptance Criteria

1. THE System SHALL enforce rate limits for generate operations per user
2. THE System SHALL enforce rate limits for regenerate-scene operations per user
3. THE System SHALL enforce rate limits for render operations per user
4. WHEN a rate limit is exceeded, THE System SHALL return a 429 status with retry-after header
5. THE System SHALL track rate limit windows per user per operation type

### Requirement 24: Observability and Logging

**User Story:** As a developer, I want correlation IDs for requests and jobs, so that I can trace operations across services and debug issues.

#### Acceptance Criteria

1. THE System SHALL generate a correlation ID for each API request
2. THE System SHALL include the correlation ID in all log entries for that request
3. THE System SHALL store the correlation ID with render jobs
4. THE System SHALL include the correlation ID in error responses
5. THE System SHALL log all generation attempts with correlation IDs
6. THE System SHALL log all render job state transitions with correlation IDs

### Requirement 25: Secure Asset Storage

**User Story:** As a security engineer, I want all asset outputs served via signed URLs, so that unauthorized users cannot access private content.

#### Acceptance Criteria

1. THE System SHALL store all rendered videos in private S3 buckets
2. THE System SHALL generate signed URLs for video outputs with expiration
3. THE System SHALL NOT use public S3 buckets for user content
4. THE System SHALL set signed URL expiration to 7 days
5. THE System SHALL regenerate signed URLs on request if expired

### Requirement 26: Schema Versioning

**User Story:** As a developer, I want schema versioning for database and messages, so that I can safely migrate data as the system evolves.

#### Acceptance Criteria

1. THE System SHALL include a version field in all message contentJson
2. THE System SHALL include a version field in checkpoint storyboardJson, scriptJson, and brandKitJson
3. THE System SHALL validate message content against version-specific schemas
4. THE System SHALL support reading older message schema versions
5. THE System SHALL use database migration tools for schema changes
6. THE System SHALL NOT break existing data when deploying schema changes
