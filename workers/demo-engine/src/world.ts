/**
 * World state -- the fictional company and its team members.
 *
 * "Serpin's Burger Shack" is a growing burger chain (12 locations) building
 * out their tech stack: mobile ordering app, delivery platform, kitchen
 * display system, loyalty program, and internal ops tools.
 *
 * The team uses GitHub, Slack, Jira, Discord (fan community), Figma,
 * Intercom, and tracks metrics in Amplitude + Google Analytics.
 */

// -- Team members ---------------------------------------------------------------

export interface TeamMember {
  name: string;
  github: string;
  slack: string;
  role: string;
  team: string;
}

export const TEAM: TeamMember[] = [
  { name: "Derek Serpin", github: "dserpin", slack: "derek", role: "CEO / Founder", team: "leadership" },
  { name: "Maria Gonzalez", github: "mariag", slack: "maria", role: "CTO", team: "engineering" },
  { name: "Jake Thompson", github: "jakethompson", slack: "jake", role: "Senior Backend Engineer", team: "engineering" },
  { name: "Aisha Patel", github: "aishap", slack: "aisha", role: "Mobile Engineer (iOS/Android)", team: "engineering" },
  { name: "Ryan Chen", github: "ryanchen", slack: "ryan", role: "Full-Stack Engineer", team: "engineering" },
  { name: "Kira Novak", github: "kiranovak", slack: "kira", role: "Frontend Engineer", team: "engineering" },
  { name: "Sam Okafor", github: "samokafor", slack: "sam", role: "DevOps / SRE", team: "engineering" },
  { name: "Lily Tran", github: "lilytran", slack: "lily", role: "Product Manager", team: "product" },
  { name: "Marco DiStefano", github: "marcod", slack: "marco", role: "UX Designer", team: "design" },
  { name: "Becca Hartwell", github: "beccah", slack: "becca", role: "Head of Marketing", team: "marketing" },
  { name: "Omar Farouk", github: "ofarouk", slack: "omar", role: "Data Analyst", team: "product" },
  { name: "Jessie Reeves", github: "jreeves", slack: "jessie", role: "Customer Support Lead", team: "support" },
  { name: "Tunde Adeyemi", github: "tundeadeyemi", slack: "tunde", role: "Community Manager", team: "community" },
  { name: "Nadia Kim", github: "nadiakim", slack: "nadia", role: "Security Engineer", team: "engineering" },
  { name: "Charlie Watts", github: "cwatts", slack: "charlie", role: "CFO", team: "finance" },
];

// -- Company constants ----------------------------------------------------------

export const ORG = "serpins-burger-shack";
export const REPO = "serpins-burger-shack/shack-stack";
export const SLACK_WORKSPACE = "serpins";
export const DISCORD_SERVER = "shack-nation";
export const JIRA_PROJECT = "SHACK";

// -- Channels -------------------------------------------------------------------

export const SLACK_CHANNELS = [
  "#engineering", "#product", "#general", "#design", "#marketing",
  "#ops", "#incidents", "#deploys", "#random", "#leadership",
  "#menu-updates", "#kitchen-tech", "#delivery-ops",
];

export const DISCORD_CHANNELS = [
  "general", "menu-feedback", "bug-reports", "feature-requests",
  "announcements", "burger-pics", "loyalty-rewards",
];

// -- Active work items (rotate over time) --------------------------------------

export const PR_TITLES = [
  "Fix order total calculation with combo discounts",
  "Add Apple Pay support to mobile checkout",
  "Implement kitchen display system real-time updates",
  "Fix delivery ETA calculation for multi-stop routes",
  "Add loyalty points redemption at checkout",
  "Refactor menu service to support seasonal items",
  "Fix push notification delivery on Android 14",
  "Add order tracking map with driver location",
  "Implement catering pre-order flow",
  "Fix payment gateway timeout on peak hours",
  "Add allergen filter to menu browsing",
  "Upgrade kitchen printer integration to support new hardware",
  "Add split payment support for group orders",
  "Implement scheduled order pickup time slots",
  "Fix inventory sync between POS and mobile app",
  "Add staff scheduling API for shift management",
  "Implement dynamic pricing for surge delivery periods",
  "Fix location search radius calculation",
  "Add nutritional info display to menu items",
  "Implement order-ahead for drive-thru lane",
];

export const JIRA_TICKETS = [
  { key: "SHACK-201", title: "Mobile app crashes on checkout with promo code", type: "bug", priority: "high" },
  { key: "SHACK-202", title: "Implement curbside pickup notification", type: "story", priority: "high" },
  { key: "SHACK-203", title: "Kitchen display showing wrong prep times", type: "bug", priority: "medium" },
  { key: "SHACK-204", title: "Build catering portal for corporate orders", type: "epic", priority: "high" },
  { key: "SHACK-205", title: "Add tip adjustment after delivery", type: "story", priority: "medium" },
  { key: "SHACK-206", title: "Fix loyalty points not syncing across devices", type: "bug", priority: "high" },
  { key: "SHACK-207", title: "Design new seasonal menu layout", type: "story", priority: "medium" },
  { key: "SHACK-208", title: "Add two-factor auth for manager accounts", type: "story", priority: "high" },
  { key: "SHACK-209", title: "Improve order confirmation email template", type: "task", priority: "low" },
  { key: "SHACK-210", title: "Set up staging environment for kitchen display", type: "task", priority: "medium" },
  { key: "SHACK-211", title: "Delivery driver app GPS tracking accuracy", type: "bug", priority: "high" },
  { key: "SHACK-212", title: "Add group ordering feature for offices", type: "story", priority: "medium" },
];

// -- Community members (Discord fans, not on the team) -------------------------

export const COMMUNITY_MEMBERS = [
  "burger_fanatic42", "shack_regular", "fry_guy_99", "smash_burger_stan",
  "hot_sauce_heather", "double_patty_dan", "milkshake_mel", "veggie_burger_vic",
  "lunch_rush_lisa", "grill_master_gary", "the_bun_whisperer", "cheese_pull_chris",
];

// -- Intercom customers (franchise inquiries, app issues, catering) ------------

export const CUSTOMERS = [
  { name: "Downtown Office Catering", plan: "catering", contact: "admin@downtownoffice.com" },
  { name: "Northside Franchise Group", plan: "franchise", contact: "ops@northsidefranchise.com" },
  { name: "Campus Eats Program", plan: "catering", contact: "dining@stateuniversity.edu" },
  { name: "Mike's Corporate Lunch", plan: "catering", contact: "mike@corpevents.com" },
  { name: "Lakewood Mall Location", plan: "franchise", contact: "manager@lakewoodmall.com" },
  { name: "FoodTruck Festival Org", plan: "events", contact: "events@foodtruckfest.org" },
];

// -- Helpers -------------------------------------------------------------------

/** Pick a random element from an array. */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick N random unique elements from an array. */
export function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** Random integer between min and max (inclusive). */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float between min and max. */
export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Generate a timestamp offset from now by the given minutes range. */
export function recentTimestamp(minMinutesAgo: number, maxMinutesAgo: number): string {
  const offset = randInt(minMinutesAgo, maxMinutesAgo) * 60 * 1000;
  return new Date(Date.now() - offset).toISOString();
}
