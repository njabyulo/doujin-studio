import { AwsClient } from "aws4fetch";
import type { AppBindings } from "../types";

function normalizeTtl(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 900;
  }

  return parsed;
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function createR2PresignedPutUrl(
  bindings: AppBindings,
  r2Key: string,
  mime: string,
) {
  const encodedKey = encodeObjectKey(r2Key);
  const ttlSeconds = normalizeTtl(bindings.R2_PRESIGN_TTL_SECONDS);
  const endpoint = new URL(
    `https://${bindings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bindings.MEDIA_BUCKET_NAME}/${encodedKey}`,
  );
  endpoint.searchParams.set("X-Amz-Expires", String(ttlSeconds));

  const client = new AwsClient({
    accessKeyId: bindings.R2_ACCESS_KEY_ID,
    secretAccessKey: bindings.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const signedRequest = await client.sign(
    new Request(endpoint, {
      method: "PUT",
      headers: {
        "content-type": mime,
      },
    }),
    {
      aws: { signQuery: true },
    },
  );

  return signedRequest.url;
}
