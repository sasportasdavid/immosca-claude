import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine des classNames Tailwind en gérant les conflits.
 * Convention shadcn/ui — utilisée partout dans `components/`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
