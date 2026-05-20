import { GoogleGenerativeAI } from "@google/generative-ai";

function requireEnv(name: string) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`missing_env_${name}`);
  return v;
}

function clip(s: string, max = 14000) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, max);
}

export async function generateExecutiveNarrative(params: {
  fichaTecnicaText: string;
  contexto: {
    ubigeo: string;
    etapa: string;
    periodoLabel: string;
    asOfDate?: string;
  };
  data: {
    totals?: { total: number; assigned: number };
    nc?: { denom: number; numer: number; pct: number; meta?: number };
    visitas?: { denom: number; numer: number; pct: number; meta?: number };
    series?: {
      nc?: Array<{
        etapa: string;
        label: string;
        denom: number;
        numer: number;
        pct: number;
        meta?: number;
      }>;
      visitas?: Array<{
        etapa: string;
        label: string;
        denom: number;
        numer: number;
        pct: number;
        meta?: number;
      }>;
    };
    periodStatus?: {
      isCurrentMonth: boolean;
      isPartialMonth: boolean;
      asOfDate: string;
      daysInMonth: number;
      dayOfMonth: number;
      daysRemaining: number;
    };
  };
}) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const modelName = String(process.env.GEMINI_MODEL ?? "gemini-1.5-flash").trim() || "gemini-1.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const ficha = clip(params.fichaTecnicaText, 16000);
  const payload = JSON.stringify(
    {
      contexto: params.contexto,
      data: params.data,
    },
    null,
    2,
  );

  const prompt = [
    "Eres un analista técnico de salud pública. Redacta un informe ejecutivo en español (Perú) basado únicamente en:",
    "1) La Ficha Técnica (extracto incluido abajo).",
    "2) Los datos calculados del Dashboard (JSON incluido abajo).",
    "",
    "Requisitos:",
    "- No inventes datos, no exageres, no hagas promesas.",
    "- Explica brevemente la interpretación técnica de los resultados y el nivel de cumplimiento vs meta.",
    "- Menciona el denominador y numerador cuando existan.",
    "- Analiza la tendencia de los meses previos usando data.series (si está disponible): describe si mejora, empeora o se mantiene.",
    "- Si data.periodStatus.isPartialMonth es true (mes en curso), aclara que es un avance parcial al corte (asOfDate) y que el resultado puede variar al cierre del mes. No proyectes con números.",
    "- Entrega el resultado en texto plano con secciones cortas:",
    "  1) Resumen ejecutivo (3-5 líneas)",
    "  2) Indicador 1.1 (NC tamizaje): resultado, meta, lectura técnica, alertas",
    "  3) Meta de Visitas completas y oportunas: resultado, meta, lectura técnica, alertas",
    "  4) Recomendaciones operativas (3-6 viñetas)",
    "",
    "Ficha Técnica (extracto):",
    ficha,
    "",
    "Datos del Dashboard (JSON):",
    payload,
  ].join("\n");

  const res = await model.generateContent(prompt);
  const text = String(res.response.text() ?? "").trim();
  return text;
}

