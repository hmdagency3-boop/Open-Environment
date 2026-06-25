import { useState, useEffect, useCallback, useRef } from "react";
import { useGetRooms, getGetRoomsQueryKey, Room, useGetTrtcToken } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, Users, Radio, User, Zap, Copy, Check, Loader2, X, Headphones, Volume2, VolumeX, Mic, MicOff, Search, XCircle } from "lucide-react";
import AgoraRTC, { IAgoraRTCClient, IRemoteAudioTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

const TABS = ["POPULAR", "EG", "SA", "AE"];
const AGORA_APP_ID = "1b77c926d478406cae3174ce0565db4b";
const SESSION_UID = 281306;

AgoraRTC.setLogLevel(4);

type ListenState = "idle" | "fetching" | "connecting" | "listening" | "error";
type TalkState   = "idle" | "fetching" | "connecting" | "talking"   | "error";

interface ActiveSession {
  roomId:      string;
  roomName:    string;
  client:      IAgoraRTCClient;
  audioTracks: IRemoteAudioTrack[];
  muted:       boolean;
  localTrack:  IMicrophoneAudioTrack | null;
  isTalking:   boolean;
  micMuted:    boolean;
}

export default function Rooms() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isMuted,   setIsMuted]   = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<Room[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearchMode = searchQuery.length > 0;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/ditto/rooms/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { ok: boolean; rooms: Room[]; error?: unknown };
      if (data.ok) {
        setSearchResults(data.rooms);
      } else {
        setSearchError("لم يتم العثور على نتائج");
        setSearchResults([]);
      }
    } catch {
      setSearchError("Network error");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchInput("");
    setSearchResults(null);
    setSearchError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const { data: roomList, isLoading } = useGetRooms(
    { tab: activeTab, pageNum: 1, pageSize: 30 },
    { query: { queryKey: getGetRoomsQueryKey({ tab: activeTab, pageNum: 1, pageSize: 30 }) } }
  );

  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      activeSession.audioTracks.forEach(t => t.stop());
      if (activeSession.localTrack) {
        activeSession.localTrack.stop();
        activeSession.localTrack.close();
      }
      await activeSession.client.leave();
    } catch (_) {}
    setActiveSession(null);
    setIsMuted(false);
    setIsMicMuted(false);
  }, [activeSession]);

  const toggleMute = useCallback(() => {
    if (!activeSession) return;
    const newMuted = !isMuted;
    activeSession.audioTracks.forEach(t => {
      if (newMuted) t.stop();
      else t.play();
    });
    setIsMuted(newMuted);
  }, [activeSession, isMuted]);

  const toggleMic = useCallback(async () => {
    if (!activeSession?.localTrack) return;
    const newMicMuted = !isMicMuted;
    await activeSession.localTrack.setMuted(newMicMuted);
    setIsMicMuted(newMicMuted);
  }, [activeSession, isMicMuted]);

  useEffect(() => {
    return () => {
      if (activeSession) {
        activeSession.audioTracks.forEach(t => t.stop());
        if (activeSession.localTrack) {
          activeSession.localTrack.stop();
          activeSession.localTrack.close();
        }
        activeSession.client.leave().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-6 font-mono h-full flex flex-col">
      <header className="border-b border-border pb-4 shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
              <LayoutGrid className="w-8 h-8" />
              Network Nodes
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {isSearchMode
                ? searchLoading
                  ? "Searching..."
                  : searchResults != null
                  ? `${searchResults.length} result(s) for "${searchQuery}"`
                  : "Search rooms by ID or name"
                : roomList?.total != null
                ? `${roomList.total} active broadcasts`
                : "Monitor active broadcast channels."}
            </p>
          </div>

          {/* Tabs — hidden in search mode */}
          {!isSearchMode && (
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
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="ابحث بالـ ID أو الاسم أو الـ keyword..."
              className="w-full bg-background border border-border border-r-0 pl-9 pr-9 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 h-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); if (!isSearchMode) inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!searchInput.trim() || searchLoading}
            className="border border-border border-r bg-primary/10 text-primary hover:bg-primary/20 px-4 h-9 text-xs font-bold tracking-widest uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            بحث
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearch}
              className="border border-border bg-background text-muted-foreground hover:text-foreground px-3 h-9 text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> مسح
            </button>
          )}
        </form>
      </header>

      {/* ── Active session bar ── */}
      {activeSession && (
        <div className={`shrink-0 border px-4 py-3 flex items-center justify-between gap-4 ${
          activeSession.isTalking
            ? "border-green-500/60 bg-green-500/5"
            : "border-primary/60 bg-primary/5"
        }`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`}></span>
            </span>
            <span className={`text-xs font-bold tracking-widest uppercase ${activeSession.isTalking ? "text-green-400" : "text-primary"}`}>
              {activeSession.isTalking ? "BROADCASTING" : "INTERCEPTING"}
            </span>
            <span className="text-xs text-muted-foreground">
              Channel <span className="text-foreground font-bold">{activeSession.roomId}</span>
              {activeSession.roomName && (
                <> · <span className="text-foreground truncate max-w-[200px] inline-block align-bottom">{activeSession.roomName}</span></>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mic toggle — only when talking */}
            {activeSession.isTalking && (
              <button
                onClick={toggleMic}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-widest border transition-colors ${
                  isMicMuted
                    ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                    : "border-green-500/50 text-green-400 hover:bg-green-500/10"
                }`}
              >
                {isMicMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {isMicMuted ? "MIC_OFF" : "MIC_ON"}
              </button>
            )}
            {/* Speaker toggle */}
            <button
              onClick={toggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-widest border transition-colors ${
                isMuted
                  ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {isMuted ? "MUTED" : "LIVE"}
            </button>
            <button
              onClick={stopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-widest border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="w-3 h-3" /> DISCONNECT
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto pb-8">
        {/* Search error */}
        {isSearchMode && searchError && (
          <div className="border border-destructive/40 bg-destructive/5 p-4 text-destructive text-xs font-bold font-mono mb-4">
            ⚠ {searchError}
          </div>
        )}

        {/* Search loading skeleton */}
        {isSearchMode && searchLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full bg-muted rounded-none" />
            ))}
          </div>
        )}

        {/* Search results */}
        {isSearchMode && !searchLoading && searchResults != null && (
          searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {searchResults.map((room: Room, idx: number) => (
                <RoomCard
                  key={room.roomId ?? idx}
                  room={room}
                  isActiveRoom={activeSession?.roomId === String(room.roomId)}
                  isTalking={activeSession?.isTalking ?? false}
                  onListen={async (token) => {
                    await stopSession();
                    const roomIdStr = String(room.roomId);
                    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
                    await client.setClientRole("audience");
                    const tracks: IRemoteAudioTrack[] = [];
                    client.on("user-published", async (user, mediaType) => {
                      if (mediaType === "audio") {
                        const track = await client.subscribe(user, mediaType);
                        tracks.push(track);
                        track.play();
                        setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
                      }
                    });
                    await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);
                    setActiveSession({ roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "", client, audioTracks: tracks, muted: false, localTrack: null, isTalking: false, micMuted: false });
                  }}
                  onTalk={async (token) => {
                    await stopSession();
                    const roomIdStr = String(room.roomId);
                    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
                    await client.setClientRole("host");
                    const tracks: IRemoteAudioTrack[] = [];
                    client.on("user-published", async (user, mediaType) => {
                      if (mediaType === "audio") {
                        const track = await client.subscribe(user, mediaType);
                        tracks.push(track);
                        track.play();
                        setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
                      }
                    });
                    const localTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "music_standard", AEC: true, ANS: true, AGC: true });
                    await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);
                    await client.publish([localTrack]);
                    setActiveSession({ roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "", client, audioTracks: tracks, muted: false, localTrack, isTalking: true, micMuted: false });
                    setIsMicMuted(false);
                  }}
                  onStop={stopSession}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center border border-dashed border-border p-16 text-center text-muted-foreground mt-8">
              <div>
                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold tracking-widest uppercase">NO_RESULTS</p>
                <p className="text-sm mt-2 opacity-60">لا توجد رومات بهذا البحث.</p>
              </div>
            </div>
          )
        )}

        {/* Normal browse loading skeleton */}
        {!isSearchMode && isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full bg-muted rounded-none" />
            ))}
          </div>
        )}

        {/* Normal browse — room grid */}
        {!isSearchMode && !isLoading && roomList?.rooms && roomList.rooms.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {roomList.rooms.map((room: Room, idx: number) => (
              <RoomCard
                key={room.roomId ?? idx}
                room={room}
                isActiveRoom={activeSession?.roomId === String(room.roomId)}
                isTalking={activeSession?.isTalking ?? false}
                onListen={async (token) => {
                  await stopSession();
                  const roomIdStr = String(room.roomId);
                  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
                  await client.setClientRole("audience");
                  const tracks: IRemoteAudioTrack[] = [];
                  client.on("user-published", async (user, mediaType) => {
                    if (mediaType === "audio") {
                      const track = await client.subscribe(user, mediaType);
                      tracks.push(track);
                      track.play();
                      setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
                    }
                  });
                  client.on("user-unpublished", (_user, mediaType) => {
                    if (mediaType === "audio") {
                      setActiveSession(prev => prev ? { ...prev, audioTracks: prev.audioTracks.filter(t => t !== t) } : prev);
                    }
                  });
                  await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);
                  setActiveSession({ roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "", client, audioTracks: tracks, muted: false, localTrack: null, isTalking: false, micMuted: false });
                }}
                onTalk={async (token) => {
                  await stopSession();
                  const roomIdStr = String(room.roomId);
                  const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
                  await client.setClientRole("host");
                  const tracks: IRemoteAudioTrack[] = [];
                  client.on("user-published", async (user, mediaType) => {
                    if (mediaType === "audio") {
                      const track = await client.subscribe(user, mediaType);
                      tracks.push(track);
                      track.play();
                      setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
                    }
                  });
                  const localTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "music_standard", AEC: true, ANS: true, AGC: true });
                  await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);
                  await client.publish([localTrack]);
                  setActiveSession({ roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "", client, audioTracks: tracks, muted: false, localTrack, isTalking: true, micMuted: false });
                  setIsMicMuted(false);
                }}
                onStop={stopSession}
              />
            ))}
          </div>
        )}

        {/* Normal browse — empty state */}
        {!isSearchMode && !isLoading && (!roomList?.rooms || roomList.rooms.length === 0) && (
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

// ── Room card ──────────────────────────────────────────────────────────────────
interface RoomCardProps {
  room:        Room;
  isActiveRoom: boolean;
  isTalking:   boolean;
  onListen:    (token: string) => Promise<void>;
  onTalk:      (token: string) => Promise<void>;
  onStop:      () => Promise<void>;
}

function RoomCard({ room, isActiveRoom, isTalking, onListen, onTalk, onStop }: RoomCardProps) {
  const hasCover = !!room.cover;
  const [showToken,   setShowToken]   = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [listenState, setListenState] = useState<ListenState>("idle");
  const [listenError, setListenError] = useState<string | null>(null);
  const [talkState,   setTalkState]   = useState<TalkState>("idle");
  const [talkError,   setTalkError]   = useState<string | null>(null);

  const { mutate: fetchToken, mutateAsync: fetchTokenAsync, data: tokenData, isPending, reset } = useGetTrtcToken();

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

  async function handleListen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;

    if (isActiveRoom) {
      await onStop();
      setListenState("idle");
      setTalkState("idle");
      return;
    }

    setListenState("fetching");
    setListenError(null);
    try {
      const data = await fetchTokenAsync({ data: { roomId, type: "1", channel: "1" } });
      if (!data?.ok || !data.token) throw new Error(typeof (data as Record<string, unknown>)?.error === "string" ? String((data as Record<string, unknown>).error) : "Token fetch failed");
      setListenState("connecting");
      await onListen(data.token);
      setListenState("listening");
    } catch (err) {
      setListenState("error");
      setListenError(err instanceof Error ? err.message : "Connection failed");
      setTimeout(() => { setListenState("idle"); setListenError(null); }, 4000);
    }
  }

  async function handleTalk(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;

    if (isActiveRoom && isTalking) {
      await onStop();
      setTalkState("idle");
      setListenState("idle");
      return;
    }

    setTalkState("fetching");
    setTalkError(null);
    try {
      const data = await fetchTokenAsync({ data: { roomId, type: "0", channel: "1" } });
      if (!data?.ok || !data.token) throw new Error(typeof (data as Record<string, unknown>)?.error === "string" ? String((data as Record<string, unknown>).error) : "Token fetch failed");
      setTalkState("connecting");
      await onTalk(data.token);
      setTalkState("talking");
    } catch (err) {
      setTalkState("error");
      setTalkError(err instanceof Error ? err.message : "Mic access or connection failed");
      setTimeout(() => { setTalkState("idle"); setTalkError(null); }, 5000);
    }
  }

  useEffect(() => {
    if (!isActiveRoom) {
      setListenState("idle");
      setTalkState("idle");
    }
  }, [isActiveRoom]);

  const listenLabel = isActiveRoom && !isTalking
    ? "LIVE"
    : listenState === "fetching"   ? "TOKEN..."
    : listenState === "connecting" ? "JOINING..."
    : listenState === "error"      ? "ERROR"
    : "INTERCEPT";

  const talkLabel = isActiveRoom && isTalking
    ? "ON_AIR"
    : talkState === "fetching"   ? "TOKEN..."
    : talkState === "connecting" ? "JOINING..."
    : talkState === "error"      ? "ERROR"
    : "TALK";

  return (
    <Card className={`bg-card rounded-none overflow-hidden group transition-colors relative flex flex-col ${
      isActiveRoom
        ? isTalking ? "border-green-500" : "border-primary"
        : "border-border hover:border-primary/50"
    }`}>
      {/* Cover image */}
      <div className="relative w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden shrink-0">
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-black/80 text-secondary border border-secondary/50 rounded-none font-bold gap-1 text-[10px]">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
          </Badge>
        </div>

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

        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-accent">
          <Users className="w-3 h-3" />
          {room.onlineNum?.toLocaleString() ?? 0}
        </div>

        {roomId && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
            {/* INTERCEPT (listen) button */}
            <button
              onClick={handleListen}
              disabled={listenState === "fetching" || listenState === "connecting" || talkState === "fetching" || talkState === "connecting"}
              title="Listen only"
              className={`flex items-center gap-1 border text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                isActiveRoom && !isTalking
                  ? "bg-primary/20 border-primary text-primary"
                  : listenState === "error"
                  ? "bg-destructive/20 border-destructive text-destructive"
                  : "bg-black/70 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary"
              }`}
            >
              {(listenState === "fetching" || listenState === "connecting") ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : isActiveRoom && !isTalking ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              ) : (
                <Headphones className="w-2.5 h-2.5" />
              )}
              {listenLabel}
            </button>

            {/* TALK (broadcast) button */}
            <button
              onClick={handleTalk}
              disabled={listenState === "fetching" || listenState === "connecting" || talkState === "fetching" || talkState === "connecting"}
              title="Join as speaker"
              className={`flex items-center gap-1 border text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                isActiveRoom && isTalking
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : talkState === "error"
                  ? "bg-destructive/20 border-destructive text-destructive"
                  : "bg-black/70 border-green-500/40 text-green-400 hover:bg-green-500/20 hover:border-green-500"
              }`}
            >
              {(talkState === "fetching" || talkState === "connecting") ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : isActiveRoom && isTalking ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
              ) : (
                <Mic className="w-2.5 h-2.5" />
              )}
              {talkLabel}
            </button>

            {/* TRTC token button */}
            <button
              onClick={handleGetToken}
              className="flex items-center gap-1 bg-black/70 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors px-2 py-1 text-[10px] font-bold tracking-widest uppercase"
            >
              <Zap className="w-2.5 h-2.5" /> TRTC
            </button>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-3 flex gap-3 items-start flex-1">
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

          {listenState === "error" && listenError && (
            <p className="text-[10px] text-destructive mt-1 font-bold">⚠ {listenError}</p>
          )}
          {talkState === "error" && talkError && (
            <p className="text-[10px] text-destructive mt-1 font-bold">⚠ {talkError}</p>
          )}
        </div>
      </div>

      {/* TRTC Token panel */}
      {showToken && (
        <div className="border-t border-primary/30 bg-black/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-primary font-bold tracking-widest uppercase flex items-center gap-1">
              <Zap className="w-3 h-3" /> AGORA TOKEN
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
                <span>ch: <span className="text-foreground font-bold">{roomId}</span></span>
                <span>appId: <span className="text-foreground font-bold">{AGORA_APP_ID.slice(0, 8)}…</span></span>
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
