"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Emblem } from "./emblem";
import { Downloader } from "./downloader";

/* ------------------------------------------------------------------ */
/*  The wall: layered ridge silhouettes with a crack of blood light.  */
/* ------------------------------------------------------------------ */

const FAR_RIDGE =
  "M0,540 L70,470 L140,510 L210,445 L280,500 L350,435 L420,490 L490,425 L560,480 L630,415 L700,470 L770,405 L840,460 L910,395 L980,450 L1050,385 L1120,440 L1190,375 L1260,430 L1330,370 L1440,430 L1440,800 L0,800 Z";
const MID_WALL =
  "M0,620 L80,545 L160,595 L250,520 L330,580 L410,505 L490,565 L580,490 L660,550 L750,475 L830,540 L920,465 L1000,525 L1090,455 L1170,515 L1260,445 L1350,505 L1440,450 L1440,800 L0,800 Z";
const NEAR_WALL =
  "M0,690 L110,640 L230,680 L340,625 L450,670 L560,615 L670,660 L780,605 L890,650 L1000,600 L1110,645 L1220,595 L1330,640 L1440,610 L1440,800 L0,800 Z";
const CRACK =
  "M716,140 L748,230 L726,300 L762,380 L734,460 L772,545 L742,640 L784,730 L762,800 L800,800 L812,730 L776,640 L806,545 L768,460 L796,380 L760,300 L782,230 L750,140 Z";
const CRACK_CORE =
  "M733,140 L755,240 L731,320 L769,400 L741,480 L779,565 L749,660 L788,745 L766,800";

interface EmberSpec {
  id: number;
  left: number;
  bottom: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
}

/** Precomputed at module load so no impure calls happen during render. */
const EMBER_SPECS: EmberSpec[] = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  bottom: Math.random() * 55,
  size: 1.5 + Math.random() * 2.5,
  delay: Math.random() * 9,
  duration: 7 + Math.random() * 9,
  drift: (Math.random() - 0.5) * 90,
  opacity: 0.3 + Math.random() * 0.5,
}));

function Embers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {EMBER_SPECS.map((e) => (
        <span
          key={e.id}
          className="absolute rounded-full"
          style={
            {
              left: `${e.left}%`,
              bottom: `${e.bottom}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              background: "var(--accent-ember)",
              boxShadow: "0 0 6px var(--ember-glow)",
              "--ember-drift": `${e.drift}px`,
              "--ember-opacity": e.opacity,
              opacity: 0,
              animation: `ember-rise ${e.duration}s linear ${e.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function WallBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const farY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -18]);
  const midY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -42]);
  const nearY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -72]);
  const crackY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -58]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 bottom-0 h-[115%]" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
      >
        <defs>
          <filter id="crack-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="crack-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* far ridge — slowest */}
        <motion.g style={{ y: farY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.15 }}>
          <path d={FAR_RIDGE} fill="var(--wall-far)" />
        </motion.g>

        {/* mid wall */}
        <motion.g style={{ y: midY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }}>
          <path d={MID_WALL} fill="var(--wall-mid)" />
        </motion.g>

        {/* near wall */}
        <motion.g style={{ y: nearY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.45 }}>
          <path d={NEAR_WALL} fill="var(--wall-near)" />
          {/* wall seams for texture */}
          <path d="M0,720 L1440,690" stroke="var(--line-rust)" strokeWidth="2" opacity="0.5" fill="none" />
          <path d="M0,760 L1440,735" stroke="var(--line-rust)" strokeWidth="2" opacity="0.35" fill="none" />
        </motion.g>

        {/* crack of light — fades in last */}
        <motion.g style={{ y: crackY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.1, delay: 0.7 }}>
          <path d={CRACK} fill="var(--crack-glow)" filter="url(#crack-soft)" opacity="0.85" />
          <path
            d={CRACK_CORE}
            stroke="var(--crack-core)"
            strokeWidth="3"
            fill="none"
            filter="url(#crack-glow)"
            className="animate-[crack-flicker_5s_ease-in-out_infinite]"
          />
        </motion.g>
      </svg>

      <Embers />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PLATFORMS = [
  "YouTube", "Instagram", "TikTok", "X / Twitter", "Facebook", "Vimeo",
  "SoundCloud", "Reddit", "Twitch", "Dailymotion", "+1800 more",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-label="Veyra downloader">
      <WallBackdrop />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-24 text-center sm:px-6 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-2 text-ember"
        >
          <Emblem size={20} />
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">
            The universal media downloader
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="font-display mt-6 text-4xl font-black uppercase leading-[1.05] tracking-[0.12em] text-bone sm:text-6xl lg:text-7xl"
        >
          Beyond the <span className="text-blood">Walls</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-5 max-w-xl text-sm leading-relaxed text-dim sm:text-base"
        >
          One URL box. Every platform Veyra reaches. Every format it can produce.
          Nothing else on the internet should feel this fast.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-10 w-full max-w-3xl"
        >
          <Downloader />
        </motion.div>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-14">
        {PLATFORMS.map((p, i) => (
          <span
            key={p}
            className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
              i === PLATFORMS.length - 1 ? "text-ember" : "text-dim/70"
            }`}
          >
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}
