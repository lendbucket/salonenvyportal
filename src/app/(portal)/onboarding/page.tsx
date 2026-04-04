"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "salonenvy_onboarding_complete";

const locations = [
  {
    id: "cc",
    name: "Corpus Christi",
    address: "5601 S Padre Island Dr STE E, TX 78412",
    phone: "(361) 889-1102",
  },
  {
    id: "sa",
    name: "San Antonio",
    address: "11826 Wurzbach Rd, TX 78230",
    phone: "(210) 660-3339",
  },
];

const roles = [
  {
    id: "OWNER",
    title: "Owner",
    desc: "Full access to locations, staff, and settings.",
  },
  {
    id: "MANAGER",
    title: "Manager",
    desc: "Lead the floor, schedules, and daily operations.",
  },
  {
    id: "STYLIST",
    title: "Stylist",
    desc: "Focus on guests, services, and your book.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      router.replace("/dashboard");
    }
  }, [router]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    router.push("/dashboard");
  }

  function goNext() {
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#0d0d0d] px-4 pb-28 pt-6 md:min-h-[calc(100dvh-3.5rem)] md:pb-8">
      {/* Progress */}
      <div className="mx-auto mb-8 max-w-lg">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                n <= step ? "bg-[#C9A84C]" : "bg-[#2a2a2a]"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-neutral-500">
          Step {step} of 4
        </p>
      </div>

      <div className="relative mx-auto max-w-lg overflow-hidden">
        <div
          className="flex w-[400%] transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${(step - 1) * 25}%)` }}
        >
          {/* Step 1 */}
          <section className="w-1/4 shrink-0 px-1">
            <div className="text-center">
              <div className="mb-4 flex justify-center gap-2 text-4xl text-[#C9A84C]">
                <span>✦</span>
                <span>✂</span>
              </div>
              <h1 className="text-2xl font-bold text-[#C9A84C] md:text-3xl">
                Welcome to Salon Envy® Portal
              </h1>
              <p className="mt-3 text-neutral-400">
                Let&apos;s get you set up in just a few steps
              </p>
              <button
                type="button"
                onClick={goNext}
                className="mt-8 w-full rounded-xl bg-[#C9A84C] py-3 font-semibold text-[#0d0d0d] transition hover:bg-[#b89642]"
              >
                Get Started
              </button>
            </div>
          </section>

          {/* Step 2 */}
          <section className="w-1/4 shrink-0 px-1">
            <h2 className="text-center text-xl font-semibold text-neutral-100">
              Which location are you at?
            </h2>
            <div className="mt-6 flex flex-col gap-4">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setLocationId(loc.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    locationId === loc.id
                      ? "border-[#C9A84C] bg-[#1f1f1f] shadow-[0_0_24px_rgba(201,168,76,0.2)]"
                      : "border-[#2a2a2a] bg-[#161616] hover:border-[#3a3a3a]"
                  }`}
                >
                  <p className="font-semibold text-[#C9A84C]">{loc.name}</p>
                  <p className="mt-1 text-sm text-neutral-400">{loc.address}</p>
                  <p className="text-sm text-neutral-500">{loc.phone}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex-1 rounded-xl border border-[#2a2a2a] py-3 text-neutral-300"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!locationId}
                onClick={goNext}
                className="flex-1 rounded-xl bg-[#C9A84C] py-3 font-semibold text-[#0d0d0d] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </section>

          {/* Step 3 */}
          <section className="w-1/4 shrink-0 px-1">
            <h2 className="text-center text-xl font-semibold text-neutral-100">
              What best describes your role?
            </h2>
            <div className="mt-6 flex flex-col gap-3">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    roleId === r.id
                      ? "border-[#C9A84C] bg-[#1f1f1f] shadow-[0_0_20px_rgba(201,168,76,0.15)]"
                      : "border-[#2a2a2a] bg-[#161616]"
                  }`}
                >
                  <p className="font-semibold text-neutral-100">{r.title}</p>
                  <p className="mt-1 text-sm text-neutral-500">{r.desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex-1 rounded-xl border border-[#2a2a2a] py-3 text-neutral-300"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!roleId}
                onClick={goNext}
                className="flex-1 rounded-xl bg-[#C9A84C] py-3 font-semibold text-[#0d0d0d] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </section>

          {/* Step 4 */}
          <section className="w-1/4 shrink-0 px-1">
            <div className="confetti-wrap relative overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#161616] p-8 text-center">
              <div className="confetti" aria-hidden />
              <p className="text-4xl">🎉</p>
              <h2 className="mt-4 text-xl font-bold text-[#C9A84C]">
                You&apos;re in! Welcome to the team
              </h2>
              <p className="mt-2 text-neutral-400">
                You&apos;re ready to explore the portal.
              </p>
              <button
                type="button"
                onClick={finish}
                className="mt-8 w-full rounded-xl bg-[#C9A84C] py-3 font-semibold text-[#0d0d0d]"
              >
                Go to Dashboard
              </button>
              <Link
                href="/dashboard"
                className="mt-4 block text-sm text-neutral-500 hover:text-neutral-300"
                onClick={() => localStorage.setItem(STORAGE_KEY, "1")}
              >
                Skip for now
              </Link>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .confetti-wrap {
          position: relative;
        }
        .confetti::before,
        .confetti::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
              circle,
              #c9a84c 1px,
              transparent 1px
            ),
            radial-gradient(circle, #8a7333 1px, transparent 1px),
            radial-gradient(circle, #f5d78e 1px, transparent 1px);
          background-size:
            24px 24px,
            32px 32px,
            18px 18px;
          opacity: 0.25;
          animation: drift 8s linear infinite;
          pointer-events: none;
        }
        .confetti::after {
          animation-duration: 12s;
          animation-direction: reverse;
          opacity: 0.15;
        }
        @keyframes drift {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-24px);
          }
        }
      `}</style>
    </div>
  );
}
