import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ChevronDown,
  AlertTriangle,
  User,
  LogOut,
  Sliders,
} from "lucide-react";
import { useTheme } from "../../context/useTheme";
import { useAuth } from "../../context/useAuth";
import { getDashboard, getTools } from "../../api/client";

const routeTitles = {
  "/": "Governance Overview",
  "/tools": "AI Tool Registry",
  "/policy-matrix": "Corporate Policy Matrix",
  "/risk-assessments": "Risk & Compliance Assessments",
  "/audit-log": "Audit & Compliance Log",
  "/employee-checker": "Employee Self-Check Tool",
  "/settings": "Governance Settings",
};

export const Topbar = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [alertSnapshot, setAlertSnapshot] = useState(null);
  const [alertErrorSnapshot, setAlertErrorSnapshot] = useState(null);
  const [alertsReloadVersion, setAlertsReloadVersion] = useState(0);

  const notifRef = useRef(null);
  const userRef = useRef(null);
  const searchRef = useRef(null);

  const currentTitle = routeTitles[location.pathname] || "Dashboard";
  const initials = user?.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const canSearchRegistry = ["Admin", "Compliance", "Requester", "Auditor"].includes(user?.role);
  const canViewAlerts = ["Admin", "Compliance", "Auditor"].includes(user?.role);
  const alertData = alertSnapshot?.role === user?.role ? alertSnapshot.data : null;
  const alertError = alertErrorSnapshot?.role === user?.role ? alertErrorSnapshot.message : "";

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !canSearchRegistry) return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      getTools({ search: query, page: 1, limit: 5 }, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) {
            setSearchResults(result.data);
            setSearchError("");
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setSearchError(error.message || "Tool search is unavailable.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, canSearchRegistry]);

  useEffect(() => {
    if (!canViewAlerts) return undefined;

    const controller = new AbortController();
    getDashboard({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setAlertSnapshot({ role: user.role, data });
          setAlertErrorSnapshot(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAlertErrorSnapshot({ role: user.role, message: error.message || "Governance alerts are unavailable." });
        }
      });
    return () => controller.abort();
  }, [user?.role, canViewAlerts, alertsReloadVersion]);

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await logout();
    } catch (error) {
      setLogoutError(error.message || "Unable to sign out. Please try again.");
    }
  };

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchQuery(value);
    setSearchResults([]);
    setSearchError("");
    setSearchLoading(Boolean(value.trim()));
    setShowSearchResults(Boolean(value.trim()));
  }

  function submitSearch(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/tools?search=${encodeURIComponent(query)}`);
    setShowSearchResults(false);
  }

  function openSearchResult() {
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/tools?search=${encodeURIComponent(query)}`);
    setShowSearchResults(false);
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#FBFBFA]/90 dark:bg-[#111213]/90 backdrop-blur-md border-b border-[#E8E8E4] dark:border-[#242629] px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-2 rounded-lg text-[#555] dark:text-[#AAA] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base md:text-lg font-semibold text-[#18191B] dark:text-[#EDEDED] tracking-tight truncate">
            {currentTitle}
          </h1>
          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-[#1B4D3E] dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live Guardrails
          </span>
        </div>
      </div>

      {/* Right: Search, Notifications, Theme Toggle, User Menu */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search Input */}
        {canSearchRegistry && (
          <div className="relative hidden w-48 sm:block md:w-64" ref={searchRef}>
            <form onSubmit={submitSearch}>
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8C92]" />
              <input
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setShowSearchResults(Boolean(searchQuery.trim()))}
                placeholder="Search tools..."
                aria-label="Search tool registry"
                aria-expanded={showSearchResults && Boolean(searchQuery.trim())}
                className="w-full rounded-lg border border-[#E4E4E0] bg-neutral-100/80 py-1.5 pl-9 pr-8 text-xs text-[#18191B] placeholder-[#8A8C92] transition-all focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:border-[#2C2E31] dark:bg-neutral-800/80 dark:text-[#EDEDED] dark:focus:ring-emerald-500"
              />
              <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded bg-neutral-200/50 px-1.5 py-0.5 font-mono text-[10px] text-[#8A8C92] dark:bg-neutral-700/50 md:inline-flex">
                Enter
              </kbd>
            </form>
            {showSearchResults && searchQuery.trim() && (
              <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E4E4E0] bg-white shadow-xl dark:border-[#2A2C30] dark:bg-[#18191B]">
                <div className="border-b border-[#EAEAE6] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#8A8C92] dark:border-[#26282B]">
                  Registry results
                </div>
                {searchLoading ? (
                  <p role="status" className="px-3 py-4 text-xs text-[#717378] dark:text-[#8E9096]">Searching tools…</p>
                ) : searchError ? (
                  <p role="alert" className="px-3 py-4 text-xs text-rose-700 dark:text-rose-400">{searchError}</p>
                ) : searchResults.length > 0 ? (
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {searchResults.map((tool) => (
                      <li key={tool._id}>
                        <button type="button" onClick={openSearchResult} className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
                          <span className="block truncate text-xs font-medium text-[#18191B] dark:text-[#EDEDED]">{tool.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#717378] dark:text-[#8E9096]">{tool.vendor} · {tool.approvalStatus}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-4 text-xs text-[#717378] dark:text-[#8E9096]">No matching tools.</p>
                )}
                <button type="button" onClick={submitSearch} className="w-full border-t border-[#EAEAE6] px-3 py-2 text-left text-[11px] font-medium text-[#1B4D3E] hover:bg-neutral-50 dark:border-[#26282B] dark:text-emerald-400 dark:hover:bg-neutral-900/60">
                  View registry results
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative p-2 rounded-lg text-[#64666B] dark:text-[#9A9CA2] hover:text-[#18191B] dark:hover:text-[#EDEDED] hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {alertData?.toolsNeedingReview.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#1B4D3E] dark:bg-emerald-500" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#18191B] border border-[#E4E4E0] dark:border-[#2A2C30] shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAEAE6] dark:border-[#26282B]">
                <span className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED]">
                  Governance Alerts
                </span>
                {alertData && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                    {alertData.toolsNeedingReview.length} need attention
                  </span>
                )}
              </div>
              {alertError ? (
                <div role="alert" className="space-y-2 text-xs text-rose-700 dark:text-rose-400">
                  <p>{alertError}</p>
                  <button type="button" onClick={() => setAlertsReloadVersion((version) => version + 1)} className="font-semibold underline">Retry</button>
                </div>
              ) : !canViewAlerts ? (
                <p className="py-3 text-xs text-[#717378] dark:text-[#8E9096]">Review alerts are available to governance roles.</p>
              ) : !alertData ? (
                <p role="status" className="py-3 text-xs text-[#717378] dark:text-[#8E9096]">Loading review queue…</p>
              ) : alertData.toolsNeedingReview.length === 0 ? (
                <p className="py-3 text-xs text-[#717378] dark:text-[#8E9096]">No tools or requests currently need attention.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto">
                  {alertData.toolsNeedingReview.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/tools?search=${encodeURIComponent(item.name)}`);
                          setShowNotifications(false);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-neutral-200/60 bg-neutral-50 p-2 text-left hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:bg-neutral-900"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-[#222] dark:text-[#E0E0E0]">{item.name}</span>
                          <span className="mt-0.5 block text-[11px] text-[#717378] dark:text-[#8E9096]">
                            {item.approvalStatus}{item.riskLevel ? ` · ${item.riskLevel} risk` : ""}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-[#8A8C92]">
                            {new Date(item.submittedAt).toLocaleString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[#64666B] dark:text-[#9A9CA2] hover:text-[#18191B] dark:hover:text-[#EDEDED] hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors"
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[#555]" />
          )}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-[#1B4D3E] dark:bg-emerald-600 text-white font-medium text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="hidden lg:block">
              <div className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED] leading-none">
                {user?.name}
              </div>
              <div className="text-[10px] text-[#717378] dark:text-[#8E9096] leading-tight mt-0.5">
                {user?.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#888] hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#18191B] border border-[#E4E4E0] dark:border-[#2A2C30] shadow-xl p-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-[#EAEAE6] dark:border-[#26282B] mb-1">
                <p className="font-semibold text-[#18191B] dark:text-[#EDEDED]">
                  {user?.name}
                </p>
                <p className="text-[11px] text-[#717378] dark:text-[#8E9096] truncate">
                  {user?.email}
                </p>
                <div className="mt-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  {user?.role}
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#555] dark:text-[#AAA] hover:text-[#111] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profile & Permissions</span>
                </button>
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#555] dark:text-[#AAA] hover:text-[#111] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Policy Preferences</span>
                </button>
                <div className="my-1 border-t border-[#EAEAE6] dark:border-[#26282B]" />
                <button
                  onClick={() => void handleLogout()}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
                {logoutError && <p role="alert" className="px-2.5 py-1.5 text-[11px] text-rose-600 dark:text-rose-400">{logoutError}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
