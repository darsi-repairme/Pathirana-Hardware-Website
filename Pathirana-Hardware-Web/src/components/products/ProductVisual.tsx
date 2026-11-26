import type { LucideIcon } from "lucide-react";

/** Forest-green icon panel used when a product has no uploaded image. */
export function IconPanel({ icon: Icon, size = "md" }: { icon: LucideIcon; size?: "md" | "lg" }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#16704a,var(--color-forest-900)_75%)]">
      <span
        className={`relative inline-flex items-center justify-center rounded-full border-2 border-gold-soft/70 shadow-[0_0_34px_rgb(232_190_79/0.3)] ${size === "lg" ? "size-32 sm:size-40" : "size-20 sm:size-24"}`}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.3}
          className={`text-gold-soft ${size === "lg" ? "size-16 sm:size-20" : "size-10 sm:size-12"}`}
        />
      </span>
    </div>
  );
}
