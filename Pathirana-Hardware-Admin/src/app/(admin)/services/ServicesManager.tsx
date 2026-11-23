"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, ImageUp, Pencil, Plus, Wrench } from "lucide-react";
import { api, ApiError, serviceImageUrl, SERVICE_ICONS, uploadFile, type SiteService } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { digitsOnly, required, useValidation, wholeNumber, type Rules } from "@/lib/useValidation";
import { MediaUploadDialog } from "@/components/MediaUploadDialog";
import {
  TranslationFields,
  fromTranslationForm,
  toTranslationForm,
  emptyTranslationForm,
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
  Select,
  Spinner,
  TableWrap,
  Textarea,
  td,
  th,
} from "@/components/ui";
import { ViewOnWebsite } from "@/components/ViewOnWebsite";
import { websitePaths } from "@/lib/website";

const ICON_LABEL: Record<SiteService["icon"], string> = {
  bricks: "Bricks",
  truck: "Truck",
  boxes: "Boxes",
  bookmark: "Bookmark",
  lightbulb: "Light bulb",
  hardhat: "Hard hat",
};
/**
 * The six client-approved services, by their fixed slug (set at creation, never edited): only these
 * have a 3D scene on the website (Home ring, Services showcase). Every published service — these
 * and any added later — appears as an image card on the website's See More page (/services/all/).
 */
const APPROVED_3D: ReadonlySet<string> = new Set([
  "building-material-supply",
  "home-site-delivery",
  "bulk-orders",
  "product-reservations",
  "product-advice",
  "contractor-support",
]);

type Form = {
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  howToAsk: string;
  enquireAbout: string;
  share: string;
  icon: SiteService["icon"];
  kind: SiteService["kind"];
  sortOrder: string;
  isPublished: boolean;
  slug: string;
  translations: TranslationForm;
};

const RULES: Rules<Form> = {
  title: (v) => required("the service title")(v),
  summary: (v) => required("a short summary")(v),
  description: (v) => required("the description")(v),
  sortOrder: (v) => wholeNumber("Display order")(v),
  enquireAbout: (v) =>
    String(v)
      .split("\n")
      .filter((l) => l.trim()).length > 10
      ? "List at most 10 questions."
      : null,
};

const empty = (order: number): Form => ({
  title: "",
  shortTitle: "",
  summary: "",
  description: "",
  howToAsk: "",
  enquireAbout: "",
  share: "",
  icon: "bricks",
  kind: "materials",
  sortOrder: String(order),
  isPublished: false,
  slug: "",
  translations: emptyTranslationForm(),
});

/**
 * Services shown on the public website (3D: Home ring and Services page, approved six only; image
 * cards: the See More page, every published service). The six
 * approved services are already here; staff can edit their text, order, image and Tamil /
 * Sinhala versions, publish or hide them, and add new ones (hidden until published).
 */
export function ServicesManager() {
  const list = useApi<SiteService[]>("admin/services");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<SiteService | "new" | null>(null);
  const [form, setForm] = useState<Form>(() => empty(0));
  const v = useValidation(form, RULES);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggle, setToggle] = useState<SiteService | null>(null);
  const [toggling, setToggling] = useState(false);
  const [media, setMedia] = useState<SiteService | null>(null);

  const items = list.data;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(
      (s) => !t || s.title.toLowerCase().includes(t) || s.summary.toLowerCase().includes(t) || s.slug.includes(t),
    );
  }, [items, q]);

  const open = (s: SiteService | "new") => {
    setEditing(s);
    setFormError(null);
    v.reset();
    setForm(
      s === "new"
        ? empty(Math.max(0, ...(items ?? []).map((x) => x.sortOrder + 10)))
        : {
            title: s.title,
            shortTitle: s.shortTitle,
            summary: s.summary,
            description: s.description,
            howToAsk: s.howToAsk,
            enquireAbout: s.enquireAbout.join("\n"),
            share: s.share,
            icon: s.icon,
            kind: s.kind,
            sortOrder: String(s.sortOrder),
            isPublished: s.isPublished,
            slug: s.slug,
            translations: toTranslationForm(s.translations),
          },
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    const body = {
      title: form.title.trim(),
      shortTitle: form.shortTitle.trim() || form.title.trim(),
      summary: form.summary.trim(),
      description: form.description.trim(),
      howToAsk: form.howToAsk.trim(),
      enquireAbout: form.enquireAbout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      share: form.share.trim(),
      icon: form.icon,
      kind: form.kind,
      sortOrder: Number(form.sortOrder),
      isPublished: form.isPublished,
      ...(form.slug.trim() && editing === "new" ? { slug: form.slug.trim() } : {}),
      translations: fromTranslationForm(form.translations),
    };
    try {
      if (editing === "new") await api.post("admin/services", body);
      else if (editing) await api.patch(`admin/services/${editing.id}`, body);
      setNotice(
        editing === "new"
          ? `Service “${body.title}” added${body.isPublished ? " and published" : " (hidden until published)"}.`
          : `Service “${body.title}” saved.`,
      );
      setEditing(null);
      list.reload();
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
      await api.patch(`admin/services/${toggle.id}/publication`, { isPublished: !toggle.isPublished });
      setNotice(`“${toggle.title}” ${toggle.isPublished ? "hidden from" : "published on"} the website.`);
      setToggle(null);
      list.reload();
    } catch (err) {
      setNotice(null);
      setFormError(err as ApiError);
      setToggle(null);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Services"
        description="The six approved services keep their 3D scenes on the Home and Services pages. Every published service, including new ones, appears with its image on the See More page. Changes appear on the website after saving."
        actions={
          <Button onClick={() => open("new")}>
            <Plus aria-hidden="true" className="size-4" /> Add Service
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {formError && !editing ? (
        <div className="mb-4">
          <Alert>{formError.message}</Alert>
        </div>
      ) : null}
      <div className="mb-4 max-w-sm">
        <SearchBox value={q} onChange={setQ} placeholder="Search services" label="Search services" />
      </div>
      {list.error ? (
        <Alert onRetry={list.reload}>{list.error}</Alert>
      ) : !items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-6" />}
          title={q ? "No services match your search." : "No services yet."}
        >
          {q ? "Try another word." : "Add the first service."}
        </EmptyState>
      ) : (
        <TableWrap>
          <table className="rtable w-full text-left xl:min-w-[40rem]">
            <thead className="bg-cream/60">
              <tr>
                <th scope="col" className={`${th} w-20`}>
                  Image
                </th>
                <th scope="col" className={th}>
                  Service
                </th>
                <th scope="col" className={`${th} w-20`}>
                  Order
                </th>
                <th scope="col" className={`${th} w-28`}>
                  Status
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {shown.map((s) => (
                <tr key={s.id} data-service={s.slug} className="hover:bg-cream/40">
                  <td className={`${td} rtable-media`}>
                    {s.imageKey ? (
                      <AuthImage
                        src={serviceImageUrl(s)}
                        alt={s.imageAlt ?? s.title}
                        className="aspect-[4/3] w-16 rounded-lg object-cover"
                        fallbackClassName="aspect-[4/3] w-16"
                      />
                    ) : (
                      <span className="inline-flex aspect-[4/3] w-16 items-center justify-center rounded-lg bg-forest text-xs text-gold-soft">
                        {ICON_LABEL[s.icon]}
                      </span>
                    )}
                  </td>
                  <td className={`${td} rtable-main`}>
                    <p className="font-semibold text-charcoal">{s.title}</p>
                    <p className="line-clamp-2 text-xs text-ink-muted">{s.summary}</p>
                    <p className="mt-1">
                      {APPROVED_3D.has(s.slug) ? (
                        <Badge tone="gold">3D scene + See More</Badge>
                      ) : (
                        <Badge tone="grey">See More page</Badge>
                      )}
                    </p>
                  </td>
                  <td className={`${td} tabular-nums`}>{s.sortOrder}</td>
                  <td className={td}>
                    {s.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="grey">Hidden</Badge>}
                  </td>
                  <td className={`${td} rtable-actions text-right`}>
                    <div className="row-actions">
                      {s.isPublished ? <ViewOnWebsite path={websitePaths.service(s.slug)} name={s.title} /> : null}
                      <Button variant="ghost" onClick={() => open(s)} aria-label={`Edit ${s.title}`}>
                        <Pencil aria-hidden="true" className="size-4" /> Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setMedia(s)} aria-label={`Image for ${s.title}`}>
                        <ImageUp aria-hidden="true" className="size-4" /> Image
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setToggle(s)}
                        aria-label={`${s.isPublished ? "Hide" : "Publish"} ${s.title}`}
                      >
                        {s.isPublished ? (
                          <>
                            <EyeOff aria-hidden="true" className="size-4" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye aria-hidden="true" className="size-4" /> Publish
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add Service" : `Edit Service — ${editing?.title ?? ""}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="service-form" loading={saving}>
              Save Service
            </Button>
          </>
        }
      >
        <form id="service-form" noValidate onSubmit={save} className="space-y-4">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Short title" hint="Footer link text. Empty = the title.">
              {(p) => (
                <Input
                  {...p}
                  maxLength={60}
                  value={form.shortTitle}
                  onChange={(e) => setForm({ ...form, shortTitle: e.target.value })}
                />
              )}
            </Field>
            {editing === "new" ? (
              <Field label="URL slug" hint="Optional. Made from the title when empty.">
                {(p) => (
                  <Input
                    {...p}
                    maxLength={80}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  />
                )}
              </Field>
            ) : (
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
            )}
          </div>
          <Field label="Summary" required hint="One line for the Home page." error={v.error("summary")}>
            {(p) => (
              <Input
                {...p}
                maxLength={300}
                value={form.summary}
                onBlur={v.blur("summary")}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            )}
          </Field>
          <Field label="Description" required error={v.error("description")}>
            {(p) => (
              <Textarea
                {...p}
                maxLength={3000}
                value={form.description}
                onBlur={v.blur("description")}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>
          <Field label="How to ask" hint="What customers should send when they enquire.">
            {(p) => (
              <Input
                {...p}
                maxLength={500}
                value={form.howToAsk}
                onChange={(e) => setForm({ ...form, howToAsk: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Customers can ask about"
            hint="One question per line (up to 10). Questions only — never promises."
            error={v.error("enquireAbout")}
          >
            {(p) => (
              <Textarea
                {...p}
                value={form.enquireAbout}
                onBlur={v.blur("enquireAbout")}
                onChange={(e) => setForm({ ...form, enquireAbout: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Information to share"
            hint='Completes "Share …" in the enquiry steps, e.g. "the items and quantities you need".'
          >
            {(p) => (
              <Input
                {...p}
                maxLength={200}
                value={form.share}
                onChange={(e) => setForm({ ...form, share: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Icon" optional={false}>
              {(p) => (
                <Select
                  {...p}
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value as Form["icon"] })}
                >
                  {SERVICE_ICONS.map((i) => (
                    <option key={i} value={i}>
                      {ICON_LABEL[i]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="rounded-xl border border-line/70 bg-cream/50 px-4 py-3 text-sm" data-service-placement>
              <p className="font-semibold text-charcoal">Where it appears</p>
              <p className="mt-1 text-ink-muted">
                {editing !== "new" && editing && APPROVED_3D.has(editing.slug)
                  ? "Approved 3D scene on the Home page and Services page (fixed), plus an image card on the See More page."
                  : "An image card on the See More page. New services do not get a 3D scene."}
              </p>
            </div>
          </div>
          {editing === "new" ? (
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
          ) : null}
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line/70 px-4">
            <input
              type="checkbox"
              className="size-5 accent-forest"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            <span className="font-semibold text-charcoal">Published on the website</span>
          </label>
          <div className="rounded-2xl border border-gold-soft/40 bg-forest-900 p-4 text-white" aria-label="Preview">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase">Preview</p>
            <p className="mt-2 font-display text-lg font-semibold">{form.title || "Service title"}</p>
            <p className="mt-1 text-sm text-sage">{form.summary || "Short summary"}</p>
          </div>
          <TranslationFields
            value={form.translations}
            onChange={(translations) => setForm({ ...form, translations })}
            fields={[
              { key: "title", label: "Title", english: form.title, maxLength: 120 },
              { key: "shortTitle", label: "Short title", english: form.shortTitle || form.title, maxLength: 60 },
              { key: "summary", label: "Summary", english: form.summary, maxLength: 300 },
              { key: "description", label: "Description", english: form.description, multiline: true, maxLength: 3000 },
              { key: "howToAsk", label: "How to ask", english: form.howToAsk, maxLength: 500 },
              { key: "share", label: "Information to share", english: form.share, maxLength: 200 },
            ]}
          />
        </form>
      </Dialog>

      <MediaUploadDialog
        key={media?.id ?? "closed"}
        open={media !== null}
        title={`Image — ${media?.title ?? ""}`}
        current={media?.imageKey ? { src: serviceImageUrl(media, "full"), alt: media.imageAlt ?? "" } : null}
        currentNote="No uploaded image yet. The See More page shows a plain green panel with the service icon until a photo is uploaded."
        hint="Shown on the website’s See More page; 3D scenes are not affected. A real photo for this service (landscape works best). JPEG, PNG or WebP up to 5 MB; resized to WebP with all metadata removed."
        alt={{
          initial: media?.imageAlt ?? media?.title ?? "",
          label: "Alt text",
          hint: "Describe what the image shows.",
        }}
        onUpload={async (file, altText, onProgress) => {
          setMedia(
            await uploadFile<SiteService>(
              `admin/services/${media!.id}/image`,
              file,
              { altText: altText ?? "" },
              onProgress,
            ),
          );
          setNotice(`Image for “${media!.title}” saved.`);
          list.reload();
        }}
        onSaveAlt={async (altText) => {
          setMedia(await api.patch<SiteService>(`admin/services/${media!.id}/image`, { altText }));
          setNotice(`Image description for “${media!.title}” saved.`);
          list.reload();
        }}
        onRemove={async () => {
          await api.del(`admin/services/${media!.id}/image`);
          setMedia({ ...media!, imageKey: null, imageAlt: null });
          setNotice(`Image for “${media!.title}” removed.`);
          list.reload();
        }}
        removeMessage={`The uploaded image for “${media?.title ?? ""}” will be deleted. The See More page then shows the plain green panel; 3D scenes are not affected.`}
        onClose={() => setMedia(null)}
      />

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isPublished ? "Hide service?" : "Publish service?"}
        message={
          toggle?.isPublished
            ? `“${toggle.title}” will no longer be shown on the website. You can publish it again at any time.`
            : `“${toggle?.title}” will be shown on the website’s Home and Services pages.`
        }
        confirmLabel={toggle?.isPublished ? "Hide" : "Publish"}
        danger={toggle?.isPublished}
        busy={toggling}
        onConfirm={confirmToggle}
        onClose={() => setToggle(null)}
      />
    </>
  );
}
