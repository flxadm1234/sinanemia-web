import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import {
  ensureMetasC1DefaultsForUbigeo,
  listMetasC1ByUbigeo,
  type MetaC1Tipo,
} from "@/lib/metasC1";
import { MetasC1FormClient } from "@/components/MetasC1FormClient";
import { saveMetasC1Action } from "./actions";

export default async function MetasPage(props: { searchParams: Promise<{ ubigeo?: string }> }) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const ubigeo =
    user.tipo === "SUPER ADMIN" ? String(sp.ubigeo ?? "").trim() : String(user.ubigeo ?? "");

  if (!ubigeo) {
    return (
      <AppShell user={user} title="Metas">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu usuario no tiene ubigeo configurado.
        </div>
      </AppShell>
    );
  }

  await ensureMetasC1DefaultsForUbigeo(ubigeo);
  const rows = await listMetasC1ByUbigeo(ubigeo);

  const map = new Map<number, any>();
  for (const r of rows as any[]) map.set(Number(r.tipo), r);

  const tipos = [1, 2, 3, 4, 5] as MetaC1Tipo[];
  const items = tipos.map((t) => ({
    tipo: t,
    descripcion_meta: String(map.get(t)?.descripcion_meta ?? ""),
    valla_min: Number(map.get(t)?.valla_min ?? 60),
  }));

  return (
    <AppShell user={user} title="Metas">
      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="text-lg font-semibold text-zinc-900">Metas (Condiciones previas)</div>
        <div className="mt-1 text-sm text-zinc-600">
          Ubigeo: <span className="font-semibold">{ubigeo}</span>
        </div>
        <MetasC1FormClient
          userTipo={user.tipo}
          ubigeo={ubigeo}
          items={items}
          action={saveMetasC1Action}
        />
      </div>
    </AppShell>
  );
}

