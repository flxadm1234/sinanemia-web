"use client";

import { useMemo, useState } from "react";
import { CoordinatorCombobox } from "@/components/CoordinatorCombobox";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  role: "SUPER ADMIN" | "ADMINISTRADOR" | "COORDINADOR" | "ACTOR SOCIAL";
  ubigeo: number | null;
  cdrDefault?: string;
};

export function PersonaCreateForm(props: Props) {
  const { action, role, ubigeo, cdrDefault } = props;
  const [dni, setDni] = useState("");
  const [loadingReniec, setLoadingReniec] = useState(false);
  const [reniecError, setReniecError] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [tipo, setTipo] = useState("ACTOR SOCIAL");
  const [ubigeoValue, setUbigeoValue] = useState(ubigeo ? String(ubigeo) : "");

  const allowedTipos = useMemo(() => {
    if (role === "SUPER ADMIN")
      return [
        "ACTOR SOCIAL",
        "COORDINADOR",
        "ADMINISTRADOR",
        "INVITADO",
        "SUPERVISOR",
        "SUPER ADMIN",
      ];
    if (role === "ADMINISTRADOR")
      return ["ACTOR SOCIAL", "COORDINADOR", "ADMINISTRADOR"];
    return ["ACTOR SOCIAL"];
  }, [role]);

  async function buscarReniec() {
    const v = dni.trim();
    if (!/^\d{8}$/.test(v)) {
      setReniecError("Ingresa un DNI válido de 8 dígitos.");
      return;
    }
    setReniecError("");
    setLoadingReniec(true);
    try {
      const res = await fetch(`/api/reniec/${v}`, { cache: "no-store" });
      if (!res.ok) {
        setReniecError("DNI no encontrado en RENIEC o servicio no disponible.");
        return;
      }
      const data = await res.json();
      setNombres(String(data?.nombres ?? ""));
      const ap =
        `${String(data?.apellidoPaterno ?? "")} ${String(
          data?.apellidoMaterno ?? "",
        )}`.trim();
      setApellidos(ap);
      setDireccion(String(data?.direccion ?? ""));
    } catch {
      setReniecError("No se pudo consultar RENIEC. Intenta nuevamente.");
    } finally {
      setLoadingReniec(false);
    }
  }

  const showUbigeoInput = role === "SUPER ADMIN";
  const showCdrSelect = role === "ADMINISTRADOR" || role === "SUPER ADMIN";
  const cdrFixed = role === "COORDINADOR" ? cdrDefault ?? "" : "";

  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-zinc-900">DNI</label>
        <div className="mt-1 flex gap-2">
          <input
            name="dni"
            required
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={buscarReniec}
            disabled={loadingReniec}
            className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            {loadingReniec ? "Buscando..." : "RENIEC"}
          </button>
        </div>
        {reniecError ? (
          <div className="mt-2 text-xs text-red-700">{reniecError}</div>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Tipo</label>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          disabled={role === "COORDINADOR"}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
        >
          {allowedTipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">
          Nombres
        </label>
        <input
          name="nombrecompleto"
          value={nombres}
          onChange={(e) => setNombres(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">
          Apellidos
        </label>
        <input
          name="apellidos"
          required
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Clave</label>
        <input
          name="clave"
          type="password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
        {showUbigeoInput ? (
          <input
            name="ubigeo"
            inputMode="numeric"
            value={ubigeoValue}
            onChange={(e) => setUbigeoValue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <>
            <input type="hidden" name="ubigeo" value={ubigeo ? String(ubigeo) : ""} />
            <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
              {ubigeo ?? "-"}
            </div>
          </>
        )}
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-zinc-900">
          Coordinador (CDR)
        </label>
        {showCdrSelect ? (
          <div className="mt-1">
            <CoordinatorCombobox
              name="cdr"
              ubigeo={role === "ADMINISTRADOR" ? ubigeo : ubigeoValue ? Number(ubigeoValue) : null}
            />
          </div>
        ) : (
          <>
            <input type="hidden" name="cdr" value={cdrFixed} />
            <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
              {cdrFixed || "-"}
            </div>
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">
          Teléfono
        </label>
        <input
          name="telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Email</label>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-zinc-900">
          Dirección
        </label>
        <input
          name="direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2">
        <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          Crear
        </button>
      </div>
    </form>
  );
}

