import { beforeEach, describe, expect, it } from "vitest";
import {
  claimPendingAuthUploadFile,
  clearPendingAuthUpload,
  getPendingAuthUploadMetadata,
  savePendingAuthUpload,
} from "../lib/pending-auth-upload";

function createFile(name: string, type = "video/mp4", content = "video") {
  return new File([content], name, { type });
}

describe("pending auth upload", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPendingAuthUpload();
  });

  it("stores metadata and returns file once", () => {
    const file = createFile("clip.mp4");

    savePendingAuthUpload(file);
    const metadata = getPendingAuthUploadMetadata();
    expect(metadata?.fileName).toBe("clip.mp4");
    expect(metadata?.mime).toBe("video/mp4");

    const firstClaim = claimPendingAuthUploadFile();
    const secondClaim = claimPendingAuthUploadFile();
    expect(firstClaim?.name).toBe("clip.mp4");
    expect(secondClaim).toBeNull();
  });

  it("clears file and metadata", () => {
    savePendingAuthUpload(createFile("clip.mp4"));
    clearPendingAuthUpload();
    expect(claimPendingAuthUploadFile()).toBeNull();
    expect(getPendingAuthUploadMetadata()).toBeNull();
  });
});
