import { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  onBrand?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: "h-6 w-auto", word: "h-4", gap: "gap-2" },
  md: { icon: "h-8 w-auto", word: "h-[1.375rem]", gap: "gap-2.5" },
  lg: { icon: "h-11 w-auto", word: "h-[1.875rem]", gap: "gap-3" },
  xl: { icon: "h-16 w-auto", word: "h-11", gap: "gap-4" },
};

const FORMAS = {
  caixaInterna: "M106 211 L256 297.6 L406 211 L256 124.4 Z",
  faceEsquerda: "M106 211 L256 297.6 L256 447.6 L106 361 Z",
  faceDireita: "M256 297.6 L406 211 L406 361 L256 447.6 Z",
  borda: "M106 211 L256 297.6 L406 211",
  tampaEsquerda: "M106 151 L256 237.6 L256 263.6 L106 177 Z",
  tampaDireita: "M256 237.6 L406 151 L406 177 L256 263.6 Z",
  tampaTopo: "M106 151 L256 237.6 L406 151 L256 64.4 Z",
};

const PALAVRA =
  "M336 19Q237 19 169 -12.5Q101 -44 66 -98.5Q31 -153 31 -224H190Q190 -196 205.5 -172Q221 -148 253 -133.5Q285 -119 336 -119Q382 -119 413 -131Q444 -143 460 -164.5Q476 -186 476 -214Q476 -249 446 -269.5Q416 -290 349 -296L294 -301Q185 -310 120 -369Q55 -428 55 -525Q55 -595 88.5 -646Q122 -697 182 -724.5Q242 -752 324 -752Q410 -752 471.5 -722.5Q533 -693 566 -639.5Q599 -586 599 -514H439Q439 -541 426 -563.5Q413 -586 387.5 -600Q362 -614 324 -614Q288 -614 263.5 -602Q239 -590 227 -569.5Q215 -549 215 -525Q215 -494 237 -471Q259 -448 309 -444L365 -439Q445 -432 506 -404.5Q567 -377 601.5 -329.5Q636 -282 636 -214Q636 -144 599.5 -91.5Q563 -39 496 -10Q429 19 336 19Z M1106 0 933 -256H856L1079 -548H1247L1037 -276L1039 -354L1286 0ZM720 0V-730H880V0Z M1517 17Q1422 17 1371 -44.5Q1320 -106 1320 -230V-548H1480V-222Q1480 -178 1505 -152Q1530 -126 1572 -126Q1615 -126 1642 -153Q1669 -180 1669 -226V-548H1829V0H1702V-231H1713Q1713 -148 1691.5 -92.5Q1670 -37 1628 -10Q1586 17 1524 17Z M2294 18Q2227 18 2176 -10.5Q2125 -39 2096 -93Q2067 -147 2065 -225H2084V0H1957V-730H2117V-359L2079 -311Q2082 -394 2110.5 -450.5Q2139 -507 2189 -535.5Q2239 -564 2303 -564Q2359 -564 2404.5 -543.5Q2450 -523 2482 -485.5Q2514 -448 2531.5 -397Q2549 -346 2549 -286V-264Q2549 -204 2531.5 -153Q2514 -102 2480.5 -63.5Q2447 -25 2400 -3.5Q2353 18 2294 18ZM2252 -116Q2293 -116 2323.5 -136Q2354 -156 2371 -192.5Q2388 -229 2388 -275Q2388 -322 2371 -357Q2354 -392 2323.5 -411.5Q2293 -431 2252 -431Q2216 -431 2184 -414Q2152 -397 2132.5 -365.5Q2113 -334 2113 -289V-252Q2113 -209 2133.5 -178.5Q2154 -148 2186 -132Q2218 -116 2252 -116Z M2907 19Q2835 19 2779 -3.5Q2723 -26 2684.5 -65Q2646 -104 2626 -154.5Q2606 -205 2606 -261V-284Q2606 -341 2626.5 -392.5Q2647 -444 2686.5 -483Q2726 -522 2782 -544.5Q2838 -567 2907 -567Q2978 -567 3033.5 -544.5Q3089 -522 3128 -483Q3167 -444 3188 -392.5Q3209 -341 3209 -284V-261Q3209 -205 3189 -154.5Q3169 -104 3130.5 -65Q3092 -26 3036 -3.5Q2980 19 2907 19ZM2907 -116Q2954 -116 2985 -136Q3016 -156 3032.5 -192Q3049 -228 3049 -272Q3049 -319 3032 -354.5Q3015 -390 2983.5 -411Q2952 -432 2907 -432Q2863 -432 2831 -411Q2799 -390 2782.5 -354.5Q2766 -319 2766 -272Q2766 -228 2782 -192Q2798 -156 2830 -136Q2862 -116 2907 -116Z";

const VIEWBOX_SIMBOLO = "92 50 328 412";

export function CubeMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  const id = useId().replace(/:/g, "");

  if (mono) {
    return (
      <svg viewBox={VIEWBOX_SIMBOLO} className={className} aria-hidden="true" focusable="false">
        <g fill="currentColor" stroke="currentColor" strokeWidth={14} strokeLinejoin="round">
          <path d={FORMAS.faceEsquerda} />
          <path d={FORMAS.faceDireita} opacity={0.78} />
          <path d={FORMAS.tampaEsquerda} opacity={0.62} />
          <path d={FORMAS.tampaDireita} opacity={0.5} />
          <path d={FORMAS.tampaTopo} opacity={0.42} />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox={VIEWBOX_SIMBOLO} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#5B3DF5" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A2EE0" />
          <stop offset="1" stopColor="#3519B8" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#45F0C0" />
          <stop offset="1" stopColor="#14C497" />
        </linearGradient>
      </defs>
      <g strokeWidth={14} strokeLinejoin="round">
        <path d={FORMAS.caixaInterna} fill="#1C0E63" stroke="#1C0E63" />
        <path d={FORMAS.faceEsquerda} fill={`url(#${id}e)`} stroke={`url(#${id}e)`} />
        <path d={FORMAS.faceDireita} fill={`url(#${id}d)`} stroke={`url(#${id}d)`} />
        <path
          d={FORMAS.borda}
          fill="none"
          stroke="#A68FFF"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9}
        />
        <path d={FORMAS.tampaEsquerda} fill="#10A47F" stroke="#10A47F" />
        <path d={FORMAS.tampaDireita} fill="#0B8466" stroke="#0B8466" />
        <path d={FORMAS.tampaTopo} fill={`url(#${id}t)`} stroke={`url(#${id}t)`} />
      </g>
    </svg>
  );
}

export function Wordmark({ className, white = false }: { className?: string; white?: boolean }) {
  return (
    <svg
      viewBox="20 -762 3200 792"
      className={cn("w-auto", className)}
      role="img"
      aria-label="Skubo"
      focusable="false"
    >
      <path d={PALAVRA} fill={white ? "#FFFFFF" : "hsl(var(--foreground))"} />
    </svg>
  );
}

export function Logo({ variant = "full", size = "md", onBrand = false, className }: LogoProps) {
  const s = sizes[size];

  if (variant === "mark") {
    return <CubeMark mono={onBrand} className={cn(s.icon, onBrand && "text-white", className)} />;
  }

  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <CubeMark mono={onBrand} className={cn(s.icon, "shrink-0", onBrand && "text-white")} />
      <Wordmark white={onBrand} className={s.word} />
    </span>
  );
}

export default Logo;
