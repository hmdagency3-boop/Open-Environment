import { useState } from "react";
import { useGetUserByUid, getGetUserByUidQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, User, Package, Hash, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Search() {
  const [searchInput, setSearchInput] = useState("");
  const [searchUid, setSearchUid] = useState<string | null>(null);

  const { data: userLookup, isLoading, isFetching } = useGetUserByUid(searchUid || "", {
    query: {
      enabled: !!searchUid,
      queryKey: getGetUserByUidQueryKey(searchUid || "")
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchUid(searchInput.trim());
    }
  };

  const loading = isLoading || isFetching;

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
          <SearchIcon className="w-8 h-8" />
          Target Identity
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Query precise user vectors via UID.</p>
      </header>

      <Card className="bg-card rounded-none border-primary/50 shadow-[0_0_10px_rgba(0,240,255,0.05)]">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input 
              placeholder="ENTER_UID..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="font-mono rounded-none bg-background border-border focus-visible:ring-primary text-lg h-12"
              data-testid="input-search-uid"
            />
            <Button 
              type="submit" 
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 font-bold tracking-widest"
              disabled={loading}
              data-testid="button-search"
            >
              {loading ? "QUERYING..." : "EXECUTE"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <Card className="bg-card rounded-none border-border mt-6">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-1/3 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
            <div className="grid grid-cols-3 gap-4 pt-4">
              <Skeleton className="h-24 bg-muted" />
              <Skeleton className="h-24 bg-muted" />
              <Skeleton className="h-24 bg-muted" />
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && userLookup && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-card rounded-none border-border">
            <CardHeader className="border-b border-border pb-3 bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono text-foreground flex items-center gap-2 uppercase tracking-wider">
                <User className="w-4 h-4 text-primary" /> Target Profile
              </CardTitle>
              <Badge variant={userLookup.workerUsed ? "default" : "secondary"} className="rounded-none font-bold">
                {userLookup.workerUsed ? "WORKER_OBTAINED" : "DIRECT_OBTAINED"}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 font-mono space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-border/50 p-3 bg-background/50">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">UID</div>
                  <div className="text-lg font-bold text-foreground">{userLookup.uid}</div>
                </div>
                <div className="border border-border/50 p-3 bg-background/50">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">SOURCE</div>
                  <div className="text-sm font-bold text-foreground">{userLookup.source}</div>
                </div>
                <div className="border border-border/50 p-3 bg-background/50">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">TOTAL GIFTS</div>
                  <div className="text-lg font-bold text-secondary">{userLookup.totalGiftsNum?.toLocaleString() ?? 0}</div>
                </div>
                <div className="border border-border/50 p-3 bg-background/50">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">GIFT TYPES</div>
                  <div className="text-lg font-bold text-accent">{userLookup.totalGiftTypes?.toLocaleString() ?? 0}</div>
                </div>
              </div>
              
              {userLookup.profile && (
                <div className="mt-4 border border-border p-4 bg-background/30">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Hash className="w-3 h-3"/> PROFILE_DUMP</div>
                  <pre className="text-xs text-primary/80 whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {JSON.stringify(userLookup.profile, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card rounded-none border-secondary/30">
            <CardHeader className="border-b border-border pb-3 bg-secondary/5">
              <CardTitle className="text-sm font-mono text-secondary flex items-center gap-2 uppercase tracking-wider">
                <Package className="w-4 h-4" /> Top Gift Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 font-mono p-0">
              {userLookup.topGifts.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {userLookup.topGifts.map((gift, idx) => (
                    <div key={gift.giftId} className="flex justify-between items-center p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground w-6 text-right">#{idx + 1}</span>
                        <div>
                          <div className="font-bold text-foreground uppercase">{gift.giftName}</div>
                          <div className="text-xs text-muted-foreground">ID: {gift.giftId}</div>
                        </div>
                      </div>
                      <div className="font-bold text-secondary text-xl">
                        {gift.num?.toLocaleString() ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm border-t border-border/50">
                  NO_GIFT_ASSETS_FOUND
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
