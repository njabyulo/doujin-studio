import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, message, project } from "@doujin/database/schema";
import type { TBrandKit, TScript, TStoryboard } from "@doujin/shared";
import {
  SBrandKit,
  SCheckpointCreated,
  SScript,
  SStoryboard,
} from "@doujin/shared";

interface CreateCheckpointParams {
  projectId: string;
  sourceMessageId: string;
  parentCheckpointId: string | null;
  storyboard: TStoryboard;
  script: TScript;
  brandKit: TBrandKit;
  name: string;
  reason:
    | "generation"
    | "manual_edit"
    | "scene_regeneration"
    | "asset_generation"
    | "brand_kit_update";
}

export async function createCheckpoint(params: CreateCheckpointParams) {
  const validatedStoryboard = SStoryboard.parse(params.storyboard);
  const validatedScript = SScript.parse(params.script);
  const validatedBrandKit = SBrandKit.parse(params.brandKit);

  const [newCheckpoint] = await db
    .insert(checkpoint)
    .values({
      projectId: params.projectId,
      name: params.name,
      sourceMessageId: params.sourceMessageId,
      parentCheckpointId: params.parentCheckpointId,
      storyboardJson: validatedStoryboard,
      scriptJson: validatedScript,
      brandKitJson: validatedBrandKit,
    })
    .returning();

  const checkpointCreatedContent = SCheckpointCreated.parse({
    version: "1",
    type: "checkpoint_created",
    checkpointId: newCheckpoint.id,
    reason: params.reason,
    artifactRefs: [{ type: "checkpoint", id: newCheckpoint.id }],
  });

  await db.insert(message).values({
    projectId: params.projectId,
    role: "system",
    type: "checkpoint_created",
    contentJson: checkpointCreatedContent,
  });

  await db
    .update(project)
    .set({
      activeCheckpointId: newCheckpoint.id,
      updatedAt: new Date(),
    })
    .where(eq(project.id, params.projectId));

  return newCheckpoint;
}
