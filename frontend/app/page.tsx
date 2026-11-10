"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCommitIcon,
  FireIcon,
  StarIcon,
  SourceCodeIcon,
  Download01Icon,
  SparklesIcon,
  Search01Icon,
  AlertCircleIcon,
  Loading03Icon,
  Tick01Icon as Check,
  Moon02Icon as Moon,
  Sun02Icon as Sunrise,
  Award01Icon as Trophy,
  Link02Icon as Link2,
  GitPullRequestIcon as GitPullRequest,
  FlashIcon as Zap,
  Rocket01Icon as Rocket,
  Calendar03Icon as CalendarDays,
  PaintBoardIcon as Palette,
  FireIcon as Flame,
  CodeIcon as Code2,
  UserGroupIcon as Users,
  MagicWand01Icon as Wand2,
} from "hugeicons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface LanguageItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface WrappedData {
  name: string;
  login: string;
  avatar: string;
  year: number;
  persona?: string;
  tagline?: string;
  percentile?: number;
  public_repos?: number;
  total_repos?: number;
  followers?: number;
  total_stars?: number;
  stars?: number;
  total_contributions?: number;
  commits?: number;
  pull_requests?: number;
  issues?: number;
  longest_streak?: number;
  active_days?: number;
  busiest_day?: string;
  top_languages?: string[];
  languages_breakdown?: LanguageItem[];
  top_repo?: string | null;
  /** Optional: 24 numbers, activity per hour of day (0 = 12 AM) */
  hourly_activity?: number[];
  /** Optional: daily contribution counts, oldest first (last 182 days used) */
  calendar?: number[];
}

interface Theme {
  id: string;
  name: string;
  bg: string;
  accent: string;
  accent2: string;
  accent3: string;
  gold: string;
  glowA: string;
  glowB: string;
  onAccent: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SAMPLE_USERS = ["torvalds", "shadcn", "leerob", "octocat"];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];
const CARD_WIDTH = 480;
const RECENT_KEY = "gw:recent";

const THEMES: Theme[] = [
  {
    id: "neon",
    name: "Neon",
    bg: "#09060F",
    accent: "#FF2E93",
    accent2: "#9B5CFF",
    accent3: "#00F5D4",
    gold: "#FFD166",
    glowA: "rgba(255,46,147,0.30)",
    glowB: "rgba(155,92,255,0.26)",
    onAccent: "#1A0410",
  },
  {
    id: "mint",
    name: "Mint",
    bg: "#050D0A",
    accent: "#3DDC97",
    accent2: "#22D3EE",
    accent3: "#A3E635",
    gold: "#FFD166",
    glowA: "rgba(61,220,151,0.26)",
    glowB: "rgba(34,211,238,0.20)",
    onAccent: "#03150C",
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "#0F0806",
    accent: "#FF8A4C",
    accent2: "#FF4D6D",
    accent3: "#FFD166",
    gold: "#FFE08A",
    glowA: "rgba(255,138,76,0.28)",
    glowB: "rgba(255,77,109,0.22)",
    onAccent: "#1F0B02",
  },
  {
    id: "ocean",
    name: "Ocean",
    bg: "#050A14",
    accent: "#60A5FA",
    accent2: "#A78BFA",
    accent3: "#22D3EE",
    gold: "#FFD166",
    glowA: "rgba(96,165,250,0.28)",
    glowB: "rgba(167,139,250,0.22)",
    onAccent: "#04102A",
  },
];

const VIBRANT_LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3FB6FF",
  HTML: "#FF5722",
  CSS: "#9B5CFF",
  Rust: "#FF8A00",
  Go: "#00E5FF",
  "C++": "#FF2E93",
  Java: "#F89820",
  Shell: "#89E051",
};

const LOADING_MESSAGES = [
  "Fetching your repositories...",
  "Counting commits and stars...",
  "Finding your peak hour...",
  "Picking your coding persona...",
  "Rendering your card...",
];

const FALLBACK_LANGUAGES: LanguageItem[] = [
  { name: "TypeScript", count: 8, percentage: 42.1, color: "#3178C6" },
  { name: "JavaScript", count: 7, percentage: 36.8, color: "#F7DF1E" },
  { name: "Python", count: 2, percentage: 10.5, color: "#3FB6FF" },
  { name: "HTML", count: 1, percentage: 10.6, color: "#FF5722" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fmtHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${suffix}`;
}

function estimatePercentile(d: WrappedData): number {
  if (typeof d.percentile === "number") return d.percentile;
  const score =
    (d.total_contributions ?? 0) +
    (d.longest_streak ?? 0) * 12 +
    (d.total_stars ?? d.stars ?? 0) * 6 +
    (d.pull_requests ?? 0) * 4;
  if (score >= 8000) return 1;
  if (score >= 4000) return 3;
  if (score >= 2500) return 6;
  if (score >= 1200) return 10;
  if (score >= 600) return 20;
  if (score >= 250) return 35;
  return 60;
}

interface Persona {
  title: string;
  tagline: string;
  Icon: React.ComponentType<{ size?: number | string; color?: string; className?: string }>;
}

function derivePersona(d: WrappedData, topLang: string): Persona {
  const peak =
    d.hourly_activity && d.hourly_activity.length === 24
      ? d.hourly_activity.indexOf(Math.max(...d.hourly_activity))
      : null;
  const streak = d.longest_streak ?? 0;
  const prs = d.pull_requests ?? 0;
  const commits = d.commits ?? 0;
  const weekend = d.busiest_day === "Saturday" || d.busiest_day === "Sunday";

  if (d.persona) {
    return {
      title: d.persona,
      tagline: d.tagline ?? "Your year, your style.",
      Icon: Zap,
    };
  }
  if (peak !== null && (peak >= 22 || peak <= 4)) {
    return {
      title: "The night owl",
      tagline: "Ships best after dark. Sleep is a suggestion.",
      Icon: Moon,
    };
  }
  if (peak !== null && peak >= 5 && peak <= 8) {
    return {
      title: "The early bird",
      tagline: "Merged a PR before most people woke up.",
      Icon: Sunrise,
    };
  }
  if (streak >= 30) {
    return {
      title: "The streak machine",
      tagline: `${streak} days in a row. The graph stays green.`,
      Icon: Flame,
    };
  }
  if (weekend) {
    return {
      title: "The weekend warrior",
      tagline: "Side projects don't build themselves.",
      Icon: Rocket,
    };
  }
  if (commits > 0 && prs / commits > 0.25) {
    return {
      title: "The PR machine",
      tagline: "Small changes, reviewed and merged. Clean.",
      Icon: GitPullRequest,
    };
  }
  return {
    title: `The ${topLang} crafter`,
    tagline: "Steady work, one commit at a time.",
    Icon: Code2,
  };
}

interface BadgeDef {
  label: string;
  Icon: React.ComponentType<{ size?: number | string; color?: string; className?: string }>;
  color: (t: Theme) => string;
}

function deriveBadges(d: WrappedData): BadgeDef[] {
  const out: BadgeDef[] = [];
  const stars = d.total_stars ?? d.stars ?? 0;
  if ((d.longest_streak ?? 0) >= 30)
    out.push({ label: "Streak master", Icon: Flame, color: (t) => t.accent3 });
  if (d.busiest_day === "Saturday" || d.busiest_day === "Sunday")
    out.push({ label: "Weekend warrior", Icon: Rocket, color: (t) => t.accent2 });
  if ((d.pull_requests ?? 0) >= 50)
    out.push({ label: "PR machine", Icon: GitPullRequest, color: (t) => t.accent });
  if (stars >= 100)
    out.push({ label: "Star collector", Icon: Trophy, color: (t) => t.gold });
  if ((d.followers ?? 0) >= 100)
    out.push({ label: "Community voice", Icon: Users, color: (t) => t.accent3 });
  if ((d.active_days ?? 0) >= 200)
    out.push({ label: "Daily driver", Icon: CalendarDays, color: (t) => t.accent2 });
  if ((d.total_contributions ?? 0) >= 1000 && out.length < 3)
    out.push({ label: "1K club", Icon: Zap, color: (t) => t.accent });
  if (out.length === 0)
    out.push({ label: "Just getting started", Icon: Wand2, color: (t) => t.accent });
  return out.slice(0, 3);
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Wrapped card (this is the element that gets exported as PNG)               */
/* -------------------------------------------------------------------------- */

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 18,
};

const WrappedCard = forwardRef<
  HTMLDivElement,
  { data: WrappedData; theme: Theme; year: number }
>(function WrappedCard({ data, theme, year }, ref) {
  const languages: LanguageItem[] =
    data.languages_breakdown && data.languages_breakdown.length > 0
      ? data.languages_breakdown.map((l) => ({
        ...l,
        color: VIBRANT_LANG_COLORS[l.name] || l.color || theme.accent3,
      }))
      : FALLBACK_LANGUAGES;

  const topLanguageName = languages[0]?.name || "TypeScript";
  const persona = derivePersona(data, topLanguageName);
  const badges = deriveBadges(data);
  const percentile = estimatePercentile(data);
  const total = data.total_contributions ?? 0;
  const countedTotal = useCountUp(total);
  const stars = data.total_stars ?? data.stars ?? 0;

  const hours =
    data.hourly_activity && data.hourly_activity.length === 24
      ? data.hourly_activity
      : null;
  const maxHour = hours ? Math.max(...hours, 1) : 1;
  const peakHour = hours ? hours.indexOf(Math.max(...hours)) : null;

  const heat = useMemo(() => {
    if (!data.calendar || data.calendar.length === 0) return null;
    const days = data.calendar.slice(-182);
    const padded = Array(182 - days.length).fill(0).concat(days);
    const max = Math.max(...padded, 1);
    return padded.map((c: number) => (c === 0 ? 0 : Math.ceil((c / max) * 4)));
  }, [data.calendar]);

  const PersonaIcon = persona.Icon;
  const heatOpacity = [0, 0.28, 0.5, 0.75, 1];

  return (
    <div
      ref={ref}
      style={{
        width: CARD_WIDTH,
        padding: 28,
        borderRadius: 28,
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(circle at 0% 0%, ${theme.glowA}, transparent 55%), radial-gradient(circle at 100% 100%, ${theme.glowB}, transparent 55%), ${theme.bg}`,
        border: `1px solid ${theme.accent}40`,
        color: "#fff",
        fontFamily: "inherit",
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            fontSize: 11,
            color: "rgba(255,255,255,0.78)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: theme.accent,
              display: "inline-block",
            }}
          />
          GitHub Wrapped · {year}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 999,
            background: theme.accent,
            color: theme.onAccent,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Trophy size={13} color={theme.onAccent} />
          {percentile <= 35 ? `Top ${percentile}% of developers` : "Rising developer"}
        </div>
      </div>

      {/* Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.avatar}
          alt={data.name}
          crossOrigin="anonymous"
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            objectFit: "cover",
            border: `2px solid ${theme.accent}`,
            padding: 2,
            background: "#0b0b10",
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 340,
            }}
          >
            {data.name}
          </div>
          <div style={{ fontSize: 13, color: theme.accent, fontWeight: 500 }}>
            @{data.login}
          </div>
        </div>
      </div>

      {/* Hero number */}
      <div style={{ marginTop: 26 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {countedTotal.toLocaleString()}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 500,
          }}
        >
          contributions in {year}
          {data.active_days ? ` · ${data.active_days} active days` : ""}
        </div>
      </div>

      {/* Persona */}
      <div
        style={{
          ...glass,
          marginTop: 20,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          border: `1px solid ${theme.accent}55`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: `${theme.accent}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PersonaIcon size={22} color={theme.accent} />
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
            }}
          >
            Your coding persona
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: theme.accent,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {persona.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.72)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {persona.tagline}
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <StatTile
          icon={<GitCommitIcon width={16} height={16} color={theme.accent} />}
          label="Commits"
          value={(data.commits ?? 0).toLocaleString()}
          color={theme.accent}
        />
        <StatTile
          icon={<FireIcon width={16} height={16} color={theme.accent3} />}
          label="Longest streak"
          value={`${data.longest_streak ?? 0}d`}
          color={theme.accent3}
        />
        <StatTile
          icon={<StarIcon width={16} height={16} color={theme.gold} />}
          label="Stars earned"
          value={stars.toLocaleString()}
          color={theme.gold}
        />
      </div>

      {/* Busiest day + top repo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 10,
        }}
      >
        <div style={{ ...glass, padding: "12px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
            }}
          >
            <CalendarDays size={13} color={theme.accent2} />
            Busiest day
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>
            {data.busiest_day ?? "-"}
          </div>
        </div>
        <div style={{ ...glass, padding: "12px 14px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
            }}
          >
            <Rocket size={13} color={theme.accent2} />
            Top repo
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              marginTop: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.top_repo ?? "-"}
          </div>
        </div>
      </div>

      {/* Peak hour chart (only when backend sends hourly_activity) */}
      {hours && peakHour !== null && (
        <div style={{ ...glass, padding: "14px 16px", marginTop: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 500,
              }}
            >
              Activity by hour
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>
              Peak: {fmtHour(peakHour)}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(24, 1fr)",
              gap: 3,
              alignItems: "end",
              height: 54,
            }}
          >
            {hours.map((h, i) => (
              <div
                key={i}
                style={{
                  height: `${Math.max((h / maxHour) * 100, 6)}%`,
                  borderRadius: 3,
                  background: i === peakHour ? theme.accent : theme.accent2,
                  opacity: i === peakHour ? 1 : 0.4,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              marginTop: 6,
            }}
          >
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>
      )}

      {/* Core stack */}
      <div style={{ ...glass, padding: 16, marginTop: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
            }}
          >
            <SourceCodeIcon width={14} height={14} color={theme.accent} />
            Core stack
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>
            Top: {topLanguageName}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            height: 10,
            borderRadius: 999,
            overflow: "hidden",
            gap: 2,
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {languages.map((l, i) => (
            <div
              key={i}
              style={{
                width: `${Math.max(l.percentage, 5)}%`,
                background: l.color,
                height: "100%",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 14px",
            marginTop: 10,
            fontSize: 12,
          }}
        >
          {languages.slice(0, 3).map((l, i) => (
            <span
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: l.color,
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 600 }}>{l.name}</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                {l.percentage}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Badges unlocked
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {badges.map((b, i) => (
            <span
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <b.Icon size={14} color={b.color(theme)} />
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Heatmap (only when backend sends calendar) */}
      {heat && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: "repeat(7, 1fr)",
            gridAutoFlow: "column",
            gridAutoColumns: "1fr",
            gap: 3,
            marginTop: 18,
          }}
        >
          {heat.map((lvl: number, i: number) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                borderRadius: 2,
                background: lvl === 0 ? "rgba(255,255,255,0.06)" : theme.accent,
                opacity: lvl === 0 ? 1 : heatOpacity[lvl],
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <span style={{ color: theme.accent, fontWeight: 600 }}>
          github-wrapped.dev
        </span>
        <span>{year} edition</span>
      </div>
    </div>
  );
});

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{ ...glass, padding: "12px 14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 500,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color,
          marginTop: 4,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preview wrapper: scales the fixed-size card down on small screens          */
/*  (the export always uses the real, unscaled card)                           */
/* -------------------------------------------------------------------------- */

function ScaledPreview({
  cardRef,
  children,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [cardHeight, setCardHeight] = useState(820);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / CARD_WIDTH));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    setCardHeight(card.offsetHeight);
    const ro = new ResizeObserver(() => setCardHeight(card.offsetHeight));
    ro.observe(card);
    return () => ro.disconnect();
  }, [cardRef]);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: CARD_WIDTH * scale,
          height: cardHeight * scale,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: CARD_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading skeleton (same shape as the real card)                             */
/* -------------------------------------------------------------------------- */

function CardSkeleton({ message }: { message: string }) {
  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="w-full max-w-[480px] rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-7 space-y-5 animate-pulse">
        <div className="flex justify-between">
          <div className="h-6 w-36 rounded-full bg-zinc-800" />
          <div className="h-6 w-28 rounded-full bg-zinc-800" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-zinc-800" />
            <div className="h-3 w-24 rounded bg-zinc-800" />
          </div>
        </div>
        <div className="h-16 w-48 rounded-xl bg-zinc-800" />
        <div className="h-20 w-full rounded-2xl bg-zinc-900" />
        <div className="grid grid-cols-3 gap-2.5">
          <div className="h-20 rounded-2xl bg-zinc-900" />
          <div className="h-20 rounded-2xl bg-zinc-900" />
          <div className="h-20 rounded-2xl bg-zinc-900" />
        </div>
        <div className="h-24 w-full rounded-2xl bg-zinc-900" />
      </div>
      <p
        className="text-xs text-zinc-400 flex items-center gap-2"
        aria-live="polite"
      >
        <Loading03Icon className="w-3.5 h-3.5 animate-spin" />
        {message}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const [username, setUsername] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(YEARS[0]);
  const [data, setData] = useState<WrappedData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [themeId, setThemeId] = useState("neon");
  const [recent, setRecent] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  /* Keyboard shortcut for "/" search focus */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* Rotate loading messages */
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, LOADING_MESSAGES.length - 1)),
      1100
    );
    return () => clearInterval(id);
  }, [loading]);

  const saveRecent = useCallback((login: string) => {
    try {
      const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const next = [login, ...prev.filter((u) => u.toLowerCase() !== login.toLowerCase())].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const handleGenerate = useCallback(
    async (targetUser?: string, yearToFetch?: number) => {
      const userToQuery = (targetUser ?? username).trim().replace(/^@/, "");
      if (!userToQuery) {
        setError("Enter a GitHub username to get started.");
        inputRef.current?.focus();
        return;
      }

      const yearQuery = yearToFetch ?? selectedYear;
      setLoading(true);
      setError("");
      setData(null);

      try {
        const res = await fetch(
          `${API_URL}/api/wrapped/${encodeURIComponent(userToQuery)}?year=${yearQuery}`
        );

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`We couldn't find "${userToQuery}" on GitHub. Check the spelling and try again.`);
          }
          if (res.status === 403 || res.status === 429) {
            throw new Error("GitHub rate limit reached. Wait a minute and try again.");
          }
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || `Server error (status ${res.status}).`);
        }

        const result: WrappedData = await res.json();
        setData(result);
        saveRecent(result.login || userToQuery);

        const params = new URLSearchParams({ u: result.login || userToQuery, y: String(yearQuery) });
        window.history.replaceState(null, "", `?${params.toString()}`);
      } catch (e: unknown) {
        if (e instanceof TypeError) {
          setError(`Can't reach the backend at ${API_URL}. Is Uvicorn running?`);
        } else if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Something went wrong while generating your card.");
        }
      } finally {
        setLoading(false);
      }
    },
    [username, selectedYear, saveRecent]
  );

  /* On first load: restore recent searches and auto-generate from ?u=&y= */
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(window.location.search);
    const u = params.get("u");
    const y = Number(params.get("y"));
    if (u) {
      const yr = YEARS.includes(y) ? y : YEARS[0];
      setUsername(u);
      setSelectedYear(yr);
      handleGenerate(u, yr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async () => {
    if (!cardRef.current || !data) return;
    try {
      setDownloading(true);
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 1000));

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: theme.bg,
      });

      const link = document.createElement("a");
      link.download = `${data.login}-github-wrapped-${data.year || selectedYear}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Card saved as PNG");
    } catch (err) {
      console.error("Export error:", err);
      setError("Couldn't export the image. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  const shareUrl = () => {
    if (!data) return "";
    return `${window.location.origin}/?u=${encodeURIComponent(data.login)}&y=${data.year || selectedYear}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy the link");
    }
  };

  const handleShareX = () => {
    if (!data) return;
    const persona = derivePersona(data, data.top_languages?.[0] ?? "TypeScript");
    const text = `My ${data.year} GitHub Wrapped: ${(data.total_contributions ?? 0).toLocaleString()} contributions, ${data.longest_streak ?? 0}-day streak. I'm ${persona.title.toLowerCase()}. Get yours:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const quickList = recent.length > 0 ? recent : SAMPLE_USERS;
  const quickLabel = recent.length > 0 ? "Recent" : "Try";

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-between selection:bg-pink-500/30 selection:text-white font-sans antialiased">
      {/* Vercel subtle grid overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      />

      {/* Soft top glow */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 35% at 50% 0%, ${theme.glowA}, transparent 70%)`,
          opacity: 0.35,
        }}
      />

      <div className="relative z-10 w-full max-w-xl mx-auto px-4 pt-14 pb-12 flex flex-col items-center gap-8 flex-1">
        {/* Hero */}
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-zinc-800/90 bg-zinc-950/80 text-zinc-300 shadow-[0_0_12px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors hover:border-zinc-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-zinc-200">Wrapped season is here</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 font-mono">{selectedYear}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]">
            Your year in code,
            <br />
            <span
              style={{
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2}, ${theme.accent3})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              wrapped.
            </span>
          </h1>

          <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
            Enter a GitHub username to get a shareable card with your stats,
            your coding persona, and the badges you earned.
          </p>
        </header>

        {/* Form */}
        <div className="w-full max-w-[420px] space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="flex flex-col gap-2.5 w-full"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search01Icon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="octocat"
                  aria-label="GitHub username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="pl-9 pr-12 h-10 w-full bg-zinc-950/90 border-zinc-800 text-white placeholder:text-zinc-600 text-sm rounded-xl focus:border-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                  disabled={loading}
                  autoFocus
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex">
                  <Kbd className="text-[10px] px-1.5 py-0.5 font-mono text-zinc-500 bg-zinc-900 border-zinc-800">/</Kbd>
                </div>
              </div>

              {/* Year dropdown using Base UI Select */}
              <div className="w-[100px] shrink-0">
                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => {
                    const yr = Number(val);
                    setSelectedYear(yr);
                    if (data) handleGenerate(data.login, yr);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger
                    aria-label="Select year"
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 text-sm font-semibold text-zinc-100 font-mono transition-colors hover:bg-zinc-900/60 hover:border-zinc-700 focus:outline-none focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50 cursor-pointer"
                  >
                    <SelectValue placeholder="2026">{selectedYear}</SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="border border-zinc-800 bg-[#0a0a0a]/95 text-zinc-100 min-w-[100px] rounded-xl p-1 shadow-2xl backdrop-blur-xl z-50 outline-none ring-0"
                  >
                    {YEARS.map((yr) => (
                      <SelectItem
                        key={yr}
                        value={String(yr)}
                        className="font-mono text-xs cursor-pointer rounded-lg px-2.5 py-1.5 focus:bg-zinc-800/80 focus:text-white"
                      >
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm gap-2 shadow-[0_0_20px_rgba(255,255,255,0.12)] active:scale-[0.99] transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loading03Icon className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  <span>Generate my Wrapped</span>
                </>
              )}
            </Button>
          </form>

          {/* Recent / sample users */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
            <span className="text-sm font-mono text-zinc-500 mr-1">{quickLabel}:</span>
            {quickList.map((user) => (
              <Kbd
                key={user}
                onClick={() => {
                  setUsername(user);
                  handleGenerate(user);
                }}
                className="border dark:border-neutral-800 rounded-lg dark:text-neutral-400"
              >
                @{user}
              </Kbd>
            ))}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="w-full max-w-[420px] p-3.5 bg-red-950/80 border border-red-500/30 rounded-xl text-xs flex items-start gap-2.5"
            >
              <AlertCircleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-300">Couldn&apos;t generate your card</p>
                <p className="text-red-200/80 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && <CardSkeleton message={LOADING_MESSAGES[loadingStep]} />}

        {/* Result */}
        {data && !loading && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="w-full flex flex-col items-center gap-5"
            aria-label={`GitHub Wrapped card for ${data.login}`}
          >
            <ScaledPreview cardRef={cardRef}>
              <WrappedCard
                ref={cardRef}
                data={data}
                theme={theme}
                year={data.year || selectedYear}
              />
            </ScaledPreview>

            {/* Theme swatches */}
            <div className="flex items-center gap-3">
              <Palette className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  aria-label={`${t.name} theme`}
                  aria-pressed={t.id === themeId}
                  title={t.name}
                  className="relative h-6 w-6 rounded-full cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  style={{
                    background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
                    boxShadow:
                      t.id === themeId
                        ? "0 0 0 2px #000, 0 0 0 4px rgba(255,255,255,0.8)"
                        : "none",
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm gap-2 cursor-pointer"
              >
                {downloading ? (
                  <>
                    <Loading03Icon className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Download01Icon className="w-4 h-4" />
                    <span>Download PNG</span>
                  </>
                )}
              </Button>

              <Button
                onClick={handleShareX}
                variant="outline"
                className="h-10 px-4 rounded-xl border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-100 text-sm gap-2 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>Share on X</span>
              </Button>

              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="h-10 px-4 rounded-xl border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-100 text-sm gap-2 cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                <span>Copy link</span>
              </Button>
            </div>
          </motion.section>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            role="status"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-100 shadow-2xl"
          >
            <Check className="w-3.5 h-3.5" style={{ color: theme.accent }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-10 w-full border-t border-zinc-900 py-6 text-[11px] text-zinc-600">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-between">
          <span>GitHub Wrapped</span>
          <span>Built with Next.js and FastAPI</span>
        </div>
      </footer>
    </main>
  );
}