import { useState } from "react";
import {
  useGetUserByUid, getGetUserByUidQueryKey,
  useGetUserProfile, getGetUserProfileQueryKey,
  useSearchUsers, getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, User, Package, Hash, Users, Star, AlertTriangle, Wifi } from "lucide-react";

type SearchMode = "uid" | "name";

export default function Search() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SearchMode>("uid");

  // ── UID-based state ──────────────────────────────────────────────────────────
  const [activeUid, setActiveUid] = useState<string | null>(null);

  // ── Name-based state ─────────────────────────────────────────────────────────
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: gifts, isLoading: giftsLoading, isFetching: giftsFetching } = useGetUserByUid(
    activeUid ?? "",
    { query: { enabled: !!activeUid && mode === "uid", queryKey: getGetUserByUidQueryKey(activeUid ?? "") } }
  );

  const { data: profile, isLoading: profileLoading, isFetching: profileFetching } = useGetUserProfile(
    activeUid ?? "",
    { query: { enabled: !!activeUid && mode === "uid", queryKey: getGetUserProfileQueryKey(activeUid ?? "") } }
  );

  const { data: searchResult, isLoading: searchLoading, isFetching: searchFetching } = useSearchUsers(
    { q: activeQuery ?? "" },
    { query: { enabled: !!activeQuery && mode === "name", queryKey: getSearchUsersQueryKey({ q: activeQuery ?? "" }) } }
  );

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    if (mode === "uid") {
      setActiveUid(v);
      setActiveQuery(null);
    } else {
      setActiveQuery(v);
      setActiveUid(null);
    }
  };

  const handleSelectUser = (uid: string | number | null | undefined) => {
    if (!uid) return;
    setMode("uid");
    setInput(String(uid));
    setActiveUid(String(uid));
    setActiveQuery(null);
  };

  const loading = giftsLoading || giftsFetching || profileLoading || profileFetching || searchLoading || searchFetching;

  const workerNeeded = (profile?.workerNeeded && !profile?.ok) || (searchResult && !searchResult.ok && searchResult.workerNeeded);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
          <SearchIcon className="w-8 h-8" />
          Profile Intel
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Search by UID for gift history and profile data, or by name/ID to discover accounts.
        </p>
      </header>

      {/* Mode tabs */}
      <div className="flex gap-0 border border-border w-fit">
        {(["uid", "name"] as SearchMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-6 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "uid" ? "By UID" : "By Name / ID"}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <Card className="bg-card rounded-none border-primary/50 shadow-[0_0_10px_rgba(0,240,255,0.05)]">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder={mode === "uid" ? "ENTER_UID (e.g. 281306)..." : "ENTER_NAME or erbanNo..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono rounded-none bg-background border-border focus-visible:ring-primary text-lg h-12"
            />
            <Button
              type="submit"
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 font-bold tracking-widest"
              disabled={loading}
            >
              {loading ? "QUERYING..." : "EXECUTE"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Worker needed notice */}
      {workerNeeded && (
        <div className="flex items-center gap-3 border border-yellow-500/50 bg-yellow-500/5 px-4 py-3 text-yellow-400 text-sm font-mono">
          <Wifi className="w-4 h-4 shrink-0" />
          <span>
            Worker offline — profile &amp; search require the Egyptian worker to be connected.
            Gift history is still available via UID.
          </span>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <Card className="bg-card rounded-none border-border">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-1/3 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 bg-muted" />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NAME SEARCH RESULTS ─────────────────────────────────────────────────── */}
      {!loading && searchResult && mode === "name" && (
        <Card className="bg-card rounded-none border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="border-b border-border pb-3 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono text-foreground flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 text-primary" /> Search Results
            </CardTitle>
            <div className="flex items-center gap-2">
              {searchResult.workerUsed && (
                <Badge className="rounded-none font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                  WORKER
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{searchResult.users.length} found</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {searchResult.users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">NO_RESULTS_FOUND</div>
            ) : (
              <div className="divide-y divide-border/50">
                {searchResult.users.map((u, i) => (
                  <div
                    key={String(u.uid ?? i)}
                    className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => handleSelectUser(u.uid)}
                  >
                    <div className="w-10 h-10 rounded-none overflow-hidden border border-border/50 shrink-0 bg-muted flex items-center justify-center">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{u.nickname ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        UID: {u.uid ?? "—"} {u.erbanNo ? `| ID: ${u.erbanNo}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {u.fansNum != null && (
                        <div className="text-xs text-muted-foreground">{u.fansNum.toLocaleString()} fans</div>
                      )}
                      {u.level != null && (
                        <div className="text-xs text-primary">Lv {u.level}</div>
                      )}
                    </div>
                    <div className="text-primary text-xs">VIEW &gt;</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── UID RESULTS ─────────────────────────────────────────────────────────── */}
      {!loading && activeUid && mode === "uid" && (gifts || profile) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Profile card */}
          <Card className="bg-card rounded-none border-primary/40">
            <CardHeader className="border-b border-border pb-3 bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono text-foreground flex items-center gap-2 uppercase tracking-wider">
                <User className="w-4 h-4 text-primary" /> Profile
              </CardTitle>
              <div className="flex gap-2">
                {profile?.workerUsed && (
                  <Badge className="rounded-none font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                    WORKER
                  </Badge>
                )}
                {profile?.workerNeeded && !profile?.ok && (
                  <Badge variant="outline" className="rounded-none font-bold text-yellow-400 border-yellow-500/40">
                    WORKER_NEEDED
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex gap-5 items-start flex-wrap">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-none border border-border/60 overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                {/* Core info */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
                  <InfoCell label="UID" value={gifts?.uid ?? activeUid} color="text-primary" />
                  <InfoCell label="NICKNAME" value={profile?.nickname} />
                  <InfoCell label="ERBAN_NO" value={profile?.erbanNo} />
                  <InfoCell label="FANS" value={profile?.fansNum?.toLocaleString()} color="text-secondary" />
                  <InfoCell label="FOLLOWING" value={profile?.followNum?.toLocaleString()} />
                  <InfoCell label="LEVEL" value={profile?.level != null ? `Lv ${profile.level}` : undefined} color="text-accent" />
                  <InfoCell label="DIAMOND" value={profile?.diamond != null ? String(profile.diamond) : undefined} color="text-yellow-400" />
                  <InfoCell label="STATUS" value={profile?.online != null ? (profile.online ? "ONLINE" : "OFFLINE") : undefined}
                    color={profile?.online ? "text-green-400" : "text-muted-foreground"} />
                  <InfoCell label="SIGNATURE" value={profile?.signature} wide />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gift stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="TOTAL GIFTS" value={gifts?.totalGiftsNum?.toLocaleString() ?? "—"} color="text-secondary" />
            <StatCard label="GIFT TYPES" value={gifts?.totalGiftTypes?.toLocaleString() ?? "—"} color="text-accent" />
            <StatCard label="SOURCE" value={gifts?.source?.toUpperCase() ?? "—"} color="text-muted-foreground" />
          </div>

          {/* Top gifts */}
          {gifts && gifts.topGifts.length > 0 && (
            <Card className="bg-card rounded-none border-secondary/30">
              <CardHeader className="border-b border-border pb-3 bg-secondary/5">
                <CardTitle className="text-sm font-mono text-secondary flex items-center gap-2 uppercase tracking-wider">
                  <Package className="w-4 h-4" /> Top Received Gifts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {gifts.topGifts.map((gift, idx) => (
                    <div key={gift.giftId} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <span className="text-muted-foreground w-5 text-right text-xs shrink-0">#{idx + 1}</span>
                      <div className="w-9 h-9 rounded-none border border-border/40 overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {gift.icon ? (
                          <img src={gift.icon} alt={gift.giftName ?? ""} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <Star className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground uppercase text-sm truncate">{gift.giftName}</div>
                        <div className="text-xs text-muted-foreground">ID: {gift.giftId}</div>
                      </div>
                      <div className="font-bold text-secondary text-lg shrink-0">
                        {gift.num?.toLocaleString() ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No gifts */}
          {gifts && gifts.topGifts.length === 0 && (
            <div className="flex items-center gap-3 border border-border px-4 py-6 text-muted-foreground text-sm justify-center">
              <AlertTriangle className="w-4 h-4" />
              NO_GIFT_DATA_FOUND for UID {activeUid}
            </div>
          )}

          {/* Raw dump (profile only shown when worker returned data) */}
          {profile?.ok && profile.raw && (
            <Card className="bg-card rounded-none border-border/40">
              <CardHeader className="border-b border-border/40 pb-2 bg-muted/10">
                <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <Hash className="w-3 h-3" /> Raw Profile Dump
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <pre className="text-xs text-primary/70 whitespace-pre-wrap max-h-[250px] overflow-auto leading-relaxed">
                  {JSON.stringify(profile.raw, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function InfoCell({ label, value, color = "text-foreground", wide = false }: {
  label: string; value?: string | null; color?: string; wide?: boolean;
}) {
  return (
    <div className={`border border-border/40 px-3 py-2 bg-background/40 ${wide ? "col-span-2 md:col-span-3" : ""}`}>
      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold truncate ${color} ${!value ? "opacity-30" : ""}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border/50 px-4 py-4 bg-card">
      <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
