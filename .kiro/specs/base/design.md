# Design Document: AI Ad Creation Tool (MVP)

## Overview

The AI Ad Creation Tool MVP is a streamlined web application that enables users to generate video advertisements through a simple "One-Shot URL-to-Video" flow. The system focuses on speed-to-market with a 3-day implementation sprint.

### Key Design Principles

1. **Simplicity First**: Minimal architecture with no authentication, no database persistence, no project management
2. **Streaming UX**: Real-time storyboard generation with progressive UI updates
3. **Browser-First**: Remotion Player for instant previews without server-side rendering
4. **Infrastructure as Code**: SST for declarative infrastructure management
5. **Single Template**: One flexible Remotion composition handles all storyboards

### Technology Stack Summary

- **Frontend**: Next.js 16 with App Router, shadcn/ui, Tailwind CSS
- **API**: Next.js API routes (no separate server)
- **AI**: Gemini 1.5 Pro via Vercel AI SDK
- **Video**: Remotion for composition, Remotion Lambda for rendering
- **Storage**: S3 via SST
- **Infrastructure**: SST with local Docker PostgreSQL for dev
- **Package Manager**: pnpm with workspaces

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  Next.js Frontend (apps/web)                            │
│  - URL Input Form                                        │
│  - Storyboard Editor (Sidebar)                          │
│  - Remotion Player (Preview)                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                             │
│  Next.js API Routes (apps/web/app/api)                  │
│  - POST /api/generate (SSE streaming)                   │
│  - POST /api/render                                      │
│  - GET /api/download/:id                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 External Services                        │
│  - Gemini 1.5 Pro (URL analysis + storyboard)          │
│  - Remotion Lambda (video rendering)                    │
│  - S3 (video storage via SST)                           │
└─────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
a-ds/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/
│       │   ├── page.tsx        # Main UI
│       │   └── api/            # API routes
│       │       ├── generate/route.ts
│       │       ├── render/route.ts
│       │       └── download/[id]/route.ts
│       ├── components/         # React components
│       │   ├── url-input.tsx
│       │   ├── storyboard-editor.tsx
│       │   └── video-preview.tsx
│       └── lib/                # Utilities
│
├── packages/
│   └── remotion/               # Remotion template
│       ├── src/
│       │   ├── Root.tsx        # Master composition
│       │   ├── Scene.tsx       # Scene component
│       │   └── types.ts        # Storyboard types
│       └── remotion.config.ts
│
├── infra/                      # SST infrastructure
│   ├── storage.ts              # S3 bucket
│   ├── compute.ts              # Lambda functions
│   └── database.ts             # PostgreSQL (dev only)
│
├── sst.config.ts               # SST configuration
├── pnpm-workspace.yaml
└── package.json
```

### Data Flow

#### Storyboard Generation Flow

```
User enters URL
    ↓
POST /api/generate (SSE)
    ↓
Gemini 1.5 Pro analyzes URL
    ↓
Stream storyboard JSON chunks
    ↓
Frontend updates UI progressively
    ↓
Complete storyboard displayed
    ↓
Remotion Player renders preview
```

#### Video Rendering Flow

```
User clicks "Render"
    ↓
POST /api/render
    ↓
Remotion Lambda starts render
    ↓
Poll for progress
    ↓
Upload to S3 (via SST)
    ↓
Return download URL
```

## Components and Interfaces

### Storyboard Schema

```typescript
// packages/remotion/src/types.ts
import { z } from 'zod';

export const SScene = z.object({
  textOverlay: z.string(),
  voiceoverScript: z.string(),
  imagePrompt: z.string(),
  durationInSeconds: z.number().default(5),
});

export const SStoryboard = z.object({
  adTitle: z.string(),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fontFamily: z.enum(['Inter', 'Roboto', 'Montserrat']),
  }),
  scenes: z.array(SScene).max(6),
});

export type TScene = z.infer<typeof SScene>;
export type TStoryboard = z.infer<typeof SStoryboard>;
```

### API Endpoints

#### POST /api/generate

Streams storyboard generation using Server-Sent Events.

```typescript
// apps/web/app/api/generate/route.ts
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  const { url } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const result = await streamText({
        model: google('gemini-1.5-pro-latest'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPrompt() },
              { type: 'url', url },
            ],
          },
        ],
      });

      for await (const chunk of result.textStream) {
        controller.enqueue(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function buildPrompt(): string {
  return `Analyze the provided URL and generate a video ad storyboard in JSON format.

Output ONLY valid JSON matching this schema:
{
  "adTitle": "string",
  "branding": {
    "primaryColor": "#RRGGBB",
    "fontFamily": "Inter" | "Roboto" | "Montserrat"
  },
  "scenes": [
    {
      "textOverlay": "string",
      "voiceoverScript": "string",
      "imagePrompt": "string for image generation",
      "durationInSeconds": 5
    }
  ]
}

Requirements:
- Maximum 6 scenes
- Total duration must not exceed 30 seconds
- Each scene should have compelling text overlay and voiceover
- Image prompts should describe visual content for each scene`;
}
```

#### POST /api/render

Triggers Remotion Lambda rendering.

```typescript
// apps/web/app/api/render/route.ts
import { renderMediaOnLambda } from '@remotion/lambda/client';
import { Resource } from 'sst';

export async function POST(req: Request) {
  const storyboard = await req.json();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: 'us-east-1',
    functionName: Resource.RemotionFunction.name,
    composition: 'Master',
    serveUrl: process.env.REMOTION_SERVE_URL!,
    codec: 'h264',
    inputProps: storyboard,
  });

  return Response.json({ renderId, bucketName });
}
```

#### GET /api/download/[id]

Returns pre-signed S3 URL for video download.

```typescript
// apps/web/app/api/download/[id]/route.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Resource } from 'sst';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const s3 = new S3Client({});

  const command = new GetObjectCommand({
    Bucket: Resource.VideoBucket.name,
    Key: `${params.id}.mp4`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return Response.json({ url });
}
```

### Frontend Components

#### URL Input Component

```typescript
// apps/web/components/url-input.tsx
'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

interface UrlInputProps {
  onGenerate: (url: string) => void;
  isGenerating: boolean;
}

export function UrlInput({ onGenerate, isGenerating }: UrlInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onGenerate(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="url"
        placeholder="Enter URL to analyze..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isGenerating}
        required
      />
      <Button type="submit" disabled={isGenerating || !url}>
        {isGenerating ? 'Generating...' : 'Generate'}
      </Button>
    </form>
  );
}
```

#### Storyboard Editor Component

```typescript
// apps/web/components/storyboard-editor.tsx
'use client';

import { TStoryboard } from '@a-ds/remotion';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select } from '~/components/ui/select';

interface StoryboardEditorProps {
  storyboard: TStoryboard;
  onChange: (storyboard: TStoryboard) => void;
}

export function StoryboardEditor({ storyboard, onChange }: StoryboardEditorProps) {
  const updateBranding = (key: string, value: string) => {
    onChange({
      ...storyboard,
      branding: { ...storyboard.branding, [key]: value },
    });
  };

  const updateScene = (index: number, key: string, value: string | number) => {
    const scenes = [...storyboard.scenes];
    scenes[index] = { ...scenes[index], [key]: value };
    onChange({ ...storyboard, scenes });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Ad Title</Label>
        <Input
          value={storyboard.adTitle}
          onChange={(e) => onChange({ ...storyboard, adTitle: e.target.value })}
        />
      </div>

      <div>
        <Label>Primary Color</Label>
        <Input
          type="color"
          value={storyboard.branding.primaryColor}
          onChange={(e) => updateBranding('primaryColor', e.target.value)}
        />
      </div>

      <div>
        <Label>Font Family</Label>
        <Select
          value={storyboard.branding.fontFamily}
          onValueChange={(value) => updateBranding('fontFamily', value)}
        >
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Montserrat">Montserrat</option>
        </Select>
      </div>

      <div className="space-y-4">
        <Label>Scenes</Label>
        {storyboard.scenes.map((scene, index) => (
          <div key={index} className="border p-4 rounded space-y-2">
            <Label>Scene {index + 1}</Label>
            <Input
              placeholder="Text Overlay"
              value={scene.textOverlay}
              onChange={(e) => updateScene(index, 'textOverlay', e.target.value)}
            />
            <Input
              type="number"
              placeholder="Duration (seconds)"
              value={scene.durationInSeconds}
              onChange={(e) => updateScene(index, 'durationInSeconds', Number(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Video Preview Component

```typescript
// apps/web/components/video-preview.tsx
'use client';

import { Player } from '@remotion/player';
import { Master } from '@a-ds/remotion';
import { TStoryboard } from '@a-ds/remotion';

interface VideoPreviewProps {
  storyboard: TStoryboard;
}

export function VideoPreview({ storyboard }: VideoPreviewProps) {
  const durationInFrames = storyboard.scenes.reduce(
    (acc, scene) => acc + scene.durationInSeconds * 30,
    0
  );

  return (
    <Player
      component={Master}
      inputProps={storyboard}
      durationInFrames={durationInFrames}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: '100%' }}
      controls
    />
  );
}
```

### Remotion Master Template

```typescript
// packages/remotion/src/Root.tsx
import { Composition } from 'remotion';
import { Master } from './Master';
import { TStoryboard } from './types';

export const RemotionRoot = () => {
  return (
    <Composition
      id="Master"
      component={Master}
      durationInFrames={900} // 30 seconds at 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        adTitle: 'Sample Ad',
        branding: {
          primaryColor: '#3B82F6',
          fontFamily: 'Inter' as const,
        },
        scenes: [
          {
            textOverlay: 'Scene 1',
            voiceoverScript: 'This is scene 1',
            imagePrompt: 'A beautiful landscape',
            durationInSeconds: 5,
          },
        ],
      } as TStoryboard}
    />
  );
};
```

```typescript
// packages/remotion/src/Master.tsx
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { TStoryboard } from './types';
import { Scene } from './Scene';

export const Master: React.FC<TStoryboard> = ({ adTitle, branding, scenes }) => {
  const { fps } = useVideoConfig();

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene, index) => {
        const durationInFrames = scene.durationInSeconds * fps;
        const from = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <Scene scene={scene} branding={branding} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

```typescript
// packages/remotion/src/Scene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { TScene, TStoryboard } from './types';

interface SceneProps {
  scene: TScene;
  branding: TStoryboard['branding'];
}

export const Scene: React.FC<SceneProps> = ({ scene, branding }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15, 135, 150], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: branding.primaryColor,
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <h1
        style={{
          fontFamily: branding.fontFamily,
          fontSize: 80,
          color: '#fff',
          textAlign: 'center',
          padding: '0 100px',
        }}
      >
        {scene.textOverlay}
      </h1>
    </AbsoluteFill>
  );
};
```

## Data Models

### Storyboard Type

```typescript
export type TStoryboard = {
  adTitle: string;
  branding: {
    primaryColor: string; // Hex color
    fontFamily: 'Inter' | 'Roboto' | 'Montserrat';
  };
  scenes: TScene[];
};

export type TScene = {
  textOverlay: string;
  voiceoverScript: string;
  imagePrompt: string;
  durationInSeconds: number;
};
```

### Validation Schemas

```typescript
import { z } from 'zod';

export const SScene = z.object({
  textOverlay: z.string().min(1).max(200),
  voiceoverScript: z.string().min(1).max(500),
  imagePrompt: z.string().min(1).max(300),
  durationInSeconds: z.number().min(1).max(10).default(5),
});

export const SStoryboard = z.object({
  adTitle: z.string().min(1).max(100),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fontFamily: z.enum(['Inter', 'Roboto', 'Montserrat']),
  }),
  scenes: z.array(SScene).min(1).max(6),
});

// Validation helper
export function validateStoryboard(data: unknown): TStoryboard {
  return SStoryboard.parse(data);
}

// Total duration validation
export function validateTotalDuration(storyboard: TStoryboard): boolean {
  const total = storyboard.scenes.reduce(
    (acc, scene) => acc + scene.durationInSeconds,
    0
  );
  return total <= 30;
}
```

## SST Infrastructure

### sst.config.ts

```typescript
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'a-ds',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    const infra = await import('./infra');

    return {
      bucket: infra.bucket.name,
      database: infra.database.host,
    };
  },
});
```

### infra/storage.ts

```typescript
import * as aws from '@pulumi/aws';

export const bucket = new sst.aws.Bucket('VideoBucket', {
  access: 'public',
});

// Export bucket name for use in app
export const bucketName = bucket.name;
```

### infra/database.ts

```typescript
export const database = new sst.aws.Postgres('Database', {
  dev: {
    username: 'postgres',
    password: 'password',
    database: 'local',
    host: 'localhost',
    port: 5432,
  },
});
```

### infra/compute.ts

```typescript
import { bucket } from './storage';

export const remotionFunction = new sst.aws.Function('RemotionFunction', {
  handler: 'packages/remotion/src/lambda.handler',
  timeout: '15 minutes',
  memory: '3 GB',
  link: [bucket],
  environment: {
    REMOTION_SERVE_URL: process.env.REMOTION_SERVE_URL!,
  },
});
```

### Local Development with Docker

```bash
# Start local PostgreSQL
docker run \
  --rm \
  -p 5432:5432 \
  -v $(pwd)/.sst/storage/postgres:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=local \
  postgres:16.4
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Storyboard Schema Validation

*For any* AI-generated storyboard JSON, parsing it with the Storyboard schema should either succeed with valid data or fail with descriptive validation errors.

**Validates: Requirements 1.2, 1.3, 7.2, 7.4, 7.5**

### Property 2: Total Duration Constraint

*For any* valid storyboard, the sum of all scene durations should not exceed 30 seconds.

**Validates: Requirements 1.6, 7.6**

### Property 3: URL Validation

*For any* user input, invalid URLs should be rejected before sending to the AI generator.

**Validates: Requirements 1.5**

### Property 4: Streaming Completeness

*For any* successful storyboard generation, the final streamed result should contain all required fields (adTitle, branding, scenes array).

**Validates: Requirements 2.3, 2.6**

### Property 5: Preview Rendering

*For any* valid storyboard, the Remotion Player should render a preview without errors.

**Validates: Requirements 3.1, 3.5**

### Property 6: Storyboard Edit Preservation

*For any* storyboard modification, the preview should update to reflect the changes within 2 seconds.

**Validates: Requirements 3.3, 4.3, 4.4, 4.5**

### Property 7: Render Output Format

*For any* completed render, the output should be a valid MP4 file at 1080p, 30 FPS, H.264 codec.

**Validates: Requirements 5.5**

### Property 8: S3 Upload Success

*For any* completed render, the video file should be successfully uploaded to S3 and accessible via pre-signed URL.

**Validates: Requirements 6.3, 6.4**

### Property 9: Error Message Clarity

*For any* error condition, the system should display a user-friendly message while logging technical details.

**Validates: Requirements 13.1, 13.5**

### Property 10: Responsive Layout

*For any* viewport width between 768px and 2560px, the UI should render without horizontal scrolling or broken layouts.

**Validates: Requirements 12.3, 12.4**

## Error Handling

### Error Categories

1. **Validation Errors** (400)
   - Invalid URL format
   - Invalid storyboard schema
   - Total duration exceeds 30 seconds

2. **AI Generation Errors** (500)
   - Gemini API timeout
   - Gemini API rate limit
   - Invalid JSON response from AI

3. **Rendering Errors** (500)
   - Remotion Lambda failure
   - S3 upload failure
   - Invalid storyboard props

4. **Network Errors** (503)
   - Connection timeout
   - Service unavailable

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### Error Handling Strategy

- **Frontend**: Display toast notifications for errors, maintain last valid state
- **API**: Return consistent error format, log full error details
- **Streaming**: Send error events through SSE stream
- **Rendering**: Cancel job and clean up resources on failure

## Testing Strategy

### Unit Tests

- Storyboard schema validation
- Total duration calculation
- URL validation
- Component rendering

### Property Tests

- Storyboard schema parsing (100+ random inputs)
- Duration constraint validation
- Preview rendering with various storyboards

### Integration Tests

- End-to-end flow: URL → Storyboard → Preview → Render
- SSE streaming behavior
- S3 upload and download

### Testing Tools

- Vitest for unit tests
- Chrome DevTools MCP for integration tests
- fast-check for property-based tests

## Performance Considerations

### Streaming Optimization

- Use Server-Sent Events for low-latency updates
- Stream JSON chunks as they're generated
- Update UI incrementally to show progress

### Preview Performance

- Remotion Player runs in browser (no server rendering)
- Use React.memo for scene components
- Debounce storyboard edits to reduce re-renders

### Rendering Performance

- Remotion Lambda scales automatically
- Use H.264 codec for broad compatibility
- 1080p resolution balances quality and file size

## Security Considerations

### API Security

- Validate all inputs with Zod schemas
- Rate limit API endpoints
- Sanitize URLs before passing to Gemini

### S3 Security

- Use pre-signed URLs with expiration
- Configure bucket CORS appropriately
- Limit file sizes to prevent abuse

### Environment Variables

- Store API keys in .env.local
- Never commit secrets to git
- Use SST secrets for production

## Deployment

### Development

```bash
# Install dependencies
pnpm install

# Start local PostgreSQL
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=local \
  postgres:16.4

# Start SST dev mode
npx sst dev

# Start Next.js dev server
pnpm dev
```

### Production

```bash
# Deploy infrastructure
npx sst deploy --stage production

# Build and deploy Next.js
pnpm build
```

## Future Enhancements (Post-MVP)

- User authentication and project persistence
- Multiple Remotion templates
- AI-generated images for scenes (Stability AI)
- Voiceover generation (ElevenLabs)
- Advanced editing (timeline, transitions)
- Template marketplace
