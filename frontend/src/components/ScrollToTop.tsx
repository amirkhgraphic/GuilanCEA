import * as React from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop({
  onlyOnPush = false,   // if true, keeps scroll on back/forward (POP)
  smooth = false,       // smooth animation
}: { onlyOnPush?: boolean; smooth?: boolean }) {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType(); // 'PUSH' | 'POP' | 'REPLACE'

  React.useLayoutEffect(() => {
    // If URL has a hash (#id), scroll to that element
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        return;
      }
    }
    // If you want to keep scroll when user hits back/forward:
    if (onlyOnPush && navType === "POP") return;

    window.scrollTo({ top: 0, left: 0, behavior: smooth ? "smooth" : "auto" });
  }, [pathname, hash, navType, onlyOnPush, smooth]);

  // Disable native restoration if you always want to control it
  React.useEffect(() => {
    if (!onlyOnPush && "scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => { window.history.scrollRestoration = prev as "auto" | "manual"; };
    }
  }, [onlyOnPush]);

  return null;
}
