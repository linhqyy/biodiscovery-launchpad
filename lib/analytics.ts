"use client";

import posthog from "posthog-js";

let initialized = false;
const consentKey = "biodiscovery-analytics-consent";

export const POSTHOG_FLAG_KEY = "hero-cta-copy";

export type AnalyticsConsent = "granted" | "declined" | "unset";
export type HeroVariant = "control" | "action-oriented";

export function isAnalyticsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST,
  );
}

export function analyticsHostRegion() {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
  if (host.includes("eu.i.posthog.com")) return "EU Cloud";
  if (host.includes("us.i.posthog.com")) return "US Cloud";
  return host ? "Custom host" : "Not configured";
}

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  const value = window.localStorage.getItem(consentKey);
  return value === "granted" || value === "declined" ? value : "unset";
}

export function initializeAnalytics() {
  if (initialized || typeof window === "undefined") return initialized;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return false;

  posthog.init(token, {
    api_host: host,
    ui_host: host.includes("eu.i.posthog.com")
      ? "https://eu.posthog.com"
      : host.includes("us.i.posthog.com")
        ? "https://us.posthog.com"
        : null,
    defaults: "2026-05-30",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    person_profiles: "never",
    persistence: "localStorage",
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    opt_out_capturing_persistence_type: "localStorage",
    flag_keys: [POSTHOG_FLAG_KEY],
    before_send(event) {
      if (!event) return null;
      if (event.properties) {
        delete event.properties.$current_url;
        delete event.properties.$referrer;
      }
      return event;
    },
  });

  initialized = true;
  const consent = readAnalyticsConsent();
  if (consent === "granted") {
    posthog.opt_in_capturing({ captureEventName: false });
  } else {
    posthog.opt_out_capturing();
  }

  return true;
}

export function setAnalyticsConsent(value: "granted" | "declined") {
  if (typeof window === "undefined") return false;

  window.localStorage.setItem(consentKey, value);
  const ready = initializeAnalytics();

  if (ready) {
    if (value === "granted") {
      posthog.opt_in_capturing({ captureEventName: false });
      posthog.reloadFeatureFlags();
    } else {
      posthog.opt_out_capturing();
    }
  }

  window.dispatchEvent(new Event("biodiscovery-analytics-consent"));
  return ready;
}

export function resetAnalyticsConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(consentKey);
  if (initializeAnalytics()) posthog.opt_out_capturing();
  window.dispatchEvent(new Event("biodiscovery-analytics-consent"));
}

export function captureEvent(
  event: string,
  properties: Record<string, string | number | boolean | undefined> = {},
) {
  const captured =
    readAnalyticsConsent() === "granted" && initializeAnalytics();

  if (captured) {
    posthog.capture(event, properties);
  }

  if (process.env.NODE_ENV === "development") {
    console.info(`[prototype analytics] ${event}`, properties, {
      captured,
    });
  }

  return captured;
}

export function subscribeToHeroVariant(
  callback: (variant: HeroVariant) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  if (process.env.NODE_ENV === "development") {
    const previewVariant = new URLSearchParams(window.location.search).get(
      "variant",
    );
    if (previewVariant === "action-oriented" || previewVariant === "control") {
      callback(previewVariant);
      return () => undefined;
    }
  }

  if (readAnalyticsConsent() !== "granted" || !initializeAnalytics()) {
    callback("control");
    return () => undefined;
  }

  return posthog.onFeatureFlags((_flags, _variants, metadata) => {
    if (metadata?.errorsLoading) {
      callback("control");
      return;
    }

    const value = posthog.getFeatureFlag(POSTHOG_FLAG_KEY);
    callback(value === "action-oriented" ? "action-oriented" : "control");
  });
}
