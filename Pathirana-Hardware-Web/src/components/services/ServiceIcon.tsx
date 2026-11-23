import { Bookmark, Boxes, BrickWall, HardHat, Lightbulb, Truck, type LucideIcon } from "lucide-react";
import type { ServiceIcon as ServiceIconName } from "@/content/services";

export const serviceIcons: Record<ServiceIconName, LucideIcon> = {
  bricks: BrickWall,
  truck: Truck,
  boxes: Boxes,
  bookmark: Bookmark,
  lightbulb: Lightbulb,
  hardhat: HardHat,
};

export function ServiceIcon({ name, className = "size-6" }: { name: ServiceIconName; className?: string }) {
  const Icon = serviceIcons[name];
  return <Icon aria-hidden="true" className={className} strokeWidth={1.6} />;
}
