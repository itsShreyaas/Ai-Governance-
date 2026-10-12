import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  User,
  LogOut,
  Sliders,
} from "lucide-react";
import { useTheme } from "../../context/useTheme";

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
  const { theme, toggleTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef(null);
  const userRef = useRef(null);

  const currentTitle = routeTitles[location.pathname] || "Dashboard";

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        <div className="relative hidden sm:block w-48 md:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8C92]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools, policies..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-100/80 dark:bg-neutral-800/80 border border-[#E4E4E0] dark:border-[#2C2E31] rounded-lg text-[#18191B] dark:text-[#EDEDED] placeholder-[#8A8C92] focus:outline-hidden focus:ring-1 focus:ring-[#1B4D3E] dark:focus:ring-emerald-500 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#8A8C92] bg-neutral-200/50 dark:bg-neutral-700/50 rounded">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative p-2 rounded-lg text-[#64666B] dark:text-[#9A9CA2] hover:text-[#18191B] dark:hover:text-[#EDEDED] hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1B4D3E] dark:bg-emerald-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#18191B] border border-[#E4E4E0] dark:border-[#2A2C30] shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAEAE6] dark:border-[#26282B]">
                <span className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED]">
                  Governance Alerts
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  2 Pending Review
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[#222] dark:text-[#E0E0E0]">
                      Midjourney v6 restricted
                    </p>
                    <p className="text-[11px] text-[#717378] dark:text-[#8E9096]">
                      High risk flagged by InfoSec sentinel 4 hours ago.
                    </p>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[#222] dark:text-[#E0E0E0]">
                      Perplexity Enterprise approved
                    </p>
                    <p className="text-[11px] text-[#717378] dark:text-[#8E9096]">
                      Compliance cleared annual vendor review.
                    </p>
                  </div>
                </div>
              </div>
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
              AV
            </div>
            <div className="hidden lg:block">
              <div className="text-xs font-semibold text-[#18191B] dark:text-[#EDEDED] leading-none">
                Alex Vance
              </div>
              <div className="text-[10px] text-[#717378] dark:text-[#8E9096] leading-tight mt-0.5">
                Compliance Officer
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#888] hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#18191B] border border-[#E4E4E0] dark:border-[#2A2C30] shadow-xl p-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-[#EAEAE6] dark:border-[#26282B] mb-1">
                <p className="font-semibold text-[#18191B] dark:text-[#EDEDED]">
                  Alex Vance
                </p>
                <p className="text-[11px] text-[#717378] dark:text-[#8E9096] truncate">
                  alex.v@acmecorp.com
                </p>
                <div className="mt-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  Global Policy Admin
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
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
