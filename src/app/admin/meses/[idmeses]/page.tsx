import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MesForm } from "@/components/MesForm";
import { findMesById } from "@/lib/meses";
import { updateMesAction } from "../actions";

export default async function AdminMesEditPage(props: {
  params: Promise<{ idmeses: string }>;
}) {
  const user = await requireAdmin();
  const ubigeo = user.ubigeo ?? null;
  if (!ubigeo) notFound();

  const { idmeses } = await props.params;
  const id = Number(idmeses);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const row = await findMesById({ ubigeo, idmeses: id });
  if (!row) notFound();

  return (
    <AppShell user={user} title="Editar mes">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Editar mes
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Ubigeo {ubigeo} · ID {row.idmeses}
            </div>
          </div>
          <Link
            href="/admin/meses"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <MesForm
            action={updateMesAction}
            initial={{
              idmeses: row.idmeses,
              numero_mes: row.numero_mes,
              meses: row.meses,
              year: row.year,
              seleccion: row.seleccion,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}

