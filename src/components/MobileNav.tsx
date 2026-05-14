"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type NavLink = { href: string; label: string };

function buildLinks(user: SessionUser): NavLink[] {
  const links: NavLink[] = [];
  if (user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN") {
    links.push({ href: "/admin/personas", label: "Usuarios" });
  }
  if (user.tipo === "ADMINISTRADOR" || user.tipo === "COORDINADOR") {
    links.push({ href: "/asignacion", label: "Asignación" });
  }
  if (user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN") {
    links.push({ href: "/admin/padronnominal", label: "Padrón nominal" });
  }
  if (user.tipo === "COORDINADOR") {
    links.push({ href: "/coordinador/actores", label: "Actores sociales" });
  }
  if (user.tipo === "ACTOR SOCIAL") {
    links.push({ href: "/actor", label: "Inicio" });
  }
  return links;
}

export function MobileNav(props: { user: SessionUser }) {
  const { user } = props;
  const [open, setOpen] = useState(false);
  const links = useMemo(() => buildLinks(user), [user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 hover:bg-zinc-50 md:hidden"
        aria-label="Abrir menú"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6H20M4 12H20M4 18H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 px-5 py-5 border-b border-zinc-200">
              <div>
                <div className="text-lg font-semibold text-zinc-900">
                  SinAnemia
                </div>
                <div className="mt-1 text-xs text-zinc-500">Compromiso 1</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="px-3 py-4">
              <div className="px-3 pb-3">
                <div className="text-sm font-semibold text-zinc-900">
                  {user.nombre}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{user.tipo}</div>
              </div>

              <nav className="space-y-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-5 px-3">
                <Link
                  href="/logout"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Salir
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

