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
  const [licenseResult, setLicenseResult] = useState<{ verified: boolean; holderName?: string; licenseType?: string; expirationDate?: string; status?: string; error?: string } | null>(null)
  const [licenseSendStatus, setLicenseSendStatus] = useState<string | null>(null)
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

  const closeLicenseModal = () => {
    setLicenseModal(null)
    setLicenseResult(null)
    setLicenseInput("")
    setLicenseSendStatus(null)
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
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 cursor-pointer transition hover:brightness-125 ${tb.cls}`}
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
        <div className="fixed inset-0 z-[300]">
          <div className="absolute inset-0 bg-black/70" onClick={closeLicenseModal} />
          <div
            className="absolute left-1/2 top-1/2 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d1117] p-7"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.8)", maxWidth: "min(520px, calc(100vw - 32px))" }}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{licenseModal.staffName}</h2>
                {licenseModal.currentStatus && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tdlrBadge({ tdlrStatus: licenseModal.currentStatus, tdlrExpirationDate: null } as StaffRow).cls}`}>
                    {tdlrBadge({ tdlrStatus: licenseModal.currentStatus, tdlrExpirationDate: null } as StaffRow).label}
                  </span>
                )}
              </div>
              <button type="button" onClick={closeLicenseModal} className="text-neutral-500 hover:text-white transition">
                <X className="size-5" />
              </button>
            </div>

            {/* License input */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-neutral-500">TDLR License Number</label>
              <input
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                placeholder="e.g. 123456 or COST123456"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-mono text-base text-white outline-none focus:border-[#7a8f96] focus:ring-2 focus:ring-[#7a8f96]/15"
              />
            </div>

            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerifyLicense}
              disabled={licenseVerifying || !licenseInput.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#7a8f96] py-3 text-[15px] font-semibold text-white transition hover:bg-[#7a8f96]/10 disabled:opacity-40"
              style={{ background: licenseVerifying ? "rgba(96,110,116,0.2)" : "rgba(122,143,150,0.15)" }}
            >
              {licenseVerifying && <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#7a8f96] border-t-transparent" />}
              {licenseVerifying ? "Verifying with TDLR..." : "Verify License"}
            </button>

            {/* Result: success */}
            {licenseResult && licenseResult.verified && (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-400" />
                  <span className="text-[15px] font-bold text-emerald-400">License Verified</span>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    { label: "LICENSE NUMBER", value: licenseInput },
                    { label: "LICENSE HOLDER", value: licenseResult.holderName },
                    { label: "LICENSE TYPE", value: licenseResult.licenseType },
                    { label: "EXPIRATION DATE", value: licenseResult.expirationDate ? new Date(licenseResult.expirationDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null },
                    { label: "STATUS", value: licenseResult.status },
                    { label: "ISSUED STATE", value: "TEXAS" },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="flex items-center justify-between py-2.5">
                      <span className="text-xs font-medium text-neutral-500">{r.label}</span>
                      {r.label === "STATUS" ? (
                        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${r.value === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : r.value === "EXPIRED" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-300"}`}>
                          {r.value}
                        </span>
                      ) : (
                        <span className="font-mono text-[13px] font-medium text-white">{r.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result: failed */}
            {licenseResult && !licenseResult.verified && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <X className="size-4 text-red-400" />
                  <span className="text-sm font-bold text-red-400">License Not Found</span>
                </div>
                <p className="mt-2 text-[13px] text-[#7a8f96]">{licenseResult.error || "This license number was not found in the TDLR database. Please check the number and try again."}</p>
                <p className="mt-1 text-xs text-neutral-600">You can look up licenses at tdlr.texas.gov</p>
              </div>
            )}

            {/* Send verification link */}
            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Send Verification Link</p>
              {licenseSendStatus && (
                <p className="mb-2 text-xs font-semibold text-[#7a8f96]">{licenseSendStatus}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSendVerification("sms")}
                  disabled={!licenseModal.phone}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-[13px] font-medium text-[#7a8f96] transition hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Send via SMS
                </button>
                <button
                  type="button"
                  onClick={() => handleSendVerification("email")}
                  disabled={!licenseModal.email}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-[13px] font-medium text-[#7a8f96] transition hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed"
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
