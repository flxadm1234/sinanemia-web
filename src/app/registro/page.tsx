"use client";

import { useActionState, useMemo, useState } from "react";
import { registerInvitadoAction } from "./actions";

type RegisterState = { ok: false; error: string } | null;

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerInvitadoAction as any,
    null,
  );
  const errorText = useMemo(() => state?.error ?? "", [state?.error]);

  return (
    <div className="flex flex-1 min-h-[100dvh] bg-zinc-50 items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.25)] ring-1 ring-black/5 p-7 text-zinc-900">
          <div className="text-xl font-semibold">Crear cuenta invitado</div>
          <div className="mt-1 text-sm text-zinc-600">
            Acceso limitado: Dashboard, Meses y Carga.
          </div>

          {errorText ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorText}
            </div>
          ) : null}

          <form action={action} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-900">DNI</label>
              <input
                name="dni"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">Nombre completo</label>
              <input
                name="nombrecompleto"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
              <input
                name="ubigeo"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                maxLength={6}
              />
              <div className="mt-1 text-xs text-zinc-500">
                Código de 6 dígitos (ej. 160101).
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">Clave</label>
              <div className="mt-1 relative">
                <input
                  name="clave"
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-20 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                  maxLength={15}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-2 rounded-lg px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 disabled:hover:bg-blue-700"
            >
              {pending ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        </div>

        <a
          href="/login"
          className="mt-4 block text-center text-xs text-zinc-600 hover:text-zinc-900"
        >
          Volver a iniciar sesión
        </a>
      </div>
    </div>
  );
}

