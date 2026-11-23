"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api, type Product } from "@/lib/api";
import { useStaff } from "@/components/AdminShell";
import { Alert, Button, Card, Dialog, Field, Input } from "@/components/ui";

/**
 * Permanent deletion (admins only; the API enforces it too). Unpublishing is the
 * recommended routine action. Deleting removes the product, its images and brand
 * links; customers' quotation requests keep the product name they asked for.
 */
export function DeleteProductCard({ product }: { product: Product }) {
  const staff = useStaff();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (staff.role !== "admin") return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.del<{ quotationItemsKept: number }>(`admin/products/${product.id}`, {
        confirmSlug: typed.trim(),
      });
      const kept = res?.quotationItemsKept ?? 0;
      router.push(`/products?deleted=${encodeURIComponent(product.name)}&kept=${kept}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card className="border-logo-red/30 p-5">
      <h2 className="font-display text-lg font-semibold text-logo-red">Delete permanently</h2>
      <p className="mt-2 text-sm text-ink-muted">
        To take a product off the website, <strong>unpublish</strong> it — that can be undone. Delete only products
        added by mistake: the product, its images and brand links are removed for good. Quotation requests keep the
        product name customers asked for.
      </p>
      <Button
        variant="danger"
        size="sm"
        className="mt-4"
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
        icon={<Trash2 aria-hidden="true" className="size-3.5" />}
      >
        Delete product…
      </Button>
      <Dialog
        open={open}
        title="Delete this product permanently?"
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={busy} disabled={typed.trim() !== product.slug}>
              Delete Permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert>{error}</Alert> : null}
          <p className="text-sm text-charcoal">
            “{product.name}”{product.isPublished ? " is published and" : ""} will be removed from the website and the
            database, with its {product.images.length} image{product.images.length === 1 ? "" : "s"}. This cannot be
            undone.
          </p>
          <Field label={`Type the product's URL slug to confirm: ${product.slug}`} required>
            {(p) => (
              <Input
                {...p}
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
