/**
 * PP-32 Documents and compliance — docs/02-partner-portal.md. Source §4 Step 8
 * (document-expiry and re-KYC alerts), §5.4 (repeated document expiry is a
 * suspension trigger). Alerts at 30, 15 and 7 days (assumed). Uploading a
 * renewal applies the new expiry; the row stays Under review until Logisco's
 * SIMULATED check (4 hours on the demo clock).
 */
import { EmptyState } from "@shared/ui/EmptyState";
import { BellRing, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  docRegister,
  type DocOwner,
  type DocRow,
  type DocState,
} from "@shared/engines/partnerSettings";
import { useData, useDemoNow } from "@shared/hooks/useDemo";
import { formatDate } from "@shared/lib/format";
import { useDemoStore } from "@shared/store";
import { Button } from "@shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Field } from "@shared/ui/FormField";
import { Input } from "@shared/ui/input";
import { KpiTile } from "@shared/ui/KpiTile";
import { PageHeader } from "@shared/ui/Page";
import { Chip } from "@shared/ui/StatusChip";
import type { Tone } from "@shared/ui/tones";
import { usePartnerSession } from "./usePartnerSession";

const TONE: Record<DocState, Tone> = {
  valid: "success",
  expiring: "warning",
  expired: "danger",
  underReview: "info",
};
const OWNERS: (DocOwner | "all")[] = [
  "all",
  "company",
  "vehicle",
  "staff",
  "hub",
];

export default function PP32Compliance() {
  const { t } = useTranslation();
  const { user, partner } = usePartnerSession();
  const data = useData((d) => d);
  const now = useDemoNow();
  const rows = docRegister(data, partner.id, now);
  const [owner, setOwner] = useState<DocOwner | "all">("all");
  const [renewing, setRenewing] = useState<DocRow>();
  const shown = owner === "all" ? rows : rows.filter((r) => r.owner === owner);
  const count = (s: DocState) => rows.filter((r) => r.status === s).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("pp32.title")}
        subtitle={t("pp32.subtitle")}
        className="mb-0"
      />
      <div className="grid gap-3 sm:grid-cols-4" data-testid="doc-kpis">
        {(["expired", "expiring", "underReview", "valid"] as const).map((s) => (
          <KpiTile
            key={s}
            label={t(`pp32.state.${s}`)}
            value={String(count(s))}
          />
        ))}
      </div>
      <div
        role="tablist"
        aria-label={t("pp32.filter")}
        className="flex w-fit flex-wrap rounded-lg border bg-card p-0.5"
      >
        {OWNERS.map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={owner === o}
            onClick={() => setOwner(o)}
            className={cn(
              "rounded-md px-3 py-1 text-caption font-medium",
              owner === o && "bg-primary text-primary-foreground",
            )}
          >
            {t(`pp32.owner.${o}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t("pp32.empty")} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table
            className="w-full text-table [&_td]:pr-3 [&_th]:pr-3"
            data-testid="documents"
          >
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t("pp32.col.doc")}</th>
                <th>{t("pp32.col.owner")}</th>
                <th>{t("pp32.col.number")}</th>
                <th>{t("pp32.col.expiry")}</th>
                <th>{t("pp32.col.status")}</th>
                <th className="sr-only">{t("pp32.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-0"
                  aria-label={`${t(`pp32.kind.${r.kind}`)} · ${r.ownerName}`}
                >
                  <td className="px-4 py-2 font-medium">
                    {t(`pp32.kind.${r.kind}`)}
                  </td>
                  <td>
                    {r.ownerName}
                    <span className="block text-caption text-muted-foreground">
                      {t(`pp32.owner.${r.owner}`)}
                    </span>
                  </td>
                  <td className="tabular text-caption">
                    {r.number
                      ? r.kind === "police"
                        ? formatDate(r.number)
                        : r.number
                      : "—"}
                  </td>
                  <td className="tabular whitespace-nowrap">
                    {r.expiry ? formatDate(r.expiry) : "—"}
                  </td>
                  <td>
                    <Chip tone={TONE[r.status]}>
                      {r.status === "expiring"
                        ? t("pp32.expiringIn", { days: r.alert })
                        : r.kind === "police" && r.status === "expired"
                          ? t("pp32.pending")
                          : t(`pp32.state.${r.status}`)}
                    </Chip>
                    {r.renewal && r.status === "underReview" && (
                      <span className="block text-caption text-muted-foreground">
                        {r.renewal.file}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {(r.status === "expiring" || r.status === "expired") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRenewing(r)}
                      >
                        <Upload /> {t("pp32.upload")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <BellRing className="size-4" aria-hidden /> {t("pp32.rule")}
      </p>
      {renewing && (
        <RenewDialog
          row={renewing}
          onClose={() => setRenewing(undefined)}
          onSave={(file, expiry) => {
            useDemoStore
              .getState()
              .uploadRenewal(partner.id, renewing.id, file, expiry, user.id);
            toast.success(
              t("pp32.uploaded", { doc: t(`pp32.kind.${renewing.kind}`) }),
            );
            setRenewing(undefined);
          }}
        />
      )}
    </div>
  );
}

function RenewDialog({
  row,
  onClose,
  onSave,
}: {
  row: DocRow;
  onClose: () => void;
  onSave: (file: string, expiry: string) => void;
}) {
  const { t } = useTranslation();
  const now = useDemoNow();
  const [file, setFile] = useState("");
  const [expiry, setExpiry] = useState("");
  const police = row.kind === "police";
  const ok = file && (police || expiry > now.slice(0, 10));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("pp32.renewTitle", {
              doc: t(`pp32.kind.${row.kind}`),
              owner: row.ownerName,
            })}
          </DialogTitle>
          <DialogDescription>{t("pp32.renewNote")}</DialogDescription>
        </DialogHeader>
        <Field label={t("pp32.file")} htmlFor="r-file" required>
          <Input
            id="r-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
          />
        </Field>
        {!police && (
          <Field label={t("pp32.newExpiry")} htmlFor="r-exp" required>
            <Input
              id="r-exp"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!ok}
            onClick={() => onSave(file, police ? "2099-12-31" : expiry)}
          >
            {t("pp32.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
