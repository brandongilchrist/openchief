import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Save,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  BookOpen,
  Terminal,
} from "lucide-react";
import {
  api,
  type ConnectorConfigResponse,
  type ConnectorConfigField,
  type ConnectionEvent,
} from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  agentId: string;
  agentName: string;
  tools: string[];
}

// ---------------------------------------------------------------------------
// Setup Guide
// ---------------------------------------------------------------------------

interface SetupGuideData {
  title: string;
  manual: { step: string; detail: string }[];
  claudeCode?: string;
}

const SETUP_GUIDES: Record<string, SetupGuideData> = {
  github: {
    title: "GitHub App Setup Guide",
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
          "Under Repository permissions, set the following to Read-only: Commit statuses, Contents, Issues, Metadata (mandatory), Pull requests.",
      },
      {
        step: "Subscribe to events",
        detail:
          "Check these event subscriptions: Create, Delete, Issue comment, Issues, Pull request, Pull request review, Push, Status.",
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
      'You can automate the GitHub App setup using Claude Code with browser automation. Use this prompt:\n\n"Create a new GitHub App for OpenChief on my organization. Navigate to GitHub → Organization Settings → Developer Settings → GitHub Apps → New. Fill in the app name, set the webhook URL to my GitHub connector worker URL, generate a webhook secret, set repository permissions (Commit statuses, Contents, Issues, Pull requests — all Read-only), subscribe to events (Create, Delete, Issue comment, Issues, Pull request, Pull request review, Push, Status), select Only on this account, create the app, generate a private key, install it on the org for all repos, then convert the private key to PKCS#8 and set all the wrangler secrets on the connector worker."',
  },
  slack: {
    title: "Slack App Setup Guide",
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

function SetupGuide({ source }: { source: string }) {
  const guide = SETUP_GUIDES[source];
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "claude">(
    guide?.claudeCode ? "claude" : "manual",
  );
  if (!guide) return null;

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{guide.title}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <CardContent className="pt-0">
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
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
                extension), you can automate the entire setup. Copy the prompt
                below and paste it into Claude Code:
              </p>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs leading-relaxed">
                {guide.claudeCode}
              </pre>
            </div>
          )}
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
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!source) return;
    try {
      const [configData, eventData, accessData] = await Promise.all([
        api
          .get<ConnectorConfigResponse>(`connections/${source}/settings`)
          .catch(() => null),
        api
          .get<ConnectionEvent[]>(`connections/${source}/events?limit=100`)
          .catch(() => []),
        api
          .get<AgentAccess[]>(`connections/${source}/access`)
          .catch(() => []),
      ]);
      setConfig(configData);
      setEvents(eventData);
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

      {/* Setup Guide */}
      {source && SETUP_GUIDES[source] && (
        <SetupGuide source={source} />
      )}

      {/* Configuration */}
      {config && config.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>
              Manage connection credentials and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? ""}
                revealed={revealedFields.has(field.key)}
                onValueChange={(v) => handleFieldChange(field.key, v)}
                onToggleReveal={() => toggleReveal(field.key)}
              />
            ))}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
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
          </CardContent>
        </Card>
      )}

      {/* Agent Access */}
      {agentAccess.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Agent Access</CardTitle>
            </div>
            <CardDescription>
              Agents with tool-based access to this connection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentAccess.map((access) => (
                <div
                  key={access.agentId}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <Link
                    to={`/modules/${access.agentId}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {access.agentName}
                  </Link>
                  <div className="flex gap-1">
                    {access.tools.map((tool) => (
                      <Badge key={tool} variant="secondary" className="text-xs">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">
          {field.label}
          {field.required && (
            <span className="ml-0.5 text-destructive">*</span>
          )}
        </label>
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
        <Input
          type={field.secret && !revealed ? "password" : "text"}
          value={showMasked ? (field.maskedValue ?? "") : value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          disabled={showMasked}
          className="font-mono text-sm"
        />
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
