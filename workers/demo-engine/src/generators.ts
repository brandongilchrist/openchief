/**
 * Event generators -- one function per source, each returns a batch of
 * realistic OpenChiefEvents spread over the last ~30 minutes.
 */

import type { OpenChiefEvent } from "@openchief/shared";
import { generateULID } from "@openchief/shared";
import {
  TEAM, ORG, REPO, SLACK_WORKSPACE, DISCORD_SERVER, JIRA_PROJECT,
  SLACK_CHANNELS, DISCORD_CHANNELS, PR_TITLES, JIRA_TICKETS,
  COMMUNITY_MEMBERS, CUSTOMERS,
  pick, pickN, randInt, randFloat, recentTimestamp,
} from "./world";

const now = (): string => new Date().toISOString();

// -- GitHub events --------------------------------------------------------------

export function generateGitHubEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];
  const engineers = TEAM.filter(m => m.team === "engineering");

  // 2-4 PR events per cycle
  const prCount = randInt(2, 4);
  for (let i = 0; i < prCount; i++) {
    const author = pick(engineers);
    const prNum = randInt(200, 500);
    const title = pick(PR_TITLES);
    const action = pick(["opened", "merged", "closed", "synchronize"] as const);
    const additions = randInt(5, 300);
    const deletions = randInt(1, 100);
    const files = randInt(1, 20);
    const reviewers = pickN(engineers.filter(e => e.github !== author.github), randInt(1, 3));
    const labels = pickN(["feature", "bug", "refactor", "security", "performance", "docs", "breaking"], randInt(0, 3));
    const ts = recentTimestamp(1, 25);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "github",
      eventType: action === "merged" ? "pr.merged" : action === "synchronize" ? "pr.synchronize" : `pr.${action}`,
      scope: { org: ORG, project: REPO, actor: author.name },
      payload: {
        number: prNum,
        title,
        action,
        additions,
        deletions,
        changed_files: files,
        labels,
        draft: false,
        requested_reviewers: reviewers.map(r => r.github),
        author: author.github,
        url: `https://github.com/${REPO}/pull/${prNum}`,
      },
      summary: `PR #${prNum} "${title}" was ${action} by ${author.name} in ${REPO} | +${additions}/-${deletions} files=${files}${labels.length ? ` | labels=[${labels.join(",")}]` : ""}`,
      tags: labels.includes("security") ? ["security"] : undefined,
    });
  }

  // 1-3 reviews
  const reviewCount = randInt(1, 3);
  for (let i = 0; i < reviewCount; i++) {
    const reviewer = pick(engineers);
    const prNum = randInt(200, 500);
    const state = pick(["approved", "changes_requested", "commented"] as const);
    const ts = recentTimestamp(1, 25);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "github",
      eventType: `review.submitted`,
      scope: { org: ORG, project: REPO, actor: reviewer.name },
      payload: {
        pr_number: prNum,
        state,
        reviewer: reviewer.github,
        time_to_review_hours: randFloat(0.5, 24),
      },
      summary: `${reviewer.name} ${state.replace("_", " ")} PR #${prNum} in ${REPO}`,
    });
  }

  // 0-1 build events
  if (Math.random() > 0.4) {
    const branch = pick([
      "main",
      "feature/apple-pay-checkout",
      "fix/delivery-eta-calculation",
      "feature/kitchen-display-v2",
      "fix/loyalty-points-sync",
      "feature/catering-portal",
      "fix/combo-discount-rounding",
      "feature/order-tracking-map",
    ]);
    const conclusion = Math.random() > 0.15 ? "success" : "failure";
    const triggerer = pick(engineers);
    const ts = recentTimestamp(1, 20);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "github",
      eventType: conclusion === "success" ? "build.succeeded" : "build.failed",
      scope: { org: ORG, project: REPO, actor: triggerer.name },
      payload: {
        workflow: "CI / Build & Test",
        branch,
        conclusion,
        triggering_actor: triggerer.github,
        duration_seconds: randInt(60, 600),
      },
      summary: `Build ${conclusion} on ${branch} in ${REPO} (triggered by ${triggerer.name})`,
      tags: conclusion === "failure" ? ["build-failure"] : undefined,
    });
  }

  return events;
}

// -- Slack events ---------------------------------------------------------------

export function generateSlackEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];
  const messageCount = randInt(8, 20);

  const slackMessages = [
    "Deployed mobile app v3.2.1 to TestFlight -- looks good so far",
    "Can someone review my PR for the combo discount fix? Been open since yesterday",
    "The ordering API is throwing 500s again during lunch rush, investigating",
    "Catering demo with Downtown Office went well! They want to set up weekly orders",
    "Sprint retro at 3pm today, don't forget",
    "Fixed the kitchen display lag -- it was a websocket reconnect loop on the ticket queue",
    "New menu board mockups are in Figma, feedback welcome",
    "Heads up: deploying menu service migration at 2pm UTC",
    "The revamped checkout flow increased order completion by 12%",
    "Anyone else seeing high latency on the delivery tracking endpoint?",
    "Quick standup update: Apple Pay integration is 80% done, should land tomorrow",
    "Merged the loyalty points PR -- please test redemption flow when you get a chance",
    "Support ticket volume is up 15% this week, mostly curbside pickup issues",
    "Reminder: security review for the payment gateway is Thursday",
    "Good news: menu page load time dropped 40% after the image CDN changes",
    "Can we schedule a design review for the catering portal?",
    "FYI: the staging DB will be down for 10 min at 4pm for maintenance",
    "The A/B test results are in -- larger food photos increased add-to-cart by 8%",
    "Just shipped the allergen filter to 10% of users, monitoring for issues",
    "Customer feedback from Lakewood Mall: they love the new drive-thru order-ahead feature",
    "Build is green again, the flaky kitchen display test was fixed",
    "Working on the split payment feature today, need help with the Stripe multi-charge flow",
    "Location #12 is live on the app! Grand opening promo codes are ready",
    "Quarterly menu review doc is ready in Notion -- seasonal items need approval",
    "The order caching layer is saving us ~$200/day in API costs during peak hours",
    "Delivery driver app GPS accuracy improved after the last patch -- complaints down 30%",
    "Franchise group from Northside wants a demo of the analytics dashboard",
    "The new kitchen printer integration is working great at the downtown location",
  ];

  for (let i = 0; i < messageCount; i++) {
    const member = pick(TEAM);
    const channel = pick(SLACK_CHANNELS);
    const isThread = Math.random() > 0.7;
    const text = pick(slackMessages);
    const ts = recentTimestamp(1, 28);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "slack",
      eventType: isThread ? "thread.replied" : "message.posted",
      scope: { org: SLACK_WORKSPACE, project: channel, actor: member.name },
      payload: {
        channel_name: channel.replace("#", ""),
        user_name: member.slack,
        text,
        is_thread: isThread,
      },
      summary: `${member.name} ${isThread ? "replied" : ""} in ${channel}: ${text}`,
    });
  }

  // 1-2 reactions
  for (let i = 0; i < randInt(1, 2); i++) {
    const member = pick(TEAM);
    const channel = pick(SLACK_CHANNELS);
    const emoji = pick(["+1", "eyes", "rocket", "fire", "thinking_face", "white_check_mark", "tada"]);
    const ts = recentTimestamp(1, 28);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "slack",
      eventType: "reaction.added",
      scope: { org: SLACK_WORKSPACE, project: channel, actor: member.name },
      payload: { emoji, channel_name: channel.replace("#", "") },
      summary: `${member.name} reacted with :${emoji}: in ${channel}`,
    });
  }

  return events;
}

// -- Discord events -------------------------------------------------------------

export function generateDiscordEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];
  const messageCount = randInt(3, 8);

  const communityMessages = [
    "Just tried the new spicy jalapeño smash burger -- absolute fire 🔥",
    "Is the loyalty rewards program live at all locations yet?",
    "The mobile app crashed when I tried to use a promo code at checkout",
    "Feature request: let us save favorite customizations for repeat orders!",
    "Just posted my review on the new seasonal shake -- 10/10",
    "The drive-thru order-ahead is a game changer, no more waiting in line",
    "Thanks for adding the allergen info! Makes ordering so much easier",
    "Any plans to open a location on the east side of town?",
    "The app is so much faster since the last update, great work team!",
    "Tried to order delivery but my address keeps showing as out of range",
    "Would love a veggie patty option that isn't just a garden burger",
    "Shack Nation meetup at the downtown location this Saturday! Who's in?",
    "The new combo deals are amazing -- saved $5 on my family order",
    "Anyone else think the bacon cheese fries need to be a permanent menu item?",
    "Just hit 500 loyalty points! What should I redeem them for?",
  ];

  for (let i = 0; i < messageCount; i++) {
    const isTeam = Math.random() > 0.6;
    const actor = isTeam ? pick(TEAM).name : pick(COMMUNITY_MEMBERS);
    const channel = pick(DISCORD_CHANNELS);
    const text = pick(communityMessages);
    const isThread = Math.random() > 0.7;
    const ts = recentTimestamp(1, 28);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "discord",
      eventType: isThread ? "thread.replied" : "message.posted",
      scope: { org: DISCORD_SERVER, project: channel, actor },
      payload: {
        channel_name: channel,
        author: actor,
        content: text,
        is_reply: isThread,
      },
      summary: `${actor} ${isThread ? "replied " : ""}in #${channel}: ${text}`,
    });
  }

  return events;
}

// -- Jira events ----------------------------------------------------------------

export function generateJiraEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];
  const count = randInt(2, 5);

  const transitions = ["To Do -> In Progress", "In Progress -> In Review", "In Review -> Done", "Done -> Deployed"];
  const productPeople = TEAM.filter(m => ["product", "engineering"].includes(m.team));

  for (let i = 0; i < count; i++) {
    const ticket = pick(JIRA_TICKETS);
    const actor = pick(productPeople);
    const isTransition = Math.random() > 0.4;
    const ts = recentTimestamp(1, 28);

    if (isTransition) {
      const transition = pick(transitions);
      events.push({
        id: generateULID(),
        timestamp: ts,
        ingestedAt: now(),
        source: "jira",
        eventType: "issue.transitioned",
        scope: { org: ORG, project: JIRA_PROJECT, actor: actor.name },
        payload: {
          key: ticket.key,
          title: ticket.title,
          type: ticket.type,
          priority: ticket.priority,
          transition,
          assignee: actor.name,
        },
        summary: `${actor.name} moved ${ticket.key} "${ticket.title}" ${transition}`,
      });
    } else {
      const action = pick(["commented", "updated", "created"] as const);
      events.push({
        id: generateULID(),
        timestamp: ts,
        ingestedAt: now(),
        source: "jira",
        eventType: `issue.${action}`,
        scope: { org: ORG, project: JIRA_PROJECT, actor: actor.name },
        payload: {
          key: ticket.key,
          title: ticket.title,
          type: ticket.type,
          priority: ticket.priority,
          action,
        },
        summary: `${actor.name} ${action} ${ticket.key} "${ticket.title}"`,
      });
    }
  }

  return events;
}

// -- Figma events ---------------------------------------------------------------

export function generateFigmaEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];
  const designers = TEAM.filter(m => m.team === "design" || m.role.includes("Designer"));
  const files = [
    "Mobile Order Flow v3", "Menu Board Design", "Catering Portal",
    "Delivery Tracking Map", "Kitchen Display UI", "Loyalty Rewards Dashboard",
    "Drive-Thru Order-Ahead", "Marketing Landing Page",
  ];

  if (Math.random() > 0.3) {
    const designer = pick(designers.length ? designers : TEAM);
    const file = pick(files);
    const ts = recentTimestamp(1, 25);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "figma",
      eventType: "file.version_updated",
      scope: { org: ORG, project: file, actor: designer.name },
      payload: {
        file_name: file,
        version_label: pick(["", "Ready for review", "Final", "WIP", ""]),
        editor: designer.name,
      },
      summary: `${designer.name} updated "${file}" in Figma`,
    });
  }

  // Occasional comment
  if (Math.random() > 0.5) {
    const commenter = pick(TEAM);
    const file = pick(files);
    const comment = pick([
      "Looks great! The menu item cards feel much more tappable now",
      "Can we try our brand red for the order CTA? The gray blends in",
      "The cart summary is confusing -- subtotal vs total with delivery fee look too similar",
      "Love this direction for the catering flow. Let's present it to Derek Thursday",
      "This needs to match our design system tokens -- the font weight is off",
      "The kitchen ticket layout needs bigger text -- line cooks can't read it from 6ft away",
      "Order tracking animation is slick! Can we add the driver's ETA?",
    ]);
    const ts = recentTimestamp(1, 25);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "figma",
      eventType: "file.comment",
      scope: { org: ORG, project: file, actor: commenter.name },
      payload: { file_name: file, comment, commenter: commenter.name },
      summary: `${commenter.name} commented on "${file}": ${comment}`,
    });
  }

  return events;
}

// -- Intercom events ------------------------------------------------------------

export function generateIntercomEvents(): OpenChiefEvent[] {
  const events: OpenChiefEvent[] = [];

  const topics = [
    "We want to set up weekly catering orders for 200+ employees -- what's the process?",
    "How do I access the franchise analytics dashboard?",
    "Billing question: can we get volume pricing for our campus dining program?",
    "Getting an error when trying to schedule a large catering order for next Friday",
    "We'd like to add our own branded packaging -- is that part of the franchise agreement?",
    "The delivery tracking link we send to customers isn't loading on mobile",
    "Need help setting up the POS integration at our new Lakewood Mall location",
    "Can we get custom loyalty rewards tiers for our franchise locations?",
    "Our food truck event is in 3 weeks -- can we set up a special event menu?",
    "The kitchen display system keeps disconnecting from the printer at our downtown store",
  ];

  const count = randInt(1, 3);
  for (let i = 0; i < count; i++) {
    const customer = pick(CUSTOMERS);
    const topic = pick(topics);
    const isNew = Math.random() > 0.4;
    const ts = recentTimestamp(1, 28);

    events.push({
      id: generateULID(),
      timestamp: ts,
      ingestedAt: now(),
      source: "intercom",
      eventType: isNew ? "conversation.opened" : "conversation.replied",
      scope: { org: ORG, actor: customer.contact },
      payload: {
        customer_name: customer.name,
        plan: customer.plan,
        contact: customer.contact,
        topic,
        state: isNew ? "open" : "active",
      },
      summary: `${customer.name} (${customer.plan}): ${topic}`,
    });
  }

  return events;
}

// -- Amplitude metrics ----------------------------------------------------------

export function generateAmplitudeEvents(): OpenChiefEvent[] {
  // Metrics snapshot -- emitted less frequently (every other cycle)
  if (Math.random() > 0.5) return [];

  const ts = recentTimestamp(1, 10);
  const dailyOrders = randInt(800, 2200);
  const weeklyOrders = randInt(4500, 14000);
  const avgOrderValue = randFloat(12.50, 18.75);
  const mobileOrderPct = randFloat(38, 62);
  const avgDeliveryMin = randFloat(22, 38);
  const loyaltyRedemptionRate = randFloat(8, 22);

  return [{
    id: generateULID(),
    timestamp: ts,
    ingestedAt: now(),
    source: "amplitude",
    eventType: "metrics.snapshot",
    scope: { org: ORG, project: "ordering-platform" },
    payload: {
      daily_orders: dailyOrders,
      weekly_orders: weeklyOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      mobile_order_pct: Math.round(mobileOrderPct * 10) / 10,
      avg_delivery_time_min: Math.round(avgDeliveryMin * 10) / 10,
      loyalty_redemption_rate: Math.round(loyaltyRedemptionRate * 10) / 10,
      top_events: ["menu_viewed", "add_to_cart", "checkout_started", "order_placed", "delivery_tracked"],
      top_menu_items: ["Classic Smash Burger", "Bacon Cheese Fries", "Shack Shake", "Spicy Jalapeño Burger"],
      retention_d7: randFloat(25, 45),
    },
    summary: `Metrics snapshot: ${dailyOrders} daily orders, ${weeklyOrders} weekly, avg $${avgOrderValue.toFixed(2)}, ${mobileOrderPct.toFixed(0)}% mobile, ${avgDeliveryMin.toFixed(0)}min avg delivery`,
  }];
}

// -- Google Analytics -----------------------------------------------------------

export function generateGoogleAnalyticsEvents(): OpenChiefEvent[] {
  // Less frequent -- every other cycle
  if (Math.random() > 0.4) return [];

  const ts = recentTimestamp(1, 10);
  const pageviews = randInt(5000, 15000);
  const users = randInt(1500, 5000);
  const bounceRate = randFloat(30, 50);
  const onlineOrderStarts = randInt(400, 1200);

  return [{
    id: generateULID(),
    timestamp: ts,
    ingestedAt: now(),
    source: "google-analytics",
    eventType: "traffic.snapshot",
    scope: { org: ORG, project: "serpinsburgers.com" },
    payload: {
      pageviews,
      active_users: users,
      bounce_rate: Math.round(bounceRate * 10) / 10,
      online_order_starts: onlineOrderStarts,
      top_pages: ["/menu", "/order", "/locations", "/catering", "/loyalty-rewards", "/careers"],
      top_sources: ["google", "instagram.com", "yelp.com", "direct", "doordash.com"],
      top_locations: { "Downtown": 28, "Lakewood Mall": 18, "University Ave": 15, "Northside": 12, "Airport": 10 },
    },
    summary: `Site overview: ${pageviews} pageviews, ${users} users, ${bounceRate.toFixed(1)}% bounce, ${onlineOrderStarts} online orders started`,
  }];
}

// -- Combined generator ---------------------------------------------------------

export function generateEventBatch(): OpenChiefEvent[] {
  return [
    ...generateGitHubEvents(),
    ...generateSlackEvents(),
    ...generateDiscordEvents(),
    ...generateJiraEvents(),
    ...generateFigmaEvents(),
    ...generateIntercomEvents(),
    ...generateAmplitudeEvents(),
    ...generateGoogleAnalyticsEvents(),
  ];
}
