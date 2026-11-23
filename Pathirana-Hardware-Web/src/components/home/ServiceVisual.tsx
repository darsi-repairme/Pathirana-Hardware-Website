"use client";

import { ThreeCanvas } from "@/components/three/ThreeCanvas";
import {
  bulkScene,
  contractorScene,
  deliveryScene,
  guidanceScene,
  materialsScene,
  reservationsScene,
  spinningServiceScenes,
} from "@/components/three/scenes";
import type { ServiceIcon, ServiceKind } from "@/content/services";
import { serviceIcons } from "@/components/services/ServiceIcon";

const sceneFor = {
  materials: materialsScene,
  delivery: deliveryScene,
  bulk: bulkScene,
  reservations: reservationsScene,
  guidance: guidanceScene,
  contractor: contractorScene,
} as const;

/** 3D floating service object on a glowing gold platform (static icon fallback). */
export function ServiceVisual({
  kind,
  icon,
  className = "",
  active = true,
  spin = false,
}: {
  kind: ServiceKind;
  icon: ServiceIcon;
  className?: string;
  /** Pause the ambient animation (e.g. ring cards turned away). */
  active?: boolean;
  /** Slow continuous 360° turn instead of the gentle sway. */
  spin?: boolean;
}) {
  const Icon = serviceIcons[icon];
  return (
    <ThreeCanvas
      create={spin ? spinningServiceScenes[kind] : sceneFor[kind]}
      className={className}
      active={active}
      fallback={
        <span className="relative flex h-full w-full items-end justify-center pb-4">
          <span className="absolute bottom-3 h-6 w-[70%] max-w-44 rounded-[50%] border-2 border-gold-soft/80 shadow-[0_0_30px_rgb(232_190_79/0.45)]" />
          <Icon strokeWidth={1.25} className="relative mb-3 size-16 text-gold-soft" />
        </span>
      }
    />
  );
}
