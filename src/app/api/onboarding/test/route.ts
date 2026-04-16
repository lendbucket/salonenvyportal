import { NextResponse } from "next/server";

export async function GET() {
  console.log("[onboarding-test] Test endpoint hit at", new Date().toISOString());
  return NextResponse.json({
    status: "onboarding API working",
    time: new Date().toISOString(),
    squareTokenPresent: !!process.env.SQUARE_ACCESS_TOKEN,
    squareTokenLength: process.env.SQUARE_ACCESS_TOKEN?.length || 0,
  });
}
