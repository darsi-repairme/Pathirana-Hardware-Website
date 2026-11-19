"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Alert, Button, ConfirmDialog, Dialog, Field, Input } from "@/components/ui";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
/** Mirrors the API's MAX_UPLOAD_MB (5 MB); the API enforces it as well. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload / replace / remove ONE image (a brand logo or a category image).
 * The API decodes and re-encodes every file; this dialog only pre-checks the
 * type and size for a quick message.
 */
export function MediaUploadDialog({
  open,
  title,
  current,
  currentNote,
  hint,
  alt,
  onUpload,
  onSaveAlt,
  onRemove,
  removeMessage,
  onClose,
}: {
  open: boolean;
  title: string;
  /** Preview of the uploaded file (same-origin URL), or null when none. */
  current: { src: string; alt: string } | null;
  /** Shown when there is no uploaded file (e.g. what the website shows instead). */
  currentNote: ReactNode;
  hint: ReactNode;
  /** Present for images that need alt text (category images); absent for logos. */
  alt?: { initial: string; label: string; hint: string };
  onUpload: (file: File, altText: string | undefined, onProgress: (f: number) => void) => Promise<void>;
  onSaveAlt?: (altText: string) => Promise<void>;
  onRemove: () => Promise<void>;
  removeMessage: string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  /** Hiding this dialog to show the Remove confirmation fires the native "close" event — not a real close. */
  const switchingToConfirm = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Fresh state per record: callers remount this dialog with key={record id}.
  const [altText, setAltText] = useState(alt?.initial ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setError("Choose a JPEG, PNG or WebP image.");
    if (f.size > MAX_BYTES) return setError("The image is larger than 5 MB. Please choose a smaller file.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const needsAlt = !!alt;
  const upload = async () => {
    if (!file) return;
    if (needsAlt && !altText.trim()) return setError("Describe the image (alt text) for people who cannot see it.");
    setError(null);
    setProgress(0);
    try {
      await onUpload(file, needsAlt ? altText.trim() : undefined, setProgress);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const saveAlt = async () => {
    if (!onSaveAlt) return;
    if (!altText.trim()) return setError("Alt text cannot be empty.");
    setBusy(true);
    setError(null);
    try {
      await onSaveAlt(altText.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onRemove();
      setConfirmRemove(false);
      onClose();
    } catch (e) {
      setConfirmRemove(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress !== null;
  return (
    <>
      <Dialog
        open={open && !confirmRemove}
        title={title}
        onClose={() => {
          if (switchingToConfirm.current) switchingToConfirm.current = false;
          else onClose();
        }}
        footer={
          <>
            {current ? (
              <Button
                variant="danger"
                onClick={() => {
                  switchingToConfirm.current = true;
                  setConfirmRemove(true);
                }}
                disabled={uploading || busy}
                icon={<Trash2 aria-hidden="true" className="size-4" />}
                className="mr-auto"
              >
                Remove
              </Button>
            ) : null}
            <Button variant="outline" onClick={onClose} disabled={uploading || busy}>
              Close
            </Button>
            {file ? (
              <Button onClick={upload} loading={uploading} icon={<Upload aria-hidden="true" className="size-4" />}>
                {current ? "Replace" : "Upload"}
              </Button>
            ) : current && onSaveAlt && altText.trim() !== (alt?.initial ?? "") ? (
              <Button onClick={saveAlt} loading={busy}>
                Save Alt Text
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert>{error}</Alert> : null}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-charcoal">Current</p>
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-line/70 bg-cream/60 p-3">
              {current ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image via the admin gateway
                <img src={current.src} alt={current.alt} className="max-h-32 w-auto max-w-full object-contain" />
              ) : (
                <p className="text-center text-sm text-ink-muted">{currentNote}</p>
              )}
            </div>
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-brass/50 bg-cream/50 px-4 py-5 text-center text-sm font-semibold text-forest hover:border-brass">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
              <img src={preview} alt="Selected image preview" className="max-h-32 w-auto rounded-lg object-contain" />
            ) : (
              <ImagePlus aria-hidden="true" className="size-6 text-brass" />
            )}
            {file ? file.name : current ? "Choose a replacement image" : "Choose an image"}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-ink-muted">{hint}</p>
          {alt && (file || current) ? (
            <Field label={alt.label} required hint={alt.hint}>
              {(p) => <Input {...p} maxLength={250} value={altText} onChange={(e) => setAltText(e.target.value)} />}
            </Field>
          ) : null}
          {uploading ? (
            <div>
              <div
                className="h-2 overflow-hidden rounded-full bg-cream-deep"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label="Upload progress"
              >
                <div
                  className="h-full bg-gradient-to-r from-forest to-brass transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Processing…"}
              </p>
            </div>
          ) : null}
        </div>
      </Dialog>
      <ConfirmDialog
        open={open && confirmRemove}
        title="Remove image?"
        message={removeMessage}
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}
