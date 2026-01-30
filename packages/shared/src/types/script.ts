import { z } from "zod";
import { SScript, SScriptScene } from "../schemas/script";

export type TScriptScene = z.infer<typeof SScriptScene>;
export type TScript = z.infer<typeof SScript>;
