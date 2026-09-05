import type { AestheticBundle } from "@contracts/types";

export interface CompareSong {
  id: string;
  title: string;
  aesthetic: AestheticBundle;
  color: string;
}
