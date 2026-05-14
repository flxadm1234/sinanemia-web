"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

type LoginState = { ok: false; error: string } | null;

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction as any,
    null,
  );

  return (
    <div className="flex flex-1 items-stretch">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-sky-900 via-blue-800 to-indigo-900 text-white p-12">
        <div className="text-sm font-medium tracking-wide uppercase">
          Compromiso 1
        </div>
        <div>
          <div className="text-4xl font-semibold leading-tight">SinAnemia</div>
          <div className="mt-3 text-white/80 text-lg leading-relaxed max-w-md">
            Monitoreo de visitas domiciliarias y control de registros.
          </div>
        </div>
        <div className="text-xs text-white/60">
          Acceso por DNI y clave asignada
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-7">
            <div className="text-xl font-semibold">Iniciar sesión</div>
            <div className="mt-1 text-sm text-zinc-600">
              Ingresa tus credenciales para continuar
            </div>

            {state?.error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}

            <form action={action} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  DNI
                </label>
                <input
                  name="dni"
                  inputMode="numeric"
                  autoComplete="username"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Ej: 72701644"
                  required
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Clave
                </label>
                <input
                  name="clave"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Tu clave"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
              >
                {pending ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>

          <div className="mt-4 text-center text-xs text-zinc-500">
            Si no recuerdas tu clave, solicita soporte al administrador.
          </div>
        </div>
      </div>
    </div>
  );
}

