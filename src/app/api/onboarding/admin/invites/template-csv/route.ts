import { NextResponse } from "next/server"

const TEMPLATE = `firstName,lastName,email,phone,location,role,compensationType,boothRentalAmount,commissionPercent,paymentSchedule,startDate
Maria,Lopez,maria@example.com,5125550100,SA,Stylist,BOOTH_RENTAL,400,0,MONTHLY,2026-06-01
John,Smith,john@example.com,5125550101,CC,Manager,W2_HOURLY,,,BIWEEKLY,2026-06-01`

export async function GET() {
  return new NextResponse(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=bulk-invite-template.csv",
    },
  })
}
