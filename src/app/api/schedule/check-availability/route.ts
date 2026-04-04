import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SquareClient, SquareEnvironment } from "square";

const TEST_TEAM_MEMBERS = [
  { id: "TMbc13IBzS8Z43AO", name: "Clarissa Reyna" },
  { id: "TMMJKxeQuMlMW1Dw", name: "Melissa Cruz" },
];

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const square = getSquare();
  const results: Record<string, unknown> = {};

  for (const member of TEST_TEAM_MEMBERS) {
    try {
      // Try to retrieve booking profile for team member
      const bookingProfile = await square.bookings.bulkRetrieveTeamMemberBookingProfiles({
        teamMemberIds: [member.id],
      });
      results[member.name] = {
        teamMemberId: member.id,
        bookingProfile,
        status: "success",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results[member.name] = {
        teamMemberId: member.id,
        error: errorMessage,
        status: "api_error",
        note: "The bookings.bulkRetrieveTeamMemberBookingProfiles method may not be available or the booking profile may not be configured.",
      };
    }
  }

  // Also check what methods are available on square.bookings
  let availableMethods: string[] = [];
  try {
    availableMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(square.bookings)
    ).filter((k) => k !== "constructor");
  } catch {
    availableMethods = ["Could not enumerate methods"];
  }

  return NextResponse.json({
    diagnostic: true,
    message: "Square booking profile diagnostic for test team members",
    availableBookingMethods: availableMethods,
    results,
  });
}
