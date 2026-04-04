export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/staff/:path*",
    "/metrics/:path*",
    "/schedule/:path*",
    "/reyna-ai/:path*",
  ]
}
