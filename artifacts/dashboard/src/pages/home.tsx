import { useGetSession, useGetBalance, useGetExplore, useGetRooms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Key, Zap, LayoutGrid, Users, Radio } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const { data: balance, isLoading: balanceLoading } = useGetBalance();
  const { data: explore, isLoading: exploreLoading } = useGetExplore();
  const { data: roomsData, isLoading: roomsLoading } = useGetRooms({ tab: "POPULAR", pageNum: 1, pageSize: 4 });

  return (
    <div className="space-y-6">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
          <Activity className="w-8 h-8" />
          Command Center
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">System diagnostic and live telemetry.</p>
      </header>

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
                  <Badge variant={session.ticket_expired ? "destructive" : "default"} className="rounded-none font-bold uppercase tracking-widest">
                    {session.ticket_expired ? "EXPIRED" : "VALID"}
                  </Badge>
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
