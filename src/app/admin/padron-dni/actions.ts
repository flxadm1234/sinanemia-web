"use server";

import { requireSession } from "@/lib/auth";
import { deletePadronDniJob, ensurePadronDniTables, getPadronDniJob } from "@/lib/padronDniImport";
import { redirect } from "next/navigation";

export async function deletePadronDniJobAction(formData: FormData) {
  const user = await requireSession();
  if (user.tipo === "COORDINADOR" || user.tipo === "ACTOR SOCIAL") {
    redirect("/dashboard");
  }

  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) redirect("/admin/padron-dni?err=1");

  await ensurePadronDniTables();
  try {
    const job = await getPadronDniJob(jobId);
    if (!job) redirect("/admin/padron-dni?err=1");
    if (user.tipo !== "SUPER ADMIN") {
      const su = typeof user.ubigeo === "number" && Number.isFinite(user.ubigeo) ? user.ubigeo : null;
      const ju = typeof job.ubigeo === "number" && Number.isFinite(job.ubigeo) ? job.ubigeo : null;
      if (!su || !ju || su !== ju) redirect("/admin/padron-dni?err=1");
    }
    await deletePadronDniJob(jobId);
    redirect("/admin/padron-dni?ok=1");
  } catch {
    redirect("/admin/padron-dni?err=1");
  }
}
