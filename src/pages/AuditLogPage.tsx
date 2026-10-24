import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  AuditEventType,
  UserRole,
  type AuditEventListItem,
  type AuditListQuery,
  type AuditVerificationResponse,
  type PaginatedResponse,
} from "@aegisai/shared";
import { ApiError, getAudit, getAuditExport, verifyAuditChain } from "../api/client";
import { useAuth } from "../context/useAuth";

const PAGE_SIZE = 20;
interface AuditDraftFilters {
  eventType: string;
  toolId: string;
  actor: string;
  from: string;
  to: string;
}
type AuditFilters = Omit<Partial<AuditListQuery>, "from" | "to"> & {
  from?: Date | string;
  to?: Date | string;
};

const emptyFilters: AuditDraftFilters = { eventType: "", toolId: "", actor: "", from: "", to: "" };

function auditErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error instanceof ApiError && error.status === 403) {
    return "Your account does not have permission to access this audit action.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "One or more filters are invalid. Check the IDs and date range.";
  }
  return error instanceof Error ? error.message : "The audit request could not be completed.";
}

function formatTimestamp(value: Date | string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "Invalid timestamp" : timestamp.toLocaleString();
}

function dateBoundary(value: string, endOfDay = false): string {
  if (!value) return "";
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

export const AuditLogPage = () => {
  const { role } = useAuth();
  const canVerify = role === UserRole.Admin || role === UserRole.Auditor;
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState<AuditDraftFilters>(emptyFilters);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [result, setResult] = useState<PaginatedResponse<AuditEventListItem>>({
    data: [],
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<AuditVerificationResponse | null>(null);
  const [verificationError, setVerificationError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getAudit({ ...filters, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((nextResult) => setResult(nextResult))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(auditErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, filters, reloadVersion]);

  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const visibleStart = result.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const visibleEnd = Math.min(page * PAGE_SIZE, result.total);
  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

  function updateDraft(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setLoading(true);
    setLoadError("");
    setFilters({
      ...(draftFilters.eventType ? { eventType: draftFilters.eventType } : {}),
      ...(draftFilters.toolId ? { toolId: draftFilters.toolId.trim() } : {}),
      ...(draftFilters.actor ? { actor: draftFilters.actor.trim() } : {}),
      ...(draftFilters.from ? { from: dateBoundary(draftFilters.from) } : {}),
      ...(draftFilters.to ? { to: dateBoundary(draftFilters.to, true) } : {}),
    });
  }

  function clearFilters() {
    setDraftFilters(emptyFilters);
    setFilters({});
    setPage(1);
    setLoading(true);
    setLoadError("");
  }

  async function exportCsv() {
    setExporting(true);
    setExportError("");
    try {
      const blob = await getAuditExport(filters);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "audit-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error: unknown) {
      setExportError(auditErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  async function verifyChain() {
    setVerifying(true);
    setVerificationError("");
    setVerification(null);
    try {
      setVerification(await verifyAuditChain());
    } catch (error: unknown) {
      setVerificationError(auditErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  }

  function retryLoad(): void {
    setLoading(true);
    setLoadError("");
    setReloadVersion((version) => version + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#E8E8E4] pb-4 dark:border-[#27282B] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#18191B] dark:text-[#EDEDED]">Audit Log</h1>
            <span className="rounded-full border border-[#1B4D3E]/20 bg-[#1B4D3E]/10 px-2 py-0.5 text-[11px] font-medium text-[#1B4D3E] dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
              {result.total} Recorded Events
            </span>
          </div>
          <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">
            Append-only, hash-chained evidence of governance activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3 py-2 text-xs font-medium text-[#18191B] transition-colors hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60 dark:border-[#2C2E32] dark:bg-[#1A1C1E] dark:text-[#EDEDED] dark:hover:bg-neutral-800"
          >
            {exporting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </button>
          {canVerify && (
            <button
              type="button"
              onClick={verifyChain}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B4D3E] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#163F33] disabled:cursor-wait disabled:opacity-60"
            >
              {verifying ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Verify hash chain
            </button>
          )}
        </div>
      </div>

      {exportError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{exportError}</p>}
      {verificationError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{verificationError}</p>}
      {verification && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${verification.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"}`}>
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{verification.valid ? "Audit chain verified" : "Audit chain verification failed"}</p>
            <p className="mt-0.5">
              {verification.checked} event(s) checked
              {verification.firstBrokenSequence == null ? "." : `; first broken sequence: ${verification.firstBrokenSequence}.`}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={applyFilters} className="rounded-xl border border-[#E8E8E4] bg-white p-4 shadow-2xs dark:border-[#27282B] dark:bg-[#18191B]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[11px] font-medium text-[#717378] dark:text-[#8E9096]">
            Event type
            <select name="eventType" value={draftFilters.eventType} onChange={updateDraft} className="mt-1 block w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]">
              <option value="">All event types</option>
              {Object.values(AuditEventType).map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-[#717378] dark:text-[#8E9096]">
            Tool ID
            <input name="toolId" value={draftFilters.toolId} onChange={updateDraft} placeholder="24-character ID" className="mt-1 block w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] placeholder-[#8A8C92] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]" />
          </label>
          <label className="text-[11px] font-medium text-[#717378] dark:text-[#8E9096]">
            Actor ID
            <input name="actor" value={draftFilters.actor} onChange={updateDraft} placeholder="24-character ID" className="mt-1 block w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] placeholder-[#8A8C92] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]" />
          </label>
          <label className="text-[11px] font-medium text-[#717378] dark:text-[#8E9096]">
            From
            <input type="date" name="from" value={draftFilters.from} onChange={updateDraft} className="mt-1 block w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]" />
          </label>
          <label className="text-[11px] font-medium text-[#717378] dark:text-[#8E9096]">
            To
            <input type="date" name="to" value={draftFilters.to} onChange={updateDraft} className="mt-1 block w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-lg bg-[#1B4D3E] px-3 py-2 text-xs font-medium text-white hover:bg-[#163F33]">Apply filters</button>
          {hasFilters && <button type="button" onClick={clearFilters} className="text-xs font-medium text-[#1B4D3E] hover:underline dark:text-emerald-400">Clear filters</button>}
          <span className="ml-auto text-[11px] text-[#8A8C92]">Filters apply to the current page and CSV export.</span>
        </div>
      </form>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Could not load the audit log</p>
              <p className="mt-1 text-xs">{loadError}</p>
              <button type="button" onClick={retryLoad} className="mt-3 text-xs font-semibold underline">Try again</button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#717378] dark:text-[#8E9096]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading audit events…
        </div>
      ) : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D8D8D3] bg-white px-6 py-12 text-center dark:border-[#34363A] dark:bg-[#18191B]">
          <p className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">No audit events found</p>
          <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">{hasFilters ? "Try changing or clearing the filters." : "Governance actions will appear here as they are recorded."}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#E8E8E4] bg-white shadow-xs dark:border-[#27282B] dark:bg-[#18191B]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[#E8E8E4] bg-neutral-50 text-[#717378] dark:border-[#27282B] dark:bg-neutral-900/60 dark:text-[#8E9096]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sequence / Time</th>
                    <th className="px-4 py-3 font-medium">Event Type</th>
                    <th className="px-4 py-3 font-medium">Tool</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0ED] dark:divide-[#242629]">
                  {result.data.map((event) => (
                    <tr key={event.sequence} className="align-top transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40">
                      <td className="whitespace-nowrap px-4 py-3 text-[#717378] dark:text-[#8E9096]">
                        <span className="block font-medium text-[#444] dark:text-[#BBB]">#{event.sequence}</span>
                        <span className="mt-1 block text-[10px]">{formatTimestamp(event.timestamp)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-[#444] dark:bg-neutral-800 dark:text-[#BBB]">{event.eventType}</span>
                      </td>
                      <td className="max-w-48 break-all px-4 py-3 text-[#64666B] dark:text-[#9A9CA2]">{event.toolId || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#18191B] dark:text-[#EDEDED]">{event.actor?.name || "Unauthenticated"}</span>
                        {event.department && <span className="mt-1 block text-[10px] text-[#8A8C92]">{event.department}</span>}
                      </td>
                      <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 text-[#64666B] dark:text-[#9A9CA2]">{event.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-xs text-[#717378] dark:text-[#8E9096] sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {visibleStart}–{visibleEnd} of {result.total} events</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); setLoading(true); }} className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E0] px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2C2E32]">
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => { setPage((current) => current + 1); setLoading(true); }} className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E0] px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2C2E32]">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
