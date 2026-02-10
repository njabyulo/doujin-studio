import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import ffmpegPath from "ffmpeg-static";
import { chromium } from "playwright";

const BASE_URL = "https://doujin.njabulomajozi.com";

function parseArgs(argv) {
  const out = {
    file: "tmp/sample.mp4",
    out: "dist/doujin-demo.mp4",
    pace: "human",
    typing: "human",
    typingLogin: "human",
    typeDelay: 35,
    headful: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--file" && next) {
      out.file = next;
      i += 1;
      continue;
    }
    if (arg === "--out" && next) {
      out.out = next;
      i += 1;
      continue;
    }
    if (arg === "--pace" && next) {
      out.pace = next;
      i += 1;
      continue;
    }
    if (arg === "--typing" && next) {
      out.typing = next;
      i += 1;
      continue;
    }
    if (arg === "--typing-login" && next) {
      out.typingLogin = next;
      i += 1;
      continue;
    }
    if (arg === "--type-delay" && next) {
      out.typeDelay = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (arg === "--headful") {
      out.headful = true;
      continue;
    }
  }

  if (out.pace !== "human" && out.pace !== "fast") {
    throw new Error(`Invalid --pace value: ${out.pace}`);
  }
  if (out.typing !== "human" && out.typing !== "instant") {
    throw new Error(`Invalid --typing value: ${out.typing}`);
  }
  if (out.typingLogin !== "human" && out.typingLogin !== "instant") {
    throw new Error(`Invalid --typing-login value: ${out.typingLogin}`);
  }
  if (
    !Number.isFinite(out.typeDelay) ||
    out.typeDelay < 0 ||
    out.typeDelay > 250
  ) {
    throw new Error(`Invalid --type-delay value: ${out.typeDelay}`);
  }

  return out;
}

async function waitForVideoState(page) {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const state = await page.evaluate(() => {
      const v = document.querySelector("video");
      if (!v) return null;
      return { currentTime: v.currentTime ?? 0, paused: v.paused ?? false };
    });
    if (state) return state;
    await page.waitForTimeout(250);
  }
  throw new Error("Timed out waiting for <video> element");
}

async function pollUntil(page, label, fn, predicate, timeoutMs = 20_000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (predicate(last)) return last;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out: ${label}`);
}

async function clearAndType(locator, text, opts) {
  await locator.click();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await locator.press("Backspace");
  if (opts.mode === "human") {
    await locator.type(text, { delay: opts.delayMs });
  } else {
    await locator.fill(text);
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function convertWebmToMp4(args) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static did not provide a binary for this platform");
  }

  const cmdArgs = [
    "-y",
    "-i",
    args.input,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    args.output,
  ];

  const result = spawnSync(ffmpegPath, cmdArgs, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.status}`);
  }
}

const args = parseArgs(process.argv);

const demoEmail = process.env.DEMO_EMAIL;
const demoPassword = process.env.DEMO_PASSWORD;

if (!demoEmail || !demoPassword) {
  throw new Error(
    "Missing DEMO_EMAIL or DEMO_PASSWORD env vars (credentials are not accepted via CLI args)",
  );
}

const uploadFilePath = path.resolve(args.file);
if (!fs.existsSync(uploadFilePath)) {
  throw new Error(`Upload file not found: ${uploadFilePath}`);
}

const outMp4Path = path.resolve(args.out);
ensureDir(path.dirname(outMp4Path));

const videoDir = path.resolve("dist/.playwright-video");
ensureDir(videoDir);

const delays =
  args.pace === "fast"
    ? {
        afterNav: 200,
        afterLogin: 400,
        afterUpload: 600,
        afterEditor: 600,
        afterAi: 900,
      }
    : {
        afterNav: 900,
        afterLogin: 1200,
        afterUpload: 1400,
        afterEditor: 1400,
        afterAi: 1600,
      };

const typing = {
  ai: { mode: args.typing, delayMs: args.typeDelay },
  login: { mode: args.typingLogin, delayMs: args.typeDelay },
};

let browser;
let context;

try {
  browser = await chromium.launch({ headless: !args.headful });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  const videoHandle = page.video();

  await page.goto(`${BASE_URL}/auth/sign-in?next=%2F`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(delays.afterNav);

  // Sign in (human typing)
  const emailInput = page
    .locator(
      'input[type="email"], input[name="email"], input[autocomplete="email"]',
    )
    .first();
  const passwordInput = page
    .locator(
      'input[type="password"], input[name="password"], input[autocomplete="current-password"]',
    )
    .first();

  await emailInput.waitFor({ state: "visible", timeout: 30_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 30_000 });

  await clearAndType(emailInput, demoEmail, typing.login);
  await page.waitForTimeout(250);
  await clearAndType(passwordInput, demoPassword, typing.login);
  await page.waitForTimeout(300);

  const signInButton = page
    .getByRole("button", { name: /sign in/i })
    .or(page.locator('button[type="submit"]'))
    .first();
  await signInButton.click({ timeout: 30_000 });

  await page.waitForURL(new RegExp(`${BASE_URL.replace(/\./g, "\\.")}/?$`), {
    timeout: 60_000,
  });
  await page.waitForTimeout(delays.afterLogin);

  // Upload from home page.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 30_000 });
  await fileInput.setInputFiles(uploadFilePath);
  await page.waitForTimeout(delays.afterUpload);

  await page.waitForURL(/\/projects\/[A-Za-z0-9-]+$/, { timeout: 90_000 });
  await page.waitForTimeout(delays.afterEditor);

  // Ensure video exists.
  await waitForVideoState(page);

  const askInput = page.getByPlaceholder(/type a command/i);
  await askInput.waitFor({ state: "visible", timeout: 60_000 });

  async function sendAi(prompt) {
    await clearAndType(askInput, prompt, typing.ai);
    await askInput.press("Enter");
    await page.waitForTimeout(delays.afterAi);
  }

  const before = await page.evaluate(() => {
    const v = document.querySelector("video");
    return v
      ? { currentTime: v.currentTime ?? 0, paused: v.paused ?? false }
      : null;
  });

  await sendAi("go to middle");
  await pollUntil(
    page,
    "video seeks",
    async () =>
      page.evaluate(() => {
        const v = document.querySelector("video");
        return v ? (v.currentTime ?? 0) : 0;
      }),
    (t) => typeof t === "number" && before && t > before.currentTime + 0.5,
    30_000,
  );

  await sendAi("pause");
  await pollUntil(
    page,
    "video pauses",
    async () =>
      page.evaluate(() => {
        const v = document.querySelector("video");
        return v ? !!v.paused : false;
      }),
    (paused) => paused === true,
    30_000,
  );

  await sendAi("restart");
  await pollUntil(
    page,
    "video restarts",
    async () =>
      page.evaluate(() => {
        const v = document.querySelector("video");
        return v ? (v.currentTime ?? 999) : 999;
      }),
    (t) => typeof t === "number" && t < 1.0,
    30_000,
  );

  // Close to flush the .webm recording.
  await context.close();
  await browser.close();

  const webmPath = await videoHandle.path();
  convertWebmToMp4({ input: webmPath, output: outMp4Path });

  console.log(`Saved demo video: ${outMp4Path}`);
} catch (error) {
  try {
    if (context) await context.close();
  } catch {
    // ignore
  }
  try {
    if (browser) await browser.close();
  } catch {
    // ignore
  }

  console.error(error);
  process.exit(1);
}
