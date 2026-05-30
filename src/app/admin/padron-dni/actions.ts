"use server";

import { requireSession } from "@/lib/auth";
import { deletePadronDniJob, ensurePadronDniTables } from "@/lib/padronDniImport";
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
    await deletePadronDniJob(jobId);
    redirect("/admin/padron-dni?ok=1");
  } catch {
    redirect("/admin/padron-dni?err=1");
  }
}

