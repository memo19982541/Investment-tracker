/**
 * Fund NAV scraping from settrade.com's mutual fund overview page (same
 * source as the user's Apps Script `setMutualfundInfo`). That script reads
 * the live NAV out of the page's embedded NUXT payload by resolving a
 * variable-indirection scheme; as of writing that particular field now
 * resolves to null (settrade moved the "current NAV" widget to a
 * client-side fetch instead of SSR). The page still embeds a full
 * `{date, navPerUnit}` history array — used for the page's own mini chart —
 * as literal values, so we read the most recent entry from that instead.
 * `ticker` is the same fund symbol already used as `asset.name` in this app
 * (e.g. "SCBS&P500A").
 */

const QUOTATION_RE = /\{date:"([\d-]+)T[\d:]+\+\d{2}:\d{2}",navPerUnit:(-?[\d.]+),/g;

export interface FundNavPoint {
  navDate: string;
  price: number;
}

function parseQuotations(contentText: string): FundNavPoint[] {
  const points: FundNavPoint[] = [];
  for (const m of contentText.matchAll(QUOTATION_RE)) {
    const price = Number(m[2]);
    if (Number.isFinite(price)) points.push({ navDate: m[1], price });
  }
  return points;
}

async function fetchOverviewPage(ticker: string): Promise<string | null> {
  const url = `https://www.settrade.com/th/mutualfund/quote/${encodeURIComponent(ticker)}/overview`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}

export interface FundNavResult {
  price: number;
  navDate: string;
}

/** Latest known NAV + its as-of date for a single fund ticker. */
export async function fetchFundNav(ticker: string): Promise<FundNavResult | null> {
  try {
    const contentText = await fetchOverviewPage(ticker);
    if (!contentText) return null;
    const points = parseQuotations(contentText);
    if (points.length === 0) return null;
    const latest = points[points.length - 1];
    return { price: latest.price, navDate: latest.navDate };
  } catch {
    return null;
  }
}

/** Full NAV history embedded in the fund's overview page (chronological). */
export async function fetchFundNavHistory(ticker: string): Promise<FundNavPoint[]> {
  try {
    const contentText = await fetchOverviewPage(ticker);
    if (!contentText) return [];
    return parseQuotations(contentText);
  } catch {
    return [];
  }
}

/**
 * US stock price, via Yahoo Finance's unofficial chart API
 * (query1.finance.yahoo.com/v8/finance/chart). `ticker` is the same NYSE/
 * NASDAQ symbol already used as `asset.name` (e.g. "MO", "KO").
 */
async function fetchYahooChart(
  ticker: string,
  params: string
): Promise<{
  timestamps: number[];
  closes: (number | null)[];
  latestPrice: number | null;
  latestTime: number | null;
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  return {
    timestamps: result.timestamp ?? [],
    closes: result.indicators?.quote?.[0]?.close ?? [],
    latestPrice: result.meta?.regularMarketPrice ?? null,
    latestTime: result.meta?.regularMarketTime ?? null,
  };
}

function unixToIsoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** Latest known price + its as-of date for a single US stock ticker. */
export async function fetchStockPrice(ticker: string): Promise<FundNavResult | null> {
  try {
    const chart = await fetchYahooChart(ticker, "range=5d&interval=1d");
    if (!chart || typeof chart.latestPrice !== "number") return null;
    const navDate = chart.latestTime ? unixToIsoDate(chart.latestTime) : new Date().toISOString().slice(0, 10);
    return { price: chart.latestPrice, navDate };
  } catch {
    return null;
  }
}

/** Daily close price history for a US stock ticker (chronological). */
export async function fetchStockPriceHistory(ticker: string): Promise<FundNavPoint[]> {
  try {
    const chart = await fetchYahooChart(ticker, "range=1y&interval=1d");
    if (!chart) return [];
    const points: FundNavPoint[] = [];
    chart.timestamps.forEach((ts, i) => {
      const price = chart.closes[i];
      if (typeof price === "number") {
        points.push({ navDate: unixToIsoDate(ts), price });
      }
    });
    return points;
  } catch {
    return [];
  }
}
