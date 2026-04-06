export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/staff/:path*",
    "/metrics/:path*",
    "/schedule/:path*",
    "/reyna-ai/:path*",
    "/approvals/:path*",
    "/audit-log/:path*",
    "/bonus-triggers/:path*",
    "/service-pricing/:path*",
    "/issue-reports/:path*",
    "/complaints/:path*",
    "/reviews/:path*",
    "/purchase-orders/:path*",
    "/conduct/:path*",
    "/onboarding",
    "/submit-complaint/:path*",
    "/orders/:path*",
    "/alerts/:path*",
    "/profile/:path*",
    "/preferences/:path*",
    "/retention/:path*",
    "/cancellations/:path*",
    "/stylist/:path*",
    "/pos/:path*",
    "/appointments/:path*",
    "/payroll/:path*",
    "/suite/:path*",
  ]
}
