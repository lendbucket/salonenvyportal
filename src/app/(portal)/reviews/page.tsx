"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

/* ── Types ── */
type Review = {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  photoUrl: string;
};

type LocationData = {
  location: string;
  label: string;
  rating: number;
  totalReviews: number;
  formattedAddress: string;
  reviews: Review[];
  reviewUrl: string;
  googleMapsUrl: string;
};

/* ── Constants ── */
const STAR_COLOR = "#F59E0B";
const CARD_BG = "#0d1117";
const ACCENT = "#CDC9C0";
const TIPS = [
  { icon: "qr_code_2", title: "Table Cards", desc: "Place QR codes at each station linking to your Google review page." },
  { icon: "sms", title: "Follow-up Texts", desc: "Send a thank-you text with a review link 2 hours after each appointment." },
  { icon: "redeem", title: "Incentivize Staff", desc: "Reward stylists whose clients leave the most reviews each month." },
  { icon: "reply", title: "Respond to All", desc: "Reply to every review, positive or negative, to show you care." },
];

/* ── Google Logo SVG ── */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

/* ── Helpers ── */
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: "1px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="material-symbols-outlined"
          style={{
            fontSize: `${size}px`,
            color: i <= Math.round(rating) ? STAR_COLOR : "rgba(205,201,192,0.2)",
          }}
        >
          star
        </span>
      ))}
    </span>
  );
}

function RatingBars({ reviews }: { reviews: Review[] }) {
  const counts = [5, 4, 3, 2, 1].map((r) => reviews.filter((rv) => rv.rating === r).length);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {[5, 4, 3, 2, 1].map((r, i) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
          <span style={{ width: "12px", textAlign: "right", color: "rgba(205,201,192,0.6)" }}>{r}</span>
          <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.1)" }}>
            <div
              style={{
                width: `${(counts[i] / max) * 100}%`,
                height: "100%",
                borderRadius: "3px",
                backgroundColor: STAR_COLOR,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span style={{ width: "20px", color: "rgba(205,201,192,0.4)", fontSize: "10px" }}>{counts[i]}</span>
        </div>
      ))}
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

/* ── Main Page ── */
export default function ReviewsPage() {
  const { isOwner, isManager, locationName } = useUserRole();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Determine default location for managers */
  const defaultLoc = useMemo(() => {
    if (isManager && locationName) {
      if (locationName.toLowerCase().includes("corpus") || locationName.toLowerCase().includes("cc")) return "CC";
      if (locationName.toLowerCase().includes("san antonio") || locationName.toLowerCase().includes("sa")) return "SA";
    }
    return "ALL";
  }, [isManager, locationName]);

  useEffect(() => {
    setSelectedLocation(defaultLoc);
  }, [defaultLoc]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const param = selectedLocation !== "ALL" ? `?location=${selectedLocation}` : "";
      const res = await fetch(`/api/reviews${param}`);
      const data = await res.json();
      setLocations(data.locations || []);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  /* Combined reviews */
  const allReviews = useMemo(() => {
    const combined = locations.flatMap((loc) =>
      loc.reviews.map((r) => ({ ...r, locationKey: loc.location, locationLabel: loc.label })),
    );
    if (ratingFilter !== null) return combined.filter((r) => r.rating === ratingFilter);
    return combined;
  }, [locations, ratingFilter]);

  /* Overall stats */
  const overallRating = useMemo(() => {
    if (locations.length === 0) return 0;
    const total = locations.reduce((s, l) => s + l.rating * l.totalReviews, 0);
    const count = locations.reduce((s, l) => s + l.totalReviews, 0);
    return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
  }, [locations]);

  const overallCount = useMemo(() => locations.reduce((s, l) => s + l.totalReviews, 0), [locations]);

  function handleCopy(text: string, id: string) {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  /* ── Render ── */
  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#FFFFFF", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <GoogleLogo size={24} />
            Reviews
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(205,201,192,0.5)", margin: "4px 0 0" }}>Google Places ratings and customer feedback</p>
        </div>
        {isOwner && (
          <div style={{ display: "flex", gap: "6px" }}>
            {["ALL", "CC", "SA"].map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: `1px solid ${selectedLocation === loc ? ACCENT : "rgba(205,201,192,0.15)"}`,
                  backgroundColor: selectedLocation === loc ? "rgba(205,201,192,0.1)" : "transparent",
                  color: selectedLocation === loc ? ACCENT : "rgba(205,201,192,0.5)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {loc === "ALL" ? "Both" : loc === "CC" ? "Corpus Christi" : "San Antonio"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(205,201,192,0.4)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", animation: "spin 1s linear infinite" }}>progress_activity</span>
          <p style={{ marginTop: "8px", fontSize: "13px" }}>Loading reviews...</p>
        </div>
      ) : (
        <>
          {/* Overall stats bar (when showing both) */}
          {locations.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                padding: "16px 20px",
                backgroundColor: CARD_BG,
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "20px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF" }}>{overallRating}</span>
                <Stars rating={overallRating} size={18} />
              </div>
              <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.5)" }}>
                <span style={{ fontWeight: 700, color: ACCENT }}>{overallCount.toLocaleString()}</span> total reviews across all locations
              </div>
            </div>
          )}

          {/* Location cards */}
          <div style={{ display: "grid", gridTemplateColumns: locations.length > 1 ? "repeat(auto-fit, minmax(340px, 1fr))" : "1fr", gap: "16px", marginBottom: "28px" }}>
            {locations.map((loc) => (
              <div
                key={loc.location}
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                      {loc.label}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontSize: "36px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{loc.rating}</span>
                      <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.4)" }}>/ 5</span>
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <Stars rating={loc.rating} size={16} />
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.45)", marginTop: "4px" }}>
                      {loc.totalReviews.toLocaleString()} reviews
                    </div>
                  </div>
                  <GoogleLogo size={28} />
                </div>

                {/* Rating distribution */}
                <RatingBars reviews={loc.reviews} />

                {/* Share buttons */}
                <div style={{ display: "flex", gap: "6px", marginTop: "16px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleCopy(loc.reviewUrl, `link-${loc.location}`)}
                    style={{
                      flex: 1,
                      minWidth: "100px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      backgroundColor: "rgba(205,201,192,0.06)",
                      color: copiedId === `link-${loc.location}` ? "#22c55e" : "rgba(205,201,192,0.6)",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      {copiedId === `link-${loc.location}` ? "check" : "content_copy"}
                    </span>
                    {copiedId === `link-${loc.location}` ? "Copied!" : "Review Link"}
                  </button>
                  <a
                    href={`sms:?body=We'd love your feedback! Leave us a review: ${loc.reviewUrl}`}
                    style={{
                      flex: 1,
                      minWidth: "80px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      backgroundColor: "rgba(205,201,192,0.06)",
                      color: "rgba(205,201,192,0.6)",
                      fontSize: "10px",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>sms</span>
                    SMS
                  </a>
                  <a
                    href={loc.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: "80px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      backgroundColor: "rgba(205,201,192,0.06)",
                      color: "rgba(205,201,192,0.6)",
                      fontSize: "10px",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>map</span>
                    Maps
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Rating filter pills */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
            {[null, 5, 4, 3, 2, 1].map((r) => (
              <button
                key={r ?? "all"}
                onClick={() => setRatingFilter(r)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: `1px solid ${ratingFilter === r ? STAR_COLOR : "rgba(255,255,255,0.06)"}`,
                  backgroundColor: ratingFilter === r ? "rgba(245,158,11,0.12)" : "transparent",
                  color: ratingFilter === r ? STAR_COLOR : "rgba(205,201,192,0.5)",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {r === null ? (
                  "All"
                ) : (
                  <>
                    {r}
                    <span className="material-symbols-outlined" style={{ fontSize: "13px", color: STAR_COLOR }}>star</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Reviews feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
            {allReviews.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(205,201,192,0.35)", fontSize: "13px" }}>
                No reviews found{ratingFilter !== null ? ` with ${ratingFilter}-star rating` : ""}.
              </div>
            )}
            {allReviews.map((review, idx) => (
              <div
                key={`${review.authorName}-${idx}`}
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  {/* Author photo or initial */}
                  {review.photoUrl ? (
                    <img
                      src={review.photoUrl}
                      alt={review.authorName}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "rgba(205,201,192,0.1)",
                        border: "1px solid rgba(205,201,192,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: ACCENT,
                        fontSize: "14px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {review.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{review.authorName}</span>
                      {locations.length > 1 && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: "rgba(205,201,192,0.5)",
                          }}
                        >
                          {review.locationLabel}
                        </span>
                      )}
                      {review.rating <= 3 && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(239,68,68,0.12)",
                            color: "#EF4444",
                          }}
                        >
                          Needs Response
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                      <Stars rating={review.rating} size={13} />
                      <span style={{ fontSize: "11px", color: "rgba(205,201,192,0.35)" }}>{review.relativeTime}</span>
                    </div>
                  </div>
                </div>
                {review.text && (
                  <p style={{ fontSize: "13px", lineHeight: "1.6", color: "rgba(205,201,192,0.7)", margin: 0 }}>{review.text}</p>
                )}
              </div>
            ))}
          </div>

          {/* Tips section */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: STAR_COLOR }}>lightbulb</span>
              How to Get More Reviews
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {TIPS.map((tip) => (
                <div
                  key={tip.title}
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    padding: "16px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "22px", color: ACCENT, flexShrink: 0, marginTop: "1px" }}
                  >
                    {tip.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>{tip.title}</div>
                    <div style={{ fontSize: "12px", lineHeight: "1.5", color: "rgba(205,201,192,0.5)" }}>{tip.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
