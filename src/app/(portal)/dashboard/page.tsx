"use client"
import { useSession } from "next-auth/react"
import Link from "next/link"

export default function DashboardPage() {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "Robert"

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()

  const metrics = [
    { label: "Revenue This Week", value: "$0", icon: "payments", trend: "0%" },
    { label: "Services This Week", value: "0", icon: "content_cut" },
    { label: "New Clients", value: "0", icon: "person_add" },
    { label: "Pending Approvals", value: "0", icon: "rule" },
  ]

  const alerts = [
    { label: "Low Stock Items", sub: "Reorder suggested", icon: "inventory_2", count: 0 },
    { label: "Pending Schedules", sub: "Needs review", icon: "event_note", count: 0 },
    { label: "Open Issues", sub: "Action required", icon: "report_problem", count: 0 },
  ]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Hero Header */}
      <section className="space-y-1">
        <h1 className="font-[var(--font-noto-serif)] text-4xl text-white">
          {greeting}, {userName} <span aria-hidden>&#x1F44B;</span>
        </h1>
        <p className="text-[#a8a49c] text-sm tracking-wide">{dateStr}</p>
      </section>

      {/* Location Tabs */}
      <div className="flex items-center gap-1 bg-[#3a4347] p-1 rounded-lg w-fit">
        {["Corpus Christi", "San Antonio", "Both"].map((loc, i) => (
          <button key={loc} className={`px-6 py-2 text-xs font-bold rounded-lg transition-colors ${
            i === 0
              ? "text-[#CDC9C0] bg-[#142127] shadow-sm"
              : "text-[#CDC9C0]/60 hover:text-[#CDC9C0]"
          }`}>
            {loc}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[#4a5459] border border-[rgba(205,201,192,0.2)] p-6 rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-[#CDC9C0] tracking-[0.1em] uppercase">{m.label}</span>
              <span className="material-symbols-outlined text-[#CDC9C0]/40">{m.icon}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-[var(--font-noto-serif)] text-3xl text-white">{m.value}</span>
              {m.trend && <span className="text-xs text-[#CDC9C0] font-bold flex items-center">
                <span className="material-symbols-outlined text-sm mr-0.5">trending_flat</span>{m.trend}
              </span>}
            </div>
          </div>
        ))}
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {alerts.map((a) => (
          <div key={a.label} className="bg-[#1f2c31] p-6 rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#29373c] transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#29373c] flex items-center justify-center text-[#CDC9C0]">
                <span className="material-symbols-outlined">{a.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-[#CDC9C0] uppercase">{a.label}</p>
                <p className="text-xs text-[#cac6bc]">{a.sub}</p>
              </div>
            </div>
            <span className="bg-[#29373c] text-[#CDC9C0] font-[var(--font-noto-serif)] text-xl px-3 py-1 rounded">{a.count}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 items-center bg-[#101d22]/50 p-6 rounded-xl border border-[rgba(205,201,192,0.1)]">
        {[
          { href: "/inventory/add", icon: "add", label: "Add Inventory" },
          { href: "/schedule", icon: "calendar_today", label: "Build Schedule" },
          { href: "/approvals", icon: "done_all", label: "Review Approvals" },
        ].map(({ href, icon, label }) => (
          <Link key={href} href={href} className="bg-transparent border border-[#CDC9C0] text-[#CDC9C0] px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#CDC9C0] hover:text-[#1a1a1a] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">{icon}</span>
            {label}
          </Link>
        ))}
        <Link href="/reyna-ai" className="bg-[#CDC9C0] text-[#1a1a1a] px-8 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-[0.15em] shadow-lg hover:brightness-110 transition-all flex items-center gap-2 ml-auto">
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          Ask Reyna AI
        </Link>
      </div>

      {/* Activity + Alerts Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-3 bg-[#142127] p-8 rounded-xl min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-[var(--font-noto-serif)] text-xl text-white">Recent Activity</h3>
            <span className="material-symbols-outlined text-[#CDC9C0]/40">history</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-16 h-16 rounded-full border border-dashed border-[#CDC9C0]/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#CDC9C0]">sync</span>
            </div>
            <div>
              <p className="font-[var(--font-noto-serif)] text-lg italic text-[#e9e5dc]">Awaiting Activity</p>
              <p className="text-sm text-[#cac6bc]">The portal is currently synchronized.</p>
            </div>
          </div>
        </div>

        {/* Admin Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-[#CDC9C0] tracking-[0.2em] uppercase px-2">Admin Alerts</h3>
          <div className="bg-[#1f2c31] p-5 rounded-lg border-l-4 border-[#ffb4ab]">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#ffb4ab]">priority_high</span>
              <div>
                <p className="text-xs font-bold text-[#ffb4ab] uppercase tracking-wider">Urgent</p>
                <p className="text-sm text-[#d6e5ec]">End of month reconciliation due in 48 hours.</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1f2c31] p-5 rounded-lg border-l-4 border-[#ffb000]">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#ffb000]">warning</span>
              <div>
                <p className="text-xs font-bold text-[#ffb000] uppercase tracking-wider">High Priority</p>
                <p className="text-sm text-[#d6e5ec]">3 staff members have not confirmed their schedules.</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1f2c31] p-5 rounded-lg border-l-4 border-[#CDC9C0]">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[#CDC9C0]">info</span>
              <div>
                <p className="text-xs font-bold text-[#CDC9C0] uppercase tracking-wider">Medium</p>
                <p className="text-sm text-[#d6e5ec]">Quarterly inventory audit scheduled for next Monday.</p>
              </div>
            </div>
          </div>
          <div className="bg-[#031015] p-8 rounded-xl border border-[rgba(205,201,192,0.1)] text-center space-y-2">
            <p className="text-[10px] text-[#CDC9C0]/40 uppercase tracking-[0.3em]">System Health</p>
            <p className="font-[var(--font-noto-serif)] text-2xl text-white">Optimal</p>
            <div className="flex justify-center gap-1">
              <div className="h-1 w-8 bg-[#CDC9C0] rounded-full"></div>
              <div className="h-1 w-8 bg-[#CDC9C0]/20 rounded-full"></div>
              <div className="h-1 w-8 bg-[#CDC9C0]/20 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
