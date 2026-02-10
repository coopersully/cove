import type { SUPPORTED_LOCALES } from "./constants.js";

export type Snowflake = string;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface ApiError {
  readonly code: string;
  readonly message: string;
}
