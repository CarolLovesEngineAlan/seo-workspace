import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoTipProps = {
  content: string;
  className?: string;
  tone?: "default" | "warm";
};

export function InfoTip({
  content,
  className,
  tone = "default",
}: InfoTipProps) {
  return (
    <span className={cn("group relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-label={content}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full border transition-colors",
          tone === "warm"
            ? "border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.76)] text-[#5e6860] shadow-[0_10px_24px_rgba(44,38,22,0.08)] hover:text-[#1c221d] focus-visible:text-[#1c221d]"
            : "surface-chip future-ring border border-border/70 text-muted-foreground hover:text-foreground focus-visible:text-foreground"
        )}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-30 w-64 rounded-2xl border px-3 py-2 text-xs leading-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          tone === "warm"
            ? "border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.98)] text-[#1c221d] shadow-[0_18px_40px_rgba(44,38,22,0.16)]"
            : "border border-border/80 bg-[rgba(7,13,25,0.96)] text-foreground shadow-[0_18px_40px_rgba(2,8,19,0.36)]"
        )}
      >
        {content}
      </span>
    </span>
  );
}
