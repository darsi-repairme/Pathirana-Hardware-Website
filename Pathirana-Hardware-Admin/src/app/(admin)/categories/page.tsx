"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ImageOff, ImageUp, Pencil, Plus, Tags } from "lucide-react";
import { api, ApiError, categoryImageUrl, uploadFile, type Category } from "@/lib/api";
import { MediaUploadDialog } from "@/components/MediaUploadDialog";
import {
  emptyTranslationForm,
  fromTranslationForm,
  toTranslationForm,
  TranslationFields,
  type TranslationForm,
} from "@/components/TranslationFields";
import { useApi } from "@/lib/useApi";
import { useOpenNew } from "@/lib/useOpenNew";
import { digitsOnly, required, useValidation, wholeNumber, type Rules } from "@/lib/useValidation";
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
  TableWrap,
  Textarea,
  td,
  th,
  AuthImage,
} from "@/components/ui";

type Form = { name: string; slug: string; description: string; sortOrder: string; translations: TranslationForm };
const CATEGORY_RULES: Rules<Form> = {
  name: (v) => required("the category name")(v),
  sortOrder: (v) => wholeNumber("Display order")(v),
};

const empty = (): Form => ({
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  translations: emptyTranslationForm(),
});

export default function CategoriesPage() {
  const list = useApi<{ items: Category[] }>("admin/categories");
  const items = list.data?.items ?? null;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const v = useValidation(form, CATEGORY_RULES);
  /** Translations need migration 0006 (records then carry the field). */
  const translationsSupported = Boolean(items?.some((c) => c.translations !== undefined));
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggle, setToggle] = useState<Category | null>(null);
  const [toggling, setToggling] = useState(false);
  const [media, setMedia] = useState<Category | null>(null);

  const load = list.reload;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.slug.includes(t));
  }, [items, q]);

  const open = (c: Category | "new") => {
    setEditing(c);
    setFormError(null);
    v.reset();
    setForm(
      c === "new"
        ? empty()
        : {
            name: c.name,
            slug: c.slug,
            description: c.description ?? "",
            sortOrder: String(c.sortOrder),
            translations: toTranslationForm(c.translations),
          },
    );
  };
  useOpenNew(() => open("new"));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      description: form.description.trim(),
      sortOrder: Number(form.sortOrder),
      ...(translationsSupported ? { translations: fromTranslationForm(form.translations) } : {}),
    };
    try {
      if (editing === "new") await api.post("admin/categories", body);
      else if (editing) await api.patch(`admin/categories/${editing.id}`, body);
      setNotice(editing === "new" ? `Category “${body.name}” added.` : `Category “${body.name}” saved.`);
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
      await api.patch(`admin/categories/${toggle.id}/status`, { isActive: !toggle.isActive });
      setNotice(`Category “${toggle.name}” ${toggle.isActive ? "deactivated" : "activated"}.`);
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
        title="Categories"
        description="Product categories shown on the website. Inactive categories and their products are hidden from the public."
        actions={
          <Button onClick={() => open("new")} icon={<Plus aria-hidden="true" className="size-4" />}>
            Add Category
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
          <SearchBox value={q} onChange={setQ} label="Search categories" />
        </div>
        {!items && !list.error ? <Spinner /> : null}
        {items && shown.length === 0 ? (
          <EmptyState icon={<Tags />} title={items.length ? "No matching categories" : "No categories yet"}>
            {items.length ? "Try a different search." : "Add the confirmed product categories to get started."}
          </EmptyState>
        ) : null}
        {shown.length ? (
          <TableWrap>
            <table className="rtable w-full xl:min-w-[46rem]">
              <thead className="bg-cream/60">
                <tr>
                  <th scope="col" className={th}>
                    <span className="sr-only">Image</span>
                  </th>
                  <th scope="col" className={th}>
                    Name
                  </th>
                  <th scope="col" className={th}>
                    Order
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {shown.map((c) => (
                  <tr key={c.id} className="hover:bg-cream/40">
                    <td className={`${td} rtable-media w-20`}>
                      {c.imageKey ? (
                        <AuthImage
                          src={categoryImageUrl(c)}
                          alt={c.imageAlt ?? c.name}
                          className="aspect-[4/3] w-16 rounded-lg object-cover"
                          fallbackClassName="aspect-[4/3] w-16"
                        />
                      ) : (
                        <span
                          title="No uploaded image"
                          className="inline-flex aspect-[4/3] w-16 items-center justify-center rounded-lg bg-cream text-ink-muted"
                        >
                          <ImageOff aria-hidden="true" className="size-4" />
                          <span className="sr-only">No uploaded image</span>
                        </span>
                      )}
                    </td>
                    <td className={`${td} rtable-main`}>
                      <p className="font-semibold text-charcoal">{c.name}</p>
                      <p className="text-xs text-ink-muted">/{c.slug}</p>
                    </td>
                    <td className={`${td} tabular-nums`}>{c.sortOrder}</td>
                    <td className={td}>{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className={`${td} rtable-actions text-right`}>
                      <div className="row-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => open(c)}
                          icon={<Pencil aria-hidden="true" className="size-3.5" />}
                        >
                          Edit<span className="sr-only"> {c.name}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMedia(c)}
                          icon={<ImageUp aria-hidden="true" className="size-3.5" />}
                        >
                          Image<span className="sr-only"> for {c.name}</span>
                        </Button>
                        <Button variant={c.isActive ? "danger" : "outline"} size="sm" onClick={() => setToggle(c)}>
                          {c.isActive ? "Deactivate" : "Activate"}
                          <span className="sr-only"> {c.name}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : null}
      </Card>

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add category" : "Edit category"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={saving}>
              {editing === "new" ? "Add Category" : "Save Changes"}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={save} className="space-y-4">
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
                required
                maxLength={120}
                value={form.name}
                onBlur={v.blur("name")}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="URL slug" hint="Optional. Created from the name when left empty (e.g. doors-windows).">
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
          <Field label="Description">
            {(p) => (
              <Textarea
                {...p}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Display order"
            required
            hint="A whole number, 0 or more. Lower numbers are listed first (equal numbers: by name)."
            error={v.error("sortOrder")}
          >
            {(p) => (
              <Input
                {...p}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={form.sortOrder}
                onBlur={v.blur("sortOrder")}
                // Digits only: a typed or pasted "-3", "2.5" or "1e3" cannot be entered.
                onChange={(e) => setForm({ ...form, sortOrder: digitsOnly(e.target.value) })}
              />
            )}
          </Field>
          {translationsSupported ? (
            <TranslationFields
              value={form.translations}
              onChange={(translations) => setForm({ ...form, translations })}
              fields={[
                { key: "name", label: "Category name", english: form.name, maxLength: 120 },
                {
                  key: "description",
                  label: "Description",
                  english: form.description,
                  multiline: true,
                  maxLength: 2000,
                },
              ]}
            />
          ) : null}
        </form>
      </Dialog>

      <MediaUploadDialog
        key={media?.id ?? "closed"}
        open={media !== null}
        title={`Image — ${media?.name ?? ""}`}
        current={media?.imageKey ? { src: categoryImageUrl(media, "full"), alt: media.imageAlt ?? "" } : null}
        currentNote="No uploaded image. The website shows the existing category artwork for the original categories, or a category icon."
        hint="A clear, real photo of the category (landscape works best). JPEG, PNG or WebP up to 5 MB; it is resized and stored as WebP with all metadata removed."
        alt={{
          initial: media?.imageAlt ?? media?.name ?? "",
          label: "Alt text",
          hint: "Describe what the image shows.",
        }}
        onUpload={async (file, altText, onProgress) => {
          // Keep the dialog in step with the saved record (it showed "No uploaded image" until reopened).
          const saved = await uploadFile<Category>(
            `admin/categories/${media!.id}/image`,
            file,
            { altText: altText ?? "" },
            onProgress,
          );
          setMedia(saved);
          setNotice(`Image for “${media!.name}” saved.`);
          load();
        }}
        onSaveAlt={async (altText) => {
          setMedia(await api.patch<Category>(`admin/categories/${media!.id}/image`, { altText }));
          setNotice(`Image description for “${media!.name}” saved.`);
          load();
        }}
        onRemove={async () => {
          await api.del(`admin/categories/${media!.id}/image`);
          setMedia({ ...media!, imageKey: null, imageAlt: null });
          setNotice(`Image for “${media!.name}” removed.`);
          load();
        }}
        removeMessage={`The uploaded image for “${media?.name ?? ""}” will be deleted. The website then shows the existing artwork or an icon.`}
        onClose={() => setMedia(null)}
      />

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isActive ? "Deactivate category?" : "Activate category?"}
        message={
          toggle?.isActive
            ? `“${toggle.name}” and all of its products will be hidden from the public website. You can activate it again at any time.`
            : `“${toggle?.name}” will be visible on the public website again (published products only).`
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
