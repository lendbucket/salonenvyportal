import Link from "next/link"

export default function ServicePricingPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="font-[var(--font-noto-serif)] text-3xl text-white">Service Pricing</h1>
      <div className="bg-[#1f2c31] border border-[rgba(205,201,192,0.15)] rounded-xl p-10 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-[#CDC9C0]/30">sell</span>
        <p className="font-[var(--font-noto-serif)] text-lg text-[#e9e5dc]">Coming Soon</p>
        <p className="text-sm text-[#cac6bc]">This module is being built.</p>
        <Link href="/dashboard" className="inline-block mt-4 text-xs font-bold text-[#CDC9C0] uppercase tracking-widest hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
