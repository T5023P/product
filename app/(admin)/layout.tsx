"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "../../lib/firebase";

function AdminLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState(searchParams.get("q") ?? "");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSidebarSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const targetPath = pathname === "/categories" ? "/categories" : "/";
    const params = new URLSearchParams(searchParams.toString());
    const nextValue = sidebarSearch.trim();

    if (nextValue) {
      params.set("q", nextValue);
    } else {
      params.delete("q");
    }

    const nextQuery = params.toString();
    const nextHref = nextQuery ? `${targetPath}?${nextQuery}` : targetPath;
    const currentQuery = searchParams.toString();
    const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (pathname !== targetPath || currentHref !== nextHref) {
      const timeout = window.setTimeout(() => {
        router.replace(nextHref);
      }, 150);
      return () => window.clearTimeout(timeout);
    }
  }, [pathname, router, searchParams, sidebarSearch, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to log in.";
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const sidebarSearchPlaceholder =
    pathname === "/categories" ? "Search categories..." : "Search products...";

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background-app flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not signed in: show login form
  if (!user) {
    return (
      <main className="min-h-screen bg-background-app flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="font-display font-bold text-3xl tracking-tight text-primary">
              Creator Studio
            </h1>
            <p className="text-sm text-secondary-app mt-2">
              Sign in to manage your product catalog
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface"
                placeholder="e.g. father@catalog.com"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation text-base cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Signed in: render chrome + children
  return (
    <div className="min-h-screen bg-background-app text-on-background flex flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col bg-white border-r border-outline-variant w-64 fixed left-0 top-0 h-full p-8 z-30">
        <div className="mb-8">
          <Link
            href="/"
            className="font-display text-2xl font-bold text-primary tracking-tight block hover:opacity-80 transition-opacity"
          >
            Creator Studio
          </Link>
          <p className="text-xs text-secondary-app mt-1">Verified Admin</p>
        </div>
        <div className="relative mb-6">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary-app text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder={sidebarSearchPlaceholder}
            className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-full w-full"
          />
        </div>
        <nav className="flex-1 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 text-primary hover:bg-surface-container-low rounded-lg px-4 py-3 font-semibold transition-colors text-sm"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              grid_view
            </span>
            <span>My Products</span>
          </Link>
          <Link
            href="/new"
            className="flex items-center gap-3 text-secondary-app hover:text-primary hover:bg-surface-container-low rounded-lg px-4 py-3 font-medium transition-colors text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">
              add_circle
            </span>
            <span>New Product</span>
          </Link>
          <Link
            href="/categories"
            className="flex items-center gap-3 text-secondary-app hover:text-primary hover:bg-surface-container-low rounded-lg px-4 py-3 font-medium transition-colors text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">
              category
            </span>
            <span>Categories</span>
          </Link>
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-secondary-app hover:text-red-600 px-4 py-3 rounded-lg transition-colors text-sm w-full text-left mt-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top header (mobile) */}
        <header className="md:hidden bg-white border-b border-outline-variant flex justify-between items-center h-16 px-6 sticky top-0 z-40">
          <Link
            href="/"
            className="font-display font-bold text-xl tracking-tight text-primary"
          >
            Creator Studio
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 text-secondary-app hover:text-red-600 rounded-full cursor-pointer"
            title="Sign Out"
            aria-label="Sign out"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
          </button>
        </header>

        <nav className="md:hidden bg-white border-b border-outline-variant px-4 py-2 flex gap-2 overflow-x-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-primary bg-surface-container-low whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            <span>Products</span>
          </Link>
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-secondary-app bg-surface-container-low whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>New</span>
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-secondary-app bg-surface-container-low whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">category</span>
            <span>Categories</span>
          </Link>
        </nav>

        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background-app" />}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </Suspense>
  );
}
