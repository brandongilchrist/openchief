import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Save,
  Eye,
  EyeOff,
  Loader2,
  BookOpen,
  Terminal,
  Settings,
  Activity,
  Users,
  Zap,
} from "lucide-react";
import { BarChart, Bar, CartesianGrid, XAxis } from "recharts";
import {
  api,
  type ConnectorConfigResponse,
  type ConnectorConfigField,
  type ConnectionEvent,
} from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SourceIcon } from "@/components/SourceIcon";

interface AgentAccess {
  id: string;
  name: string;
  tools: string[];
}

interface ConnectionStats {
  volume: { date: string; count: number }[];
  eventTypes: { eventType: string; count: number }[];
  topActors: { actor: string; count: number }[];
}

const EVENT_TYPE_COLORS = [
  "#34d399", "#fbbf24", "#818cf8", "#f87171",
  "#38bdf8", "#fb923c", "#a78bfa", "#4ade80",
  "#f472b6", "#94a3b8",
];

// ---------------------------------------------------------------------------
// Connection Charts
// ---------------------------------------------------------------------------

function EventVolumeChart({ data }: { data: ConnectionStats["volume"] }) {
  const { chartData, totalEvents } = useMemo(() => {
    const byDate: Record<string, number> = {};
    let totalEvents = 0;
    for (const row of data) {
      byDate[row.date] = row.count;
      totalEvents += row.count;
    }
    const chartData: { date: string; label: string; events: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      chartData.push({ date: key, label, events: byDate[key] || 0 });
    }
    return { chartData, totalEvents };
  }, [data]);

  const chartConfig: ChartConfig = {
    events: { label: "Events", color: "#34d399" },
  };

  return (
    <Card className="flex flex-col gap-0 py-3">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Event Volume</CardTitle>
        <CardDescription className="text-xs">Last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {totalEvents === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/40">
            <Activity className="h-8 w-8" />
            <span className="text-xs font-medium">No events yet</span>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[120px] w-full">
            <BarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => v.slice(0, 3)} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="events" fill="#34d399" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="pt-1 pb-0 px-4">
        <div className="text-xs text-muted-foreground leading-none">
          {totalEvents > 0
            ? `${totalEvents.toLocaleString()} events in the last 30 days`
            : "Waiting for events"}
        </div>
      </CardFooter>
    </Card>
  );
}

function EventTypesChart({ data }: { data: ConnectionStats["eventTypes"] }) {
  const { chartData, topType } = useMemo(() => {
    const chartData = data.map((row, i) => ({
      type: row.eventType,
      count: row.count,
      fill: EVENT_TYPE_COLORS[i % EVENT_TYPE_COLORS.length],
    }));
    const topType = data.length > 0 ? data[0].eventType : null;
    return { chartData, topType };
  }, [data]);

  const chartConfig: ChartConfig = {};
  for (const row of chartData) {
    chartConfig[row.type] = { label: row.type, color: row.fill };
  }

  return (
    <Card className="flex flex-col gap-0 py-3">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Event Types</CardTitle>
        <CardDescription className="text-xs">Top types by volume</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/40">
            <Zap className="h-8 w-8" />
            <span className="text-xs font-medium">No events yet</span>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[120px] w-full">
            <BarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="type" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="pt-1 pb-0 px-4">
        <div className="text-xs text-muted-foreground leading-none">
          {topType
            ? `Most common: ${topType}`
            : "Waiting for events"}
        </div>
      </CardFooter>
    </Card>
  );
}

function ConsumersCard({
  agents,
  events,
}: {
  agents: AgentAccess[];
  events: ConnectionEvent[];
}) {
  const lastEvent = events.length > 0 ? events[0] : null;
  const uniqueActors = useMemo(() => {
    const actors = new Set<string>();
    for (const e of events) {
      if (e.actor) actors.add(e.actor);
    }
    return actors.size;
  }, [events]);

  return (
    <Card className="flex flex-col gap-0 py-3">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Connection Info</CardTitle>
        <CardDescription className="text-xs">Agents &amp; activity</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Subscribing agents</span>
            <span className="text-sm font-medium">{agents.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Unique actors</span>
            <span className="text-sm font-medium">{uniqueActors}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ingestion</span>
            <Badge variant="outline" className="text-xs">Webhook + Poll</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last event</span>
            <span className="text-xs font-medium">
              {lastEvent ? timeAgo(lastEvent.timestamp) : "—"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-1 pb-0 px-4">
        <div className="flex flex-wrap gap-1">
          {agents.slice(0, 5).map((a) => (
            <Link key={a.id} to={`/modules/${a.id}`}>
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-accent">
                {a.name}
              </Badge>
            </Link>
          ))}
          {agents.length > 5 && (
            <Badge variant="secondary" className="text-xs">
              +{agents.length - 5} more
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Setup Guide Data
// ---------------------------------------------------------------------------

interface SetupGuideData {
  manual: { step: string; detail: string }[];
  claudeCode?: string;
}

const SETUP_GUIDES: Record<string, SetupGuideData> = {
  github: {
    manual: [
      {
        step: "Create a GitHub App",
        detail:
          'Go to your GitHub organization Settings → Developer settings → GitHub Apps → New GitHub App. Set the app name (e.g. "openchief-internal"), homepage URL to your OpenChief repo, and a description.',
      },
      {
        step: "Configure webhook",
        detail:
          "Set the Webhook URL to your GitHub connector worker URL (e.g. https://your-worker.your-team.workers.dev). Generate a random webhook secret (openssl rand -hex 20) and enter it in the Webhook secret field.",
      },
      {
        step: "Set repository permissions",
        detail:
          "Under Repository permissions, set the following to Read-only: Actions, Commit statuses, Contents, Deployments, Issues, Metadata (mandatory), Pull requests.",
      },
      {
        step: "Subscribe to events",
        detail:
          "Check these event subscriptions: Create, Delete, Deployment, Deployment status, Issue comment, Issues, Pull request, Pull request review, Pull request review comment, Push, Release, Status, Workflow run.",
      },
      {
        step: 'Select "Only on this account" and create the app',
        detail:
          "Keep the app private to your organization. Click Create GitHub App. Note the App ID shown on the next page.",
      },
      {
        step: "Generate a private key",
        detail:
          'Scroll down to "Private keys" on the app settings page and click Generate a private key. A .pem file will download. Convert it to PKCS#8 format: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in downloaded.pem -out pkcs8.pem',
      },
      {
        step: "Install the app",
        detail:
          'Click "Install App" in the sidebar, select your organization, choose "All repositories" (or select specific repos), and click Install. Note the Installation ID from the URL (the number at the end).',
      },
      {
        step: "Enter credentials",
        detail:
          "Fill in the fields below with: App ID, Private Key (PKCS#8 PEM content), Installation ID, Webhook Secret, Repos (comma-separated, e.g. org/repo1,org/repo2), and an Admin Secret for the /poll endpoint.",
      },
    ],
    claudeCode:
      'You can automate the GitHub App setup using Claude Code with browser automation. Use this prompt:\n\n"Create a new GitHub App for OpenChief on my organization. Navigate to GitHub → Organization Settings → Developer Settings → GitHub Apps → New. Fill in the app name, set the webhook URL to my GitHub connector worker URL, generate a webhook secret, set repository permissions (Actions, Commit statuses, Contents, Deployments, Issues, Pull requests — all Read-only), subscribe to events (Create, Delete, Deployment, Deployment status, Issue comment, Issues, Pull request, Pull request review, Pull request review comment, Push, Release, Status, Workflow run), select Only on this account, create the app, generate a private key, install it on the org for all repos, then convert the private key to PKCS#8 and set all the wrangler secrets on the connector worker."',
  },
  slack: {
    manual: [
      {
        step: "Create a Slack App",
        detail:
          "Go to api.slack.com/apps and click Create New App → From scratch. Name it (e.g. OpenChief) and select your workspace.",
      },
      {
        step: "Configure bot permissions",
        detail:
          "Under OAuth & Permissions, add these Bot Token Scopes: channels:history, channels:read, groups:history, groups:read, users:read, users:read.email, reactions:read.",
      },
      {
        step: "Enable Event Subscriptions",
        detail:
          "Turn on Event Subscriptions and set the Request URL to your Slack connector worker URL. Subscribe to bot events: message.channels, message.groups, reaction_added, member_joined_channel.",
      },
      {
        step: "Install to workspace and get credentials",
        detail:
          "Install the app to your workspace. Copy the Bot User OAuth Token (xoxb-...) and the Signing Secret from Basic Information. Enter them below along with an Admin Secret.",
      },
    ],
    claudeCode:
      'Use Claude Code with browser automation: "Create a new Slack App for OpenChief on my workspace at api.slack.com. Set up bot permissions for reading channels, groups, users, and reactions. Enable Event Subscriptions with my Slack connector worker URL. Install to the workspace and set the wrangler secrets (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, ADMIN_SECRET)."',
  },
};

// ---------------------------------------------------------------------------
// Configuration (unified: setup guide + credentials)
// ---------------------------------------------------------------------------

function SetupGuideContent({ guide }: { guide: SetupGuideData }) {
  const [activeTab, setActiveTab] = useState<"manual" | "claude">(
    guide.claudeCode ? "claude" : "manual",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Setup Guide</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-3 w-3" />
          Manual Setup
        </button>
        {guide.claudeCode && (
          <button
            onClick={() => setActiveTab("claude")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "claude"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-3 w-3" />
            Claude Code
          </button>
        )}
      </div>

      {activeTab === "manual" ? (
        <ol className="space-y-3">
          {guide.manual.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{item.step}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you have Claude Code with browser automation (MCP Chrome
            extension), you can automate the entire setup. Copy the prompt below
            and paste it into Claude Code:
          </p>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs leading-relaxed">
            {guide.claudeCode}
          </pre>
        </div>
      )}
    </div>
  );
}

function ConfigurationSection({
  source,
  config,
  fieldValues,
  revealedFields,
  hasChanges,
  saving,
  onFieldChange,
  onToggleReveal,
  onSave,
}: {
  source: string;
  config: ConnectorConfigResponse;
  fieldValues: Record<string, string>;
  revealedFields: Set<string>;
  hasChanges: boolean;
  saving: boolean;
  onFieldChange: (key: string, value: string) => void;
  onToggleReveal: (key: string) => void;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const guide = SETUP_GUIDES[source] ?? null;

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Configuration</span>
          <span className="text-xs text-muted-foreground">
            {guide ? "Setup guide, credentials & settings" : "Manage connection credentials and settings"}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <CardContent className="space-y-6 pt-0">
          {/* Setup Guide (if available for this source) */}
          {guide && (
            <>
              <SetupGuideContent guide={guide} />
              <Separator />
            </>
          )}

          {/* Credential Fields */}
          <div className="space-y-4">
            {config.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? ""}
                revealed={revealedFields.has(field.key)}
                onValueChange={(v) => onFieldChange(field.key, v)}
                onToggleReveal={() => onToggleReveal(field.key)}
              />
            ))}
            <div className="flex justify-end pt-2">
              <Button
                onClick={onSave}
                disabled={!hasChanges || saving}
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ConnectionDetail
// ---------------------------------------------------------------------------

export function ConnectionDetail() {
  const { source } = useParams<{ source: string }>();
  const [config, setConfig] = useState<ConnectorConfigResponse | null>(null);
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  const [agentAccess, setAgentAccess] = useState<AgentAccess[]>([]);
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!source) return;
    try {
      const [configData, eventData, accessData, statsData] = await Promise.all([
        api
          .get<ConnectorConfigResponse>(`connections/${source}/settings`)
          .catch(() => null),
        api
          .get<ConnectionEvent[]>(`connections/${source}/events?limit=100`)
          .catch(() => []),
        api
          .get<{ agents: AgentAccess[] }>(`connections/${source}/access`)
          .then((d) => d?.agents ?? [])
          .catch(() => []),
        api
          .get<ConnectionStats>(`connections/${source}/stats`)
          .catch(() => null),
      ]);
      setConfig(configData);
      setEvents(eventData);
      setStats(statsData);
      setAgentAccess(accessData);
    } catch (err) {
      console.error("Failed to load connection:", err);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleReveal(key: string) {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!source) return;
    setSaving(true);
    try {
      await api.put(`connections/${source}/settings`, fieldValues);
      setFieldValues({});
      await loadData();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.keys(fieldValues).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="capitalize">{config?.label ?? source}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SourceIcon name={source ?? ""} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {config?.label ?? source}
          </h1>
          {config?.workerName && (
            <p className="text-sm text-muted-foreground">
              Worker: {config.workerName}
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      {stats && events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <EventVolumeChart data={stats.volume} />
          <EventTypesChart data={stats.eventTypes} />
          <ConsumersCard agents={agentAccess} events={events} />
        </div>
      )}

      {/* Configuration (setup guide + credentials) */}
      {config && config.fields.length > 0 && source && (
        <ConfigurationSection
          source={source}
          config={config}
          fieldValues={fieldValues}
          revealedFields={revealedFields}
          hasChanges={hasChanges}
          saving={saving}
          onFieldChange={handleFieldChange}
          onToggleReveal={toggleReveal}
          onSave={handleSave}
        />
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Events</CardTitle>
          <CardDescription>
            Last {events.length} events from this source
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {event.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {event.summary}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.actor ?? "--"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.project ?? "--"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {timeAgo(event.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow sub-component
// ---------------------------------------------------------------------------

function FieldRow({
  field,
  value,
  revealed,
  onValueChange,
  onToggleReveal,
}: {
  field: ConnectorConfigField;
  value: string;
  revealed: boolean;
  onValueChange: (value: string) => void;
  onToggleReveal: () => void;
}) {
  const showMasked = field.secret && field.configured && !value && !revealed;
  const isMultiline = field.key.includes("private_key") || field.key.includes("pem");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={field.key}>
          {field.label}
          {field.required && (
            <span className="ml-0.5 text-destructive">*</span>
          )}
        </Label>
        {field.configured && (
          <Badge variant="secondary" className="text-xs">
            Configured
          </Badge>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <div className="flex gap-2">
        {isMultiline && !showMasked ? (
          <Textarea
            id={field.key}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={field.placeholder ?? undefined}
            className="min-h-[80px] font-mono text-sm"
            rows={4}
          />
        ) : (
          <Input
            id={field.key}
            type={field.secret && !revealed ? "password" : "text"}
            value={showMasked ? (field.maskedValue ?? "") : value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={field.placeholder ?? undefined}
            disabled={showMasked}
            className="font-mono text-sm"
          />
        )}
        {field.secret && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleReveal}
            type="button"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {field.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Last updated {timeAgo(field.updatedAt)}
        </p>
      )}
    </div>
  );
}
