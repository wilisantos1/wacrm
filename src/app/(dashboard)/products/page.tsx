"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useCan } from "@/hooks/use-can";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ProductsPage() {
  const t = useTranslations("Products");
  const supabase = createClient();
  const { accountId, defaultCurrency, profileLoading } = useAuth();
  const canEdit = useCan("send-messages");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[ProductsPage] Failed to load products:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      toast.error(
        error.code === "42P01" || error.code === "PGRST205"
          ? t("migrationRequired")
          : t("loadError"),
      );
      setLoading(false);
      return;
    }
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, [accountId, supabase, t]);

  useEffect(() => {
    if (profileLoading) return;
    if (!accountId) {
      setLoading(false);
      return;
    }
    void loadProducts();
  }, [accountId, loadProducts, profileLoading]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? products.filter((product) =>
          product.name.toLocaleLowerCase().includes(query),
        )
      : products;
  }, [products, search]);

  function openForm(product?: Product) {
    setEditingProduct(product ?? null);
    setName(product?.name ?? "");
    setValue(product ? String(product.value) : "");
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const numericValue = Number(value);
    if (!trimmedName || value.trim() === "" || !Number.isFinite(numericValue) || numericValue < 0) {
      toast.error(t("invalidProduct"));
      return;
    }
    if (!accountId) {
      toast.error(t("accountUnavailable"));
      return;
    }

    setSaving(true);
    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({ name: trimmedName, value: numericValue })
        .eq("id", editingProduct.id)
        .eq("account_id", accountId);
      if (error) {
        toast.error(t("saveError"));
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error(t("accountUnavailable"));
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("products").insert({
        user_id: session.user.id,
        account_id: accountId,
        name: trimmedName,
        value: numericValue,
      });
      if (error) {
        toast.error(t("saveError"));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setFormOpen(false);
    toast.success(editingProduct ? t("updated") : t("created"));
    await loadProducts();
  }

  async function handleDelete() {
    if (!deleteTarget || !accountId) return;
    setDeleting(true);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("account_id", accountId);
    setDeleting(false);
    if (error) {
      toast.error(t("deleteError"));
      return;
    }
    setDeleteTarget(null);
    toast.success(t("deleted"));
    await loadProducts();
  }

  function formatValue(amount: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: defaultCurrency,
    }).format(amount);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => openForm()}
          disabled={!canEdit}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("addProduct")}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-background pl-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("value")}</TableHead>
              <TableHead className="w-24 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center">
                  <p className="font-medium text-foreground">
                    {search ? t("noResults") : t("emptyTitle")}
                  </p>
                  {!search && (
                    <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id} className="border-border">
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatValue(product.value)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("editProduct", { name: product.name })}
                        disabled={!canEdit}
                        onClick={() => openForm(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("deleteProduct", { name: product.name })}
                        disabled={!canEdit}
                        onClick={() => setDeleteTarget(product)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="border-border bg-popover sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                {editingProduct ? t("editTitle") : t("newTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">{t("name")}</Label>
                <Input
                  id="product-name"
                  autoFocus
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-value">{t("value")}</Label>
                <Input
                  id="product-value"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="0,00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("currencyHint", { currency: defaultCurrency })}
                </p>
              </div>
            </div>
            <DialogFooter className="border-border">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving || !canEdit}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border-border bg-popover sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            {t("deleteDescription", { name: deleteTarget?.name ?? "" })}
          </p>
          <DialogFooter className="border-border">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || !canEdit}
              onClick={handleDelete}
            >
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
