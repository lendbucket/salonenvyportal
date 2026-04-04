const stats = [
  { label: "Revenue This Week", value: "$12,480" },
  { label: "Services This Week", value: "142" },
  { label: "New Clients", value: "18" },
  { label: "Pending Approvals", value: "3" },
];

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-100">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-neutral-800 bg-[#1f1f1f] p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-neutral-400">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[#C9A84C]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
