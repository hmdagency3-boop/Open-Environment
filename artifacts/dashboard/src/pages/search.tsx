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
import { SearchIcon, User, Package, Hash, Users, Star, AlertTriangle, Radio } from "lucide-react";

type SearchMode = "uid" | "name";

export default function Search() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SearchMode>("uid");
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    if (mode === "uid") { setActiveUid(v); setActiveQuery(null); }
    else                { setActiveQuery(v); setActiveUid(null); }
  };

  const drillIntoUid = (uid: string | number | null | undefined) => {
    if (!uid) return;
    setMode("uid");
    setInput(String(uid));
    setActiveUid(String(uid));
    setActiveQuery(null);
  };

  const loading = giftsLoading || giftsFetching || profileLoading || profileFetching || searchLoading || searchFetching;

  // ── Source badge text ──────────────────────────────────────────────────────
  const sourceBadge = profile?.source === "live_room"
    ? { label: "LIVE_ROOM", cls: "bg-red-500/20 text-red-400 border-red-500/30" }
    : profile?.workerUsed
    ? { label: "WORKER",    cls: "bg-green-500/20 text-green-400 border-green-500/30" }
    : profile?.ok
    ? { label: "DIRECT",    cls: "bg-primary/20 text-primary border-primary/30" }
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
          <SearchIcon className="w-8 h-8" />
          Profile Intel
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Search by UID for gift history and live profile data.
        </p>
      </header>

      {/* Mode tabs */}
      <div className="flex gap-0 border border-border w-fit">
        {(["uid", "name"] as SearchMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-6 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "uid" ? "By UID" : "By Name / ID"}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <Card className="bg-card rounded-none border-primary/50">
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

      {/* Worker needed notice (only for name search with no worker) */}
      {!loading && searchResult && !searchResult.ok && searchResult.workerNeeded && (
        <div className="flex items-center gap-3 border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-yellow-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Name search requires the Egyptian worker to be running.
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <Card className="bg-card rounded-none border-border">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-1/3 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 bg-muted" />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NAME SEARCH RESULTS ─────────────────────────────────────────── */}
      {!loading && searchResult && searchResult.ok && mode === "name" && (
        <Card className="bg-card rounded-none border-border animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="border-b border-border pb-3 bg-muted/10 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 text-primary" /> Search Results
            </CardTitle>
            <span className="text-xs text-muted-foreground">{searchResult.users.length} found</span>
          </CardHeader>
          <CardContent className="p-0">
            {searchResult.users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">NO_RESULTS_FOUND</div>
            ) : (
              <div className="divide-y divide-border/50">
                {searchResult.users.map((u, i) => (
                  <div
                    key={String(u.uid ?? i)}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => drillIntoUid(u.uid)}
                  >
                    <Avatar src={u.avatar} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{u.nickname ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        UID: {u.uid ?? "—"}{u.erbanNo ? ` | ID: ${u.erbanNo}` : ""}
                      </div>
                    </div>
                    <div className="text-right space-y-0.5 shrink-0">
                      {u.fansNum != null && <div className="text-xs text-muted-foreground">{u.fansNum.toLocaleString()} fans</div>}
                      {u.level != null && <div className="text-xs text-primary">Lv {u.level}</div>}
                    </div>
                    <span className="text-primary text-xs">VIEW &gt;</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── UID PROFILE RESULTS ─────────────────────────────────────────── */}
      {!loading && activeUid && mode === "uid" && (gifts || profile) && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {/* Profile card */}
          <Card className="bg-card rounded-none border-primary/30">
            <CardHeader className="border-b border-border pb-3 bg-muted/10 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2 uppercase tracking-wider">
                <User className="w-4 h-4 text-primary" /> Profile
              </CardTitle>
              <div className="flex gap-2 items-center">
                {profile?.online === true && (
                  <Badge className="rounded-none font-bold bg-red-500/20 text-red-400 border border-red-500/30 gap-1 text-[10px]">
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                  </Badge>
                )}
                {sourceBadge && (
                  <Badge className={`rounded-none font-bold border text-[10px] ${sourceBadge.cls}`}>
                    {sourceBadge.label}
                  </Badge>
                )}
                {profile?.workerNeeded && !profile?.ok && (
                  <Badge variant="outline" className="rounded-none font-bold text-muted-foreground border-border text-[10px]">
                    NOT_FOUND_OFFLINE
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex gap-5 items-start">
                {/* Avatar + country */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-20 h-20 border border-border/60 overflow-hidden bg-muted flex items-center justify-center">
                    {profile?.avatar ? (
                      <img src={profile.avatar} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <User className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  {profile?.countryIcon && (
                    <img src={profile.countryIcon} alt={profile.countryCode ?? ""} className="w-7 h-5 object-cover border border-border/40" />
                  )}
                </div>

                {/* Info grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <InfoCell label="UID"       value={gifts?.uid ?? activeUid} color="text-primary" />
                  <InfoCell label="NICKNAME"  value={profile?.nickname} />
                  <InfoCell label="ERBAN_NO"  value={profile?.erbanNo != null ? String(profile.erbanNo) : undefined} />
                  <InfoCell label="FANS"      value={profile?.fansNum?.toLocaleString()} color="text-secondary" />
                  <InfoCell label="FOLLOWING" value={profile?.followNum?.toLocaleString()} />
                  <InfoCell label="COUNTRY"   value={profile?.countryName ?? profile?.countryCode} />
                  <InfoCell label="VIP"       value={profile?.vipName}   color="text-yellow-400" />
                  <InfoCell label="LEVEL"     value={profile?.level != null ? `Lv ${profile.level}` : undefined} color="text-accent" />
                  <InfoCell label="DIAMOND"   value={profile?.diamond != null ? String(profile.diamond) : undefined} color="text-yellow-300" />
                  {profile?.signature && (
                    <InfoCell label="SIGNATURE" value={profile.signature} wide />
                  )}
                </div>
              </div>

              {/* Source note */}
              {profile?.source === "live_room" && (
                <div className="mt-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
                  Profile extracted from live room — user is currently broadcasting.
                  Fans / following / diamond data requires worker.
                </div>
              )}
              {profile?.workerNeeded && !profile?.ok && (
                <div className="mt-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
                  User not found in active rooms. Start the Egyptian worker to fetch full profile.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gift stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="TOTAL GIFTS"  value={gifts?.totalGiftsNum?.toLocaleString() ?? "—"} color="text-secondary" />
            <StatCard label="GIFT TYPES"   value={gifts?.totalGiftTypes?.toLocaleString() ?? "—"} color="text-accent" />
            <StatCard label="DATA SOURCE"  value={gifts?.source?.toUpperCase() ?? "—"} color="text-muted-foreground" />
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
                    <div key={gift.giftId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                      <span className="text-muted-foreground w-5 text-right text-xs shrink-0">#{idx + 1}</span>
                      <div className="w-9 h-9 border border-border/40 overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {gift.icon ? (
                          <img src={gift.icon} alt={gift.giftName ?? ""} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <Star className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold uppercase text-sm truncate">{gift.giftName}</div>
                        <div className="text-xs text-muted-foreground">ID: {gift.giftId}</div>
                      </div>
                      <div className="font-bold text-secondary text-base shrink-0">
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
              NO_GIFT_DATA for UID {activeUid}
            </div>
          )}

          {/* Raw dump (worker/api only) */}
          {profile?.ok && profile.raw && profile.source === "api" && (
            <Card className="bg-card rounded-none border-border/30">
              <CardHeader className="border-b border-border/30 pb-2 bg-muted/5">
                <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <Hash className="w-3 h-3" /> Raw Profile Dump
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <pre className="text-xs text-primary/60 whitespace-pre-wrap max-h-60 overflow-auto leading-relaxed">
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ src, size = 10 }: { src?: string | null; size?: number }) {
  return (
    <div className={`w-${size} h-${size} border border-border/50 overflow-hidden bg-muted flex items-center justify-center shrink-0`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <User className="w-4 h-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function InfoCell({ label, value, color = "text-foreground", wide = false }: {
  label: string; value?: string | null; color?: string; wide?: boolean;
}) {
  return (
    <div className={`border border-border/40 px-3 py-2 bg-background/40 ${wide ? "col-span-2 md:col-span-3" : ""}`}>
      <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold truncate ${color} ${!value ? "opacity-25" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border/50 px-4 py-4 bg-card">
      <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
