// Three Notification Feed layouts on the existing app shell, switchable with
// ?variant=A|B|C. This is a throwaway Knock-development prototype, not product code.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import Knock, { type Feed, type FeedItem, type FeedMetadata } from "@knocklabs/client";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Inbox,
  LoaderCircle,
  MailOpen,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import {
  NOTIFICATION_EXAMPLES,
  type NotificationExampleKey,
} from "~/lib/notification-prototype";
import { UserRole } from "~/db/schema";

type CurrentUser = {
  id: number;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
};

type FeedAuth = {
  knockUserId: string;
  userToken: string;
  publicApiKey: string;
  feedChannelId: string | null;
};

type FeedSnapshot = {
  items: FeedItem[];
  metadata: FeedMetadata;
  loading: boolean;
};

const variants = [
  { key: "A", name: "Quick peek" },
  { key: "B", name: "Activity drawer" },
  { key: "C", name: "Inbox center" },
] as const;

const emptySnapshot: FeedSnapshot = {
  items: [],
  metadata: { total_count: 0, unread_count: 0, unseen_count: 0 },
  loading: false,
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function blockContent(block: FeedItem["blocks"][number]) {
  return "content" in block ? block.content : "";
}

function itemData(item: FeedItem): Record<string, unknown> {
  return item.data && typeof item.data === "object"
    ? (item.data as Record<string, unknown>)
    : {};
}

function itemTitle(item: FeedItem) {
  const fromData = stringValue(itemData(item).title);
  if (fromData) return fromData;
  return (
    item.blocks
      .filter((block) => block.name.toLowerCase().includes("title"))
      .map(blockContent)
      .find(Boolean) ?? "New update"
  );
}

function itemBody(item: FeedItem) {
  const fromData = stringValue(itemData(item).body);
  const fromBlocks = item.blocks
    .filter((block) => !block.name.toLowerCase().includes("title"))
    .map(blockContent)
    .filter(Boolean)
    .join("\n");
  const hasUnrenderedLiquid = /\{\{|\{%/.test(fromBlocks);
  if (hasUnrenderedLiquid && fromData) return fromData;
  return fromBlocks || fromData || "Open your Notification to see the latest update.";
}

function itemHref(item: FeedItem) {
  const href = stringValue(itemData(item).href);
  return href?.startsWith("/") && !href.startsWith("//") ? href : null;
}

function itemCategory(item: FeedItem) {
  return stringValue(itemData(item).category) ?? item.source.key.replaceAll("-", " ");
}

function itemTime(item: FeedItem) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(item.inserted_at));
}

function NotificationText({ item }: { item: FeedItem }) {
  return (
    <>
      <div className="text-sm font-semibold leading-snug">{itemTitle(item)}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {itemBody(item)}
      </p>
    </>
  );
}

function StatusActions({
  item,
  markRead,
}: {
  item: FeedItem;
  markRead: (item: FeedItem) => void;
}) {
  return item.read_at ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5" /> Read
    </span>
  ) : (
    <button
      type="button"
      onClick={() => markRead(item)}
      className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
    >
      Mark read
    </button>
  );
}

function QuickPeek({
  items,
  metadata,
  loading,
  markRead,
  markAllRead,
  refresh,
  triggering,
  trigger,
  error,
  disabled,
}: FeedSnapshot & {
  markRead: (item: FeedItem) => void;
  markAllRead: () => void;
  refresh: () => void;
  triggering: string | null;
  trigger: (key: NotificationExampleKey) => void;
  error: string | null;
  disabled: boolean;
}) {
  return (
    <section className="absolute right-0 top-12 z-40 flex max-h-[min(78vh,620px)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <FeedHeader metadata={metadata} markAllRead={markAllRead} refresh={refresh} />
      <FeedBody items={items} loading={loading} markRead={markRead} />
      <TriggerSamples triggering={triggering} trigger={trigger} error={error} disabled={disabled} />
    </section>
  );
}

function ActivityDrawer({
  items,
  metadata,
  loading,
  markRead,
  markAllRead,
  refresh,
  triggering,
  trigger,
  error,
  close,
  disabled,
}: FeedSnapshot & {
  markRead: (item: FeedItem) => void;
  markAllRead: () => void;
  refresh: () => void;
  triggering: string | null;
  trigger: (key: NotificationExampleKey) => void;
  error: string | null;
  close: () => void;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25" onMouseDown={close}>
      <section
        className="flex h-full w-full max-w-lg flex-col border-l bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your updates</p>
            <h2 className="mt-1 text-xl font-semibold">Activity</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close notifications" className="rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center justify-between border-b px-6 py-3 text-sm">
          <span><strong>{metadata.unread_count}</strong> unread · {items.length} recent</span>
          <div className="flex gap-3">
            <button type="button" onClick={refresh} aria-label="Refresh notifications" className="text-muted-foreground hover:text-foreground"><RefreshCw className="size-4" /></button>
            <button type="button" onClick={markAllRead} className="font-medium text-primary hover:underline">Mark all read</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FeedBody items={items} loading={loading} markRead={markRead} spacious />
        </div>
        <TriggerSamples triggering={triggering} trigger={trigger} error={error} spacious disabled={disabled} />
      </section>
    </div>
  );
}

function InboxCenter({
  items,
  metadata,
  loading,
  markRead,
  markAllRead,
  refresh,
  triggering,
  trigger,
  error,
  close,
  disabled,
}: FeedSnapshot & {
  markRead: (item: FeedItem) => void;
  markAllRead: () => void;
  refresh: () => void;
  triggering: string | null;
  trigger: (key: NotificationExampleKey) => void;
  error: string | null;
  close: () => void;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-4" onMouseDown={close}>
      <section
        className="flex max-h-[min(820px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-primary px-7 py-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/15"><Inbox className="size-6" /></div>
            <div>
              <div className="text-sm text-primary-foreground/75">CADENCE · NOTIFICATION FEED</div>
              <h2 className="mt-1 text-2xl font-semibold">Your inbox</h2>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close notifications" className="rounded-full p-2 hover:bg-white/15"><X className="size-5" /></button>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b bg-muted/30 p-5 md:border-b-0 md:border-r">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Views</div>
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
              <span className="flex items-center gap-2"><MailOpen className="size-4" /> All activity</span>
              <span>{items.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Circle className="size-3 fill-current" /> Unread</span>
              <span>{metadata.unread_count}</span>
            </div>
            <div className="mt-8 rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-amber-500" /> Stay in the loop</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Important course and account updates will be collected here.</p>
            </div>
          </aside>
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div><h3 className="font-semibold">Recent activity</h3><p className="text-xs text-muted-foreground">{metadata.unread_count} unread Notifications</p></div>
              <div className="flex gap-3">
                <button type="button" onClick={refresh} aria-label="Refresh notifications" className="text-muted-foreground hover:text-foreground"><RefreshCw className="size-4" /></button>
                <button type="button" onClick={markAllRead} className="text-sm font-medium text-primary hover:underline">Mark all read</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {loading && items.length === 0 ? <LoadingFeed /> : items.length === 0 ? <EmptyFeed /> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <article key={item.id} className={`rounded-2xl border p-4 ${item.read_at ? "bg-background" : "bg-primary/[0.035] ring-1 ring-primary/10"}`}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">{itemCategory(item)}</span>
                        {!item.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <NotificationText item={item} />
                      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                        <span className="text-xs text-muted-foreground">{itemTime(item)}</span>
                        <StatusActions item={item} markRead={markRead} />
                      </div>
                      {itemHref(item) && <a href={itemHref(item)!} onClick={() => markRead(item)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open in Cadence <ExternalLink className="size-3" /></a>}
                    </article>
                  ))}
                </div>
              )}
            </div>
            <TriggerSamples triggering={triggering} trigger={trigger} error={error} compact disabled={disabled} />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeedHeader({
  metadata,
  markAllRead,
  refresh,
}: {
  metadata: FeedMetadata;
  markAllRead: () => void;
  refresh: () => void;
}) {
  return (
    <div className="border-b px-4 py-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold">Notifications</h2><p className="mt-0.5 text-xs text-muted-foreground">{metadata.unread_count} unread</p></div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={refresh} aria-label="Refresh notifications" className="text-muted-foreground hover:text-foreground"><RefreshCw className="size-4" /></button>
          <button type="button" onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">Mark all read</button>
        </div>
      </div>
    </div>
  );
}

function FeedBody({
  items,
  loading,
  markRead,
  spacious = false,
}: {
  items: FeedItem[];
  loading: boolean;
  markRead: (item: FeedItem) => void;
  spacious?: boolean;
}) {
  if (loading && items.length === 0) return <LoadingFeed />;
  if (items.length === 0) return <EmptyFeed />;

  return (
    <div className={spacious ? "space-y-1" : "overflow-y-auto"}>
      {items.map((item) => (
        <article key={item.id} className={`border-b last:border-0 ${spacious ? "px-1 py-5" : "px-4 py-3.5 hover:bg-muted/40"}`}>
          <div className="flex gap-3">
            <div className={`mt-1 grid size-9 shrink-0 place-items-center rounded-full ${item.read_at ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
              {item.read_at ? <MailOpen className="size-4" /> : <Circle className="size-2.5 fill-current" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><NotificationText item={item} />{!item.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs capitalize text-muted-foreground">{itemCategory(item)} · {itemTime(item)}</span>
                <StatusActions item={item} markRead={markRead} />
              </div>
              {itemHref(item) && <a href={itemHref(item)!} onClick={() => markRead(item)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open in Cadence <ExternalLink className="size-3" /></a>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LoadingFeed() {
  return <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading your Notifications…</div>;
}

function EmptyFeed() {
  return <div className="px-6 py-12 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-muted"><Inbox className="size-5 text-muted-foreground" /></div><p className="mt-3 text-sm font-medium">You’re all caught up</p><p className="mt-1 text-xs text-muted-foreground">New updates will appear here.</p></div>;
}

function TriggerSamples({
  triggering,
  trigger,
  error,
  spacious = false,
  compact = false,
  disabled = false,
}: {
  triggering: string | null;
  trigger: (key: NotificationExampleKey) => void;
  error: string | null;
  spacious?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`border-t bg-muted/20 ${spacious ? "px-6 py-4" : "px-4 py-3"}`}>
      <div className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${compact ? "sm:hidden" : ""}`}><Sparkles className="size-3" /> Prototype · send a sample to the selected user</div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(NOTIFICATION_EXAMPLES) as [NotificationExampleKey, (typeof NOTIFICATION_EXAMPLES)[NotificationExampleKey]][]).map(([key, example]) => (
          <button
            key={key}
            type="button"
            disabled={triggering !== null || disabled}
            onClick={() => trigger(key)}
            className="rounded-full border bg-background px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50"
          >
            {triggering === key ? "Sending…" : example.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function NotificationFeedPrototype({ currentUser }: { currentUser: CurrentUser | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryVariant = searchParams.get("variant")?.toUpperCase();
  const variant = variants.find((option) => option.key === queryVariant)?.key ?? "A";
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<FeedAuth | null>(null);
  const [feedState, setFeedState] = useState<FeedSnapshot>(emptySnapshot);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const feedRef = useRef<Feed | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setAuth(null);
      setFeedState(emptySnapshot);
      setConnectionError(null);
      return;
    }

    let cancelled = false;
    setAuth(null);
    setFeedState(emptySnapshot);
    setConnectionError(null);
    fetch("/api/prototype-notifications/token")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? result.statusText ?? "Unable to sign in to Knock.");
        return result as FeedAuth;
      })
      .then((result) => {
        if (!cancelled) setAuth(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setConnectionError(error instanceof Error ? error.message : "Unable to connect to Knock.");
      });

    return () => {
      cancelled = true;
      feedRef.current?.dispose();
      feedRef.current = null;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!auth?.feedChannelId) return;

    const knock = new Knock(auth.publicApiKey);
    knock.authenticate({ id: auth.knockUserId }, auth.userToken);
    const feed = knock.feeds.initialize(auth.feedChannelId);
    feedRef.current = feed;
    const unsubscribe = feed.store.subscribe((state) => {
      setFeedState({
        items: [...state.items],
        metadata: { ...state.metadata },
        loading: state.loading,
      });
    });
    feed.on("items.received.page", () => setConnectionError(null));
    feed.listenForUpdates();
    feed.fetch().catch((error: unknown) => {
      setConnectionError(error instanceof Error ? error.message : "Knock feed could not be loaded.");
    });

    return () => {
      unsubscribe();
      feed.dispose();
      if (feedRef.current === feed) feedRef.current = null;
    };
  }, [auth]);

  useEffect(() => {
    if (!open || !feedRef.current) return;
    const unseenItems = feedState.items.filter((item) => !item.seen_at);
    if (unseenItems.length) {
      feedRef.current.markAsSeen(unseenItems).catch((error: unknown) => {
        setConnectionError(error instanceof Error ? error.message : "Could not mark Notifications as seen.");
      });
    }
  }, [open, feedState.items]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const index = variants.findIndex((option) => option.key === variant);
      const step = event.key === "ArrowRight" ? 1 : -1;
      updateVariant(variants[(index + step + variants.length) % variants.length].key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // The selected variant is deliberately captured for the key handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  function updateVariant(next: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("variant", next);
    setSearchParams(nextParams, { replace: true });
    setOpen(true);
  }

  function markRead(item: FeedItem) {
    feedRef.current?.markAsRead(item).catch((error: unknown) => {
      setConnectionError(error instanceof Error ? error.message : "Could not mark this Notification as read.");
    });
  }

  function markAllRead() {
    const unread = feedState.items.filter((item) => !item.read_at);
    if (unread.length) {
      feedRef.current?.markAsRead(unread).catch((error: unknown) => {
        setConnectionError(error instanceof Error ? error.message : "Could not mark Notifications as read.");
      });
    }
  }

  function refresh() {
    setNotice(null);
    feedRef.current?.fetch().catch((error: unknown) => {
      setConnectionError(error instanceof Error ? error.message : "Knock feed could not be refreshed.");
    });
  }

  async function trigger(key: NotificationExampleKey) {
    if (!currentUser || !auth?.feedChannelId) {
      setTriggerError("Configure the Knock In-App Feed channel before sending samples.");
      return;
    }

    setTriggering(key);
    setTriggerError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/prototype-notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ example: key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Knock could not queue this sample.");
      setNotice("Sample queued in Knock. The feed will refresh in a moment.");
      window.setTimeout(() => refresh(), 1800);
    } catch (error) {
      setTriggerError(error instanceof Error ? error.message : "Knock could not queue this sample.");
    } finally {
      setTriggering(null);
    }
  }

  if (!import.meta.env.DEV) return null;

  const unreadCount = feedState.metadata.unread_count;
  const missingChannelId = !!auth && !auth.feedChannelId;
  const sharedProps = {
    ...feedState,
    markRead,
    markAllRead,
    refresh,
    triggering,
    trigger,
    error: triggerError,
    disabled: !currentUser || !auth?.feedChannelId,
  };

  return (
    <>
      <div className="fixed right-6 top-4 z-40">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Open Notification Feed${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={open}
          className="relative grid size-11 place-items-center rounded-full border bg-background shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>
        {connectionError && !open && <span className="sr-only" role="status">{connectionError}</span>}
        {open && (
          <>
            {variant === "A" && <QuickPeek {...sharedProps} />}
            {variant === "B" && <ActivityDrawer {...sharedProps} close={() => setOpen(false)} />}
            {variant === "C" && <InboxCenter {...sharedProps} close={() => setOpen(false)} />}
            <div className="pointer-events-none fixed left-1/2 top-[4.25rem] z-[60] -translate-x-1/2">
              <div role="status" className="pointer-events-auto rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
                {connectionError ?? (missingChannelId ? "Add KNOCK_FEED_CHANNEL_ID to .env to connect the feed." : notice ?? (currentUser ? `Knock development · ${currentUser.name} (${currentUser.role})` : "Choose a DevUI user to authenticate."))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full border bg-slate-950 px-3 py-2 text-white shadow-xl">
        <button type="button" aria-label="Previous Notification Feed layout" onClick={() => updateVariant(variants[(variants.findIndex((option) => option.key === variant) + variants.length - 1) % variants.length].key)} className="rounded-full p-1.5 transition hover:bg-white/15"><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={() => updateVariant(variants[(variants.findIndex((option) => option.key === variant) + 1) % variants.length].key)} className="min-w-32 text-center text-xs font-medium" aria-label="Switch Notification Feed layout">
          {variant} · {variants.find((option) => option.key === variant)?.name}
        </button>
        <button type="button" aria-label="Next Notification Feed layout" onClick={() => updateVariant(variants[(variants.findIndex((option) => option.key === variant) + 1) % variants.length].key)} className="rounded-full p-1.5 transition hover:bg-white/15"><ChevronRight className="size-4" /></button>
      </div>
      {open && variant === "A" && (
        <div className="fixed right-6 top-[4.25rem] z-50">
          {!currentUser ? (
            <div className="w-[min(390px,calc(100vw-2rem))] rounded-2xl border bg-background p-5 text-sm shadow-2xl">Select a user from the DevUI panel to exercise signed Knock authentication.</div>
          ) : connectionError ? (
            <div className="w-[min(390px,calc(100vw-2rem))] rounded-2xl border bg-background p-5 text-sm shadow-2xl"><div className="font-semibold">Knock connection needs attention</div><p className="mt-2 text-muted-foreground">{connectionError}</p></div>
          ) : missingChannelId ? (
            <SetupNotice />
          ) : null}
        </div>
      )}
      {open && variant !== "A" && !currentUser && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/30 p-5" onMouseDown={() => setOpen(false)}>
          <div className="max-w-md rounded-2xl border bg-background p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><h2 className="font-semibold">Choose a DevUI user</h2><p className="mt-2 text-sm text-muted-foreground">Switch to a Student, Instructor, Platform Admin, or Team Admin to exercise the signed Knock feed path.</p></div>
        </div>
      )}
    </>
  );
}

function SetupNotice() {
  return (
    <div className="w-[min(390px,calc(100vw-2rem))] rounded-2xl border bg-background p-5 text-sm shadow-2xl">
      <h2 className="font-semibold">Finish Knock development setup</h2>
      <p className="mt-2 text-muted-foreground">The API keys and signed-user path are ready. Create an In-App Feed channel and a development workflow before sending samples.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>In Knock, create an In-App Feed channel and add its ID to <code className="rounded bg-muted px-1">KNOCK_FEED_CHANNEL_ID</code> in the local <code className="rounded bg-muted px-1">.env</code>.</li>
        <li>Create workflow key <code className="rounded bg-muted px-1">cadence-prototype-feed</code> with only an In-App Feed step using that channel.</li>
        <li>Use <code className="rounded bg-muted px-1">data.title</code> and <code className="rounded bg-muted px-1">data.body</code> for the feed content, then restart the dev server.</li>
      </ol>
    </div>
  );
}
