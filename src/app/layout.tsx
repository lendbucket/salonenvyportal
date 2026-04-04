import type { Metadata } from "next"
import { Inter, Noto_Serif } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-noto-serif",
})

export const metadata: Metadata = {
  title: "Salon Envy® Portal",
  description: "Salon Envy Management Portal",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoSerif.variable}`}
        style={{ backgroundColor: "#07151a", margin: 0 }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
