"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#07151a] md:flex-row">
      {/* Google Fonts for Material Symbols */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap" />

      {/* Left: brand */}
      <div className="relative order-1 flex min-h-[42vh] flex-1 flex-col items-center justify-center overflow-hidden bg-[#142127] px-6 py-12 md:order-none md:min-h-0 md:flex-[1.15] md:py-0">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 70% at 50% 38%, rgba(205,201,192,0.12) 0%, rgba(7,21,26,0.4) 55%, #07151a 100%)",
          }}
        />
        <div className="relative z-10 max-w-lg text-center space-y-8">
          <div
            className="mx-auto inline-block"
            style={{
              filter: "drop-shadow(0 0 40px rgba(205,201,192,0.2)) drop-shadow(0 0 80px rgba(205,201,192,0.08))",
            }}
          >
            <img
              src="/images/logo-white.png"
              alt="Salon Envy®"
              style={{ width: "200px", height: "auto", objectFit: "contain" }}
            />
          </div>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-[#CDC9C0]/60 italic font-[var(--font-noto-serif)] md:text-lg">
            Empowering Your Salon. Elevating Your Team.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="order-2 flex w-full flex-1 items-center justify-center bg-[#07151a] px-4 pb-10 pt-4 md:max-w-[min(100%,560px)] md:px-8 md:pb-0 md:pt-0">
        <div className="w-full max-w-md rounded-t-3xl border border-b-0 border-[rgba(205,201,192,0.15)] bg-[#1f2c31] p-8 shadow-2xl md:rounded-3xl md:border md:shadow-[0_32px_90px_-24px_rgba(0,0,0,0.75)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[#e9e5dc]">Welcome back</h2>
          <p className="mt-1 text-sm text-[#CDC9C0]/50">Sign in to the management portal</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#CDC9C0]/70">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@salon.com"
                className="w-full rounded-xl border border-[rgba(205,201,192,0.2)] bg-[#142127] px-4 py-3 text-[#e9e5dc] outline-none transition placeholder:text-[#CDC9C0]/30 focus:border-[#CDC9C0] focus:ring-2 focus:ring-[#CDC9C0]/30 focus:ring-offset-0"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#CDC9C0]/70">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[rgba(205,201,192,0.2)] bg-[#142127] px-4 py-3 text-[#e9e5dc] outline-none transition placeholder:text-[#CDC9C0]/30 focus:border-[#CDC9C0] focus:ring-2 focus:ring-[#CDC9C0]/30 focus:ring-offset-0"
              />
            </div>
            {error ? <p className="text-sm text-[#ffb4ab]">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-[#CDC9C0] py-3.5 text-base font-semibold text-[#1a1a1a] shadow-[0_8px_32px_-8px_rgba(205,201,192,0.35)] transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center">
            <Link href="#" className="text-sm font-medium text-[#CDC9C0] underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
