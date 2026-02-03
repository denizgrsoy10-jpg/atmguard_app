export default function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  const border =
    tone === "danger"
      ? "border-red-500/40"
      : tone === "success"
      ? "border-emerald-500/40"
      : "border-blue-500/30";

  return (
    <div className={`rounded-2xl p-4 border bg-white/5 ${border}`}>
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
