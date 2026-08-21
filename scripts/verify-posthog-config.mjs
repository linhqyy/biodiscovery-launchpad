const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";

const tokenIsValid = /^phc_[A-Za-z0-9_-]{20,}$/.test(token) &&
  !token.includes("replace_with");

let hostIsValid = false;
try {
  const url = new URL(host);
  hostIsValid =
    url.protocol === "https:" &&
    (url.hostname === "eu.i.posthog.com" ||
      url.hostname === "us.i.posthog.com");
} catch {
  hostIsValid = false;
}

if (!tokenIsValid || !hostIsValid) {
  console.error(
    "PostHog portfolio configuration is required: set a real NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and its matching EU or US ingestion host.",
  );
  process.exit(1);
}

console.log(`PostHog portfolio configuration verified for ${new URL(host).hostname}.`);
