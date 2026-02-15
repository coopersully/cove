import { useMediaQuery } from "@hearth/ui";

const DESKTOP_QUERY = "(min-width: 768px)";

export function useIsMobile(): boolean {
  return !useMediaQuery(DESKTOP_QUERY);
}
