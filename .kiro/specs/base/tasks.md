# Implementation Plan: AI Ad Creation Tool (MVP)

## Overview

3-day sprint implementing the vertical slice: URL → Storyboard → Preview → Render. Focus on core flow with minimal infrastructure.

## Tasks

- [x] 1. Initialize project structure
  - Run `pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir`
  - Create `packages/remotion` workspace
  - Create `infra/` folder (storage.ts, compute.ts, database.ts)
  - Set up pnpm-workspace.yaml
  - Run `npx sst init`
  - Configure sst.config.ts to import from infra/
  - Install dependencies: @remotion/player, @remotion/lambda, ai, @ai-sdk/google, zod
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Define storyboard schema and types
  - [x] 2.1 Create packages/remotion/src/types.ts
    - Define TScene, TStoryboard types
    - Define SScene, SStoryboard Zod schemas
    - Export validation helpers
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

- [x] 3. Set up SST infrastructure
  - [x] 3.1 Create infra/storage.ts
    - Define S3 bucket with public access
    - Export bucket resource
    - _Requirements: 6.1, 6.2, 6.7_

  - [x] 3.2 Create infra/database.ts
    - Define Postgres with dev config (localhost:5432)
    - _Requirements: 6.5, 9.9_

  - [x] 3.3 Create infra/compute.ts
    - Define Remotion Lambda function
    - Link to S3 bucket
    - _Requirements: 6.1, 6.2_

  - [x] 3.4 Update sst.config.ts
    - Import all infra modules
    - Export resource names
    - _Requirements: 6.1, 6.2_

- [x] 4. Implement Gemini storyboard generation API
  - [x] 4.1 Create apps/web/app/api/generate/route.ts
    - Implement POST handler with SSE streaming
    - Use Vercel AI SDK with Gemini 1.5 Pro
    - Pass URL via URL context tool
    - Build prompt for storyboard JSON generation
    - Stream text chunks as SSE events
    - _Requirements: 1.1, 1.2, 1.7, 2.1, 2.2, 8.1, 8.2, 8.7_

  - [x] 4.2 Add URL validation
    - Validate URL format before sending to Gemini
    - Return 400 for invalid URLs
    - _Requirements: 1.5_

  - [x] 4.3 Add error handling
    - Handle Gemini API errors
    - Handle timeout (60s)
    - Return user-friendly error messages
    - _Requirements: 1.4, 8.3, 8.4, 8.6, 13.1, 13.4_

- [x] 5. Build Master Remotion template
  - [x] 5.1 Create packages/remotion/src/Root.tsx
    - Define Master composition
    - Set default props
    - Configure 30fps, 1080p
    - _Requirements: 10.1, 10.2_

  - [x] 5.2 Create packages/remotion/src/Master.tsx
    - Accept TStoryboard as props
    - Map scenes to Sequence components
    - Calculate frame timing from durations
    - _Requirements: 10.3, 10.4, 10.6_

  - [x] 5.3 Create packages/remotion/src/Scene.tsx
    - Render text overlay with branding
    - Apply primary color and font family
    - Add fade in/out animations
    - _Requirements: 10.5, 10.6_

  - [x] 5.4 Create packages/remotion/remotion.config.ts
    - Configure Remotion bundler
    - Set output format (MP4, H.264)
    - _Requirements: 5.5_

- [x] 6. Build frontend UI
  - [x] 6.1 Create apps/web/components/url-input.tsx
    - Input field for URL
    - Generate button
    - Loading state during generation
    - _Requirements: 1.1, 2.1_

  - [x] 6.2 Create apps/web/components/storyboard-editor.tsx
    - Editable fields for ad title, colors, fonts
    - Scene list with text overlay and duration inputs
    - Real-time validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Create apps/web/components/video-preview.tsx
    - Integrate Remotion Player
    - Pass storyboard as inputProps
    - Calculate total duration in frames
    - Add playback controls
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 6.4 Create apps/web/app/page.tsx
    - Two-column layout (editor left, preview right)
    - Wire URL input to generation API
    - Handle SSE streaming updates
    - Update storyboard state on edits
    - Pass storyboard to preview
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.3, 12.5_

  - [x] 6.5 Add responsive layout
    - Use Tailwind breakpoints
    - Stack columns on tablet
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 7. Implement video rendering
  - [ ] 7.1 Create apps/web/app/api/render/route.ts
    - Accept storyboard JSON
    - Validate with Zod schema
    - Call Remotion Lambda renderMediaOnLambda
    - Return render ID
    - _Requirements: 5.1, 5.5, 5.6_

  - [ ] 7.2 Create apps/web/app/api/download/[id]/route.ts
    - Generate pre-signed S3 URL
    - Return download URL with 1 hour expiration
    - _Requirements: 6.3, 6.4_

  - [ ] 7.3 Add render button to UI
    - Trigger render API on click
    - Show progress indicator
    - Display download link when complete
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.4 Handle render errors
    - Display error messages
    - Allow retry
    - _Requirements: 5.4, 13.1, 13.2_

- [ ] 8. Add error handling and feedback
  - [ ] 8.1 Create toast notification component
    - Success, error, loading states
    - Auto-dismiss after 5 seconds
    - _Requirements: 13.2, 13.3_

  - [ ] 8.2 Add error boundaries
    - Catch React errors
    - Display fallback UI
    - _Requirements: 13.1, 13.5_

  - [ ] 8.3 Add loading indicators
    - Spinner during generation
    - Progress bar during render
    - _Requirements: 13.2_

- [ ] 9. Testing and polish
  - [ ] 9.1 Test complete flow
    - URL input → generation → preview → render → download
    - Test with various URLs
    - Test error cases
    - _Requirements: All_

  - [ ] 9.2 Add demo mode notice
    - Banner explaining no data persistence
    - _Requirements: 11.4, 11.5_

  - [ ] 9.3 Optimize preview performance
    - Debounce storyboard edits
    - Memoize scene components
    - _Requirements: 3.3_

## Notes

- Day 1: Tasks 1-4 (Setup + Gemini integration)
- Day 2: Tasks 5-6 (Remotion template + UI)
- Day 3: Tasks 7-9 (Rendering + polish)
- No optional tasks - all required for MVP
- Focus on vertical slice over completeness
