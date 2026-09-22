import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const CACHE_MS = 10 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const UA = "OpportunityFinder/1.0 (https://localhost; student opportunity aggregator)";

const cache = { all: { at: 0, data: [] } };

app.use(express.static(__dirname));

function stripHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  return url;
}

function pic(seed) {
  return "https://picsum.photos/seed/" + encodeURIComponent(String(seed).slice(0, 40)) + "/800/500";
}

function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = new Date(iso + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function xmlTag(block, name) {
  const cdata = block.match(new RegExp("<" + name + "[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>", "i"));
  if (cdata) return stripHtml(cdata[1]);
  const tagged = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i"));
  return tagged ? stripHtml(tagged[1]) : "";
}

function parseRssItems(xml) {
  return String(xml)
    .split(/<item[\s>]/i)
    .slice(1)
    .map((block) => {
      const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      return {
        title: xmlTag(block, "title"),
        description: xmlTag(block, "description") || xmlTag(block, "content:encoded"),
        link: stripHtml(linkMatch ? linkMatch[1] : ""),
        pubDate: xmlTag(block, "pubDate") || xmlTag(block, "dc:date")
      };
    })
    .filter((item) => item.title && item.link);
}

const COUNTRY_MAP = [
  ["united states", "United States"],
  ["usa", "United States"],
  ["u.s.", "United States"],
  ["united kingdom", "United Kingdom"],
  ["england", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["india", "India"],
  ["canada", "Canada"],
  ["germany", "Germany"],
  ["france", "France"],
  ["singapore", "Singapore"],
  ["japan", "Japan"],
  ["australia", "Australia"],
  ["netherlands", "Netherlands"],
  ["sweden", "Sweden"],
  ["ireland", "Ireland"],
  ["uae", "United Arab Emirates"],
  ["dubai", "United Arab Emirates"],
  ["kenya", "Kenya"],
  ["nigeria", "Nigeria"],
  ["south africa", "South Africa"],
  ["ghana", "Ghana"],
  ["brazil", "Brazil"],
  ["mexico", "Mexico"],
  ["china", "China"],
  ["south korea", "South Korea"],
  ["korea", "South Korea"],
  ["pakistan", "Pakistan"],
  ["bangladesh", "Bangladesh"],
  ["indonesia", "Indonesia"],
  ["malaysia", "Malaysia"],
  ["philippines", "Philippines"],
  ["spain", "Spain"],
  ["italy", "Italy"],
  ["poland", "Poland"],
  ["portugal", "Portugal"],
  ["switzerland", "Switzerland"],
  ["austria", "Austria"],
  ["belgium", "Belgium"],
  ["denmark", "Denmark"],
  ["norway", "Norway"],
  ["finland", "Finland"],
  ["new zealand", "New Zealand"],
  ["egypt", "Egypt"],
  ["turkey", "Turkey"],
  ["saudi arabia", "Saudi Arabia"],
  ["qatar", "Qatar"],
  ["argentina", "Argentina"],
  ["chile", "Chile"],
  ["colombia", "Colombia"],
  ["peru", "Peru"],
  ["vietnam", "Vietnam"],
  ["thailand", "Thailand"],
  ["nepal", "Nepal"],
  ["sri lanka", "Sri Lanka"],
  ["hong kong", "Hong Kong"],
  ["taiwan", "Taiwan"],
  ["russia", "Russia"],
  ["ukraine", "Ukraine"],
  ["israel", "Israel"],
  ["rwanda", "Rwanda"],
  ["uganda", "Uganda"],
  ["tanzania", "Tanzania"],
  ["ethiopia", "Ethiopia"],
  ["morocco", "Morocco"]
];

const REGION_BY_COUNTRY = {
  "United States": "Americas",
  Canada: "Americas",
  Mexico: "Americas",
  Brazil: "Americas",
  Argentina: "Americas",
  Chile: "Americas",
  Colombia: "Americas",
  Peru: "Americas",
  "United Kingdom": "Europe",
  Germany: "Europe",
  France: "Europe",
  Netherlands: "Europe",
  Sweden: "Europe",
  Ireland: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Poland: "Europe",
  Portugal: "Europe",
  Switzerland: "Europe",
  Austria: "Europe",
  Belgium: "Europe",
  Denmark: "Europe",
  Norway: "Europe",
  Finland: "Europe",
  Russia: "Europe",
  Ukraine: "Europe",
  India: "Asia",
  Singapore: "Asia",
  Japan: "Asia",
  China: "Asia",
  "South Korea": "Asia",
  Pakistan: "Asia",
  Bangladesh: "Asia",
  Indonesia: "Asia",
  Malaysia: "Asia",
  Philippines: "Asia",
  Vietnam: "Asia",
  Thailand: "Asia",
  Nepal: "Asia",
  "Sri Lanka": "Asia",
  "Hong Kong": "Asia",
  Taiwan: "Asia",
  Israel: "Asia",
  Turkey: "Asia",
  Australia: "Oceania",
  "New Zealand": "Oceania",
  Kenya: "Africa",
  Nigeria: "Africa",
  "South Africa": "Africa",
  Ghana: "Africa",
  Egypt: "Africa",
  Rwanda: "Africa",
  Uganda: "Africa",
  Tanzania: "Africa",
  Ethiopia: "Africa",
  Morocco: "Africa",
  "United Arab Emirates": "Middle East",
  "Saudi Arabia": "Middle East",
  Qatar: "Middle East",
  Worldwide: "Worldwide"
};

function inferCountry(location) {
  const text = String(location || "").toLowerCase();
  if (!text || /online|remote|worldwide|global|virtual|anywhere/.test(text)) {
    return "Worldwide";
  }
  for (const [needle, country] of COUNTRY_MAP) {
    if (text.includes(needle)) return country;
  }
  const city = String(location).split(",")[0].trim();
  return city || "Worldwide";
}

function inferRegion(country, location) {
  if (REGION_BY_COUNTRY[country]) return REGION_BY_COUNTRY[country];
  const text = String(location || "").toLowerCase();
  if (/africa/.test(text)) return "Africa";
  if (/europe/.test(text)) return "Europe";
  if (/asia|indo-pacific/.test(text)) return "Asia";
  if (/latin america|south america|north america/.test(text)) return "Americas";
  if (/oceania|pacific/.test(text)) return "Oceania";
  if (/middle east|gulf/.test(text)) return "Middle East";
  return country === "Worldwide" ? "Worldwide" : "Worldwide";
}

function inferFormat(location, extra = "") {
  const text = [location, extra].join(" ").toLowerCase();
  const online = /online|remote|virtual|worldwide|global/.test(text);
  const onsite = /in-person|onsite|on-site|campus|city|university/.test(text) || /,/.test(String(location || ""));
  if (online && onsite) return "hybrid";
  if (online) return "online";
  if (onsite) return "in-person";
  return "online";
}

function inferClassLevels(text) {
  const hay = String(text || "").toLowerCase();
  const levels = new Set();

  if (/grade\s*9|class\s*9|year\s*9|ninth grade|9th/.test(hay)) levels.add("9");
  if (/grade\s*10|class\s*10|year\s*10|tenth grade|10th/.test(hay)) levels.add("10");
  if (/grade\s*11|class\s*11|year\s*11|eleventh|11th|junior/.test(hay)) levels.add("11");
  if (/grade\s*12|class\s*12|year\s*12|twelfth|12th|senior secondary|high school senior/.test(hay)) levels.add("12");
  if (/class 9.?10|grades? 9.?10|9-10/.test(hay)) {
    levels.add("9");
    levels.add("10");
  }
  if (/class 11.?12|grades? 11.?12|11-12/.test(hay)) {
    levels.add("11");
    levels.add("12");
  }
  if (/high school|secondary school|a-level|ib diploma|cbse|isc |teen/.test(hay)) {
    ["9", "10", "11", "12"].forEach((g) => levels.add(g));
  }
  if (/undergrad|bachelor|college student|university student/.test(hay)) levels.add("undergraduate");
  if (/intern/.test(hay) && !/high school intern/.test(hay)) levels.add("undergraduate");
  if (/master'?s|phd|postgrad|graduate student|mba /.test(hay)) levels.add("postgraduate");
  if (/early.?career|young professional|recent graduate/.test(hay)) levels.add("professional");
  if (/open to all|everyone|all ages|no age/.test(hay)) levels.add("open");

  if (!levels.size) levels.add("open");
  return [...levels];
}

function inferCategory(text, fallback = "other") {
  const hay = String(text || "").toLowerCase();
  if (/scholar/.test(hay)) return "scholarship";
  if (/hackathon|contest|competition|olympiad|challenge/.test(hay)) return "competition";
  if (/intern/.test(hay)) return "internship";
  if (/fellowship/.test(hay)) return "fellowship";
  if (/volunteer/.test(hay)) return "volunteer";
  if (/program|bootcamp|institute|summer school|exchange/.test(hay)) return "program";
  return fallback;
}

function parseDeadlineFromText(text, fallbackDays = 21) {
  const hay = String(text || "");
  const patterns = [
    /deadline[^0-9a-z]{0,12}(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /apply by[^0-9a-z]{0,8}(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/
  ];
  for (const pattern of patterns) {
    const match = hay.match(pattern);
    if (match) {
      const iso = toIsoDate(match[1]);
      if (iso) return iso;
    }
  }
  return daysFromNow(fallbackDays);
}

function getDeadlineState(deadline) {
  if (!deadline || /varies|rolling|open/i.test(String(deadline))) {
    return { visible: true, expired: false };
  }
  const date = new Date(String(deadline) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return { visible: true, expired: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date.getTime() >= today.getTime()) return { visible: true, expired: false };
  if (today.getTime() - date.getTime() <= TWO_DAYS_MS) return { visible: true, expired: true };
  return { visible: false, expired: true };
}

function card(partial) {
  const location = partial.location || "Worldwide";
  const country = partial.country || inferCountry(location);
  const classLevels = partial.classLevels?.length
    ? partial.classLevels
    : inferClassLevels([partial.title, partial.description, partial.eligibility].join(" "));
  const deadline = partial.deadline || daysFromNow(21);
  const state = getDeadlineState(deadline);
  return {
    id: String(partial.id),
    title: partial.title,
    category: partial.category || "other",
    organizer: partial.organizer || "Organizer",
    description: stripHtml(partial.description || partial.title).slice(0, 320),
    eligibility: partial.eligibility || "See official page",
    deadline,
    location,
    officialUrl: partial.officialUrl,
    image: absUrl(partial.image) || pic(partial.id || partial.title),
    country,
    region: partial.region || inferRegion(country, location),
    classLevel: classLevels.includes("open") ? "open" : classLevels[0],
    classLevels,
    format: partial.format || inferFormat(location, partial.description),
    source: partial.source || "Live feed",
    expired: state.expired,
    visible: state.visible
  };
}

async function request(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: headers.Accept || "application/json", ...headers },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(url + " failed " + response.status);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, headers = {}) {
  const response = await request(url, { Accept: "application/json", ...headers });
  return response.json();
}

async function getText(url) {
  const response = await request(url, { Accept: "application/rss+xml, application/xml, text/xml, */*" });
  return response.text();
}

function parseDevpostEndDate(dates) {
  if (!dates) return daysFromNow(21);
  const parts = String(dates).split(/[-–—]/);
  const end = parts[parts.length - 1].trim();
  return toIsoDate(end) || daysFromNow(21);
}

async function loadDevpost(status) {
  const pages = status === "open" ? [1, 2, 3] : [1];
  const collected = [];
  for (const page of pages) {
    const payload = await getJson("https://devpost.com/api/hackathons?status=" + status + "&page=" + page);
    const hackathons = Array.isArray(payload) ? payload : (payload.hackathons || []);
    collected.push(...hackathons);
  }
  return collected.map((op) => {
    const location = op.displayed_location?.location || op.location || "Online";
    const url = op.url?.startsWith("http") ? op.url : "https://devpost.com" + (op.url || "/hackathons");
    return card({
      id: "devpost-" + op.id,
      title: op.title,
      category: "competition",
      organizer: op.organization_name || op.organizer || "Devpost",
      description: op.tagline || op.description || op.title,
      eligibility: "Open to students and developers; check age rules on Devpost",
      deadline: parseDevpostEndDate(op.submission_period_dates),
      location,
      officialUrl: url,
      image: absUrl(op.thumbnail_url),
      classLevels: ["9", "10", "11", "12", "undergraduate", "open"],
      source: "Devpost",
      format: inferFormat(location)
    });
  });
}

async function loadKontests() {
  const contests = await getJson("https://kontests.net/api/v1/all");
  if (!Array.isArray(contests)) return [];
  return contests.slice(0, 80).map((contest) => {
    const end = toIsoDate(contest.end_time) || daysFromNow(7);
    return card({
      id: "contest-" + (contest.name + contest.start_time).slice(0, 60),
      title: contest.name,
      category: "competition",
      organizer: contest.site || "Programming contest",
      description: "Live coding contest on " + (contest.site || "an international platform") + ". Starts " + (contest.start_time || "") + ".",
      eligibility: "Open worldwide; school and university students commonly participate",
      deadline: end,
      location: "Online",
      officialUrl: contest.url,
      country: "Worldwide",
      classLevels: ["9", "10", "11", "12", "undergraduate", "open"],
      source: contest.site || "Kontests",
      format: "online"
    });
  });
}

async function loadCodeforces() {
  const payload = await getJson("https://codeforces.com/api/contest.list");
  const contests = payload.result || [];
  return contests
    .filter((c) => c.phase === "BEFORE" || c.phase === "CODING" || c.phase === "FINISHED")
    .slice(0, 40)
    .map((contest) => {
      const end = new Date((contest.startTimeSeconds + (contest.durationSeconds || 7200)) * 1000);
      return card({
        id: "cf-" + contest.id,
        title: contest.name,
        category: "competition",
        organizer: "Codeforces",
        description: "International programming contest. Rated rounds are open to anyone with a Codeforces account.",
        eligibility: "Open worldwide, including high school and university students",
        deadline: toIsoDate(end),
        location: "Online",
        officialUrl: "https://codeforces.com/contest/" + contest.id,
        country: "Worldwide",
        classLevels: ["9", "10", "11", "12", "undergraduate", "open"],
        source: "Codeforces",
        format: "online"
      });
    });
}

function isInternship(job) {
  const haystack = [job.position, job.title, job.name, ...(job.tags || []), job.category].join(" ").toLowerCase();
  return /intern|internship|graduate programme|graduate program|student|trainee|apprentice/.test(haystack);
}

async function loadRemoteOk() {
  const payload = await getJson("https://remoteok.com/api");
  const jobs = Array.isArray(payload) ? payload.slice(1) : [];
  return jobs.filter(isInternship).slice(0, 25).map((job) => {
    const posted = toIsoDate(job.date) || daysFromNow(0);
    return card({
      id: "rok-" + job.id,
      title: job.position || job.title,
      category: "internship",
      organizer: job.company || "Remote company",
      description: job.description,
      eligibility: "Open to applicants worldwide; check visa and age rules",
      deadline: addDays(posted, 28),
      location: job.location || "Remote",
      officialUrl: job.apply_url || job.url || "https://remoteok.com",
      image: job.logo,
      classLevels: inferClassLevels([job.position, job.description, (job.tags || []).join(" ")].join(" ")),
      source: "RemoteOK",
      format: "online"
    });
  });
}

async function loadArbeitnow() {
  const payload = await getJson("https://www.arbeitnow.com/api/job-board-api");
  const jobs = payload.data || [];
  return jobs.filter(isInternship).slice(0, 25).map((job) => {
    const posted = toIsoDate(job.created_at) || daysFromNow(0);
    return card({
      id: "arb-" + (job.slug || job.title),
      title: job.title,
      category: "internship",
      organizer: job.company_name || "Arbeitnow",
      description: job.description,
      eligibility: "Open to applicants; see posting for work authorization",
      deadline: addDays(posted, 21),
      location: job.location || (job.remote ? "Remote" : "Worldwide"),
      officialUrl: job.url,
      classLevels: inferClassLevels(job.title + " " + job.description),
      source: "Arbeitnow",
      format: job.remote ? "online" : inferFormat(job.location)
    });
  });
}

async function loadRemotive() {
  const payload = await getJson("https://remotive.com/api/remote-jobs?search=intern");
  const jobs = payload.jobs || [];
  return jobs.filter(isInternship).slice(0, 20).map((job) => {
    const posted = toIsoDate(job.publication_date) || daysFromNow(0);
    return card({
      id: "rem-" + job.id,
      title: job.title,
      category: "internship",
      organizer: job.company_name || "Remotive",
      description: job.description,
      eligibility: "Remote internship applicants",
      deadline: addDays(posted, 24),
      location: job.candidate_required_location || "Remote",
      officialUrl: job.url,
      image: job.company_logo,
      classLevels: inferClassLevels(job.title + " " + job.description),
      source: "Remotive",
      format: "online"
    });
  });
}

async function loadTheMuse() {
  const payload = await getJson("https://www.themuse.com/api/public/jobs?category=Internship&page=0");
  const jobs = payload.results || [];
  return jobs.slice(0, 20).map((job) => {
    const loc = job.locations?.[0]?.name || "Worldwide";
    const posted = toIsoDate(job.publication_date) || daysFromNow(0);
    return card({
      id: "muse-" + job.id,
      title: job.name,
      category: "internship",
      organizer: job.company?.name || "The Muse",
      description: job.contents,
      eligibility: "See employer posting",
      deadline: addDays(posted, 30),
      location: loc,
      officialUrl: job.refs?.landing_page || "https://www.themuse.com",
      classLevels: inferClassLevels(job.name + " " + job.contents),
      source: "The Muse",
      format: inferFormat(loc, job.contents)
    });
  });
}

async function loadUsaJobs() {
  const payload = await getJson(
    "https://data.usajobs.gov/api/search?Keyword=student%20internship&ResultsPerPage=25",
    { "User-Agent": "OpportunityFinder/1.0 (student@localhost)" }
  );
  const jobs = payload.SearchResult?.SearchResultItems || [];
  return jobs.map((entry) => {
    const job = entry.MatchedObjectDescriptor || {};
    const loc = job.PositionLocationDisplay || job.PositionLocation?.[0]?.LocationName || "United States";
    return card({
      id: "usa-" + (entry.MatchedObjectId || job.PositionID),
      title: job.PositionTitle,
      category: "internship",
      organizer: job.OrganizationName || "U.S. Government",
      description: job.UserArea?.Details?.JobSummary || job.QualificationSummary,
      eligibility: job.UserArea?.Details?.Requirements || "U.S. student internships; check citizenship rules",
      deadline: toIsoDate(job.ApplicationCloseDate) || daysFromNow(20),
      location: loc,
      officialUrl: job.PositionURI || "https://www.usajobs.gov",
      country: "United States",
      classLevels: inferClassLevels(job.PositionTitle + " " + (job.UserArea?.Details?.JobSummary || "")),
      source: "USAJobs",
      format: inferFormat(loc)
    });
  });
}

async function loadReliefWeb(kind) {
  const url =
    kind === "training"
      ? "https://api.reliefweb.int/v1/training?appname=opportunity-finder&profile=list&limit=20"
      : "https://api.reliefweb.int/v1/jobs?appname=opportunity-finder&profile=list&limit=30&query[value]=internship%20OR%20volunteer%20OR%20fellowship";
  const payload = await getJson(url);
  return (payload.data || []).map((item) => {
    const fields = item.fields || {};
    const loc = fields.country?.[0]?.name || fields.city?.[0]?.name || "Worldwide";
    const close = toIsoDate(fields.date?.closing || fields.date?.end) || parseDeadlineFromText(fields.title, 30);
    const category = kind === "training" ? "program" : inferCategory(fields.title, "internship");
    return card({
      id: "rw-" + item.id,
      title: fields.title,
      category,
      organizer: fields.source?.[0]?.name || "ReliefWeb",
      description: fields.body || fields.title,
      eligibility: "Humanitarian / development applicants; see posting",
      deadline: close,
      location: loc,
      officialUrl: fields.url || item.href,
      classLevels: inferClassLevels(fields.title + " " + (fields.body || "")),
      source: "ReliefWeb",
      format: inferFormat(loc, fields.title)
    });
  });
}

async function loadRssFeed(url, source, fallbackCategory) {
  const xml = await getText(url);
  return parseRssItems(xml).slice(0, 18).map((item, index) => {
    const category = inferCategory(item.title + " " + item.description, fallbackCategory);
    const classLevels = inferClassLevels(item.title + " " + item.description);
    if (fallbackCategory === "scholarship" && !classLevels.includes("9") && /school|grade|secondary/.test((item.title + item.description).toLowerCase())) {
      ["9", "10", "11", "12"].forEach((g) => classLevels.push(g));
    }
    return card({
      id: source + "-" + index + "-" + item.title.slice(0, 24),
      title: item.title,
      category,
      organizer: source,
      description: item.description,
      eligibility: "See official announcement",
      deadline: parseDeadlineFromText(item.description + " " + item.title, 18),
      location: inferCountry(item.title + " " + item.description) === "Worldwide" ? "Worldwide" : inferCountry(item.title + " " + item.description),
      officialUrl: item.link,
      classLevels: classLevels.length ? classLevels : ["open"],
      source,
      format: inferFormat(item.title + " " + item.description)
    });
  });
}

async function settled(loaders) {
  const results = await Promise.allSettled(loaders.map((fn) => fn()));
  const merged = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") merged.push(...result.value);
    else console.error("Source failed", index, result.reason?.message || result.reason);
  });
  return merged;
}

function uniqueByUrl(list) {
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    const key = String(item.officialUrl || item.title).toLowerCase().split("?")[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

async function loadAllOpportunities() {
  const merged = await settled([
    () => loadDevpost("open"),
    () => loadDevpost("ended"),
    loadKontests,
    loadCodeforces,
    loadRemoteOk,
    loadArbeitnow,
    loadRemotive,
    loadTheMuse,
    loadUsaJobs,
    () => loadReliefWeb("jobs"),
    () => loadReliefWeb("training"),
    () => loadRssFeed("https://scholarship-positions.com/feed/", "Scholarship Positions", "scholarship"),
    () => loadRssFeed("https://opportunitydesk.org/feed/", "Opportunity Desk", "program"),
    () => loadRssFeed("https://www.youthop.com/feed", "Youth Opportunities", "program"),
    () => loadRssFeed("https://www.opportunitiesforafricans.com/feed/", "Opportunities for Africans", "program")
  ]);

  return uniqueByUrl(merged)
    .filter((item) => item.visible && item.title && item.officialUrl)
    .sort((a, b) => {
      if (a.expired !== b.expired) return a.expired ? 1 : -1;
      return String(a.deadline).localeCompare(String(b.deadline));
    });
}

async function readAll() {
  if (cache.all.data.length && Date.now() - cache.all.at < CACHE_MS) {
    return cache.all.data;
  }
  const data = await loadAllOpportunities();
  cache.all = { at: Date.now(), data };
  return data;
}

app.get("/api/opportunities", async (req, res) => {
  try {
    const data = await readAll();
    res.json({
      updatedAt: cache.all.at,
      count: data.length,
      opportunities: data
    });
  } catch (e) {
    console.error("Opportunities fetch failed", e);
    res.status(500).json({ error: "Failed to fetch live opportunities" });
  }
});

app.get("/api/hackathons", async (req, res) => {
  try {
    const data = (await readAll()).filter((item) => item.category === "competition");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch hackathons" });
  }
});

app.get("/api/internships", async (req, res) => {
  try {
    const data = (await readAll()).filter((item) => item.category === "internship");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch internships" });
  }
});

app.listen(PORT, () => {
  console.log("Opportunity Finder running on http://localhost:" + PORT);
});
