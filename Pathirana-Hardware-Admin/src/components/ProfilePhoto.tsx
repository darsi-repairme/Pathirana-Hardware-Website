"use client";

import { useId, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { api, ApiError, profilePhotoUrl, uploadFile } from "@/lib/api";
import { Alert, Button, ConfirmDialog } from "@/components/ui";
import { PhotoCropper } from "@/components/PhotoCropper";

/** The chosen original (cropped in the browser; only the 512 × 512 result is uploaded). */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MIN_SIDE = 96;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export type PhotoTarget = { self: true } | { staffId: string };

/**
 * Round avatar: the staff member's profile photo (private, staff-only URL with a version cache key)
 * or their initials when there is no photo or it cannot be loaded.
 */
export function Avatar({
  name,
  target,
  version,
  size = "md",
  className = "",
}: {
  name: string;
  target: PhotoTarget;
  version: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = size === "lg" ? "size-24 text-2xl" : size === "sm" ? "size-8 text-xs" : "size-9 text-sm";
  const src = version ? profilePhotoUrl(target, version, size === "lg" ? "full" : "thumb") : null;
  return (
    <span
      aria-hidden="true"
      data-avatar={src && failed !== src ? "photo" : "initials"}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-semibold text-white ${box} ${className}`}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image via the admin gateway
        <img
          src={src}
          alt=""
          width={size === "lg" ? 96 : 36}
          height={size === "lg" ? 96 : 36}
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/** Reads the real pixel size of a chosen image (the server checks again after decoding). */
function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

/**
 * Profile photo editor: current photo (or initials); choose an image → crop dialog (drag, zoom,
 * circular preview) → Save uploads the 512 × 512 crop; Replace,
 * Remove (confirmed). JPEG, PNG or WebP, at least 96 × 96 px; the server re-checks (2 MB, decoding),
 * crops to a square and strips metadata. `target` is the signed-in user (`{ self: true }`) or,
 * for admins in Staff Management, another staff member.
 */
export function ProfilePhotoEditor({
  name,
  target,
  version,
  onChange,
}: {
  name: string;
  target: PhotoTarget;
  version: string | null;
  onChange: (version: string | null) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  /** The chosen original, shown in the crop dialog (never uploaded as is). */
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const path = "self" in target ? "admin/profile/photo" : `admin/staff/${target.staffId}/photo`;
  const busy = progress !== null || removing;

  const choose = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    setError(null);
    setNotice(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Choose a JPEG, PNG or WebP image.");
    if (f.size > MAX_SOURCE_BYTES) return setError("Choose an image of 15 MB or smaller.");
    try {
      const { width, height } = await imageSize(f);
      if (Math.min(width, height) < MIN_SIDE)
        return setError(`The photo must be at least ${MIN_SIDE} × ${MIN_SIDE} pixels.`);
    } catch {
      return setError("This file could not be read as an image.");
    }
    setCropError(null);
    setCropFile(f);
  };

  /** Uploads the 512 × 512 crop; the avatar changes only after the server confirms. */
  const saveCropped = async (cropped: File) => {
    setCropError(null);
    setProgress(0);
    try {
      const r = await uploadFile<{ photoVersion: string | null }>(path, cropped, {}, setProgress, "PUT");
      onChange(r.photoVersion);
      setNotice(version ? "Profile photo replaced." : "Profile photo saved.");
      setCropFile(null);
    } catch (e) {
      setCropError(e instanceof ApiError ? e.message : "The photo could not be saved. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    setConfirmRemove(false);
    setRemoving(true);
    setError(null);
    try {
      await api.del(path);
      onChange(null);
      setNotice("Profile photo removed.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The photo could not be removed. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div data-profile-photo className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} target={target} version={version} size="lg" className="ring-2 ring-line/70" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-ink-muted">
            {version ? "Shown in the Admin next to your name." : "No photo yet: your initials are shown instead."}
          </p>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            {
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                  icon={
                    version ? (
                      <Camera aria-hidden="true" className="size-4" />
                    ) : (
                      <ImagePlus aria-hidden="true" className="size-4" />
                    )
                  }
                >
                  {version ? "Replace Photo" : "Upload Photo"}
                </Button>
                {version ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(true)}
                    loading={removing}
                    icon={<Trash2 aria-hidden="true" className="size-4 text-logo-red" />}
                  >
                    Remove
                  </Button>
                ) : null}
              </>
            }
          </div>
          <p className="text-xs text-ink-muted">
            JPEG, PNG or WebP · at least 96 × 96 pixels · you crop it before saving.
          </p>
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? (
        <Alert tone="success">
          <span role="status">{notice}</span>
        </Alert>
      ) : null}
      {cropFile ? (
        <PhotoCropper
          key={`${cropFile.name}:${cropFile.size}:${cropFile.lastModified}`}
          file={cropFile}
          saving={progress !== null}
          error={cropError}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            input.current?.click();
          }}
          onSave={(cropped) => void saveCropped(cropped)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove profile photo?"
        message="The photo will be deleted and your initials shown instead. You can upload a new one at any time."
        confirmLabel="Remove Photo"
        danger
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
