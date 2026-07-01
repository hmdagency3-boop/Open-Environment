import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Search, Users, Star, Trophy, Globe, Shield,
  Radio, User, AlertTriangle, Wifi, WifiOff, ChevronRight, Hash,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Guild {
  gid:            number | null;
  name:           string | null;
  avatar:         string | null;
  countryIcon:    string | null;
  privilegeLevel: number;
  rank:           number | null;
  type:           number | null;
  certifiedAnchor: boolean;
  isPrivilege:    boolean;
}

interface Room {
  roomId:   number | null;
  roomName: string | null;
  uid:      number | null;
  nick:     string | null;
  avatar:   string | null;
  erbanNo:  number | null;
  online:   number | null;
  roomDesc: string | null;
  countryIcon: string | null;
  countryCode: string | null;
}

interface SearchResult {
  ok:      boolean;
  guilds:  Guild[];
  rooms:   Room[];
  scanned: number;
  workerUsed: boolean;
  error?:  string;
}

interface RankResult {
  ok:          boolean;
  guilds:      Guild[];
  workerUsed:  boolean;
  workerNeeded: boolean;
  error?:      string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const API = "/api/ditto";

async function fetchGuildSearch(q: string): Promise<SearchResult> {
  const r = await fetch(`${API}/guild/search?q=${encodeURIComponent(q)}`);
  return r.json();
}

async function fetchGuildRank(): Promise<RankResult> {
  const r = await fetch(`${API}/guild/rank`);
  return r.json();
}

const PRIVILEGE_LABELS: Record<number, string> = {
  0: "عادية",
  1: "برونزي",
  2: "فضي",
  3: "ذهبي",
  4: "بلاتيني",
  5: "ماسي",
};

const PRIVILEGE_COLORS: Record<number, string> = {
  0: "text-muted-foreground bg-muted",
  1: "text-orange-400 bg-orange-950",
  2: "text-slate-300 bg-slate-800",
  3: "text-yellow-400 bg-yellow-950",
  4: "text-cyan-300 bg-cyan-950",
  5: "text-blue-300 bg-blue-950",
};

// ── Guild Card ─────────────────────────────────────────────────────────────────

function GuildCard({ guild, rank }: { guild: Guild; rank?: number }) {
  const lvl = guild.privilegeLevel ?? 0;
  const badgeClass = PRIVILEGE_COLORS[lvl] ?? PRIVILEGE_COLORS[0];
  const displayRank = rank ?? guild.rank;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Rank badge */}
          {displayRank != null && (
            <div className="flex-shrink-0 w-8 text-center font-bold text-primary text-lg">
              #{displayRank}
            </div>
          )}

          {/* Avatar */}
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
            {guild.avatar ? (
              <img src={guild.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Building2 className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {guild.countryIcon && (
                <img src={guild.countryIcon} alt="" className="w-5 h-4 object-cover rounded-sm" />
              )}
              <span className="font-semibold text-foreground truncate">
                {guild.name ?? "—"}
              </span>
              {guild.certifiedAnchor && (
                <Badge className="text-xs bg-green-900 text-green-300 border-green-700">
                  <Shield className="w-3 h-3 mr-1" />موثق
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">
                GID: {guild.gid ?? "—"}
              </span>
              <Badge className={`text-xs ${badgeClass}`}>
                <Star className="w-3 h-3 mr-1" />
                {PRIVILEGE_LABELS[lvl] ?? `Level ${lvl}`}
              </Badge>
              {guild.type != null && (
                <Badge variant="outline" className="text-xs">
                  نوع {guild.type}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Room Card ──────────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: Room }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border">
            {room.avatar ? (
              <img src={room.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Radio className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {room.countryIcon && (
                <img src={room.countryIcon} alt="" className="w-4 h-3 object-cover rounded-sm" />
              )}
              <span className="font-medium text-foreground text-sm truncate">
                {room.roomName ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {room.nick && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />{room.nick}
                </span>
              )}
              {room.online != null && (
                <span className="flex items-center gap-1 text-green-400">
                  <Users className="w-3 h-3" />{room.online}
                </span>
              )}
              {room.roomId && (
                <span className="font-mono text-muted-foreground">
                  Room #{room.roomId}
                </span>
              )}
            </div>
            {room.roomDesc && (
              <p className="text-xs text-muted-foreground mt-1 truncate opacity-70">
                {room.roomDesc}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Guild() {
  const [inputVal, setInputVal]   = useState("");
  const [searchQ, setSearchQ]     = useState("");

  // Load top guild rankings
  const rankQuery = useQuery({
    queryKey: ["guildRank"],
    queryFn:  fetchGuildRank,
    staleTime: 60_000,
    retry: 1,
  });

  // Search query — only fires when searchQ is set
  const searchQuery = useQuery({
    queryKey: ["guildSearch", searchQ],
    queryFn:  () => fetchGuildSearch(searchQ),
    enabled:  !!searchQ,
    staleTime: 30_000,
    retry: 1,
  });

  const handleSearch = useCallback(() => {
    const v = inputVal.trim();
    if (v) setSearchQ(v);
  }, [inputVal]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const clearSearch = useCallback(() => {
    setSearchQ("");
    setInputVal("");
  }, []);

  const rankData   = rankQuery.data;
  const searchData = searchQuery.data;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto font-mono">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-widest uppercase text-primary">
            GUILD SEARCH
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            بحث عن الوكالات بالـ GID أو الاسم — يشمل الغرف المرتبطة بها
          </p>
        </div>
      </div>

      {/* Known Guild — from session */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2 text-primary text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3 h-3" />
            وكالتك (من الجلسة الحالية)
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
              <img
                src="https://res.sayyouditto.com/Fuj1hgop4ksHFO0TheNekNOsE-pa?imageslim"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <img
                  src="https://pic.vchat-onlie.com/country/flag/1/ic_Saudi_Arabia.png"
                  alt="SA"
                  className="w-5 h-4 object-cover rounded-sm"
                />
                <span className="font-bold text-foreground">زئير الأسود</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono text-muted-foreground">GID: 30</span>
                <Badge className={`text-xs ${PRIVILEGE_COLORS[1]}`}>
                  <Star className="w-3 h-3 mr-1" />{PRIVILEGE_LABELS[1]}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-xs text-primary px-1"
                  onClick={() => { setInputVal("30"); setSearchQ("30"); }}
                >
                  بحث <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search box */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="GID (رقم) أو اسم الوكالة (عربي/انجليزي)..."
            className="pl-9 font-mono bg-muted border-border"
            dir="auto"
          />
        </div>
        <Button onClick={handleSearch} disabled={!inputVal.trim() || searchQuery.isFetching}>
          {searchQuery.isFetching ? (
            <span className="animate-pulse">SCANNING...</span>
          ) : (
            <><Search className="w-4 h-4 mr-2" />SEARCH</>
          )}
        </Button>
        {searchQ && (
          <Button variant="ghost" onClick={clearSearch} className="text-muted-foreground">
            ✕
          </Button>
        )}
      </div>

      {/* Search Results */}
      {searchQ && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Hash className="w-3 h-3" />
            نتائج البحث عن: <span className="text-primary font-bold">{searchQ}</span>
            {searchData?.scanned != null && (
              <span className="ml-auto">— فُحص {searchData.scanned} غرفة</span>
            )}
          </div>

          {searchQuery.isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {searchQuery.isError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                فشل الاتصال بالـ API
              </CardContent>
            </Card>
          )}

          {searchData && !searchQuery.isLoading && (
            <div className="space-y-4">

              {/* Matched Guilds */}
              {searchData.guilds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-primary tracking-wider">
                    <Trophy className="w-3 h-3" />
                    وكالات مطابقة ({searchData.guilds.length})
                  </div>
                  {searchData.guilds.map((g, i) => (
                    <GuildCard key={g.gid ?? i} guild={g} />
                  ))}
                </div>
              )}

              {/* Matching Rooms */}
              {searchData.rooms.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-primary tracking-wider">
                    <Radio className="w-3 h-3" />
                    غرف تحمل الاسم ({searchData.rooms.length})
                  </div>
                  {searchData.rooms.map((room, i) => (
                    <RoomCard key={room.roomId ?? i} room={room} />
                  ))}
                </div>
              )}

              {/* No results */}
              {searchData.guilds.length === 0 && searchData.rooms.length === 0 && (
                <Card className="border-border bg-muted/30">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p>لم يُعثر على وكالات أو غرف تحمل هذا الاسم/الـ GID</p>
                    {!searchData.workerUsed && (
                      <p className="text-xs mt-2 opacity-70">
                        قائمة الوكالات محمية بـ CDN — وصّل الـ worker من النوكس للوصول الكامل
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Guild Rankings */}
      {!searchQ && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase font-bold text-primary tracking-wider">
              <Trophy className="w-3 h-3" />
              ترتيب الوكالات (TOP GUILDS)
            </div>

            {/* CDN / Worker status */}
            {rankData && (
              <div className="flex items-center gap-1 text-xs">
                {rankData.workerNeeded ? (
                  <Badge variant="outline" className="border-yellow-700 text-yellow-400 gap-1">
                    <WifiOff className="w-3 h-3" />CDN LOCKED
                  </Badge>
                ) : rankData.workerUsed ? (
                  <Badge variant="outline" className="border-green-700 text-green-400 gap-1">
                    <Wifi className="w-3 h-3" />VIA WORKER
                  </Badge>
                ) : rankData.ok ? (
                  <Badge variant="outline" className="border-green-700 text-green-400 gap-1">
                    <Wifi className="w-3 h-3" />LIVE
                  </Badge>
                ) : null}
              </div>
            )}
          </div>

          {/* Loading skeletons */}
          {rankQuery.isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* CDN locked message */}
          {rankData?.workerNeeded && !rankQuery.isLoading && (
            <Card className="border-yellow-800/40 bg-yellow-950/20">
              <CardContent className="p-6 text-center space-y-2">
                <WifiOff className="w-8 h-8 mx-auto text-yellow-500 opacity-70" />
                <p className="text-sm text-yellow-400 font-semibold">
                  قائمة الوكالات محجوبة من Replit (CDN Geo-Lock)
                </p>
                <p className="text-xs text-muted-foreground">
                  وصّل الـ Frida worker من جهاز النوكس للوصول لقائمة الوكالات الكاملة
                </p>
                <div className="mt-3 text-xs text-muted-foreground/60 font-mono bg-muted rounded p-2 text-left">
                  frida -U -l frida_hook_ditto.js -n ditto
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guild list */}
          {rankData?.ok && rankData.guilds.length > 0 && (
            <div className="space-y-2">
              {rankData.guilds.map((g, i) => (
                <div
                  key={g.gid ?? i}
                  className="cursor-pointer group"
                  onClick={() => { setInputVal(String(g.gid ?? g.name ?? "")); setSearchQ(String(g.gid ?? g.name ?? "")); }}
                >
                  <div className="group-hover:ring-1 group-hover:ring-primary/40 rounded-lg transition-all">
                    <GuildCard guild={g} rank={i + 1} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {rankQuery.isError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                فشل تحميل قائمة الوكالات
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tips */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Globe className="w-3 h-3" />استراتيجية البحث
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <span className="text-primary">رقم (GID)</span> — بيبحث في قائمة الوكالات الرسمية + يشوف الغرف</li>
            <li>• <span className="text-primary">اسم عربي/إنجليزي</span> — بيفتش في عناوين ووصف أكتر من 700 غرفة</li>
            <li>• <span className="text-primary">Worker متصل</span> — بيتجاوز الـ CDN lock ويجيب كل الوكالات</li>
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
