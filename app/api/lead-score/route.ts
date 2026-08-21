type LeadPayload = {
  name?: string;
  email?: string;
  organization?: string;
  role?: string;
  teamSize?: string;
  timeline?: string;
  useCase?: string;
};

const personalDomains = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
];

export async function POST(request: Request) {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let score = 0;
  const reasons: string[] = [];
  const domain = email.split("@")[1] ?? "";

  if (!personalDomains.includes(domain)) {
    score += 15;
    reasons.push("Work or institutional email");
  }

  if ((payload.organization?.trim().length ?? 0) >= 3) {
    score += 15;
    reasons.push("Organization supplied");
  }

  if (
    /scient|research|bio|pharma|chemist|computational|discovery/i.test(
      payload.role ?? "",
    )
  ) {
    score += 20;
    reasons.push("Relevant research role");
  }

  if (payload.teamSize === "5-20" || payload.teamSize === "21+") {
    score += 15;
    reasons.push("Multi-user team opportunity");
  }

  if (payload.timeline === "now" || payload.timeline === "quarter") {
    score += 20;
    reasons.push("Near-term project timeline");
  }

  if ((payload.useCase?.trim().length ?? 0) >= 24) {
    score += 15;
    reasons.push("Specific use case described");
  }

  const segment = score >= 60 ? "Priority demo" : score >= 35 ? "Qualified" : "Explore";
  const nextAction =
    score >= 60
      ? "Route to a product specialist for a tailored demo."
      : score >= 35
        ? "Send the workflow brief and invite a discovery call."
        : "Send educational resources and continue lightweight nurture.";

  return Response.json({
    score,
    segment,
    reasons,
    nextAction,
    prototype: true,
  });
}
