---
inclusion: always
---

# Product Context

## AI Ad Creation Tool (a-ds)

Full-stack application for generating professional video advertisements using AI script generation and programmatic video rendering.

## Core Features

**AI Script Generation**

- Google Gemini integration for script generation
- URL context support (web pages, YouTube videos)
- Streaming responses for real-time feedback

**Video Templates**

- Remotion-based templates with customizable parameters
- Template parameters: colors, fonts, timing, transitions
- Real-time preview with playback controls

**Asset Management**

- Upload and organize media files (images, videos, audio)
- Asset library per project
- Asset reuse across projects

**Video Rendering**

- Export to video files via Remotion
- Progress tracking and status updates
- Background job processing

**Project Management**

- Multi-project support per user
- Version history and restoration
- Project metadata (name, created date, last modified)

**Authentication**

- Better Auth with magic link (passwordless)
- User sessions and authorization
- Social account linking (Google)

## Key User Flows

**Primary Flow: Create Ad**

```
Login → Create Project → Generate Script (AI) → Select Template →
Customize Parameters → Preview → Render Video → Download
```

**Asset Management Flow**

```
Upload Media → Organize in Library → Add to Project → Use in Template
```

**Version Control Flow**

```
Save Version → View History → Compare Versions → Restore Previous
```

## Domain Concepts

**Project**: Container for ad creation work (scripts, assets, templates, renders)

**Script**: AI-generated ad copy with scenes and timing

**Template**: Remotion video composition with customizable parameters

**Asset**: User-uploaded media file (image, video, audio)

**Render Job**: Background task for video export with progress tracking

**Connection**: OAuth connection to external services (Google)

## User Personas

**Marketing Professional**

- Creates multiple ads per week
- Needs quick turnaround
- Values consistency and brand alignment
- Limited video editing skills

**Content Creator**

- Experiments with different styles
- Needs flexibility and customization
- Values preview and iteration speed
- Some technical comfort

## Business Rules

**Projects**

- Users can only access their own projects
- Project names must be unique per user
- Projects can be soft-deleted (archived)

**Scripts**

- Generated via AI with user-provided context
- Can be manually edited after generation
- Stored with project for versioning

**Assets**

- Scoped to user account
- File size limits apply (defined in config)
- Supported formats: images (jpg, png, webp), video (mp4, webm), audio (mp3, wav)

**Rendering**

- Asynchronous job processing
- Progress updates via polling or websockets
- Failed renders can be retried
- Rendered videos stored temporarily (7 days)

**Authentication**

- Magic link expires after 15 minutes
- Sessions expire after 30 days of inactivity
- Social connections persist across sessions

## Feature Priorities

**MVP (Current Focus)**

1. User authentication (magic link)
2. Project CRUD operations
3. AI script generation with URL context
4. Basic template selection and customization
5. Video rendering with progress tracking

**Post-MVP**

1. Advanced template editor
2. Asset library with search/filter
3. Collaboration features (share projects)
4. Template marketplace
5. Analytics and usage tracking

## Technical Constraints

**AI Generation**

- Google Gemini API rate limits apply
- Streaming responses for better UX
- Fallback to cached results on rate limit

**Video Rendering**

- CPU-intensive, requires background processing
- Remotion render time varies by complexity
- Storage costs for rendered videos

**Asset Storage**

- Object storage for user uploads
- CDN for asset delivery
- File size limits to control costs

## Success Metrics

**User Engagement**

- Projects created per user
- Scripts generated per project
- Videos rendered per project

**Performance**

- Script generation latency (target: <5s)
- Video render time (target: <2min for 30s ad)
- Preview load time (target: <1s)

**Quality**

- Script generation success rate
- Render success rate
- User satisfaction with generated scripts
