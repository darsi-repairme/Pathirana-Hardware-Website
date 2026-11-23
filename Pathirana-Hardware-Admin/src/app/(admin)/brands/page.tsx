"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import { Award, ImageUp, Pencil, Plus } from "lucide-react";
import { api, ApiError, brandLogoUrl, uploadFile, type Brand } from "@/lib/api";
import { required, useValidation, type Rules } from "@/lib/useValidation";
import { MediaUploadDialog } from "@/components/MediaUploadDialog";
import { useApi } from "@/lib/useApi";
import { useOpenNew } from "@/lib/useOpenNew";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchBox,
  Spinner,
} from "@/components/ui";

/** The client's original logo files (copied unmodified from the website), by brand slug.
 *  The public website shows these for brands with these slugs until staff upload a logo. */
const LOGOS: Record<string, { src: string; w: number; h: number }> = {
  "pe-plus": { src: "/brands/pe-plus.png", w: 144, h: 91 },
  swisstek: { src: "/brands/swisstek.png", w: 360, h: 166 },
  "el-toro": { src: "/brands/el-toro.png", w: 163, h: 152 },
  wurth: { src: "/brands/wurth.png", w: 128, h: 128 },
};

type Form = { name: string; slug: string };

const BRAND_RULES: Rules<{ name: string; slug: string }> = {
  name: required("the brand name"),
  slug: (v) =>
    !String(v ?? "").trim() || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(v).trim())
      ? null
      : "Use lowercase letters, digits and single hyphens (e.g. pe-plus).",
};

export default function BrandsPage() {
  const list = useApi<{ items: Brand[] }>("admin/brands");
  const items = list.data?.items ?? null;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [form, setForm] = useState<Form>({ name: "", slug: "" });
  const v = useValidation(form, BRAND_RULES);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggle, setToggle] = useState<Brand | null>(null);
  const [toggling, setToggling] = useState(false);
  const [media, setMedia] = useState<Brand | null>(null);

  const load = list.reload;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((b) => !t || b.name.toLowerCase().includes(t) || b.slug.includes(t));
  }, [items, q]);

  const open = (b: Brand | "new") => {
    setEditing(b);
    setFormError(null);
    v.reset();
    setForm(b === "new" ? { name: "", slug: "" } : { name: b.name, slug: b.slug });
  };
  useOpenNew(() => open("new"));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    const body = { name: form.name.trim(), ...(form.slug.trim() ? { slug: form.slug.trim() } : {}) };
    try {
      if (editing === "new") await api.post("admin/brands", body);
      else if (editing) await api.patch(`admin/brands/${editing.id}`, body);
      setNotice(`Brand “${body.name}” ${editing === "new" ? "added" : "saved"}.`);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggle) return;
    setToggling(true);
    try {
      await api.patch(`admin/brands/${toggle.id}/status`, { isActive: !toggle.isActive });
      setNotice(`Brand “${toggle.name}” ${toggle.isActive ? "deactivated" : "activated"}.`);
      setToggle(null);
      load();
    } catch (err) {
      setError((err as Error).message);
      setToggle(null);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Brands"
        description="Brands shown on the website and offered in the product brand filter. Upload only the brand's original logo file; without one, the website shows the brand name."
        actions={
          <Button onClick={() => open("new")} icon={<Plus aria-hidden="true" className="size-4" />}>
            Add Brand
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error || list.error ? (
        <div className="mb-4">
          <Alert onRetry={load}>{error ?? list.error}</Alert>
        </div>
      ) : null}

      <Card>
        <div className="border-b border-line/70 p-4">
          <SearchBox value={q} onChange={setQ} label="Search brands" />
        </div>
        {!items && !list.error ? <Spinner /> : null}
        {items && shown.length === 0 ? (
          <EmptyState icon={<Award />} title={items.length ? "No matching brands" : "No brands yet"}>
            {items.length
              ? "Try a different search."
              : "Add the brands the shop has confirmed (e.g. PE+, Swisstek, El Toro, Würth)."}
          </EmptyState>
        ) : null}
        {shown.length ? (
          <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((b) => {
              const uploaded = b.logoKey ? { src: brandLogoUrl(b), w: b.logoWidth ?? 0, h: b.logoHeight ?? 0 } : null;
              const logo = uploaded ?? LOGOS[b.slug];
              return (
                <li
                  key={b.id}
                  className="flex flex-col rounded-2xl border border-line/70 bg-paper p-4 transition-colors hover:border-brass/50"
                >
                  <div className="relative flex h-20 items-center justify-center rounded-xl bg-cream/60">
                    {uploaded ? (
                      // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image via the admin gateway
                      <img
                        src={uploaded.src}
                        alt={`${b.name} logo`}
                        width={uploaded.w}
                        height={uploaded.h}
                        className="h-14 w-auto max-w-[80%] object-contain"
                      />
                    ) : logo ? (
                      <Image
                        src={logo.src}
                        alt={`${b.name} logo`}
                        width={logo.w}
                        height={logo.h}
                        unoptimized
                        className="h-14 w-auto max-w-[80%] object-contain"
                      />
                    ) : (
                      <span className="px-3 text-center font-display text-xl font-semibold text-forest/70">
                        {b.name}
                      </span>
                    )}
                    <span className="absolute right-1.5 bottom-1 text-[0.65rem] font-semibold text-ink-muted">
                      {uploaded ? "Uploaded logo" : logo ? "Original file (website)" : "No logo — name shown"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-charcoal">{b.name}</p>
                      <p className="text-xs text-ink-muted">/{b.slug}</p>
                    </div>
                    {b.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                  </div>
                  <div className="row-actions mt-4 justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => open(b)}
                      icon={<Pencil aria-hidden="true" className="size-3.5" />}
                      className="flex-1"
                    >
                      Edit<span className="sr-only"> {b.name}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMedia(b)}
                      icon={<ImageUp aria-hidden="true" className="size-3.5" />}
                      className="flex-1"
                    >
                      Logo<span className="sr-only"> for {b.name}</span>
                    </Button>
                    <Button
                      variant={b.isActive ? "danger" : "outline"}
                      size="sm"
                      onClick={() => setToggle(b)}
                      className="flex-1"
                    >
                      {b.isActive ? "Deactivate" : "Activate"}
                      <span className="sr-only"> {b.name}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add brand" : "Edit brand"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="brand-form" loading={saving}>
              {editing === "new" ? "Add Brand" : "Save Changes"}
            </Button>
          </>
        }
      >
        <form id="brand-form" noValidate onSubmit={save} className="space-y-4">
          {formError ? (
            <Alert>
              {formError.message}
              {formError.details.length ? (
                <ul className="mt-1 list-disc pl-4">
                  {formError.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          <Field label="Name" required error={v.error("name")}>
            {(p) => (
              <Input
                {...p}
                maxLength={120}
                value={form.name}
                onBlur={v.blur("name")}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="URL slug"
            hint="Optional. Created from the name when left empty (PE+ → pe-plus, Würth → wurth)."
            error={v.error("slug")}
          >
            {(p) => (
              <Input
                {...p}
                maxLength={80}
                value={form.slug}
                onBlur={v.blur("slug")}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              />
            )}
          </Field>
        </form>
      </Dialog>

      <MediaUploadDialog
        key={media?.id ?? "closed"}
        open={media !== null}
        title={`Logo — ${media?.name ?? ""}`}
        current={media?.logoKey ? { src: brandLogoUrl(media), alt: `${media.name} logo` } : null}
        currentNote={
          media && LOGOS[media.slug]
            ? "No uploaded logo. The website shows the original logo file supplied for this brand."
            : "No logo. The website shows the brand name instead."
        }
        hint="Use the brand's original logo file (PNG with transparency works best). It is stored without quality loss, never recoloured or cropped; JPEG, PNG or WebP, up to 5 MB."
        onUpload={async (file, _alt, onProgress) => {
          setMedia(await uploadFile<Brand>(`admin/brands/${media!.id}/logo`, file, {}, onProgress));
          setNotice(`Logo for “${media!.name}” saved.`);
          load();
        }}
        onRemove={async () => {
          await api.del(`admin/brands/${media!.id}/logo`);
          setMedia({ ...media!, logoKey: null });
          setNotice(`Logo for “${media!.name}” removed.`);
          load();
        }}
        removeMessage={`The uploaded logo for “${media?.name ?? ""}” will be deleted. The website then shows ${
          media && LOGOS[media.slug] ? "the original logo file supplied for this brand" : "the brand name"
        }.`}
        onClose={() => setMedia(null)}
      />

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isActive ? "Deactivate brand?" : "Activate brand?"}
        message={
          toggle?.isActive
            ? `“${toggle.name}” will no longer be shown on the website or offered in the brand filter.`
            : `“${toggle?.name}” will be shown on the website again.`
        }
        confirmLabel={toggle?.isActive ? "Deactivate" : "Activate"}
        danger={toggle?.isActive}
        busy={toggling}
        onConfirm={confirmToggle}
        onClose={() => setToggle(null)}
      />
    </>
  );
}
