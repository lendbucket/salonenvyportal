"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, X, Send, ShieldCheck, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type Loc = { id: string; name: string };

type StaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  position: string;
  isActive: boolean;
  inviteStatus: string;
  squareTeamMemberId: string | null;
  createdAt: string;
  location: Loc;
  tdlrStatus: string | null;
  tdlrLicenseNumber: string | null;
  tdlrExpirationDate: string | null;
  tdlrVerifiedAt: string | null;
  tdlrHolderName: string | null;
};

type LocationOption = { id: string; name: string };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function badgeFor(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "accepted")
    return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (s === "invited") return "bg-amber-500/15 text-amber-300 ring-amber-500/35";
  return "bg-neutral-600/30 text-neutral-400 ring-neutral-500/30";
}

function labelFor(status: string) {
  const s = status.toLowerCase();
  if (s === "not_invited") return "not invited";
  return s;
}

function tdlrBadge(m: StaffRow) {
  const s = m.tdlrStatus?.toLowerCase();
  if (s === "active" || s === "current") {
    return { cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30", label: "TDLR Active" };
  }
  if (
    s === "expired" ||
    (m.tdlrExpirationDate && new Date(m.tdlrExpirationDate) < new Date())
  ) {
    return { cls: "bg-red-500/15 text-red-400 ring-red-500/30", label: "TDLR Expired" };
  }
  return { cls: "bg-amber-500/15 text-amber-300 ring-amber-500/35", label: "License Unverified" };
}

export default function StaffPage() {
  const router = useRouter();
  const { isOwner, canSeeAllLocations } = useUserRole();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [locationTab, setLocationTab] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Action states
  const [verifyingTdlr, setVerifyingTdlr] = useState<string | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "stylist",
    locationId: "",
    sendOnboarding: true,
  });
  const [inviteSending, setInviteSending] = useState(false);

  // Send enrollment modal (for existing staff)
  const [enrollTarget, setEnrollTarget] = useState<StaffRow | null>(null);
  const [enrollSending, setEnrollSending] = useState(false);

  // License verification modal
  const [licenseModal, setLicenseModal] = useState<{ staffId: string; staffName: string; phone: string | null; email: string | null; currentLicense: string | null; currentStatus: string | null } | null>(null)
  const [licenseInput, setLicenseInput] = useState("")
  const [licenseVerifying, setLicenseVerifying] = useState(false)
  const [licenseResult, setLicenseResult] = useState<{ verified: boolean; holderName?: string; licenseNumber?: string; licenseType?: string; expirationDate?: string | null; status?: string; county?: string; originalIssueDate?: string; source?: string; error?: string } | null>(null)
  const [licenseSendStatus, setLicenseSendStatus] = useState<string | null>(null)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ holderName: "", licenseType: "Cosmetologist - Operator", expirationDate: "", status: "ACTIVE" })
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/staff/by-location?all=true");
      if (!res.ok) {
        const text = await res.text();
        console.error("[staff page] API error:", res.status, text);
        throw new Error("Failed to load staff: " + res.status);
      }
      let data: { staff?: StaffRow[] };
      try {
        data = await res.json();
      } catch {
        throw new Error("Failed to parse staff data. Please refresh.");
      }
      const list = data.staff ?? [];
      setStaff(list);

      // Extract unique locations
      const locs = new Map<string, string>();
      list.forEach((m) => locs.set(m.location.id, m.location.name));
      setLocations(Array.from(locs, ([id, name]) => ({ id, name })));

      // Default invite locationId
      if (locs.size > 0 && !inviteForm.locationId) {
        const firstId = Array.from(locs.keys())[0];
        setInviteForm((f) => ({ ...f, locationId: firstId }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setStaff([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-dismiss success
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // Auto-refresh staff data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { void load(); setLastRefresh(new Date()) }, 30000)
    return () => clearInterval(interval)
  }, [load])

  const verifyTdlr = async (member: StaffRow) => {
    if (!member.tdlrLicenseNumber) return;
    setVerifyingTdlr(member.id);
    try {
      const lookupRes = await fetch(
        `/api/tdlr/verify?license=${encodeURIComponent(member.tdlrLicenseNumber)}`
      );
      const lookupData = await lookupRes.json();
      if (lookupData.found) {
        await fetch("/api/tdlr/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffMemberId: member.id,
            licenseNumber: member.tdlrLicenseNumber,
            licenseStatus:
              lookupData.status ||
              (lookupData.isActive ? "Active" : "Expired"),
            expirationDate: lookupData.expirationDate || null,
          }),
        });
        void load();
      }
    } catch {
      /* ignore */
    }
    setVerifyingTdlr(null);
  };

  const handleInvite = async () => {
    if (!inviteForm.fullName || !inviteForm.email || !inviteForm.locationId) return;
    setInviteSending(true);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (res.ok) {
        setSuccessMsg(`Invitation sent to ${inviteForm.email}`);
        setShowInviteModal(false);
        setInviteForm((f) => ({
          ...f,
          fullName: "",
          email: "",
          phone: "",
          role: "stylist",
          sendOnboarding: true,
        }));
        void load();
      } else {
        const data = await res.json();
        setErr(data.error || "Failed to send invite");
      }
    } catch {
      setErr("Network error sending invite");
    }
    setInviteSending(false);
  };

  const handleSendEnrollment = async () => {
    if (!enrollTarget) return;
    setEnrollSending(true);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: enrollTarget.fullName,
          email: enrollTarget.email,
          phone: enrollTarget.phone,
          role: enrollTarget.position,
          locationId: enrollTarget.location.id,
          sendOnboarding: true,
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Enrollment link sent to ${enrollTarget.email}`);
        setEnrollTarget(null);
        void load();
      } else {
        const data = await res.json();
        setErr(data.error || "Failed to send enrollment");
      }
    } catch {
      setErr("Network error");
    }
    setEnrollSending(false);
  };

  const handleVerifyLicense = async () => {
    if (!licenseInput.trim() || !licenseModal) return
    setLicenseVerifying(true)
    setLicenseResult(null)
    try {
      const res = await fetch(`/api/staff/${licenseModal.staffId}/verify-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "manual", licenseNumber: licenseInput.trim() }),
      })
      const data = await res.json()
      setLicenseResult(data.result || data)
      void load()
    } catch {
      setLicenseResult({ verified: false, error: "Failed to verify. Please try again." })
    } finally {
      setLicenseVerifying(false)
    }
  }

  const handleSendVerification = async (method: "sms" | "email") => {
    if (!licenseModal) return
    setLicenseSendStatus(null)
    try {
      const res = await fetch(`/api/staff/${licenseModal.staffId}/verify-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (data.sent) {
        setLicenseSendStatus(`${method === "sms" ? "SMS" : "Email"} Sent!`)
        setTimeout(() => setLicenseSendStatus(null), 3000)
      } else {
        setLicenseSendStatus(data.error || "Failed to send")
        setTimeout(() => setLicenseSendStatus(null), 3000)
      }
    } catch {
      setLicenseSendStatus("Failed to send")
      setTimeout(() => setLicenseSendStatus(null), 3000)
    }
  }

  const openLicenseModal = (m: StaffRow) => {
    setLicenseModal({
      staffId: m.id,
      staffName: m.fullName,
      phone: m.phone,
      email: m.email,
      currentLicense: m.tdlrLicenseNumber,
      currentStatus: m.tdlrStatus,
    })
    setLicenseInput(m.tdlrLicenseNumber || "")
    setLicenseResult(null)
    setLicenseSendStatus(null)
  }

  const handleOverrideSave = async () => {
    if (!licenseModal || !licenseInput.trim()) return
    setOverrideSaving(true)
    try {
      const res = await fetch(`/api/staff/${licenseModal.staffId}/verify-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "override", licenseNumber: licenseInput.trim(), ...overrideForm }),
      })
      const data = await res.json()
      if (data.verified) {
        setLicenseResult(data.result || { verified: true, ...overrideForm, licenseNumber: licenseInput.trim() })
        setShowOverride(false)
        void load()
      }
    } catch { /* skip */ }
    setOverrideSaving(false)
  }

  const closeLicenseModal = () => {
    setLicenseModal(null)
    setLicenseResult(null)
    setLicenseInput("")
    setLicenseSendStatus(null)
    setShowOverride(false)
    setOverrideForm({ holderName: "", licenseType: "Cosmetologist - Operator", expirationDate: "", status: "ACTIVE" })
  }

  // Filtering
  const filtered = useMemo(() => {
    return staff.filter((m) => {
      if (locationTab !== "all" && m.location.id !== locationTab) return false;
      if (roleFilter !== "all" && m.position.toLowerCase() !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.fullName.toLowerCase().includes(q) &&
          !(m.email || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [staff, locationTab, roleFilter, search]);

  // Group by location for owner "all" view
  const grouped = useMemo(() => {
    if (locationTab !== "all" || !canSeeAllLocations) return null;
    const map = new Map<string, { name: string; members: StaffRow[] }>();
    filtered.forEach((m) => {
      const g = map.get(m.location.id) || { name: m.location.name, members: [] };
      g.members.push(m);
      map.set(m.location.id, g);
    });
    return Array.from(map.values());
  }, [filtered, locationTab, canSeeAllLocations]);

  const renderCard = (m: StaffRow) => {
    const tb = tdlrBadge(m);
    return (
      <li
        key={m.id}
        className="rounded-2xl border border-[#1a2332] bg-[#0d1117] p-5 transition hover:border-[#7a8f96]/25"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0d1117] text-sm font-semibold text-[#7a8f96] ring-1 ring-[#7a8f96]/30">
            {initials(m.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="truncate font-medium"
                style={{
                  color: m.squareTeamMemberId ? "#7a8f96" : undefined,
                  textDecoration: m.squareTeamMemberId ? "underline" : undefined,
                  cursor: m.squareTeamMemberId ? "pointer" : undefined,
                }}
                onClick={(e) => {
                  if (m.squareTeamMemberId) {
                    e.stopPropagation();
                    router.push(`/stylist/${m.squareTeamMemberId}`);
                  }
                }}
              >
                {m.fullName}
              </p>
              {!m.isActive && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 ring-1 ring-red-500/30">
                  Inactive
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[#7a8f96]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7a8f96] ring-1 ring-[#7a8f96]/20">
                {m.position}
              </span>
              <span
                style={{
                  borderRadius: 9999, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.15s",
                  background: tb.label === "TDLR Active" ? "rgba(16,185,129,0.15)" : tb.label === "TDLR Expired" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                  color: tb.label === "TDLR Active" ? "#34d399" : tb.label === "TDLR Expired" ? "#f87171" : "#fbbf24",
                  border: `1px solid ${tb.label === "TDLR Active" ? "rgba(16,185,129,0.3)" : tb.label === "TDLR Expired" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                }}
                onClick={(e) => { e.stopPropagation(); openLicenseModal(m) }}
              >
                {tb.label}
              </span>
              {m.squareTeamMemberId && (
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400 ring-1 ring-blue-500/30">
                  SalonTransact
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${badgeFor(m.inviteStatus)}`}>
                {labelFor(m.inviteStatus)}
              </span>
            </div>
            {m.email && (
              <Link
                href={`mailto:${m.email}`}
                className="mt-1.5 block truncate text-xs text-[#7a8f96]/80 hover:underline"
              >
                {m.email}
              </Link>
            )}
            {m.phone && (
              <p className="text-xs text-neutral-500">{m.phone}</p>
            )}
            <p className="mt-1 text-xs text-neutral-600">{m.location.name}</p>

            {/* TDLR details */}
            {m.tdlrLicenseNumber && (
              <p className="mt-1 text-[11px] text-neutral-500">
                License: {m.tdlrLicenseNumber}
                {m.tdlrExpirationDate && (
                  <> &middot; Exp: {new Date(m.tdlrExpirationDate).toLocaleDateString()}</>
                )}
              </p>
            )}

            {m.createdAt && (
              <p className="text-[10px] text-neutral-600">
                Joined {new Date(m.createdAt).toLocaleDateString()}
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!m.tdlrStatus && m.tdlrLicenseNumber && (
                <button
                  type="button"
                  onClick={() => verifyTdlr(m)}
                  disabled={verifyingTdlr === m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#7a8f96]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7a8f96] transition hover:bg-[#7a8f96]/30 disabled:opacity-50"
                >
                  <ShieldCheck className="size-3" />
                  {verifyingTdlr === m.id ? "Verifying..." : "Verify License"}
                </button>
              )}
              {m.inviteStatus.toLowerCase() !== "accepted" && m.email && (
                <button
                  type="button"
                  onClick={() => setEnrollTarget(m)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#7a8f96]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7a8f96] transition hover:bg-[#7a8f96]/25"
                >
                  <Send className="size-3" />
                  Send Enrollment
                </button>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Staff</h1>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7a8f96] px-4 py-2.5 text-sm font-semibold text-[#06080d] hover:bg-[#606E74]"
        >
          <Plus className="size-4" />
          Invite Staff
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Location tabs (owner only sees all) */}
        {canSeeAllLocations && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLocationTab("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                locationTab === "all"
                  ? "bg-[#7a8f96] text-[#06080d]"
                  : "bg-[#0d1117] text-neutral-400 hover:bg-[#1a2332]"
              }`}
            >
              All
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setLocationTab(loc.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  locationTab === loc.id
                    ? "bg-[#7a8f96] text-[#06080d]"
                    : "bg-[#0d1117] text-neutral-400 hover:bg-[#1a2332]"
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}

        {/* Role filter */}
        <div className="flex gap-2">
          {["all", "manager", "stylist"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                roleFilter === r
                  ? "bg-[#7a8f96] text-[#06080d]"
                  : "bg-[#0d1117] text-neutral-400 hover:bg-[#1a2332]"
              }`}
            >
              {r === "all" ? "All Roles" : r}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full rounded-xl border border-[#1a2332] bg-[#0d1117] py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-[#7a8f96]/40"
          />
        </div>
      </div>

      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading team...</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-[#1a2332] bg-[#0d1117] px-6 py-16 text-center">
          <Users className="size-12 text-neutral-600" />
          <p className="mt-4 text-neutral-400">No staff found for this filter.</p>
        </div>
      ) : grouped ? (
        // Grouped by location
        <div className="mt-8 space-y-8">
          {grouped.map((g) => (
            <div key={g.name}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {g.name} ({g.members.length})
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {g.members.map(renderCard)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(renderCard)}
        </ul>
      )}

      {/* Last refresh indicator */}
      <p className="mt-4 text-[10px] text-neutral-600" style={{ fontFamily: "'Fira Code', monospace" }}>
        Last refreshed {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
      </p>

      {/* ---- Invite Staff Modal ---- */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1a2332] bg-[#0d1117] p-6" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)" }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-100">Invite Staff Member</h2>
              <button type="button" onClick={() => setShowInviteModal(false)}>
                <X className="size-5 text-neutral-500 hover:text-neutral-300" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Full Name *
                </label>
                <input
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-[#1a2332] bg-[#0d1117] px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-[#7a8f96]/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="jane@example.com"
                  className="w-full rounded-lg border border-[#1a2332] bg-[#0d1117] px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-[#7a8f96]/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Phone
                </label>
                <input
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  placeholder="(xxx) xxx-xxxx"
                  className="w-full rounded-lg border border-[#1a2332] bg-[#0d1117] px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-[#7a8f96]/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full rounded-lg border border-[#1a2332] bg-[#0d1117] px-3 py-2.5 text-sm text-neutral-100 outline-none"
                  >
                    <option value="stylist">Stylist</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Location *
                  </label>
                  <select
                    value={inviteForm.locationId}
                    onChange={(e) => setInviteForm({ ...inviteForm, locationId: e.target.value })}
                    className="w-full rounded-lg border border-[#1a2332] bg-[#0d1117] px-3 py-2.5 text-sm text-neutral-100 outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteForm.sendOnboarding}
                  onChange={(e) => setInviteForm({ ...inviteForm, sendOnboarding: e.target.checked })}
                  className="size-4 accent-[#7a8f96]"
                />
                <span className="text-sm text-neutral-300">Send onboarding enrollment link</span>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="flex-1 rounded-xl border border-[#1a2332] py-2.5 text-sm font-medium text-neutral-400 hover:bg-[#0d1117]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviteSending || !inviteForm.fullName || !inviteForm.email || !inviteForm.locationId}
                className="flex-[2] rounded-xl bg-[#7a8f96] py-2.5 text-sm font-bold text-[#06080d] hover:bg-[#606E74] disabled:opacity-50"
              >
                {inviteSending ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- License Verification Modal ---- */}
      {licenseModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} onClick={closeLicenseModal} />
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(520px, calc(100vw - 32px))", background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)", maxHeight: "90vh", overflowY: "auto" as const, zIndex: 301,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", margin: 0 }}>{licenseModal.staffName}</h2>
                {licenseModal.currentStatus && (() => {
                  const tb2 = tdlrBadge({ tdlrStatus: licenseModal.currentStatus, tdlrExpirationDate: null } as StaffRow)
                  return (
                    <span style={{
                      display: "inline-block", marginTop: 6, borderRadius: 9999, padding: "2px 8px",
                      fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                      background: tb2.label === "TDLR Active" ? "rgba(16,185,129,0.15)" : tb2.label === "TDLR Expired" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                      color: tb2.label === "TDLR Active" ? "#34d399" : tb2.label === "TDLR Expired" ? "#f87171" : "#fbbf24",
                      border: `1px solid ${tb2.label === "TDLR Active" ? "rgba(16,185,129,0.3)" : tb2.label === "TDLR Expired" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                    }}>{tb2.label}</span>
                  )
                })()}
              </div>
              <button type="button" onClick={closeLicenseModal} style={{ background: "none", border: "none", color: "#606E74", cursor: "pointer", padding: 4 }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* License input */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#606E74", marginBottom: 6 }}>TDLR License Number</label>
              <input
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                placeholder="e.g. 123456 or COST123456"
                style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", padding: "14px 16px", fontFamily: "'Fira Code', monospace", fontSize: 16, color: "#ffffff", outline: "none", boxSizing: "border-box" as const }}
              />
            </div>

            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerifyLicense}
              disabled={licenseVerifying || !licenseInput.trim()}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 12, borderRadius: 12, border: "1px solid #7a8f96", padding: "12px 0",
                fontSize: 15, fontWeight: 600, color: "#ffffff", cursor: "pointer", transition: "all 0.15s",
                background: licenseVerifying ? "rgba(96,110,116,0.2)" : "rgba(122,143,150,0.15)",
                opacity: (licenseVerifying || !licenseInput.trim()) ? 0.4 : 1,
              }}
            >
              {licenseVerifying ? "Verifying with TDLR..." : "Verify License"}
            </button>

            {/* Result: success */}
            {licenseResult && licenseResult.verified && (
              <div style={{ marginTop: 16, borderRadius: 12, border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.06)", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <ShieldCheck style={{ width: 20, height: 20, color: "#34d399" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>LICENSE VERIFIED — ACTIVE</span>
                </div>
                <div>
                  {[
                    { label: "NAME", value: licenseResult.holderName },
                    { label: "LICENSE NUMBER", value: licenseResult.licenseNumber || licenseInput },
                    { label: "LICENSE TYPE", value: licenseResult.licenseType },
                    { label: "EXPIRATION DATE", value: licenseResult.expirationDate || "" },
                    { label: "LICENSE STATUS", value: licenseResult.status || "" },
                    { label: "ORIGINAL ISSUE DATE", value: licenseResult.originalIssueDate || "" },
                    { label: "COUNTY", value: licenseResult.county || "" },
                    { label: "ISSUED STATE", value: "TEXAS" },
                  ].filter(r => !!r.value).map((r, idx, arr) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#606E74", letterSpacing: "0.04em" }}>{r.label}</span>
                      {r.label === "LICENSE STATUS" ? (
                        <span style={{
                          borderRadius: 9999, padding: "2px 10px", fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 600,
                          background: r.value === "ACTIVE" ? "rgba(16,185,129,0.1)" : r.value === "EXPIRED" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                          color: r.value === "ACTIVE" ? "#34d399" : r.value === "EXPIRED" ? "#f87171" : "#fbbf24",
                        }}>{r.value}</span>
                      ) : (
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, fontWeight: 500, color: "#ffffff" }}>{r.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result: failed */}
            {licenseResult && !licenseResult.verified && (
              <div style={{ marginTop: 16, borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <X style={{ width: 16, height: 16, color: "#f87171" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>License Not Found via API</span>
                </div>
                <p style={{ marginTop: 8, fontSize: 13, color: "#7a8f96" }}>{licenseResult.error || "This license number was not found in the TDLR database."}</p>
                <p style={{ marginTop: 4, fontSize: 12, color: "#606E74" }}>Look up at tdlr.texas.gov, then enter the data manually below.</p>

                {/* Manual override toggle */}
                <button
                  type="button"
                  onClick={() => setShowOverride(!showOverride)}
                  style={{ marginTop: 12, background: "none", border: "none", color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  {showOverride ? "Hide Manual Entry" : "Enter TDLR Data Manually"}
                </button>

                {showOverride && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <input value={overrideForm.holderName} onChange={e => setOverrideForm(f => ({ ...f, holderName: e.target.value }))} placeholder="Holder Name (e.g. ESPINOSA, CLARISSA)" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
                    <input value={overrideForm.licenseType} onChange={e => setOverrideForm(f => ({ ...f, licenseType: e.target.value }))} placeholder="License Type" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
                    <input type="date" value={overrideForm.expirationDate} onChange={e => setOverrideForm(f => ({ ...f, expirationDate: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none", colorScheme: "dark", boxSizing: "border-box" as const }} />
                    <select value={overrideForm.status} onChange={e => setOverrideForm(f => ({ ...f, status: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleOverrideSave}
                      disabled={overrideSaving || !licenseInput.trim()}
                      style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid #f59e0b", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: overrideSaving ? 0.5 : 1 }}
                    >
                      {overrideSaving ? "Saving..." : "Save Override"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Send verification link */}
            <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#606E74", marginBottom: 10 }}>Send Verification Link</p>
              {licenseSendStatus && (
                <p style={{ fontSize: 12, fontWeight: 600, color: "#7a8f96", marginBottom: 8 }}>{licenseSendStatus}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleSendVerification("sms")}
                  disabled={!licenseModal.phone}
                  style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "#7a8f96", cursor: licenseModal.phone ? "pointer" : "not-allowed", opacity: licenseModal.phone ? 1 : 0.3 }}
                >
                  Send via SMS
                </button>
                <button
                  type="button"
                  onClick={() => handleSendVerification("email")}
                  disabled={!licenseModal.email}
                  style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "#7a8f96", cursor: licenseModal.email ? "pointer" : "not-allowed", opacity: licenseModal.email ? 1 : 0.3 }}
                >
                  Send via Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Send Enrollment Modal ---- */}
      {enrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a2332] bg-[#0d1117] p-6" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)" }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-100">Send Enrollment</h2>
              <button type="button" onClick={() => setEnrollTarget(null)}>
                <X className="size-5 text-neutral-500 hover:text-neutral-300" />
              </button>
            </div>
            <p className="text-sm text-neutral-400">
              Send an onboarding enrollment link to{" "}
              <strong className="text-neutral-200">{enrollTarget.fullName}</strong> at{" "}
              <strong className="text-neutral-200">{enrollTarget.email}</strong>?
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              They will receive an email with a link to complete their enrollment (personal info, license, W-9, direct deposit, etc).
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEnrollTarget(null)}
                className="flex-1 rounded-xl border border-[#1a2332] py-2.5 text-sm font-medium text-neutral-400 hover:bg-[#0d1117]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEnrollment}
                disabled={enrollSending}
                className="flex-[2] rounded-xl bg-[#7a8f96] py-2.5 text-sm font-bold text-[#06080d] hover:bg-[#606E74] disabled:opacity-50"
              >
                {enrollSending ? "Sending..." : "Send Enrollment Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
