-- Drop unused tables (pruned surface: auth + projects only)

DROP TABLE IF EXISTS "render_job";
DROP TABLE IF EXISTS "checkpoint";
DROP TABLE IF EXISTS "message";
DROP TABLE IF EXISTS "idempotency_key";

DROP TABLE IF EXISTS "ai_chat_logs";
DROP TABLE IF EXISTS "ai_edl_proposals";

DROP TABLE IF EXISTS "timeline_versions";
DROP TABLE IF EXISTS "timelines";
DROP TABLE IF EXISTS "assets";
