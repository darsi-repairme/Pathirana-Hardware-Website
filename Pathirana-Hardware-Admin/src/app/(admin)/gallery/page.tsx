import type { Metadata } from "next";
import { GalleryManager } from "./GalleryManager";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return <GalleryManager />;
}
