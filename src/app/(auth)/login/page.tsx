"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0d0d0d] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-[#C9A84C]">
          Salon Envy®
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">Management Portal</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-300">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-[#161616] px-3 py-2.5 text-neutral-100 outline-none ring-[#C9A84C]/30 placeholder:text-neutral-500 focus:ring-2"
              placeholder="you@salon.com"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-300">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-[#161616] px-3 py-2.5 text-neutral-100 outline-none ring-[#C9A84C]/30 placeholder:text-neutral-500 focus:ring-2"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#C9A84C] py-2.5 font-medium text-[#0d0d0d] transition hover:bg-[#b89642] disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
