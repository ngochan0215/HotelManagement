import { useState } from "react";
import { BedDouble, CheckCircle2, Coffee, ShieldCheck, Sparkles, Users } from "lucide-react";

function resolveRatioClass(ratio) {
  if (ratio === "wide") return "aspect-[16/9]";
  if (ratio === "square") return "aspect-square";
  if (ratio === "hero") return "aspect-[4/4.5] md:aspect-[4/4.2]";
  return "aspect-[4/3]";
}

export function SectionHeader({ eyebrow, title, description, align = "left" }) {
  const alignment = align === "center" ? "mx-auto text-center" : "";

  return (
    <div className={`max-w-2xl ${alignment}`}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-7 text-stone-600 md:text-base">{description}</p> : null}
    </div>
  );
}

export function ImagePlaceholder({ label, ratio = "landscape", accent = "amber", className = "" }) {
  const accentMap = {
    amber: "from-amber-100 via-stone-100 to-amber-50 border-amber-200/80",
    stone: "from-stone-200 via-stone-100 to-white border-stone-200",
    emerald: "from-emerald-100 via-stone-100 to-amber-50 border-emerald-200/70",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border bg-gradient-to-br ${accentMap[accent] || accentMap.amber} ${resolveRatioClass(
        ratio,
      )} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_42%),linear-gradient(135deg,rgba(120,53,15,0.05),transparent_55%)]" />
      <div className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-stone-700 shadow-sm ring-1 ring-white/70">
        <BedDouble size={22} />
      </div>
      <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/70 px-4 py-3 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">SE Hotel</p>
        <p className="mt-1 truncate text-sm text-stone-700">{label}</p>
      </div>
    </div>
  );
}

export function HotelImage({ src, alt, ratio = "landscape", fallbackLabel, className = "", imageClassName = "", overlay = true }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImagePlaceholder label={fallbackLabel || alt} ratio={ratio} className={className} />;
  }

  return (
    <div className={`relative overflow-hidden rounded-[28px] ${resolveRatioClass(ratio)} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`block h-full w-full object-cover ${imageClassName}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/35 via-stone-900/10 to-white/10" />
      {overlay ? (
        <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-800 shadow-sm backdrop-blur">
          {alt}
        </div>
      ) : null}
    </div>
  );
}

export function AmenityPill({ children }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-left text-xs font-medium leading-5 text-amber-900">
      {children}
    </span>
  );
}

export function StatusBadge({ children, tone = "success" }) {
  const tones = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    warning: "bg-amber-50 text-amber-800 ring-amber-200/70",
    info: "bg-stone-100 text-stone-700 ring-stone-200/80",
  };

  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function MetricStrip() {
  const metrics = [
    { icon: Sparkles, label: "Không gian cao cấp" },
    { icon: ShieldCheck, label: "Dịch vụ đáng tin cậy" },
    { icon: Coffee, label: "Tiện nghi trọn vẹn" },
    { icon: Users, label: "Phù hợp công tác và nghỉ dưỡng" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {metrics.map((item) => {
        const MetricIcon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-4 backdrop-blur">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
              <MetricIcon size={20} />
            </div>
            <p className="text-sm font-medium text-stone-800">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-600">
        <CheckCircle2 size={26} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

export function LoadingCardGrid({ count = 3 }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="h-56 animate-pulse bg-stone-100" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
            <div className="h-7 w-2/3 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
