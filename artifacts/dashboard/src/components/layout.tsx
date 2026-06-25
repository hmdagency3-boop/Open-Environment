import { Link, useLocation } from "wouter";
import { useGetWorkerStatus, useHealthCheck } from "@workspace/api-client-react";
import { Activity, RadioReceiver, Search, LayoutGrid, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: workerStatus } = useGetWorkerStatus({
    query: {
      refetchInterval: 5000
    }
  });

  const { data: health } = useHealthCheck({
    query: {
      refetchInterval: 10000
    }
  });

  const isConnected = workerStatus?.connected ?? false;
  const isHealthy = health?.status === "ok";

  const navItems = [
    { href: "/", label: "OVERVIEW", icon: Activity },
    { href: "/search", label: "LOOKUP", icon: Search },
    { href: "/rooms", label: "NETWORK", icon: LayoutGrid },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row font-mono">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col uppercase">
        <div className="p-4 border-b border-border flex items-center gap-2 text-primary">
          <Terminal className="w-6 h-6" />
          <span className="font-bold tracking-widest text-lg">DITTO_OS</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 transition-colors ${active ? "bg-primary text-primary-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">SYSTEM</span>
              <Badge variant="outline" className={isHealthy ? "text-primary border-primary" : "text-destructive border-destructive"}>
                {isHealthy ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">WORKER</span>
              <Badge variant="outline" className={isConnected ? "text-primary border-primary" : "text-destructive border-destructive"}>
                <RadioReceiver className="w-3 h-3 mr-1" />
                {isConnected ? "CONNECTED" : "DISCONNECTED"}
              </Badge>
            </div>
            {isConnected && workerStatus?.pendingJobs !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">QUEUE</span>
                <span className="text-primary font-bold">{workerStatus.pendingJobs} JOBS</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
