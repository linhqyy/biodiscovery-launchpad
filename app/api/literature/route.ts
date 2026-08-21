type EuropePmcResult = {
  id?: string;
  source?: string;
  title?: string;
  authorString?: string;
  pubYear?: string;
  journalTitle?: string;
  journalInfo?: { journal?: { title?: string } };
  abstractText?: string;
  citedByCount?: number;
};

function cleanText(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fallbackResponse(query: string) {
  return Response.json(
    {
      query,
      mode: "prototype-fallback",
      message:
        "Live literature is temporarily unavailable. The workflow remains usable and this state demonstrates graceful API recovery.",
      results: [],
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const query = (body.query ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (query.length < 3 || query.length > 240) {
    return Response.json(
      { error: "Use a research query between 3 and 240 characters." },
      { status: 400 },
    );
  }

  const endpoint = new URL(
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  );
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("pageSize", "4");
  endpoint.searchParams.set("resultType", "core");

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return fallbackResponse(query);

    const payload = (await response.json()) as {
      resultList?: { result?: EuropePmcResult[] };
    };

    const results = (payload.resultList?.result ?? [])
      .filter((item) => item.id && item.title)
      .slice(0, 4)
      .map((item) => ({
        id: `${item.source ?? "MED"}:${item.id}`,
        title: cleanText(item.title),
        authors: cleanText(item.authorString) || "Authors unavailable",
        year: item.pubYear ?? "Year unavailable",
        journal:
          cleanText(item.journalInfo?.journal?.title ?? item.journalTitle) ||
          "Journal unavailable",
        abstract:
          cleanText(item.abstractText).slice(0, 320) ||
          "Abstract unavailable from this source.",
        citedByCount: item.citedByCount ?? 0,
        url: `https://europepmc.org/article/${encodeURIComponent(item.source ?? "MED")}/${encodeURIComponent(item.id ?? "")}`,
      }));

    if (results.length === 0) {
      return Response.json(
        {
          query,
          mode: "live",
          message: "No matching publications were returned for this query.",
          results: [],
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return Response.json(
      { query, mode: "live", results },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return fallbackResponse(query);
  }
}
