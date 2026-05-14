"use client";

import { useActionState } from "react";
import { useMemo, useState } from "react";
import { loginAction } from "./actions";

type LoginState = { ok: false; error: string } | null;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction as any,
    null,
  );
  const errorText = useMemo(() => state?.error ?? "", [state?.error]);

  return (
    <div className="flex flex-1 min-h-[100dvh] bg-zinc-50">
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-gradient-to-br from-sky-950 via-blue-900 to-indigo-950 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Compromiso 1
          </div>
        </div>

        <div className="relative">
          <div className="text-5xl font-semibold tracking-tight">SinAnemia</div>
          <div className="mt-4 text-white/80 text-lg leading-relaxed max-w-md">
            Monitoreo de visitas domiciliarias, control de registros y
            seguimiento de condiciones.
          </div>
        </div>

        <div className="relative text-xs text-white/60">
          Acceso por DNI y clave asignada
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.25)] ring-1 ring-black/5 p-7 text-zinc-900">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C7.6 2 4 5.6 4 10c0 3 1.7 5.6 4.2 6.9.3.2.5.5.6.9l.4 2.2h5.6l.4-2.2c.1-.4.3-.7.6-.9C18.3 15.6 20 13 20 10c0-4.4-3.6-8-8-8Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 10.5h4M10.5 8.5h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xl font-semibold">Iniciar sesión</div>
                <div className="mt-0.5 text-sm text-zinc-600">
                  Ingresa tus credenciales para continuar
                </div>
              </div>
            </div>

            {errorText ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorText}
              </div>
            ) : null}

            <form action={action} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  DNI
                </label>
                <div className="mt-1 relative">
                  <input
                    name="dni"
                    inputMode="numeric"
                    autoComplete="username"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-11 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Ej: 72701644"
                    required
                    maxLength={15}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Clave
                </label>
                <div className="mt-1 relative">
                  <input
                    name="clave"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-20 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Tu clave"
                    required
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
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 disabled:hover:bg-blue-700"
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

