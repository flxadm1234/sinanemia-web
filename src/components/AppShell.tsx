import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";

export function AppShell(props: {
  user: SessionUser;
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const { user, title, children, fullWidth } = props;
  const container = fullWidth === false ? "max-w-6xl" : "max-w-none";

  return (
    <div className="flex min-h-full flex-1 bg-zinc-50">
      <div className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-zinc-200 md:bg-white">
        <div className="px-5 py-5">
          <div className="text-lg font-semibold text-zinc-900">SinAnemia</div>
          <div className="mt-1 text-xs text-zinc-500">Compromiso 1</div>
        </div>
        <nav className="px-3 pb-5 space-y-1">
          {user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN" ? (
            <Link
              href="/admin/personas"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Usuarios
            </Link>
          ) : null}
          {user.tipo === "ADMINISTRADOR" ? (
            <Link
              href="/admin/meses"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Meses
            </Link>
          ) : null}
          {user.tipo === "ADMINISTRADOR" || user.tipo === "COORDINADOR" ? (
            <Link
              href="/asignacion"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Asignación
            </Link>
          ) : null}
          {user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN" ? (
            <Link
              href="/admin/padronnominal"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Padrón nominal
            </Link>
          ) : null}
          {user.tipo === "COORDINADOR" ? (
            <Link
              href="/coordinador/actores"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Actores sociales
            </Link>
          ) : null}
          {user.tipo === "ACTOR SOCIAL" ? (
            <Link
              href="/actor"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Inicio
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className={`mx-auto w-full ${container} px-5 py-4 flex items-center justify-between gap-4`}>
            <div>
              <div className="flex items-center gap-3">
                <MobileNav user={user} />
                <div className="text-sm font-semibold text-zinc-900">{title}</div>
              </div>
              <div className="text-xs text-zinc-500">
                {user.nombre}
                {typeof user.ubigeo === "number" ? ` (${user.ubigeo})` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/logout"
                className="hidden md:inline-flex rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Salir
              </Link>
            </div>
          </div>
        </header>

        <main className={`mx-auto w-full ${container} flex-1 px-5 py-6`}>
          {children}
        </main>
      </div>
    </div>
  );
}

