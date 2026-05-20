"use client";

export function FullScreenLoader(props: { label?: string }) {
  const label = props.label ?? "Procesando...";
  return (
    <div className="fixed inset-0 z-[100000] grid place-items-center bg-black/25 backdrop-blur-[1px]">
      <div className="rounded-2xl bg-white px-6 py-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border-[3px] border-blue-200 border-t-blue-700 animate-spin" />
          <div className="text-sm font-semibold text-zinc-900">{label}</div>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Por favor espera, esto puede tardar unos segundos.
        </div>
      </div>
    </div>
  );
}

