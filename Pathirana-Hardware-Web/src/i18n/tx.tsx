import type { ReactNode } from "react";
import { T } from "./I18nProvider";

/**
 * Translates a plain-string prop (button label, eyebrow, heading…) and leaves
 * any other node as it is. Usable from server and client components.
 */
export const tx = (node: ReactNode): ReactNode => (typeof node === "string" ? <T>{node}</T> : node);
