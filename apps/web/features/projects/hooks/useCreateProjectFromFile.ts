"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createProject } from "~/lib/assets-api";
import { getSessionOrMe } from "~/lib/auth-api";
import { buildAuthHref } from "~/lib/auth-navigation";
import {
  claimPendingAuthUploadFile,
  clearPendingAuthUpload,
  getPendingAuthUploadMetadata,
  savePendingAuthUpload,
} from "~/lib/pending-auth-upload";
import { useProject } from "~/providers/ProjectProvider";

const isVideoFile = (file: File) => {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
};

const deriveProjectTitle = (fileName: string) => {
  const raw = fileName.replace(/\.[^/.]+$/, "").trim();
  return raw || "Untitled Project";
};

export const useCreateProjectFromFile = (options: {
  nextPathAfterAuth: string;
}) => {
  const router = useRouter();
  const { setLocalVideoFile } = useProject();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const resumeTriggeredRef = useRef(false);

  const bootstrapFromFile = useCallback(
    async (file: File) => {
      const project = await createProject({
        title: deriveProjectTitle(file.name),
      });

      const projectId = project.project.id;
      setLocalVideoFile(file);
      clearPendingAuthUpload();
      router.push(`/projects/${projectId}`);
    },
    [router, setLocalVideoFile],
  );

  const startFromFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;

      if (!isVideoFile(file)) {
        setError("Please upload a valid video file.");
        return;
      }

      setError(null);
      setResumeMessage(null);
      setIsStarting(true);

      try {
        await getSessionOrMe();
        await bootstrapFromFile(file);
      } catch (caughtError) {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.status === 401
        ) {
          savePendingAuthUpload(file);
          router.push(
            buildAuthHref("/auth/sign-in", options.nextPathAfterAuth),
          );
          return;
        }

        setError("Could not initialize project. Please try again.");
      } finally {
        setIsStarting(false);
      }
    },
    [bootstrapFromFile, options.nextPathAfterAuth, router],
  );

  const resumeIfPending = useCallback(async () => {
    if (resumeTriggeredRef.current) {
      return;
    }

    const metadata = getPendingAuthUploadMetadata();
    if (!metadata) {
      return;
    }

    resumeTriggeredRef.current = true;

    try {
      await getSessionOrMe();
    } catch (caughtError) {
      // If not authenticated yet, do nothing.
      resumeTriggeredRef.current = false;
      if (caughtError instanceof ApiClientError && caughtError.status === 401) {
        return;
      }
      return;
    }

    const pendingFile = claimPendingAuthUploadFile();
    if (!pendingFile) {
      setResumeMessage(
        `Signed in. Please reselect "${metadata.fileName}" to continue.`,
      );
      clearPendingAuthUpload();
      resumeTriggeredRef.current = false;
      return;
    }

    setResumeMessage(`Resuming upload for "${pendingFile.name}"...`);
    setError(null);
    setIsStarting(true);
    try {
      await bootstrapFromFile(pendingFile);
    } catch {
      setResumeMessage(
        "Signed in, but could not resume upload. Please reselect your file.",
      );
    } finally {
      setIsStarting(false);
      resumeTriggeredRef.current = false;
    }
  }, [bootstrapFromFile]);

  // If the user comes back to the same page without remounting, attempt resume once.
  useEffect(() => {
    void resumeIfPending();
  }, [resumeIfPending]);

  return {
    isStarting,
    error,
    resumeMessage,
    setError,
    setResumeMessage,
    startFromFile,
    resumeIfPending,
  };
};
