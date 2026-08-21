"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AnalyticsConsent } from "../lib/analytics";
import {
  analyticsHostRegion,
  captureEvent,
  initializeAnalytics,
  isAnalyticsConfigured,
  readAnalyticsConsent,
  resetAnalyticsConsent,
  setAnalyticsConsent,
} from "../lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const configured = isAnalyticsConfigured();
  const [consent, setConsent] = useState<AnalyticsConsent | "loading">("loading");

  useEffect(() => {
    initializeAnalytics();
    let active = true;
    queueMicrotask(() => {
      if (active) setConsent(readAnalyticsConsent());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    captureEvent("page_viewed", {
      path: pathname,
      referrer_present: Boolean(document.referrer),
    });
  }, [consent, pathname]);

  function chooseConsent(value: "granted" | "declined") {
    setAnalyticsConsent(value);
    setConsent(value);
  }

  function reopenPreferences() {
    resetAnalyticsConsent();
    setConsent("unset");
  }

  return (
    <>
      {children}
      {!configured && (
        <aside className="analytics-config-warning" role="status">
          <strong>PostHog setup required</strong>
          <span>This build is for development only. Add the project token before portfolio deployment.</span>
        </aside>
      )}
      {configured && consent === "unset" && (
        <aside className="analytics-consent" aria-label="Analytics preference">
          <div>
            <strong>Help improve this prototype?</strong>
            <p>Allow anonymous product events in PostHog ({analyticsHostRegion()}). Form text and research objectives are never included.</p>
          </div>
          <div className="analytics-consent-actions">
            <button onClick={() => chooseConsent("declined")}>No thanks</button>
            <button className="accept" onClick={() => chooseConsent("granted")}>Allow analytics</button>
          </div>
        </aside>
      )}
      {configured && (consent === "granted" || consent === "declined") && (
        <button className="analytics-preferences" onClick={reopenPreferences}>
          Analytics preferences
        </button>
      )}
    </>
  );
}
