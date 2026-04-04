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

  const inputClass =
    "w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/45 focus:ring-offset-0";

  return (
    <div className="flex min-h-dvh flex-col bg-[#0d0d0d] md:flex-row">
      {/* Left: brand — full-bleed dark + glowing gold */}
      <div className="relative order-1 flex min-h-[42vh] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12 md:order-none md:min-h-0 md:flex-[1.15] md:py-0">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 70% at 50% 38%, rgba(201,168,76,0.28) 0%, rgba(13,13,13,0.4) 55%, #0d0d0d 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] h-[min(55vw,280px)] w-[min(90vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-3xl md:h-72 md:w-[480px]"
          style={{
            background:
              "radial-gradient(circle, rgba(201,168,76,0.35) 0%, rgba(201,168,76,0.06) 50%, transparent 72%)",
          }}
        />
        <div className="relative z-10 max-w-lg text-center">
          <p className="mb-6 text-4xl md:mb-8 md:text-5xl" aria-hidden>
            ✂️
          </p>
          <div
            className="mx-auto inline-block px-1"
            style={{
              filter: "drop-shadow(0 0 40px rgba(201,168,76,0.35)) drop-shadow(0 0 80px rgba(201,168,76,0.15))",
            }}
          >
            <h1 className="bg-gradient-to-b from-[#e4d4a8] via-[#C9A84C] to-[#9a7c32] bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-6xl md:leading-[1.1]">
              Salon Envy<sup className="align-super text-3xl text-[#C9A84C] md:text-4xl">®</sup>
            </h1>
          </div>
          <p className="mx-auto mt-8 max-w-sm text-base leading-relaxed text-neutral-400 md:text-lg">
            Empowering Your Salon. Elevating Your Team.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="order-2 flex w-full flex-1 items-center justify-center bg-[#0d0d0d] px-4 pb-10 pt-4 md:max-w-[min(100%,560px)] md:bg-transparent md:px-8 md:pb-0 md:pt-0">
        <div className="w-full max-w-md rounded-t-3xl border border-b-0 border-[#2a2a2a] bg-[#161616] p-8 shadow-2xl md:rounded-3xl md:border md:shadow-[0_32px_90px_-24px_rgba(0,0,0,0.75)]">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-neutral-500">Sign in to the management portal</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-400">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@salon.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-400">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-[#C9A84C] py-3.5 text-base font-semibold text-[#0d0d0d] shadow-[0_8px_32px_-8px_rgba(201,168,76,0.45)] transition hover:bg-[#b89642] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center">
            <Link href="#" className="text-sm font-medium text-[#C9A84C] underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
