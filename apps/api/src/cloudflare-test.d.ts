import type { AppBindings } from "./types";

declare module "cloudflare:test" {
  interface ProvidedEnv extends AppBindings {}
}
