import type { JSX } from "react";
import { cn } from "../lib/utils.js";

interface LogoProps {
  readonly className?: string;
}

export function Logo({ className }: LogoProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 107.01 108.89"
      fill="currentColor"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <path d="M46.95.45c74.64-8.48,82.19,105.67,8.69,108.4C-13.15,111.4-20.57,8.13,46.95.45ZM61.52,10.96c-3.77.59-9.75,3.49-12.79,5.86-7.35,5.73-26.08,24.66-32.02,32.04-22.9,28.41,13.85,65.99,43.41,41.77,6.75-5.53,31.36-30.07,34.46-36.9,10.37-22.85-8.36-46.62-33.06-42.77Z" />
    </svg>
  );
}
