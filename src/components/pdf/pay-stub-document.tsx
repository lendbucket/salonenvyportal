import React from "react"
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

const BASE_URL = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

Font.register({
  family: "Inter",
  fonts: [
    { src: `${BASE_URL}/fonts/Inter-Regular.woff`, fontWeight: 400 },
    { src: `${BASE_URL}/fonts/Inter-Medium.woff`, fontWeight: 500 },
    { src: `${BASE_URL}/fonts/Inter-SemiBold.woff`, fontWeight: 600 },
    { src: `${BASE_URL}/fonts/Inter-Bold.woff`, fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Inter", fontSize: 10, color: "#1A1313" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(26,19,19,0.08)" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 8, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" },
  badgePaid: { backgroundColor: "#dcfce7", color: "#15803d" },
  badgePending: { backgroundColor: "#fef9c3", color: "#a16207" },
  infoGrid: { flexDirection: "row", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(26,19,19,0.08)" },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 8, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 11, fontWeight: 500 },
  sectionTitle: { fontSize: 9, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(26,19,19,0.04)" },
  tableLabel: { fontSize: 10, color: "#1A1313" },
  tableValue: { fontSize: 10, color: "#1A1313", textAlign: "right" },
  grossRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(26,19,19,0.08)" },
  grossLabel: { fontSize: 12, fontWeight: 700, color: "#7a8f96" },
  grossValue: { fontSize: 12, fontWeight: 700, color: "#7a8f96" },
  netPaySection: { alignItems: "center", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(26,19,19,0.08)" },
  netPayLabel: { fontSize: 8, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  netPayValue: { fontSize: 28, fontWeight: 700, color: "#7a8f96" },
  footer: { position: "absolute", bottom: 48, left: 48, right: 48, textAlign: "center", fontSize: 8, color: "#999" },
})

export interface PayStubPDFData {
  periodId: string
  periodStart: string
  periodEnd: string
  status: string
  stylistName: string
  stylistEmail: string | null
  locationName: string
  serviceCount: number
  serviceSubtotal: number
  commission: number
  tips: number
  totalPayout: number
}

function formatPeriodDates(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }
  return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

export function PayStubDocument({ data }: { data: PayStubPDFData }) {
  const isPaid = data.status === "paid"
  const grossPay = data.commission + data.tips

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>SALON ENVY</Text>
            <Text style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Pay Stub</Text>
            <Text style={styles.subtitle}>{formatPeriodDates(data.periodStart, data.periodEnd)}</Text>
          </View>
          <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
            <Text>{isPaid ? "PAID" : "PENDING"}</Text>
          </View>
        </View>

        {/* Stylist Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{data.stylistName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{data.locationName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{data.stylistEmail || "-"}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Period ID</Text>
            <Text style={{ fontSize: 9, color: "#999" }}>{data.periodId.slice(0, 12)}</Text>
          </View>
        </View>

        {/* Earnings */}
        <Text style={styles.sectionTitle}>Earnings</Text>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Service Revenue ({data.serviceCount} services)</Text>
          <Text style={styles.tableValue}>{formatCurrency(data.serviceSubtotal)}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Commission Rate</Text>
          <Text style={styles.tableValue}>40%</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableLabel, { color: "#15803d", fontWeight: 500 }]}>Gross Commission</Text>
          <Text style={[styles.tableValue, { color: "#15803d", fontWeight: 600 }]}>{formatCurrency(data.commission)}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableLabel, { color: "#a16207", fontWeight: 500 }]}>Tips Passthrough</Text>
          <Text style={[styles.tableValue, { color: "#a16207", fontWeight: 600 }]}>{formatCurrency(data.tips)}</Text>
        </View>
        <View style={styles.grossRow}>
          <Text style={styles.grossLabel}>Gross Pay</Text>
          <Text style={styles.grossValue}>{formatCurrency(grossPay)}</Text>
        </View>

        {/* Deductions */}
        <View style={{ marginTop: 20, marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          <Text style={{ fontSize: 9, color: "#999" }}>No deductions</Text>
        </View>

        {/* Net Pay */}
        <View style={styles.netPaySection}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={styles.netPayValue}>{formatCurrency(grossPay)}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Salon Envy USA LLC {"\u2022"} Period {data.periodId.slice(0, 8)} {"\u2022"} Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </Text>
      </Page>
    </Document>
  )
}
