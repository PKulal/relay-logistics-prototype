/**
 * CP-31 SKU master — docs/01-customer-portal.md. Source §6 Step 6 (SKU master
 * uploaded with dimensions → weight freeze; AI flags dimension outliers).
 * SIMULATED: the AI outlier check and Logisco's verification (instant for a
 * plausible SKU; "Accept as is" sends a flagged SKU to Logisco for review).
 */
import { EmptyState } from "@shared/ui/EmptyState";
import { Bot, Download, Pencil, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { skuWeights } from "@shared/engines/customerSettings";
import { useData } from "@shared/hooks/useDemo";
import { formatINR, formatKg } from "@shared/lib/format";
import { useDemoStore } from "@shared/store";
import { skuOutlier } from "@shared/store/contractActions";
import type { SkuInput } from "@shared/store/customerSettingsActions";
import type { Sku } from "@shared/types";
import { Button } from "@shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Field, NumField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/input";
import { PageHeader } from "@shared/ui/Page";
import { SimulatedTag } from "@shared/ui/SimulatedTag";
import { Chip } from "@shared/ui/StatusChip";
import type { Tone } from "@shared/ui/tones";
import { downloadTemplate, readSkuFile } from "./settingsFiles";
import { useCustomerSession } from "./useCustomerSession";

const STATUS_TONE: Record<Sku["status"], Tone> = {
  frozen: "success",
  flagged: "warning",
  draft: "info",
};
const ORDER: Sku["status"][] = ["flagged", "draft", "frozen"];

export default function CP31Skus() {
  const { t } = useTranslation();
  const { user, customer } = useCustomerSession();
  const data = useData((d) => d);
  const [editing, setEditing] = useState<Sku | "new" | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const canEdit = user.role !== "finance";
  const skus = Object.values(data.skus)
    .filter((s) => s.customerId === customer.id)
    .sort(
      (a, b) =>
        ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
        a.code.localeCompare(b.code),
    );
  const flagged = skus.filter((s) => s.status === "flagged").length;

  const onFile = async (f?: File) => {
    if (!f) return;
    const r = useDemoStore
      .getState()
      .importSkus(customer.id, await readSkuFile(f), user.id);
    toast.success(
      t("cp31.imported", {
        added: r.added,
        flagged: r.flagged,
        skipped: r.skipped,
      }),
    );
    if (file.current) file.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("cp31.title")}
        subtitle={t("cp31.subtitle", { count: skus.length, flagged })}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadTemplate("sku")}>
                <Download /> {t("cp31.template")}
              </Button>
              <Button variant="outline" onClick={() => file.current?.click()}>
                <Upload /> {t("cp31.upload")}
              </Button>
              <input
                ref={file}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                aria-label={t("cp31.upload")}
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button onClick={() => setEditing("new")}>
                <Plus /> {t("cp31.add")}
              </Button>
            </div>
          )
        }
        className="mb-0"
      />
      {skus.length === 0 ? (
        <EmptyState
          title={t("cp31.empty")}
          body={t("cp31.emptyBody")}
          action={
            canEdit && (
              <Button onClick={() => setEditing("new")}>{t("cp31.add")}</Button>
            )
          }
        />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table
            className="w-full text-table [&_td]:pr-3 [&_th]:pr-3"
            data-testid="skus"
          >
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t("cp31.col.code")}</th>
                <th>{t("cp31.col.description")}</th>
                <th>{t("cp31.col.dims")}</th>
                <th>{t("cp31.col.weight")}</th>
                <th>{t("cp31.col.volumetric")}</th>
                <th>{t("cp31.col.hsn")}</th>
                <th>{t("cp31.col.value")}</th>
                <th>{t("cp31.col.status")}</th>
                {canEdit && (
                  <th className="sr-only">{t("cp31.col.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => {
                const w = skuWeights(s, data.settings);
                const why = s.status === "flagged" ? skuOutlier(s) : undefined;
                return (
                  <tr
                    key={s.id}
                    className="border-b align-top last:border-0"
                    aria-label={s.code}
                  >
                    <td className="tabular px-4 py-2 font-medium whitespace-nowrap">
                      {s.code}
                    </td>
                    <td className="py-2">
                      {s.description}
                      {s.status === "flagged" && (
                        <span className="mt-1 flex items-center gap-1 text-caption text-status-warning">
                          <Bot className="size-3.5" aria-hidden />{" "}
                          {t(`cp31.why.${why ?? "density"}`)} <SimulatedTag />
                        </span>
                      )}
                    </td>
                    <td className="tabular whitespace-nowrap">
                      {s.l} × {s.b} × {s.h}
                    </td>
                    <td className="tabular whitespace-nowrap">
                      {formatKg(s.weight)}
                    </td>
                    <td className="tabular text-caption whitespace-nowrap">
                      {formatKg(w.volumetric)} / {formatKg(w.cft)}
                    </td>
                    <td className="tabular">{s.hsn || "—"}</td>
                    <td className="tabular whitespace-nowrap">
                      {s.unitValue ? formatINR(s.unitValue) : "—"}
                    </td>
                    <td>
                      <Chip tone={STATUS_TONE[s.status]}>
                        {t(`cp31.status.${s.status}`)}
                      </Chip>
                    </td>
                    {canEdit && (
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {s.status === "flagged" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => (
                                  useDemoStore
                                    .getState()
                                    .acceptSkuFlag(s.id, user.id),
                                  toast.success(
                                    t("cp31.accepted", { code: s.code }),
                                  )
                                )}
                              >
                                {t("cp31.accept")}
                              </Button>
                              <Button size="sm" onClick={() => setEditing(s)}>
                                {t("cp31.correct")}
                              </Button>
                            </>
                          )}
                          {s.status !== "flagged" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("cp31.editOne", { code: s.code })}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <p className="text-caption text-muted-foreground">
        {t("cp31.note", {
          divisor: data.settings.volumetricDivisor,
          cft: data.settings.cftFactor,
        })}
      </p>
      {editing && (
        <SkuDialog
          sku={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SkuDialog({ sku, onClose }: { sku?: Sku; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, customer } = useCustomerSession();
  const data = useData((d) => d);
  const [f, setF] = useState({
    code: sku?.code ?? "",
    description: sku?.description ?? "",
    l: String(sku?.l ?? ""),
    b: String(sku?.b ?? ""),
    h: String(sku?.h ?? ""),
    weight: String(sku?.weight ?? ""),
    hsn: sku?.hsn ?? "",
    unitValue: String(sku?.unitValue ?? ""),
  });
  const [err, setErr] = useState("");
  const input: SkuInput = {
    code: f.code,
    description: f.description,
    l: Number(f.l),
    b: Number(f.b),
    h: Number(f.h),
    weight: Number(f.weight),
    hsn: f.hsn,
    unitValue: Number(f.unitValue) || 0,
  };
  const valid = [input.l, input.b, input.h, input.weight].every((n) => n > 0);
  const w = valid ? skuWeights(input, data.settings) : undefined;
  const outlier = valid ? skuOutlier(input) : undefined;

  const save = () => {
    const r = useDemoStore
      .getState()
      .saveSku(customer.id, input, sku?.id, user.id);
    if (r.error) return setErr(t(`cp31.err.${r.error}`));
    const status = useDemoStore.getState().data.skus[r.id!].status;
    if (status === "flagged")
      toast.warning(t("cp31.savedFlagged", { code: input.code }));
    else
      toast.success(
        t(
          sku?.status === "frozen" && status === "frozen"
            ? "cp31.reverified"
            : "cp31.saved",
          { code: input.code },
        ),
      );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {sku
              ? sku.status === "flagged"
                ? t("cp31.correctTitle", { code: sku.code })
                : t("cp31.editOne", { code: sku.code })
              : t("cp31.add")}
          </DialogTitle>
          {sku?.status === "frozen" && (
            <DialogDescription>{t("cp31.frozenNote")}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label={t("cp31.col.code")}
            htmlFor="s-code"
            required
            className="col-span-2"
          >
            <Input
              id="s-code"
              value={f.code}
              onChange={(e) =>
                setF({ ...f, code: e.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field
            label={t("cp31.col.hsn")}
            htmlFor="s-hsn"
            className="col-span-2"
          >
            <Input
              id="s-hsn"
              value={f.hsn}
              onChange={(e) => setF({ ...f, hsn: e.target.value })}
            />
          </Field>
          <Field
            label={t("cp31.col.description")}
            htmlFor="s-desc"
            required
            className="col-span-2 sm:col-span-4"
          >
            <Input
              id="s-desc"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
          <NumField
            label={t("cp31.f.l")}
            id="s-l"
            value={f.l}
            onChange={(v) => setF({ ...f, l: v })}
          />
          <NumField
            label={t("cp31.f.b")}
            id="s-b"
            value={f.b}
            onChange={(v) => setF({ ...f, b: v })}
          />
          <NumField
            label={t("cp31.f.h")}
            id="s-h"
            value={f.h}
            onChange={(v) => setF({ ...f, h: v })}
          />
          <NumField
            label={t("cp31.f.weight")}
            id="s-w"
            value={f.weight}
            onChange={(v) => setF({ ...f, weight: v })}
          />
          <NumField
            label={t("cp31.f.value")}
            id="s-v"
            value={f.unitValue}
            onChange={(v) => setF({ ...f, unitValue: v })}
          />
        </div>
        {w && (
          <p className="text-caption" data-testid="sku-preview">
            {t("cp31.preview", {
              volumetric: formatKg(w.volumetric),
              cft: formatKg(w.cft),
            })}{" "}
            {outlier ? (
              <span className="font-medium text-status-warning">
                {t(`cp31.why.${outlier}`)}
              </span>
            ) : (
              <span className="text-status-success">
                {t("cp31.looksRight")}
              </span>
            )}
          </p>
        )}
        {err && (
          <p role="alert" className="text-caption text-status-danger">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
