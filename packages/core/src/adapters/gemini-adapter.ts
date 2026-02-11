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
  | { ok: true; text: string }
  | { ok: false; status: number; text: string };

export interface IGeminiAdapter {
  generateContent(
    input: TGeminiGenerateContentInput,
  ): Promise<TGeminiGenerateContentResult>;
}

export function createGeminiAdapter(
  config: TGeminiAdapterConfig,
): IGeminiAdapter {
  return {
    async generateContent(input) {
      let response: Response;
      try {
        response = await config.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(
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
      } catch {
        return { ok: false, status: 0, text: "" };
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        return { ok: false, status: response.status, text: bodyText };
      }

      const data = (await response.json().catch(() => null)) as any;
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text)
          .filter(Boolean)
          .join("\n") ?? "";

      return { ok: true, text };
    },
  };
}
