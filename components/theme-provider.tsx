"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { useSettings } from "@/store/settings";

/** Applies the persisted theme and reduced-motion preferences to the document.
 *
 *  The <html data-theme> attribute is set pre-hydration by an inline script in
 *  layout.tsx (no flash); this component keeps it in sync afterwards and also
 *  switches Framer Motion between "always reduced" (user opted in) and
 *  "respect OS" (default). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-reduced-motion", reducedMotion ? "true" : "false");
  }, [theme, reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>{children}</MotionConfig>
  );
}
