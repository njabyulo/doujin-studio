import { z } from "zod";
import { SBrandKit } from "../schemas/brand-kit";

export type TBrandKit = z.infer<typeof SBrandKit>;
