import { useState } from "react";
import { useGetSession, useGetBalance, useGetExplore, useGetRooms } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Key, Zap, LayoutGrid, Users, Radio, AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const { data: balance, isLoading: balanceLoading } = useGetBalance();
  const { data: explore, isLoading: exploreLoading } = useGetExplore();
  const { data: roomsData, isLoading: roomsLoading } = useGetRooms({ tab: "POPULAR", pageNum: 1, pageSize: 4 });

  const [showInject, setShowInject] = useState(false);
  const [injectFields, setInjectFields] = useState({ ticket: "", access_token: "", uid: "", netEaseToken: "", nimAppKey: "" });
  const [injectState, setInjectState] = useState<"idle"|"loading"|"ok"|"err">("idle");
  const [injectMsg, setInjectMsg] = useState("");

  const sessionExpired = !sessionLoading && session?.ticket_expired;

  async function handleInject(e: React.FormEvent) {
    e.preventDefault();
    setInjectState("loading");
    setInjectMsg("");
    try {
      const res = await fetch("/api/ditto/session/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(injectFields),
      });
      const data = await res.json() as { ok: boolean; uid?: string; ticket_prefix?: string; error?: string };
      if (data.ok) {
        setInjectState("ok");
        setInjectMsg(`Session saved — UID: ${data.uid}, ticket: ${data.ticket_prefix}${(data as Record<string,unknown>).hasNimToken ? " ✓ NIM token" : ""}`);
        setInjectFields({ ticket: "", access_token: "", uid: "", netEaseToken: "", nimAppKey: "" });
        setShowInject(false);
        queryClient.invalidateQueries();
      } else {
        setInjectState("err");
        setInjectMsg(data.error ?? "Failed");
      }
    } catch (err) {
      setInjectState("err");
      setInjectMsg(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <div className="space-y-6">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
          <Activity className="w-8 h-8" />
          Command Center
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">System diagnostic and live telemetry.</p>
      </header>

      {/* ── Session expired banner ── */}
      {sessionExpired && !showInject && (
        <div className="border border-destructive/60 bg-destructive/10 p-4 flex items-start gap-3 font-mono">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-destructive font-bold text-sm uppercase tracking-wider">SESSION EXPIRED</p>
            <p className="text-muted-foreground text-xs mt-1">
              Ticket is invalid — likely due to logout from the app. Inject a fresh session captured from a new login flow.
            </p>
          </div>
          <button
            onClick={() => setShowInject(true)}
            className="shrink-0 text-xs border border-primary/50 text-primary px-3 py-1.5 uppercase tracking-widest font-bold hover:bg-primary/10 transition-colors"
          >
            INJECT SESSION
          </button>
        </div>
      )}

      {/* ── Session injection form ── */}
      {showInject && (
        <div className="border border-primary/40 bg-card p-4 font-mono space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="text-primary font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Inject New Session
            </p>
            <button onClick={() => { setShowInject(false); setInjectState("idle"); }} className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-wider">CANCEL</button>
          </div>
          <p className="text-muted-foreground text-xs">
            Capture a new flow from the Ditto app after re-login and run:<br />
            <code className="text-primary">node re-work/ditto_api.js extract-session &lt;flow_file&gt;</code><br />
            Or paste credentials below directly.
          </p>
          <form onSubmit={handleInject} className="space-y-3">
            {(["uid", "access_token", "ticket"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">{field.replace(/_/g, " ")}</label>
                <input
                  type="text"
                  value={injectFields[field]}
                  onChange={e => setInjectFields(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={field === "uid" ? "281306" : field === "access_token" ? "32-char hex token" : "32-char hex ticket"}
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                  required
                />
              </div>
            ))}
            <div className="border-t border-border/40 pt-3 space-y-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                NIM Chat (optional — needed for live comments)
              </p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">netEaseToken</label>
                <input
                  type="text"
                  value={injectFields.netEaseToken}
                  onChange={e => setInjectFields(p => ({ ...p, netEaseToken: e.target.value }))}
                  placeholder="from /acc/third/login → netEaseToken"
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">NIM App Key (override)</label>
                <input
                  type="text"
                  value={injectFields.nimAppKey}
                  onChange={e => setInjectFields(p => ({ ...p, nimAppKey: e.target.value }))}
                  placeholder="from Frida → getNetEaseKey() (optional)"
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>
            {injectMsg && (
              <p className={`text-xs font-bold ${injectState === "ok" ? "text-primary" : "text-destructive"}`}>
                {injectState === "ok" ? "✅ " : "⚠ "}{injectMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={injectState === "loading"}
              className="w-full border border-primary text-primary py-2 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {injectState === "loading" ? "SAVING..." : "SAVE SESSION"}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-primary/30 rounded-none shadow-[0_0_15px_rgba(0,240,255,0.1)]">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-mono text-primary flex items-center gap-2 uppercase tracking-wider">
              <Key className="w-4 h-4" /> Session Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 font-mono space-y-4">
            {sessionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-muted" />
                <Skeleton className="h-4 w-2/3 bg-muted" />
              </div>
            ) : session ? (
              <>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">UID</span>
                  <span className="font-bold text-foreground">{session.uid || "UNKN"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">TICKET PREFIX</span>
                  <span className="text-foreground truncate max-w-[150px]">{session.ticket_prefix || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">TICKET AGE (MIN)</span>
                  <span className="text-foreground">{session.ticket_age_min ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">STATUS</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.ticket_expired ? "destructive" : "default"} className="rounded-none font-bold uppercase tracking-widest">
                      {session.ticket_expired ? "EXPIRED" : "VALID"}
                    </Badge>
                    {session.ticket_expired && (
                      <button onClick={() => setShowInject(true)} className="text-[10px] text-primary underline uppercase tracking-wider">
                        fix
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-destructive font-bold text-sm">SESSION_DATA_ERR</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-secondary/30 rounded-none shadow-[0_0_15px_rgba(255,0,60,0.1)]">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-mono text-secondary flex items-center gap-2 uppercase tracking-wider">
              <Database className="w-4 h-4" /> Account Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 font-mono space-y-4">
            {balanceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-muted" />
                <Skeleton className="h-4 w-2/3 bg-muted" />
              </div>
            ) : balance ? (
              <>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">DIAMONDS</span>
                  <span className="font-bold text-secondary text-lg">{balance.diamondNum?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">GOLD</span>
                  <span className="font-bold text-accent text-lg">{balance.goldNum?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">COINS</span>
                  <span className="font-bold text-foreground text-lg">{balance.coin?.toLocaleString() ?? 0}</span>
                </div>
              </>
            ) : (
              <div className="text-destructive font-bold text-sm">BALANCE_DATA_ERR</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="bg-card border-border rounded-none lg:col-span-2">
          <CardHeader className="border-b border-border pb-3 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono text-foreground flex items-center gap-2 uppercase tracking-wider">
              <LayoutGrid className="w-4 h-4 text-primary" /> Active Network Nodes
            </CardTitle>
            <Link href="/rooms" className="text-xs text-primary hover:underline uppercase tracking-widest font-bold">
              VIEW_ALL_NODES
            </Link>
          </CardHeader>
          <CardContent className="pt-4 font-mono p-4">
            {roomsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-48 w-full bg-muted" />
                <Skeleton className="h-48 w-full bg-muted" />
              </div>
            ) : roomsData?.rooms && roomsData.rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roomsData.rooms.map((room) => (
                  <div key={room.roomId || Math.random().toString()} className="relative aspect-video group overflow-hidden border border-border">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <Badge className="bg-black/80 text-secondary border border-secondary/50 rounded-none font-bold gap-1 text-[10px] px-1 py-0 h-4">
                        <Radio className="w-2 h-2 animate-pulse" /> LIVE
                      </Badge>
                    </div>
                    {room.cover ? (
                      <img src={room.cover} alt={room.roomName || "Room"} className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground/50 text-xs font-bold uppercase tracking-widest rotate-45">NO_SIGNAL</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
                      <div className="text-sm font-bold text-foreground truncate">{room.roomName || "UNNAMED_NODE"}</div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-primary truncate">UID: {room.uid || "UNKN"}</span>
                        <span className="text-accent flex items-center gap-1 font-bold">
                          <Users className="w-3 h-3" /> {room.onlineNum?.toLocaleString() ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center border border-dashed border-border text-muted-foreground">
                NO_NODES_DETECTED
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none h-full flex flex-col">
          <CardHeader className="border-b border-border pb-3 bg-muted/20 shrink-0">
            <CardTitle className="text-sm font-mono text-foreground flex items-center gap-2 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-accent" /> Telemetry Log
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 font-mono text-sm flex-1 overflow-hidden p-0">
            {exploreLoading ? (
              <div className="p-4"><Skeleton className="h-full w-full bg-muted" /></div>
            ) : explore ? (
              <div className="h-full overflow-auto p-4 max-h-[300px]">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(explore.raw, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-4 text-muted-foreground text-xs">NO_TELEMETRY_DATA</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
