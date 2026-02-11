export type TGeminiAdapterConfig = {
  apiKey: string;
  model: string;
  fetch: typeof fetch;
};

export type TGeminiGenerateContentInput = {
  systemInstruction: string;
  userText: string;
};

export type TGeminiGenerateContentResult =
  | { ok: true; text: string; version: "v1" | "v1beta" }
  | { ok: false; status: number; text: string; version: "v1" | "v1beta" };

export interface IGeminiAdapter {
  generateContent(
    input: TGeminiGenerateContentInput,
  ): Promise<TGeminiGenerateContentResult>;
}

export function createGeminiAdapter(
  config: TGeminiAdapterConfig,
): IGeminiAdapter {
  // In Cloudflare Workers, calling an unbound platform function can throw
  // "Illegal invocation". Ensure we always call fetch with the correct `this`.
  const fetchImpl = config.fetch.bind(globalThis);

  return {
    async generateContent(input) {
      const stringifyError = (error: unknown) => {
        if (error instanceof Error) {
          return error.message;
        }
        try {
          return JSON.stringify(error);
        } catch {
          return String(error);
        }
      };

      const version: "v1beta" = "v1beta";
      let response: Response;
      try {
        response = await fetchImpl(
          `https://generativelanguage.googleapis.com/${version}/models/${config.model}:generateContent?key=${encodeURIComponent(
            config.apiKey,
          )}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: input.systemInstruction }],
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: input.userText }],
                },
              ],
              generationConfig: {
                temperature: 0.2,
              },
            }),
          },
        );
      } catch (error) {
        return {
          ok: false,
          status: 0,
          text: stringifyError(error),
          version,
        };
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        return { ok: false, status: response.status, text: bodyText, version };
      }

      const data = (await response.json().catch(() => null)) as any;
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text)
          .filter(Boolean)
          .join("\n") ?? "";

      return { ok: true, text, version };
    },
  };
}
