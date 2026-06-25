import { useState } from "react";
import { useGetRooms, getGetRoomsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Users, Radio } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = ["POPULAR", "EG", "SA", "AE"];

export default function Rooms() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const { data: roomList, isLoading } = useGetRooms({
    tab: activeTab,
    pageNum: 1,
    pageSize: 30
  }, {
    query: {
      queryKey: getGetRoomsQueryKey({ tab: activeTab, pageNum: 1, pageSize: 30 })
    }
  });

  return (
    <div className="space-y-6 font-mono h-full flex flex-col">
      <header className="border-b border-border pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-widest uppercase flex items-center gap-3">
            <LayoutGrid className="w-8 h-8" />
            Network Nodes
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Monitor active broadcast channels.</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-card border border-border rounded-none h-12 w-full">
            {TABS.map(tab => (
              <TabsTrigger 
                key={tab} 
                value={tab} 
                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest h-full flex-1 md:w-24"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <div className="flex-1 overflow-auto pr-2 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full bg-muted rounded-none" />
            ))}
          </div>
        ) : roomList?.rooms && roomList.rooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:grid-cols-4 gap-4">
            {roomList.rooms.map((room) => (
              <Card key={room.roomId || Math.random().toString()} className="bg-card rounded-none border-border overflow-hidden group hover:border-primary transition-colors cursor-pointer relative">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  <Badge className="bg-black/80 text-secondary border border-secondary/50 rounded-none font-bold gap-1">
                    <Radio className="w-3 h-3 animate-pulse" /> LIVE
                  </Badge>
                </div>
                
                <div className="aspect-[3/4] w-full relative bg-muted flex items-center justify-center overflow-hidden">
                  {room.cover ? (
                    <img 
                      src={room.cover} 
                      alt={room.roomName || "Room Cover"} 
                      className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%2327272a" width="100" height="100"/%3E%3Ctext fill="%23a1a1aa" font-family="monospace" font-size="12" x="50" y="50" text-anchor="middle" dominant-baseline="middle"%3ENO COVER%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div className="text-muted-foreground/50 font-bold uppercase tracking-widest text-xl rotate-45">NO_SIGNAL</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                    <div className="text-sm font-bold text-foreground truncate">{room.roomName || "UNNAMED_NODE"}</div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-primary truncate">UID: {room.uid || "UNKN"}</span>
                      <span className="text-accent flex items-center gap-1 font-bold">
                        <Users className="w-3 h-3" /> {room.onlineNum?.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center border border-dashed border-border p-12 text-center text-muted-foreground">
            <div>
              <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold tracking-widest uppercase">NO_NODES_FOUND</p>
              <p className="text-sm mt-2 opacity-60">The selected network region is currently silent.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
