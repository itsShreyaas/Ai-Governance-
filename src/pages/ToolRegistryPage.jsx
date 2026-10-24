import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { ApprovalStatus, CreateToolSchema, DataSensitivity, RiskLevel, UserRole } from "@aegisai/shared";
import { ApiError, createTool, getTools } from "../api/client";
import { useAuth } from "../context/useAuth";

const PAGE_SIZE = 12;
const emptyForm = {
  name: "",
  vendor: "",
  category: "",
  description: "",
  ownerDepartment: "",
  dataSensitivity: DataSensitivity.InternalOnly,
  userCount: "0",
  personalData: false,
};

function statusClasses(status) {
  if (status === ApprovalStatus.Approved) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
  if (status === ApprovalStatus.Restricted || status === ApprovalStatus.Revoked) {
    return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  }
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
}

function errorMessage(error, action = "load") {
  if (!(error instanceof ApiError)) return error.message || "Unable to complete the request.";
  if (error.status === 401) return "Your session has expired. Sign in again to continue.";
  if (error.status === 403) {
    return action === "register"
      ? "Your account does not have permission to register tools."
      : "Your account does not have permission to view the registry.";
  }
  if (error.status === 409) return "This tool conflicts with an existing record. Review the details and try again.";
  if (error.status === 422 || error.status === 400) {
    return "Some submitted fields were rejected. Check the form and try again.";
  }
  return error.message;
}

function FieldError({ id, errors }) {
  if (!errors[id]) return null;
  return <p id={`${id}-error`} className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{errors[id]}</p>;
}

export const ToolRegistryPage = () => {
  const { role } = useAuth();
  const canRegister = role === UserRole.Admin || role === UserRole.Compliance;
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [department, setDepartment] = useState("");
  const [result, setResult] = useState({ data: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    getTools({
      page,
      limit: PAGE_SIZE,
      search,
      approvalStatus: status,
      riskLevel: risk,
      ownerDepartment: department,
    }, { signal: controller.signal })
      .then((nextResult) => setResult(nextResult))
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search, status, risk, department, reloadVersion]);

  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const visibleStart = result.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const visibleEnd = Math.min(page * PAGE_SIZE, result.total);

  const filtersActive = useMemo(
    () => Boolean(search || status || risk || department),
    [search, status, risk, department]
  );

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
    setLoading(true);
  }

  function updateSearch(value) {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("search", value);
    else nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
    setPage(1);
    setLoading(true);
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError("");
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const candidate = {
      ...form,
      userCount: form.userCount === "" ? Number.NaN : Number(form.userCount),
    };
    const parsed = CreateToolSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && nextErrors[field] == null) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      setFormError("Please correct the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError("");
    try {
      await createTool(parsed.data);
      setRegisterOpen(false);
      setForm(emptyForm);
      setPage(1);
      setLoading(true);
      setReloadVersion((version) => version + 1);
    } catch (error) {
      setFormError(errorMessage(error, "register"));
    } finally {
      setSubmitting(false);
    }
  }

  function retryLoad() {
    setLoading(true);
    setReloadVersion((version) => version + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#E8E8E4] pb-4 dark:border-[#27282B] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#18191B] dark:text-[#EDEDED]">
              AI Tool Registry
            </h1>
            <span className="rounded-full border border-[#1B4D3E]/20 bg-[#1B4D3E]/10 px-2 py-0.5 text-[11px] font-medium text-[#1B4D3E] dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
              {result.total} Cataloged
            </span>
          </div>
          <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">
            Search and review registered AI applications across your organization.
          </p>
        </div>

        {canRegister && (
          <button
            type="button"
            onClick={() => {
              setRegisterOpen(true);
              setFormError("");
              setFieldErrors({});
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#1B4D3E] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#163F33] sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Tool
          </button>
        )}
      </div>

      <section className="rounded-xl border border-[#E8E8E4] bg-white p-4 shadow-2xs dark:border-[#27282B] dark:bg-[#18191B]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block">
            <span className="sr-only">Search tools</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8C92]" />
            <input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search name, vendor, description"
              className="w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 py-2 pl-9 pr-3 text-xs text-[#18191B] placeholder-[#8A8C92] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
            />
          </label>
          <label>
            <span className="sr-only">Filter by approval status</span>
            <select
              value={status}
              onChange={(event) => updateFilter(setStatus, event.target.value)}
              className="w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
            >
              <option value="">All statuses</option>
              {Object.values(ApprovalStatus).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by risk level</span>
            <select
              value={risk}
              onChange={(event) => updateFilter(setRisk, event.target.value)}
              className="w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
            >
              <option value="">All risk levels</option>
              {Object.values(RiskLevel).map((value) => <option key={value} value={value}>{value} risk</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by department</span>
            <input
              value={department}
              onChange={(event) => updateFilter(setDepartment, event.target.value)}
              placeholder="Department"
              className="w-full rounded-lg border border-[#E4E4E0] bg-neutral-50 px-3 py-2 text-xs text-[#18191B] placeholder-[#8A8C92] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
            />
          </label>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              updateSearch("");
              setStatus("");
              setRisk("");
              setDepartment("");
              setPage(1);
              setLoading(true);
            }}
            className="mt-3 text-[11px] font-medium text-[#1B4D3E] hover:underline dark:text-emerald-400"
          >
            Clear filters
          </button>
        )}
      </section>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Could not load the tool registry</p>
              <p className="mt-1 text-xs">{loadError}</p>
              <button type="button" onClick={retryLoad} className="mt-3 text-xs font-semibold underline">
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#717378] dark:text-[#8E9096]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading tools…
        </div>
      ) : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D8D8D3] bg-white px-6 py-12 text-center dark:border-[#34363A] dark:bg-[#18191B]">
          <p className="text-sm font-semibold text-[#18191B] dark:text-[#EDEDED]">
            {filtersActive ? "No tools match these filters" : "No tools registered yet"}
          </p>
          <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">
            {filtersActive ? "Try changing or clearing your search and filters." : "Register the first AI tool to start your inventory."}
          </p>
          {!filtersActive && canRegister && (
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="mt-4 rounded-lg bg-[#1B4D3E] px-3 py-2 text-xs font-medium text-white hover:bg-[#163F33]"
            >
              Register Tool
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.data.map((tool) => (
              <article
                key={tool._id}
                className="rounded-xl border border-[#E8E8E4] bg-white p-4 shadow-2xs transition-colors hover:border-[#D0D0CB] dark:border-[#27282B] dark:bg-[#18191B] dark:hover:border-[#383A3E]"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1B4D3E] text-xs font-bold text-white">
                      {tool.name?.charAt(0)?.toUpperCase() || "T"}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold text-[#18191B] dark:text-[#EDEDED]">{tool.name}</h2>
                      <p className="truncate text-[10px] text-[#717378] dark:text-[#8E9096]">{tool.vendor}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClasses(tool.approvalStatus)}`}>
                    {tool.approvalStatus}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-[#64666B] dark:text-[#9A9CA2]">
                  {tool.description || "No description provided."}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-[#F0F0ED] pt-3 text-[11px] text-[#8A8C92] dark:border-[#242629]">
                  <span>Risk: <strong className="text-[#444] dark:text-[#BBB]">{tool.riskLevel}</strong></span>
                  <span>{tool.userCount} users</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTool(tool)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1B4D3E] hover:underline dark:text-emerald-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View details
                </button>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-3 text-xs text-[#717378] dark:text-[#8E9096] sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {visibleStart}–{visibleEnd} of {result.total} tools</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => { setPage((current) => current - 1); setLoading(true); }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E0] px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2C2E32]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span>Page {page} of {pageCount}</span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => { setPage((current) => current + 1); setLoading(true); }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E0] px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2C2E32]"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-tool-title"
            className="my-8 max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E8E8E4] bg-white p-5 shadow-xl dark:border-[#2C2E32] dark:bg-[#18191B] sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="register-tool-title" className="text-base font-semibold text-[#18191B] dark:text-[#EDEDED]">Register an AI tool</h2>
                <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">Approval status, risk level, and compliance score are assigned by governance workflows.</p>
              </div>
              <button type="button" onClick={() => setRegisterOpen(false)} aria-label="Close registration form" className="rounded-lg p-1 text-[#717378] hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitRegistration} noValidate className="space-y-4">
              {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{formError}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ["name", "Tool name"],
                  ["vendor", "Vendor"],
                  ["category", "Category"],
                  ["ownerDepartment", "Owner department"],
                ].map(([field, label]) => (
                  <label key={field} className="block text-xs font-medium text-[#444] dark:text-[#BBB]">
                    {label}
                    <input
                      name={field}
                      value={form[field]}
                      onChange={updateForm}
                      aria-invalid={Boolean(fieldErrors[field])}
                      aria-describedby={fieldErrors[field] ? `${field}-error` : undefined}
                      className="mt-1.5 w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
                    />
                    <FieldError id={field} errors={fieldErrors} />
                  </label>
                ))}
                <label className="block text-xs font-medium text-[#444] dark:text-[#BBB]">
                  Data sensitivity
                  <select
                    name="dataSensitivity"
                    value={form.dataSensitivity}
                    onChange={updateForm}
                    aria-invalid={Boolean(fieldErrors.dataSensitivity)}
                    aria-describedby={fieldErrors.dataSensitivity ? "dataSensitivity-error" : undefined}
                    className="mt-1.5 w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
                  >
                    {Object.values(DataSensitivity).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <FieldError id="dataSensitivity" errors={fieldErrors} />
                </label>
                <label className="block text-xs font-medium text-[#444] dark:text-[#BBB]">
                  User count
                  <input
                    type="number"
                    name="userCount"
                    min="0"
                    step="1"
                    value={form.userCount}
                    onChange={updateForm}
                    aria-invalid={Boolean(fieldErrors.userCount)}
                    aria-describedby={fieldErrors.userCount ? "userCount-error" : undefined}
                    className="mt-1.5 w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
                  />
                  <FieldError id="userCount" errors={fieldErrors} />
                </label>
                <label className="block text-xs font-medium text-[#444] dark:text-[#BBB] sm:col-span-2">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateForm}
                    rows={3}
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={fieldErrors.description ? "description-error" : undefined}
                    className="mt-1.5 w-full resize-y rounded-lg border border-[#E4E4E0] bg-white px-3 py-2 text-xs text-[#18191B] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E32] dark:bg-neutral-900 dark:text-[#EDEDED]"
                  />
                  <FieldError id="description" errors={fieldErrors} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#444] dark:text-[#BBB]">
                <input type="checkbox" name="personalData" checked={form.personalData} onChange={updateForm} />
                This tool processes personal data
              </label>

              <div className="flex justify-end gap-2 border-t border-[#E8E8E4] pt-4 dark:border-[#27282B]">
                <button type="button" onClick={() => setRegisterOpen(false)} className="rounded-lg border border-[#E4E4E0] px-3 py-2 text-xs font-medium text-[#444] dark:border-[#2C2E32] dark:text-[#BBB]">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#1B4D3E] px-3 py-2 text-xs font-medium text-white hover:bg-[#163F33] disabled:cursor-wait disabled:opacity-60">
                  {submitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Submit tool
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedTool(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="tool-detail-title" className="w-full max-w-lg rounded-2xl border border-[#E8E8E4] bg-white p-5 shadow-xl dark:border-[#2C2E32] dark:bg-[#18191B]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="tool-detail-title" className="text-base font-semibold text-[#18191B] dark:text-[#EDEDED]">{selectedTool.name}</h2>
                <p className="mt-1 text-xs text-[#717378] dark:text-[#8E9096]">{selectedTool.vendor}</p>
              </div>
              <button type="button" onClick={() => setSelectedTool(null)} aria-label="Close tool details" className="rounded-lg p-1 text-[#717378] hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-xs">
              {[
                ["Category", selectedTool.category],
                ["Department", selectedTool.ownerDepartment],
                ["Approval status", selectedTool.approvalStatus],
                ["Risk level", selectedTool.riskLevel],
                ["Data sensitivity", selectedTool.dataSensitivity],
                ["Users", selectedTool.userCount],
                ["Compliance score", selectedTool.complianceScore ?? "Not assessed"],
                ["Last reviewed", selectedTool.lastReviewed ? new Date(selectedTool.lastReviewed).toLocaleDateString() : "Not reviewed"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[#8A8C92]">{label}</dt>
                  <dd className="mt-1 font-medium text-[#18191B] dark:text-[#EDEDED]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-[#E8E8E4] pt-4 text-xs dark:border-[#27282B]">
              <p className="font-medium text-[#717378] dark:text-[#8E9096]">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-[#18191B] dark:text-[#EDEDED]">{selectedTool.description || "No description provided."}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
