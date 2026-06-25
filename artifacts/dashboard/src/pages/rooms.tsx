import { useState } from "react";
import { useGetRooms, getGetRoomsQueryKey, Room, useGetTrtcToken } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, Users, Radio, User, Zap, Copy, Check, Loader2, X } from "lucide-react";

const TABS = ["POPULAR", "EG", "SA", "AE"];

export default function Rooms() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const { data: roomList, isLoading } = useGetRooms(
    { tab: activeTab, pageNum: 1, pageSize: 30 },
    { query: { queryKey: getGetRoomsQueryKey({ tab: activeTab, pageNum: 1, pageSize: 30 }) } }
  );

  return (
    <div className="space-y-6 font-mono h-full flex flex-col">
      <header className="border-b border-border pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
            <LayoutGrid className="w-8 h-8" />
            Network Nodes
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {roomList?.total != null ? `${roomList.total} active broadcasts` : "Monitor active broadcast channels."}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border border-border w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full bg-muted rounded-none" />
            ))}
          </div>
        ) : roomList?.rooms && roomList.rooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {roomList.rooms.map((room, idx) => (
              <RoomCard key={room.roomId ?? idx} room={room} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center border border-dashed border-border p-16 text-center text-muted-foreground mt-8">
            <div>
              <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold tracking-widest uppercase">NO_NODES_FOUND</p>
              <p className="text-sm mt-2 opacity-60">Selected region is silent.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room }: { room: Room }) {
  const hasCover = !!room.cover;
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const { mutate: fetchToken, data: tokenData, isPending, reset } = useGetTrtcToken();

  const roomId = room.roomId != null ? String(room.roomId) : null;

  function handleGetToken(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;
    setShowToken(true);
    fetchToken({ data: { roomId, type: "1", channel: "1" } });
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    setShowToken(false);
    reset();
    setCopied(false);
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!tokenData?.token) return;
    navigator.clipboard.writeText(tokenData.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="bg-card rounded-none border-border overflow-hidden group hover:border-primary/50 transition-colors relative flex flex-col">
      {/* Cover image */}
      <div className="relative w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {/* LIVE badge */}
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-black/80 text-secondary border border-secondary/50 rounded-none font-bold gap-1 text-[10px]">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
          </Badge>
        </div>

        {/* Country flag + VIP badge stacked top-left */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          {room.countryIcon && (
            <img src={room.countryIcon} alt={room.countryCode ?? ""} className="w-5 h-4 object-cover border border-white/20" />
          )}
          {room.vipName && (
            <span className="bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 leading-none tracking-wide">
              {room.vipName}
            </span>
          )}
        </div>

        {hasCover ? (
          <img
            src={room.cover!}
            alt=""
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <User className="w-10 h-10 text-muted-foreground/30" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        {/* Viewers badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-accent">
          <Users className="w-3 h-3" />
          {room.onlineNum?.toLocaleString() ?? 0}
        </div>

        {/* TRTC button — bottom-left of image */}
        {roomId && (
          <button
            onClick={handleGetToken}
            className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/70 border border-primary/40 text-primary hover:bg-primary/20 hover:border-primary transition-colors px-2 py-1 text-[10px] font-bold tracking-widest uppercase"
          >
            <Zap className="w-2.5 h-2.5" /> TRTC
          </button>
        )}
      </div>

      {/* Info section */}
      <div className="p-3 flex gap-3 items-start flex-1">
        {/* Host avatar */}
        <div className="w-8 h-8 rounded-none border border-border/50 overflow-hidden bg-muted flex items-center justify-center shrink-0">
          {hasCover ? (
            <img src={room.cover!} alt="" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <User className="w-4 h-4 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-sm leading-tight truncate">
            {room.nick ?? room.roomName ?? "UNNAMED"}
          </div>
          {room.roomName && room.nick && room.roomName !== room.nick && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">{room.roomName}</div>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {room.erbanNo != null && (
              <span className="text-[10px] text-primary/70">ID:{room.erbanNo}</span>
            )}
            {room.countryCode && (
              <span className="text-[10px] text-muted-foreground">{room.countryCode}</span>
            )}
            {room.vipName && (
              <span className="text-[10px] text-yellow-400/80">{room.vipName}</span>
            )}
          </div>
        </div>
      </div>

      {/* TRTC Token panel — slides in below info when active */}
      {showToken && (
        <div className="border-t border-primary/30 bg-black/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-primary font-bold tracking-widest uppercase flex items-center gap-1">
              <Zap className="w-3 h-3" /> TRTC Token
            </span>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>

          {isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
            </div>
          ) : tokenData?.ok && tokenData.token ? (
            <>
              <div className="bg-background/80 border border-border/50 p-2 rounded-none">
                <p className="text-[9px] text-primary/70 font-mono break-all leading-relaxed">
                  {tokenData.token}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span>roomId: <span className="text-foreground font-bold">{roomId}</span></span>
                <span>ch: <span className="text-foreground font-bold">{tokenData.channel ?? 1}</span></span>
              </div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-1.5 border border-border/50 hover:border-primary/50 text-[10px] font-bold tracking-widest uppercase py-1.5 transition-colors hover:text-primary"
              >
                {copied ? <><Check className="w-3 h-3 text-green-400" /> COPIED</> : <><Copy className="w-3 h-3" /> COPY TOKEN</>}
              </button>
            </>
          ) : (
            <p className="text-[10px] text-destructive font-bold">
              {tokenData ? "FETCH_FAILED" : "NO_RESPONSE"}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
