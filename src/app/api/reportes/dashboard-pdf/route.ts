import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSession } from "@/lib/auth";
import { getFichaTecnicaText } from "@/lib/fichaTecnica";
import { generateExecutiveNarrative } from "@/lib/gemini";

export const runtime = "nodejs";

function safeText(v: unknown, fallback = "") {
  const s = String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!s) return fallback;
  return s.length > 800 ? `${s.slice(0, 797)}...` : s;
}

function dataUrlToBuffer(dataUrl: string) {
  const m = /^data:image\/png;base64,(.+)$/i.exec(String(dataUrl ?? ""));
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

function limaDateISO(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function parseEtapa(etapaISO: string) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(etapaISO);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
  return { year: y, month: mm };
}

function daysInMonthUTC(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = (await request.json()) as any;
    const scopeUbigeo = safeText(body?.scopeUbigeo);
    const etapa = safeText(body?.etapa);
    if (!scopeUbigeo || !etapa)
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });

    const periodoLabel = safeText(body?.periodoLabel);
    const userLabel = safeText(body?.userLabel);
    const role = safeText(body?.role);

    const totals = body?.totals ?? null;
    const nc = body?.nc ?? null;
    const visitas = body?.visitas ?? null;
    const series = body?.series ?? null;

    const chartsIn = Array.isArray(body?.charts) ? body.charts : [];
    const charts = chartsIn
      .map((c: any) => ({
        title: safeText(c?.title),
        png: dataUrlToBuffer(String(c?.pngDataUrl ?? "")),
      }))
      .filter((c: any) => c.title && c.png) as Array<{ title: string; png: Buffer }>;

    const reportBuild = "AI-v2";
    let narrative = "";
    const hasGeminiKey = Boolean(String(process.env.GEMINI_API_KEY ?? "").trim());
    if (!hasGeminiKey) {
      narrative =
        "IA deshabilitada: falta configurar la variable de entorno GEMINI_API_KEY en el servicio (systemd).";
    } else {
      try {
        const asOfDate = limaDateISO(new Date());
        const etapaParts = parseEtapa(etapa);
        const asOfParts = parseEtapa(asOfDate);
        const isCurrentMonth = Boolean(
          etapaParts &&
            asOfParts &&
            etapaParts.year === asOfParts.year &&
            etapaParts.month === asOfParts.month,
        );
        const dayOfMonth = Number(asOfDate.slice(8, 10));
        const dim =
          etapaParts && Number.isFinite(etapaParts.year) && Number.isFinite(etapaParts.month)
            ? daysInMonthUTC(etapaParts.year, etapaParts.month)
            : 0;
        const isPartialMonth = Boolean(isCurrentMonth && dim > 0 && dayOfMonth < dim);
        const daysRemaining =
          isPartialMonth && dim > 0 && dayOfMonth > 0 ? Math.max(0, dim - dayOfMonth) : 0;

        const fichaText = await getFichaTecnicaText();
        narrative = await generateExecutiveNarrative({
          fichaTecnicaText: fichaText,
          contexto: { ubigeo: scopeUbigeo, etapa, periodoLabel, asOfDate },
          data: {
            totals: totals
              ? { total: Number(totals.total ?? 0), assigned: Number(totals.assigned ?? 0) }
              : undefined,
            nc: nc
              ? {
                  denom: Number(nc.denom ?? 0),
                  numer: Number(nc.numer ?? 0),
                  pct: Number(nc.pct ?? 0),
                  meta: nc.meta == null ? undefined : Number(nc.meta),
                }
              : undefined,
            visitas: visitas
              ? {
                  denom: Number(visitas.denom ?? 0),
                  numer: Number(visitas.numer ?? 0),
                  pct: Number(visitas.pct ?? 0),
                  meta: visitas.meta == null ? undefined : Number(visitas.meta),
                }
              : undefined,
            series: series
              ? {
                  nc: Array.isArray(series.nc)
                    ? series.nc.map((p: any) => ({
                        etapa: safeText(p?.etapa),
                        label: safeText(p?.label),
                        denom: Number(p?.denom ?? 0),
                        numer: Number(p?.numer ?? 0),
                        pct: Number(p?.pct ?? 0),
                        meta: p?.meta == null ? undefined : Number(p?.meta),
                      }))
                    : undefined,
                  visitas: Array.isArray(series.visitas)
                    ? series.visitas.map((p: any) => ({
                        etapa: safeText(p?.etapa),
                        label: safeText(p?.label),
                        denom: Number(p?.denom ?? 0),
                        numer: Number(p?.numer ?? 0),
                        pct: Number(p?.pct ?? 0),
                        meta: p?.meta == null ? undefined : Number(p?.meta),
                      }))
                    : undefined,
                }
              : undefined,
            periodStatus: {
              isCurrentMonth,
              isPartialMonth,
              asOfDate,
              daysInMonth: dim,
              dayOfMonth: Number.isFinite(dayOfMonth) ? dayOfMonth : 0,
              daysRemaining,
            },
          },
        });
        if (!String(narrative ?? "").trim()) {
          narrative =
            "IA activada, pero no devolvió texto. Revisa si la API Key tiene permisos y si el modelo respondió correctamente.";
          console.warn("dashboard_pdf_ai_empty", {
            ubigeo: scopeUbigeo,
            etapa,
            model: String(process.env.GEMINI_MODEL ?? ""),
          });
        }
      } catch (e) {
        console.error("dashboard_pdf_ai_failed", e);
        narrative =
          "IA no disponible: ocurrió un error generando la redacción. Revisa logs del servicio (journalctl).";
      }
    }
    console.info("dashboard_pdf_ai_status", {
      build: reportBuild,
      hasGeminiKey,
      model: String(process.env.GEMINI_MODEL ?? ""),
      narrativeLen: String(narrative ?? "").length,
      ubigeo: scopeUbigeo,
      etapa,
    });

    const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: 36 });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (e) => reject(e));
    });

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = doc.page.margins.left;
    const right = doc.page.margins.right;
    const top = doc.page.margins.top;
    const bottom = doc.page.margins.bottom;
    const usableW = pageW - left - right;

    const ensureSpace = (y: number, needed: number) => {
      if (y + needed <= pageH - bottom) return y;
      doc.addPage();
      return header();
    };

    const header = () => {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#111827")
        .text("Informe Ejecutivo - SinAnemia", left, top, { width: usableW });
      doc.font("Helvetica").fontSize(9).fillColor("#374151");
      doc.text(
        `Generado: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        left,
        top + 22,
      );
      doc.text(`Periodo: ${periodoLabel}`, left, top + 36);
      doc.text(`Ubigeo: ${scopeUbigeo}   Etapa: ${etapa}`, left, top + 50);
      doc.text(`Usuario: ${userLabel}   Rol: ${role}`, left, top + 64);
      doc
        .moveTo(left, top + 78)
        .lineTo(pageW - right, top + 78)
        .strokeColor("#CBD5E1")
        .stroke();
      return top + 92;
    };

    const sectionTitle = (y: number, title: string) => {
      doc.save();
      doc.rect(left, y, usableW, 18).fill("#111827");
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(title, left + 10, y + 5, { width: usableW - 20 });
      doc.restore();
      return y + 26;
    };

    const kpi = (y: number, label: string, value: string, w: number) => {
      doc.save();
      doc
        .roundedRect(left, y, w, 56, 10)
        .fill("#F8FAFC")
        .strokeColor("#E2E8F0")
        .stroke();
      doc
        .fillColor("#334155")
        .font("Helvetica")
        .fontSize(9)
        .text(label, left + 12, y + 10, { width: w - 24 });
      doc
        .fillColor("#0F172A")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(value, left + 12, y + 26, { width: w - 24 });
      doc.restore();
    };

    let y = header();

    y = sectionTitle(y, "Resumen de indicadores");
    const kpiW = (usableW - 16) / 2;
    kpi(y, "Niños cargados (mes)", String(Number(totals?.total ?? 0)), kpiW);
    doc.save();
    doc.translate(kpiW + 16, 0);
    kpi(y, "Niños asignados (mes)", String(Number(totals?.assigned ?? 0)), kpiW);
    doc.restore();
    y += 74;

    const kpiW3 = (usableW - 24) / 3;
    kpi(y, "NC (tamizaje) %", `${Number(nc?.pct ?? 0)}%`, kpiW3);
    doc.save();
    doc.translate(kpiW3 + 12, 0);
    kpi(y, "Visitas %", `${Number(visitas?.pct ?? 0)}%`, kpiW3);
    doc.restore();
    doc.save();
    doc.translate((kpiW3 + 12) * 2, 0);
    kpi(y, "Meta visitas (%)", `${Number(visitas?.meta ?? 0)}%`, kpiW3);
    doc.restore();
    y += 86;

    if (narrative) {
      y = ensureSpace(y, 120);
      y = sectionTitle(y, `Interpretación ejecutiva (IA) · ${reportBuild}`);
      doc.font("Helvetica").fontSize(9).fillColor("#111827");
      const h = doc.heightOfString(narrative, { width: usableW, align: "justify" });
      y = ensureSpace(y, Math.min(h + 10, 500));
      doc.text(narrative, left, y, { width: usableW, align: "justify" });
      y = doc.y + 14;
    }

    for (const ch of charts) {
      if (y + 280 > pageH - bottom) {
        doc.addPage();
        y = header();
      }
      y = sectionTitle(y, ch.title);
      const imgW = usableW;
      const imgH = 240;
      doc.image(ch.png, left, y, { fit: [imgW, imgH], align: "center" });
      y += imgH + 18;
    }

    doc.end();
    const buffer = await bufferPromise;

    const filename = `informe_dashboard_${scopeUbigeo}_${etapa}.pdf`.replace(
      /[^\w\-.,() ]+/g,
      "_",
    );
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("dashboard_pdf_failed", e);
    return NextResponse.json({ error: "dashboard_pdf_failed" }, { status: 500 });
  }
}
