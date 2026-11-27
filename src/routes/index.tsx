import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { joinWaitlist } from "~/lib/waitlist";

export const Route = createFileRoute("/")({
  component: Home,
});

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

/* ---------------------------------- bits ---------------------------------- */

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function Logo({ className = "h-8 w-8", inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${
        inverse ? "bg-white/10" : "bg-slate-900"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden>
        <rect x="4" y="12" width="4" height="8" rx="1.5" fill="#34d399" />
        <rect x="10" y="8" width="4" height="12" rx="1.5" fill="#34d399" />
        <rect x="16" y="4" width="4" height="16" rx="1.5" fill="#10b981" />
      </svg>
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const el = ref.current;
    if (!el) return;
    setShown(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  sub,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  dark?: boolean;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p
        className={`text-xs font-bold uppercase tracking-[0.2em] ${
          dark ? "text-emerald-400" : "text-emerald-600"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl ${
          dark ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      {sub ? (
        <p className={`mt-4 text-base leading-relaxed ${dark ? "text-slate-400" : "text-slate-600"}`}>
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}

/* ---------------------------------- icons --------------------------------- */

function UploadIcon() {
  return (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
  );
}

function ZapIcon() {
  return (
    <Icon>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
  );
}

function FileTextIcon() {
  return (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  );
}

function TargetIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  );
}

function PercentIcon() {
  return (
    <Icon>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </Icon>
  );
}

function ShieldIcon() {
  return (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function PenLineIcon() {
  return (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

function BarChartIcon() {
  return (
    <Icon>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </Icon>
  );
}

function TrendingUpIcon() {
  return (
    <Icon>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Icon>
  );
}

function BriefcaseIcon() {
  return (
    <Icon>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Icon>
  );
}

function GraduationCapIcon() {
  return (
    <Icon>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </Icon>
  );
}

function PieChartIcon() {
  return (
    <Icon>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon className="h-5 w-5">
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  );
}

function ArrowRightIcon() {
  return (
    <Icon className="h-4 w-4">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Icon>
  );
}

/* --------------------------------- hero mock ------------------------------- */

const BARS = [
  { label: "FY2021", h: "52%" },
  { label: "FY2022", h: "62%" },
  { label: "FY2023", h: "73%" },
  { label: "FY2024", h: "87%" },
  { label: "FY25E", h: "100%" },
];

const RATIOS = [
  { k: "Current ratio", v: "1.8" },
  { k: "Debt/Equity", v: "0.62" },
  { k: "ROE", v: "14.2%" },
  { k: "Gross margin", v: "41%" },
];

function ReportMock() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up lg:max-w-none" style={{ animationDelay: "180ms" }}>
      <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-emerald-500/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-black/50 backdrop-blur">
        {/* title bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="ml-2.5 text-xs font-medium text-slate-400">
              FinLens · Sample report
            </span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Illustrative
          </span>
        </div>

        <div className="p-5 sm:p-6">
          {/* company header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-white">Company A</p>
              <p className="text-xs text-slate-500">Consumer goods · FY2024 · India</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
              LOW RISK
            </span>
          </div>

          {/* stat row */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <div className="relative h-12 w-12 shrink-0">
                <svg viewBox="0 0 56 56" className="h-12 w-12 -rotate-90">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="6" />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="51.3 150.8"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">
                  34
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risk score</p>
                <p className="text-xs font-bold text-emerald-300">/100 · Low</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-lg font-extrabold text-white">12.4%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net margin</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-lg font-extrabold text-white">+18.2%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rev. growth</p>
            </div>
          </div>

          {/* chart */}
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-slate-300">Revenue trend</p>
              <p className="text-[10px] text-slate-500">₹ Cr · illustrative</p>
            </div>
            <div className="mt-4 flex h-28 items-end gap-2 sm:gap-4">
              {BARS.map((bar, i) => (
                <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end">
                    <div
                      className="animate-bar w-full rounded-t-md bg-gradient-to-t from-emerald-600/80 to-emerald-400 transition-colors hover:from-emerald-500"
                      style={{ height: bar.h, animationDelay: `${350 + i * 90}ms` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ratio chips */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {RATIOS.map((r) => (
              <div key={r.k} className="rounded-lg border border-white/10 bg-white/5 px-1 py-2 text-center">
                <p className="text-[13px] font-bold text-white">{r.v}</p>
                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">{r.k}</p>
              </div>
            ))}
          </div>

          {/* ai summary */}
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
              <ZapIcon className="h-3.5 w-3.5" /> AI summary
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              &ldquo;Company A grew revenue for the fourth straight year. Margins expanded on
              lower input costs, and debt stays well within comfort.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* floating chips */}
      <div className="absolute -right-3 -top-5 hidden animate-floaty rounded-xl border border-white/10 bg-slate-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 sm:block">
        <p className="text-[10px] font-medium text-slate-400">SWOT analysis</p>
        <p className="text-xs font-bold text-white">12 findings extracted</p>
      </div>
      <div
        className="absolute -left-4 bottom-20 hidden animate-floaty rounded-xl border border-white/10 bg-slate-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 sm:block"
        style={{ animationDelay: "1.4s" }}
      >
        <p className="text-[10px] font-medium text-slate-400">Peer comparison</p>
        <p className="text-xs font-bold text-white">vs 9 sector peers</p>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-500 lg:text-left">
        Sample output with illustrative values — not a real company.
      </p>
    </div>
  );
}

/* ------------------------------- page sections ----------------------------- */

const FEATURES = [
  {
    icon: <TargetIcon />,
    title: "SWOT analysis",
    body: "Strengths, weaknesses, opportunities and threats — drawn from the actual numbers, not boilerplate.",
  },
  {
    icon: <PercentIcon />,
    title: "Financial ratios",
    body: "Liquidity, leverage, profitability and efficiency ratios, each computed and explained in plain terms.",
  },
  {
    icon: <ShieldIcon />,
    title: "Risk score",
    body: "A single 0–100 score that surfaces red flags at a glance — before you invest, lend or approve.",
  },
  {
    icon: <PenLineIcon />,
    title: "AI-written summary",
    body: "A clear, plain-English narrative of the company's financial story and what changed year over year.",
  },
  {
    icon: <UsersIcon />,
    title: "Peer comparison",
    body: "See how the company stacks up against its sector peers across the metrics that matter.",
  },
  {
    icon: <BarChartIcon />,
    title: "Charts & trends",
    body: "Multi-year trends visualised — revenue, margins and cash flow at a glance.",
  },
];

const AUDIENCES = [
  {
    icon: <TrendingUpIcon />,
    title: "Investors",
    body: "Research companies faster and see the risks clearly before you commit capital.",
  },
  {
    icon: <BriefcaseIcon />,
    title: "CA firms",
    body: "Turn statement review into a structured, client-ready report in minutes.",
  },
  {
    icon: <GraduationCapIcon />,
    title: "MBA students",
    body: "Analyse real companies hands-on and watch how the ratios connect to risk.",
  },
  {
    icon: <PieChartIcon />,
    title: "Finance analysts",
    body: "Cut the manual ratio-crunching and focus on the story behind the numbers.",
  },
];

const PRICING_POINTS = [
  "All six report sections on every analysis",
  "AI-written summary in plain English",
  "Peer comparison against sector peers",
  "Works with annual reports, P&L, balance sheet & cash flow",
  "Simple monthly billing — cancel anytime",
  "Priority access the day we launch",
];

function Home() {
  return (
    <>
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">FinLens</span>
          </a>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href="#waitlist"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Join the waitlist
          </a>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="relative overflow-hidden bg-slate-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:56px_56px]"
        />
        <div
          aria-hidden
          className="absolute -top-48 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-32 sm:px-8 sm:pt-36 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-40">
          <div>
            <div
              className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300"
              style={{ animationDelay: "40ms" }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Built for investors, CA firms, MBA students &amp; analysts
            </div>
            <h1
              className="mt-6 animate-fade-up text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]"
              style={{ animationDelay: "120ms" }}
            >
              Turn any company&rsquo;s financial statements into a{" "}
              <span className="text-emerald-400">full analysis</span> in seconds.
            </h1>
            <p
              className="mt-5 max-w-xl animate-fade-up text-base leading-relaxed text-slate-400 sm:text-lg"
              style={{ animationDelay: "200ms" }}
            >
              Upload the annual report, balance sheet, P&amp;L and cash flow. FinLens reads
              them, computes the ratios and risk score, and writes a plain-English
              summary — SWOT, peer comparison and charts included.
            </p>
            <div
              className="mt-8 flex animate-fade-up flex-wrap items-center gap-3"
              style={{ animationDelay: "280ms" }}
            >
              <a
                href="#waitlist"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
              >
                Join the waitlist
                <ArrowRightIcon />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
            <p
              className="mt-6 animate-fade-up text-xs text-slate-500"
              style={{ animationDelay: "360ms" }}
            >
              ₹499/month · One plan · Early access by waitlist
            </p>
          </div>

          <ReportMock />
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="scroll-mt-16 bg-white py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="How it works"
            title="From upload to full report in three steps"
            sub="No templates to fill, no formulas to build. You bring the statements — FinLens does the rest."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: <UploadIcon />,
                step: "01",
                title: "Upload the statements",
                body: "Drop in the annual report, balance sheet, P&L and cash-flow statement. PDF, spreadsheet or scanned — FinLens takes it from there.",
              },
              {
                icon: <ZapIcon />,
                step: "02",
                title: "AI reads & computes",
                body: "Every line item is extracted, then converted into ratios, multi-year trends and a 0–100 risk score automatically.",
              },
              {
                icon: <FileTextIcon />,
                step: "03",
                title: "Get the full report",
                body: "SWOT, an AI-written summary, peer comparison and interactive charts — complete in seconds, ready to share.",
              },
            ].map((step, i) => (
              <Reveal key={step.step} delay={i * 90}>
                <div className="group relative h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/80">
                  <span className="absolute right-6 top-5 text-4xl font-extrabold text-slate-100 transition-colors group-hover:text-emerald-100">
                    {step.step}
                  </span>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                    {step.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* what you get */}
      <section id="features" className="scroll-mt-16 bg-slate-50 py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="What you get"
            title="One upload. Six sections of analysis."
            sub="Every analysis comes back as a complete, structured report — the same shape a senior analyst would deliver."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 80}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-slate-200/70">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* who it's for */}
      <section id="who-its-for" className="scroll-mt-16 bg-white py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Who it's for"
            title="Built for people who live in financial statements"
            sub="Whether it's a portfolio decision, a client engagement or a class assignment — FinLens gives you the analysis, you bring the judgement."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((audience, i) => (
              <Reveal key={audience.title} delay={i * 70}>
                <div className="group h-full rounded-2xl bg-slate-50 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-slate-950">
                    {audience.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900 transition-colors group-hover:text-white">
                    {audience.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 transition-colors group-hover:text-slate-400">
                    {audience.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="scroll-mt-16 bg-slate-50 py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Pricing"
            title="One plan. Everything included."
            sub="No tiers, no add-ons, no surprise fees. If we build it, it's in your plan."
          />
          <Reveal className="mx-auto mt-14 max-w-xl">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 sm:p-10">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                One plan · Everything included
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-slate-900">₹499</span>
                <span className="text-lg font-medium text-slate-500">/month</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                All six report sections on every company you analyse — from a single
                startup to a whole portfolio.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {PRICING_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 shrink-0 text-emerald-600">
                      <CheckIcon />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href="#waitlist"
                className="mt-9 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                Join the waitlist
                <ArrowRightIcon />
              </a>
              <p className="mt-4 text-center text-xs text-slate-400">
                FinLens launches soon — join the waitlist and we&rsquo;ll email you the
                moment it&rsquo;s live.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* waitlist */}
      <section id="waitlist" className="relative scroll-mt-16 overflow-hidden bg-slate-950 py-24 sm:py-28">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:56px_56px]"
        />
        <div
          aria-hidden
          className="absolute -bottom-48 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]"
        />
        <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Waitlist</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Be first in line when FinLens launches.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Leave your email and we&rsquo;ll let you know the moment the analyzer is
              live — one email, nothing else.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-9">
              <WaitlistForm />
            </div>
            <p className="mt-5 text-[11px] text-slate-500">
              We&rsquo;ll only use your email for launch updates. No spam, ever.
            </p>
          </Reveal>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-white/5 bg-slate-950 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo inverse />
            <div>
              <p className="text-base font-extrabold tracking-tight text-white">FinLens</p>
              <p className="text-xs text-slate-500">Financial statement analysis, in seconds.</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-3" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-slate-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <a href="#waitlist" className="text-sm text-slate-400 transition-colors hover:text-white">
              Waitlist
            </a>
          </nav>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} FinLens. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}

/* -------------------------------- waitlist form ---------------------------- */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setState("loading");
    setErrorMsg("");
    try {
      const result = await joinWaitlist({ email: value });
      if (!result.ok) {
        setState("error");
        setErrorMsg(result.error);
        return;
      }
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("Something went wrong — please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="mx-auto flex max-w-lg items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-6 py-5 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
          <CheckIcon />
        </span>
        <div>
          <p className="text-sm font-bold text-white">You&rsquo;re on the list!</p>
          <p className="mt-0.5 text-sm text-emerald-200">
            We&rsquo;ll email you when FinLens launches.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-lg">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:bg-white/10"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "loading" ? "Joining…" : "Join the waitlist"}
          {state !== "loading" && <ArrowRightIcon />}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}