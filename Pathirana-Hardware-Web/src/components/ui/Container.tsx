import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string; size?: "default" | "narrow" | "wide" };

const sizes = {
  narrow: "max-w-4xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
} as const;

export function Container({ children, className = "", size = "default" }: Props) {
  return <div className={`mx-auto w-full px-4 sm:px-6 lg:px-10 ${sizes[size]} ${className}`}>{children}</div>;
}
