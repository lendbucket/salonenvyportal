import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  let body: { scheduleId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scheduleId } = body;
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      shifts: {
        include: {
          staffMember: true,
        },
      },
      location: true,
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Build the list of shifts that WOULD be synced
  const syncPlan = schedule.shifts.map((shift) => ({
    shiftId: shift.id,
    staffMemberName: shift.staffMember.fullName,
    staffMemberId: shift.staffMemberId,
    squareTeamMemberId: shift.staffMember.squareTeamMemberId ?? "NOT_LINKED",
    date: shift.date.toISOString().split("T")[0],
    startTime: shift.startTime,
    endTime: shift.endTime,
    isTimeOff: shift.isTimeOff,
    wouldSync: !!shift.staffMember.squareTeamMemberId,
    reason: shift.staffMember.squareTeamMemberId
      ? "Team member has Square ID linked"
      : "No squareTeamMemberId — cannot sync to Square",
  }));

  const syncable = syncPlan.filter((s) => s.wouldSync).length;
  const notSyncable = syncPlan.filter((s) => !s.wouldSync).length;

  return NextResponse.json({
    dryRun: true,
    message: "This is a diagnostic dry run. No Square API calls were made.",
    scheduleId: schedule.id,
    location: schedule.location.name,
    weekStart: schedule.weekStart.toISOString().split("T")[0],
    weekEnd: schedule.weekEnd.toISOString().split("T")[0],
    status: schedule.status,
    summary: {
      totalShifts: syncPlan.length,
      syncable,
      notSyncable,
    },
    shifts: syncPlan,
  });
}
