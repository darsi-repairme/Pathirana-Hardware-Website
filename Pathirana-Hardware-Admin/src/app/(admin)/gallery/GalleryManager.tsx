"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, ImagePlus, Images, Pencil, Replace, Trash2 } from "lucide-react";
import { api, ApiError, galleryImageUrl, uploadFile, type GalleryPhoto } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { digitsOnly, required, useValidation, wholeNumber, type Rules } from "@/lib/useValidation";
import {
  TranslationFields,
  fromTranslationForm,
  toTranslationForm,
  type TranslationForm,
} from "@/components/TranslationFields";
import {
  Alert,
  AuthImage,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchBox,
  Spinner,
} from "@/components/ui";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

type Pending = { id: string; file: File; url: string; title: string; altText: string; error?: string };
type EditForm = {
  title: string;
  caption: string;
  altText: string;
  collection: string;
  sortOrder: string;
  translations: TranslationForm;
};
const RULES: Rules<EditForm> = {
  title: (v) => required("a title")(v),
  altText: (v) => required("a description of the photo")(v),
  sortOrder: (v) => wholeNumber("Display order")(v),
};
const nameOf = (f: File) =>
  f.name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120) || "Photo";

/** Gallery photos of the real shop: upload (hidden first), describe, order, publish / hide, replace, delete. */
export function GalleryManager() {
  const list = useApi<GalleryPhoto[]>("admin/gallery");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [group, setGroup] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [edit, setEdit] = useState<GalleryPhoto | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const v = useValidation(form ?? ({} as EditForm), form ? RULES : {});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [toggle, setToggle] = useState<GalleryPhoto | null>(null);
  const [remove, setRemove] = useState<GalleryPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GalleryPhoto | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceFor, setReplaceFor] = useState<GalleryPhoto | null>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const items = list.data;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(
      (g) =>
        !t ||
        g.title.toLowerCase().includes(t) ||
        (g.caption ?? "").toLowerCase().includes(t) ||
        (g.collection ?? "").toLowerCase().includes(t),
    );
  }, [items, q]);

  const pick = (files: FileList | null) => {
    setError(null);
    const next = [...pending];
    for (const f of Array.from(files ?? [])) {
      if (next.length >= MAX_FILES) {
        setError(`Upload up to ${MAX_FILES} photos at a time.`);
        break;
      }
      if (!ACCEPT.includes(f.type)) {
        setError(`“${f.name}” is not a JPEG, PNG or WebP image.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`“${f.name}” is larger than 5 MB.`);
        continue;
      }
      const title = nameOf(f);
      next.push({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f), title, altText: title });
    }
    setPending(next);
  };

  const closeUpload = () => {
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    setPending([]);
    setUploadOpen(false);
    setError(null);
  };

  const uploadAll = async () => {
    const invalid = pending.some((p) => !p.title.trim() || !p.altText.trim());
    if (invalid) {
      setPending((ps) =>
        ps.map((p) => ({
          ...p,
          error: !p.title.trim() || !p.altText.trim() ? "Enter a title and a description." : undefined,
        })),
      );
      return;
    }
    let ok = 0;
    const failed: Pending[] = [];
    for (const p of pending) {
      setUploading(`Uploading ${ok + failed.length + 1} of ${pending.length}…`);
      try {
        await uploadFile(
          "admin/gallery",
          p.file,
          { title: p.title.trim(), altText: p.altText.trim(), ...(group.trim() ? { collection: group.trim() } : {}) },
          () => {},
        );
        URL.revokeObjectURL(p.url);
        ok++;
      } catch (e) {
        failed.push({ ...p, error: (e as ApiError).message });
      }
    }
    setUploading(null);
    setPending(failed);
    list.reload();
    if (ok)
      setNotice(`${ok} photo${ok === 1 ? "" : "s"} uploaded (hidden until you publish ${ok === 1 ? "it" : "them"}).`);
    if (!failed.length) setUploadOpen(false);
  };

  const openEdit = (g: GalleryPhoto) => {
    setEdit(g);
    setFormError(null);
    v.reset();
    setForm({
      title: g.title,
      caption: g.caption ?? "",
      altText: g.altText,
      collection: g.collection ?? "",
      sortOrder: String(g.sortOrder),
      translations: toTranslationForm(g.translations),
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !edit || !v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch(`admin/gallery/${edit.id}`, {
        title: form.title.trim(),
        caption: form.caption.trim(),
        altText: form.altText.trim(),
        collection: form.collection.trim(),
        sortOrder: Number(form.sortOrder),
        translations: fromTranslationForm(form.translations),
      });
      setNotice(`“${form.title.trim()}” saved.`);
      setEdit(null);
      list.reload();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotice(msg);
      list.reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
      setToggle(null);
      setRemove(null);
    }
  };

  const replaceImage = async (file: File | undefined) => {
    const target = replaceFor;
    if (replaceRef.current) replaceRef.current.value = "";
    if (!file || !target) return;
    if (!ACCEPT.includes(file.type) || file.size > MAX_BYTES) {
      setError("Choose a JPEG, PNG or WebP image of up to 5 MB.");
      return;
    }
    await run(
      () => uploadFile(`admin/gallery/${target.id}/image`, file, {}, () => {}),
      `Image for “${target.title}” replaced.`,
    );
  };

  return (
    <>
      <PageHeader
        title="Gallery"
        description="Real photos of the shop for the website’s Gallery page. New uploads stay hidden until you publish them."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <ImagePlus aria-hidden="true" className="size-4" /> Upload Photos
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error && !uploadOpen ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <div className="mb-4 max-w-sm">
        <SearchBox value={q} onChange={setQ} placeholder="Search photos" label="Search photos" />
      </div>
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void replaceImage(e.target.files?.[0])}
      />
      {list.error ? (
        <Alert onRetry={list.reload}>{list.error}</Alert>
      ) : !items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Images className="size-6" />}
          title={q ? "No photos match your search." : "No gallery photos yet."}
        >
          {q ? "Try another word." : "Upload real photos of the shop to show them on the website."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((g) => (
            <li
              key={g.id}
              data-gallery-photo
              className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setPreview(g)}
                className="block aspect-[4/3] w-full overflow-hidden bg-cream"
                aria-label={`Open a larger preview of ${g.title}`}
              >
                <AuthImage
                  src={galleryImageUrl(g)}
                  alt={g.altText}
                  className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                  fallbackClassName="size-full"
                />
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold [overflow-wrap:anywhere] text-charcoal">{g.title}</p>
                  {g.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="grey">Hidden</Badge>}
                </div>
                <p className="text-xs text-ink-muted">
                  Order {g.sortOrder}
                  {g.collection ? ` · ${g.collection}` : ""} · {g.width}×{g.height}
                </p>
                <div className="row-actions justify-start">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(g)} aria-label={`Edit ${g.title}`}>
                    <Pencil aria-hidden="true" className="size-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setToggle(g)}
                    aria-label={`${g.isPublished ? "Hide" : "Publish"} ${g.title}`}
                  >
                    {g.isPublished ? (
                      <EyeOff aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                    {g.isPublished ? "Hide" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Replace the image of ${g.title}`}
                    onClick={() => {
                      setReplaceFor(g);
                      replaceRef.current?.click();
                    }}
                  >
                    <Replace aria-hidden="true" className="size-4" /> Replace
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemove(g)} aria-label={`Delete ${g.title}`}>
                    <Trash2 aria-hidden="true" className="size-4 text-logo-red" /> Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={uploadOpen}
        title="Upload Photos"
        onClose={closeUpload}
        footer={
          <>
            <Button variant="outline" onClick={closeUpload} disabled={Boolean(uploading)}>
              Cancel
            </Button>
            <Button onClick={uploadAll} loading={Boolean(uploading)} disabled={!pending.length}>
              Upload {pending.length ? pending.length : ""} Photo{pending.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert>{error}</Alert> : null}
          {uploading ? <Alert tone="info">{uploading}</Alert> : null}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-brass/50 bg-cream/50 px-4 py-5 text-center text-sm font-semibold text-forest hover:border-brass">
            <ImagePlus aria-hidden="true" className="size-6 text-brass" />
            Choose photos (JPEG, PNG or WebP, up to 5 MB each, {MAX_FILES} at a time)
            <input
              type="file"
              multiple
              accept={ACCEPT.join(",")}
              className="sr-only"
              onChange={(e) => pick(e.target.files)}
            />
          </label>
          <Field label="Group (optional)" hint="e.g. Shop front, Store interior — used to group photos on the website.">
            {(p) => <Input {...p} maxLength={60} value={group} onChange={(e) => setGroup(e.target.value)} />}
          </Field>
          <ul className="space-y-3">
            {pending.map((p, i) => (
              <li key={p.id} className="grid gap-3 rounded-xl border border-line/70 p-3 sm:grid-cols-[6rem_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                <img
                  src={p.url}
                  alt={`Selected photo ${i + 1}`}
                  className="aspect-[4/3] w-24 rounded-lg object-cover"
                />
                <div className="min-w-0 space-y-2">
                  <Field label="Title" required>
                    {(fp) => (
                      <Input
                        {...fp}
                        maxLength={120}
                        value={p.title}
                        onChange={(e) =>
                          setPending((ps) =>
                            ps.map((x) => (x.id === p.id ? { ...x, title: e.target.value, error: undefined } : x)),
                          )
                        }
                      />
                    )}
                  </Field>
                  <Field label="Description (alt text)" required error={p.error}>
                    {(fp) => (
                      <Input
                        {...fp}
                        maxLength={250}
                        value={p.altText}
                        onChange={(e) =>
                          setPending((ps) =>
                            ps.map((x) => (x.id === p.id ? { ...x, altText: e.target.value, error: undefined } : x)),
                          )
                        }
                      />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setPending((ps) => ps.filter((x) => x.id !== p.id));
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" /> Remove from upload
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>

      <Dialog
        open={edit !== null && form !== null}
        title={`Edit Photo — ${edit?.title ?? ""}`}
        onClose={() => setEdit(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button type="submit" form="gallery-form" loading={saving}>
              Save Photo
            </Button>
          </>
        }
      >
        {form ? (
          <form id="gallery-form" noValidate onSubmit={save} className="space-y-4">
            {formError ? <Alert>{formError.message}</Alert> : null}
            <Field label="Title" required error={v.error("title")}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={120}
                  value={form.title}
                  onBlur={v.blur("title")}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              )}
            </Field>
            <Field label="Caption (optional)" hint="Shown under the photo on the website.">
              {(p) => (
                <Input
                  {...p}
                  maxLength={300}
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                />
              )}
            </Field>
            <Field
              label="Description (alt text)"
              required
              hint="For screen readers: what the photo shows."
              error={v.error("altText")}
            >
              {(p) => (
                <Input
                  {...p}
                  maxLength={250}
                  value={form.altText}
                  onBlur={v.blur("altText")}
                  onChange={(e) => setForm({ ...form, altText: e.target.value })}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Group (optional)">
                {(p) => (
                  <Input
                    {...p}
                    maxLength={60}
                    value={form.collection}
                    onChange={(e) => setForm({ ...form, collection: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Display order" required hint="0 or more. Lower first." error={v.error("sortOrder")}>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    maxLength={4}
                    value={form.sortOrder}
                    onBlur={v.blur("sortOrder")}
                    onChange={(e) => setForm({ ...form, sortOrder: digitsOnly(e.target.value) })}
                  />
                )}
              </Field>
            </div>
            <TranslationFields
              value={form.translations}
              onChange={(translations) => setForm({ ...form, translations })}
              fields={[
                { key: "title", label: "Title", english: form.title, maxLength: 120 },
                { key: "caption", label: "Caption", english: form.caption, maxLength: 300 },
                { key: "altText", label: "Description (alt text)", english: form.altText, maxLength: 250 },
              ]}
            />
          </form>
        ) : null}
      </Dialog>

      <Dialog open={preview !== null} title={preview?.title ?? ""} onClose={() => setPreview(null)}>
        {preview ? (
          <figure>
            <AuthImage
              src={galleryImageUrl(preview, "full")}
              alt={preview.altText}
              className="max-h-[70vh] w-full rounded-xl object-contain"
              fallbackClassName="h-48 w-full"
            />
            {preview.caption ? (
              <figcaption className="mt-2 text-sm text-ink-muted">{preview.caption}</figcaption>
            ) : null}
          </figure>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isPublished ? "Hide photo?" : "Publish photo?"}
        message={
          toggle?.isPublished
            ? `“${toggle.title}” will no longer be shown on the website.`
            : `“${toggle?.title}” will be shown on the website’s Gallery page.`
        }
        confirmLabel={toggle?.isPublished ? "Hide" : "Publish"}
        busy={busy}
        onConfirm={() =>
          run(
            () => api.patch(`admin/gallery/${toggle!.id}/publication`, { isPublished: !toggle!.isPublished }),
            `“${toggle!.title}” ${toggle!.isPublished ? "hidden" : "published"}.`,
          )
        }
        onClose={() => setToggle(null)}
      />
      <ConfirmDialog
        open={remove !== null}
        title="Delete photo permanently?"
        message={`“${remove?.title ?? ""}” and its image files will be deleted. This cannot be undone. (To take it off the website temporarily, use Hide instead.)`}
        confirmLabel="Delete Photo"
        danger
        busy={busy}
        onConfirm={() => run(() => api.del(`admin/gallery/${remove!.id}`), `“${remove!.title}” deleted.`)}
        onClose={() => setRemove(null)}
      />
    </>
  );
}
