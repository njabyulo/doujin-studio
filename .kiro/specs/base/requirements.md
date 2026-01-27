# Requirements Document: AI Ad Creation Tool (MVP)

## Introduction

This document specifies the requirements for a streamlined MVP of an AI-powered advertisement creation tool. The system enables users to generate video advertisements through a simple "One-Shot URL-to-Video" flow: provide a URL, get an AI-generated storyboard, preview in browser, make last-mile edits, and render the final video. The MVP focuses on speed-to-market with a 3-day implementation sprint.

## Glossary

- **System**: The complete AI ad creation tool including frontend, API, and video rendering components
- **User**: A person using the system to create video advertisements (demo mode for MVP, no authentication required)
- **Storyboard**: AI-generated JSON structure containing ad title, branding, and scene definitions
- **Scene**: A single segment of the video with text overlay, voiceover script, image prompt, and duration
- **AI_Generator**: Gemini 1.5 Pro service that analyzes URLs and generates storyboards
- **Rendering_Engine**: Remotion-based component that generates video output from storyboards
- **API**: Hono Edge backend service providing streaming endpoints
- **Frontend**: Next.js web application providing the user interface
- **Remotion_Player**: Browser-based video preview component
- **Streaming_Protocol**: Real-time data streaming mechanism for progressive storyboard delivery

## Requirements

### Requirement 1: URL-to-Storyboard Generation

**User Story:** As a user, I want to provide a URL and have AI analyze it to generate a complete video storyboard, so that I can quickly create ads based on existing content.

#### Acceptance Criteria

1. WHEN a user provides a URL, THE AI_Generator SHALL analyze the URL content using Gemini 1.5 Pro
2. WHEN the AI_Generator analyzes a URL, THE System SHALL return a Storyboard JSON containing ad title, branding (primary color, font family), and up to 6 scenes
3. WHEN the AI_Generator produces a storyboard, EACH scene SHALL contain text overlay, voiceover script, image prompt, and duration in seconds
4. WHEN the AI generation fails, THE System SHALL return an error message and allow the user to retry
5. WHEN a user provides an invalid URL, THE System SHALL reject the request with a descriptive error message
6. THE total duration of all scenes SHALL NOT exceed 30 seconds
7. THE AI_Generator SHALL use Gemini 1.5 Pro's massive context window to analyze full page content

### Requirement 2: Real-Time Storyboard Streaming

**User Story:** As a user, I want to see the storyboard being generated in real-time, so that I can understand the AI's progress and cancel if needed.

#### Acceptance Criteria

1. WHEN the AI_Generator produces storyboard content, THE System SHALL stream partial results to the Frontend using Server-Sent Events
2. WHEN streaming is in progress, THE Frontend SHALL display progress indicators showing generation status
3. WHEN streaming completes, THE Frontend SHALL display the complete storyboard with all scenes
4. WHEN streaming fails or is interrupted, THE System SHALL display partial results and an error indicator
5. WHEN a user cancels generation, THE System SHALL abort the AI request and clean up resources
6. THE System SHALL stream storyboard data incrementally as scenes are generated

### Requirement 3: Browser-Based Video Preview

**User Story:** As a user, I want to preview my video in the browser immediately after generation, so that I can see the result before rendering.

#### Acceptance Criteria

1. WHEN a storyboard is complete, THE Rendering_Engine SHALL display a preview using Remotion Player
2. WHEN the preview is ready, THE Frontend SHALL display playback controls (play, pause, seek)
3. WHEN a user modifies storyboard properties, THE preview SHALL update within 2 seconds
4. WHEN preview generation fails, THE System SHALL display an error message
5. THE preview SHALL render at 30 frames per second without stuttering
6. THE Remotion_Player SHALL run entirely in the browser without server-side rendering

### Requirement 4: Last-Mile Storyboard Editing

**User Story:** As a user, I want to make quick edits to the generated storyboard, so that I can customize the video before final rendering.

#### Acceptance Criteria

1. WHEN a user views a storyboard, THE Frontend SHALL display an editable sidebar with all storyboard properties
2. WHEN a user modifies the ad title, THE System SHALL update the preview immediately
3. WHEN a user changes branding colors or fonts, THE System SHALL update the preview immediately
4. WHEN a user edits scene text or duration, THE System SHALL update the preview immediately
5. WHEN a user makes invalid changes (e.g., negative duration), THE System SHALL reject the change and display validation errors
6. THE System SHALL support editing: ad title, primary color, font family, scene text overlays, scene durations

### Requirement 5: One-Click Video Rendering

**User Story:** As a user, I want to render my final video with one click, so that I can download and use it immediately.

#### Acceptance Criteria

1. WHEN a user clicks render, THE Rendering_Engine SHALL process the storyboard and generate a video file
2. WHEN rendering is in progress, THE System SHALL provide progress updates at least every 5 seconds
3. WHEN rendering completes successfully, THE System SHALL provide a download link
4. WHEN rendering fails, THE System SHALL return an error message with details
5. THE System SHALL render videos at 1080p resolution, 30 FPS, H.264 codec
6. THE System SHALL use Remotion Lambda for scalable, serverless rendering

### Requirement 6: SST Infrastructure with S3 Storage

**User Story:** As a developer, I want infrastructure defined in code using SST, so that I can manage storage and compute resources declaratively.

#### Acceptance Criteria

1. THE System SHALL use SST for infrastructure as code with sst.config.ts
2. THE System SHALL define infrastructure in infra/ folder (compute, storage, database)
3. WHEN a rendered video is complete, THE System SHALL upload it to an S3 bucket defined in SST
4. WHEN a user requests a video download, THE System SHALL return a pre-signed S3 URL
5. THE System SHALL use local Docker PostgreSQL in dev mode via SST dev configuration
6. THE System SHALL initialize SST with npx sst init
7. THE S3 bucket SHALL be configured with public access for video downloads

### Requirement 7: Storyboard Schema Validation

**User Story:** As a developer, I want strict schema validation for storyboards, so that the system maintains data integrity.

#### Acceptance Criteria

1. THE System SHALL define a Storyboard schema using Zod with all required fields
2. WHEN the AI_Generator produces a storyboard, THE System SHALL validate it against the schema
3. WHEN validation fails, THE System SHALL return detailed validation errors
4. THE Storyboard schema SHALL enforce: ad title (string), primary color (hex string), font family (enum), scenes array (max 6)
5. THE Scene schema SHALL enforce: text overlay (string), voiceover script (string), image prompt (string), duration (number, default 5)
6. THE total duration validation SHALL ensure all scenes combined do not exceed 30 seconds

### Requirement 8: Gemini 1.5 Pro Integration

**User Story:** As a developer, I want to use Gemini 1.5 Pro's massive context window, so that I can analyze entire web pages for storyboard generation.

#### Acceptance Criteria

1. THE AI_Generator SHALL use Gemini 1.5 Pro model for all storyboard generation
2. WHEN a user provides a URL, THE System SHALL pass it to Gemini using URL context tools
3. WHEN the Gemini API rate limit is reached, THE System SHALL return an error message
4. WHEN the Gemini API returns an error, THE System SHALL log the error and return a user-friendly message
5. THE System SHALL include API key configuration through environment variables
6. THE AI_Generator SHALL implement timeout handling for requests exceeding 60 seconds
7. THE System SHALL use Vercel AI SDK for Gemini integration

### Requirement 9: Simplified Monorepo Structure with SST

**User Story:** As a developer, I want a simplified monorepo structure with SST infrastructure, so that I can iterate quickly without complex build configurations.

#### Acceptance Criteria

1. THE System SHALL organize code into apps/web, packages/remotion, and infra/ directories
2. THE apps/web workspace SHALL contain the Next.js frontend and API routes
3. THE packages/remotion workspace SHALL contain the Master Remotion template
4. THE infra/ folder SHALL contain SST infrastructure definitions (compute, storage, database)
5. THE sst.config.ts SHALL import infrastructure from infra/ folder
6. THE System SHALL use pnpm workspaces for package management
7. THE System SHALL NOT require separate API server (use Next.js API routes)
8. THE System SHALL use TypeScript throughout with shared types in packages/remotion
9. THE System SHALL use SST dev mode with local Docker PostgreSQL instead of deploying RDS

### Requirement 10: Master Remotion Template

**User Story:** As a developer, I want a single flexible Remotion template, so that I can render any storyboard without managing multiple templates.

#### Acceptance Criteria

1. THE Rendering_Engine SHALL use a single "Master" Remotion composition
2. WHEN rendering a video, THE System SHALL pass the Storyboard JSON as props to the Master template
3. THE Master template SHALL dynamically render up to 6 scenes based on the storyboard
4. THE Master template SHALL apply branding (colors, fonts) from the storyboard
5. THE Master template SHALL support customization of: background colors, text colors, font families, scene transitions
6. THE Master template SHALL render each scene with: text overlay, background (from image prompt), duration timing

### Requirement 11: Demo Mode (No Authentication)

**User Story:** As a user, I want to use the tool immediately without signing up, so that I can test it quickly.

#### Acceptance Criteria

1. WHEN a user visits the site, THE System SHALL allow immediate access without authentication
2. THE System SHALL NOT require user accounts, sessions, or login flows for MVP
3. THE System SHALL use a hardcoded demo user ID for all operations
4. THE System SHALL NOT persist storyboards or videos beyond the current session
5. THE Frontend SHALL display a notice that this is demo mode with no data persistence

### Requirement 12: Responsive User Interface

**User Story:** As a user, I want a responsive interface that works on desktop and tablet, so that I can create ads on different devices.

#### Acceptance Criteria

1. WHEN a user accesses the Frontend on desktop or tablet, THE System SHALL render an appropriate layout
2. THE Frontend SHALL use Tailwind CSS and shadcn/ui components consistently
3. WHEN the viewport width changes, THE Frontend SHALL adjust the layout without requiring a page reload
4. THE Frontend SHALL maintain usability at viewport widths from 768px to 2560px (desktop/tablet only for MVP)
5. THE Frontend SHALL use a two-column layout: storyboard editor on left, video preview on right

### Requirement 13: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages and feedback, so that I understand what went wrong and how to fix issues.

#### Acceptance Criteria

1. WHEN an error occurs, THE System SHALL display a user-friendly error message describing the problem
2. WHEN an operation is in progress, THE Frontend SHALL display loading indicators or progress bars
3. WHEN an operation completes successfully, THE Frontend SHALL display a confirmation message
4. WHEN a network error occurs, THE System SHALL distinguish between client-side and server-side errors
5. THE System SHALL log detailed error information for debugging while showing simplified messages to users

### Requirement 14: Hono Edge API

**User Story:** As a developer, I want a fast edge-based API, so that I can minimize latency for streaming operations.

#### Acceptance Criteria

1. THE API SHALL use Hono framework for all backend endpoints
2. THE API SHALL deploy to edge runtime for low-latency responses
3. THE API SHALL support streaming responses for storyboard generation
4. THE API SHALL validate all requests using Zod schemas
5. THE API SHALL return consistent error responses with status codes and messages
6. THE API SHALL implement CORS for frontend-backend communication
