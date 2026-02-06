# PR/FAQ: Instant Preview + Background Uploads

## Press Release

**Title**
Cinematic Editor Now Previews Immediately While Uploads Continue in the Background

**Summary**
Creators can drop a video into the editor and start working instantly using a local preview. The upload continues in the background via AWS S3 pre-signed URLs, so users never wait for uploads to finish before they can edit.

**Customer Quote**
"I can start cutting the moment I drop a clip. The upload finishes on its own and the editor just keeps going." 

**How It Works**
- The client creates a local blob URL and uses it for immediate playback.
- In parallel, the client requests a pre-signed S3 upload URL and streams the file directly to storage.
- When the upload completes, the editor swaps the asset source to the cloud URL without breaking playback.

**Why It Matters**
This makes large uploads feel instant and keeps the editor responsive, reducing drop-off and frustration.

## FAQ

**Does the user need to wait for the upload?**
No. The editor uses the local blob URL for preview while the upload happens asynchronously.

**What if the upload fails?**
The editor keeps the local preview and shows a retry action. No work is lost.

**Is this secure?**
Yes. Uploads use short-lived S3 pre-signed URLs with scoped permissions.

**How do we handle large files?**
We can add multipart upload later. The initial version supports single PUT uploads.

**What analytics do we track?**
Upload start/finish time, retry counts, and time-to-first-preview.
