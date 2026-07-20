import { rename, writeFile } from "node:fs/promises";

const endpoint = "https://api.cloudflare.com/client/v4/graphql";
const periodDays = 30;
const minimumPublicCountryVisits = 3;
const maximumCountrySlices = 7;
const apiToken = process.env.CF_API_TOKEN?.trim();
const accountTag = process.env.CF_ACCOUNT_TAG?.trim();
const siteTag = process.env.CF_SITE_TAG?.trim();

if (!apiToken || !accountTag || !siteTag) {
  console.log("Cloudflare visitor snapshot is not configured; leaving the existing JSON unchanged.");
  process.exit(0);
}

const end = new Date();
const start = new Date(end.getTime() - periodDays * 24 * 60 * 60 * 1000);
const query = `
  query VisitorCountries($accountTag: string!, $siteTag: string!, $start: Time!, $end: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        countries: rumPageloadEventsAdaptiveGroups(
          filter: {
            datetime_geq: $start
            datetime_lt: $end
            siteTag: $siteTag
            bot: 0
          }
          limit: 100
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            countryName
          }
        }
      }
    }
  }
`;

const response = await fetch(endpoint, {
  method: "POST",
  signal: AbortSignal.timeout(20_000),
  headers: {
    authorization: `Bearer ${apiToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag,
      siteTag,
      start: start.toISOString(),
      end: end.toISOString()
    }
  })
});

if (!response.ok) {
  throw new Error(`Cloudflare Analytics request failed with HTTP ${response.status}`);
}

const payload = await response.json();
if (Array.isArray(payload.errors) && payload.errors.length) {
  throw new Error(`Cloudflare Analytics returned an error: ${payload.errors[0].message || "unknown error"}`);
}

const accounts = payload.data?.viewer?.accounts;
if (!Array.isArray(accounts) || !accounts.length) {
  throw new Error("Cloudflare Analytics returned no matching account data");
}

const rows = Array.isArray(accounts[0].countries) ? accounts[0].countries : [];
const rawCountries = rows
  .map((row) => ({
    code: String(row.dimensions?.countryName || "XX").toUpperCase(),
    visitors: Math.max(0, Math.round(Number(row.sum?.visits) || 0))
  }))
  .filter((country) => country.visitors > 0)
  .sort((a, b) => b.visitors - a.visitors);

const totalVisitors = rawCountries.reduce((sum, country) => sum + country.visitors, 0);
const publicCountries = rawCountries.filter((country) => country.visitors >= minimumPublicCountryVisits);
let otherVisitors = rawCountries
  .filter((country) => country.visitors < minimumPublicCountryVisits)
  .reduce((sum, country) => sum + country.visitors, 0);

if (publicCountries.length > maximumCountrySlices) {
  otherVisitors += publicCountries
    .slice(maximumCountrySlices)
    .reduce((sum, country) => sum + country.visitors, 0);
}

const countries = publicCountries.slice(0, maximumCountrySlices);
if (otherVisitors > 0) {
  countries.push({ code: "OTHER", visitors: otherVisitors });
}

const snapshot = {
  configured: true,
  periodDays,
  updatedAt: end.toISOString(),
  totalVisitors,
  countries
};

const output = new URL("../data/visitor-stats.json", import.meta.url);
const temporaryOutput = new URL("../data/visitor-stats.tmp", import.meta.url);
await writeFile(temporaryOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
await rename(temporaryOutput, output);
console.log(`Updated aggregate visitor snapshot with ${totalVisitors} visits across ${countries.length} public country groups.`);
