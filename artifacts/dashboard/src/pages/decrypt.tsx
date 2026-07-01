import { useState, useRef } from "react";
import { Lock, Unlock, Copy, Trash2, ChevronDown, ChevronUp, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DecryptResult {
  ok: boolean;
  result?: unknown;
  layers?: number;
  raw?: boolean;
  error?: string;
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (value === null) return <span className="text-zinc-500">null</span>;
  if (typeof value === "boolean") return <span className="text-purple-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-yellow-400">{value}</span>;
  if (typeof value === "string") {
    // If value looks like a URL or base64, truncate display
    const display = value.length > 120 ? value.slice(0, 120) + "…" : value;
    return <span className="text-green-400">"{display}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(c => !c)} className="text-primary hover:text-primary/80 mr-1">
          {collapsed ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />}
        </button>
        <span className="text-muted-foreground">[{value.length}]</span>
        {!collapsed && (
          <div className="ml-4 border-l border-border pl-2">
            {value.map((v, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-zinc-500 mr-1">{i}:</span>
                <JsonTree value={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(c => !c)} className="text-primary hover:text-primary/80 mr-1">
          {collapsed ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />}
        </button>
        <span className="text-muted-foreground">{"{"}  {keys.length} keys{"}"}</span>
        {!collapsed && (
          <div className="ml-4 border-l border-border pl-2">
            {keys.map(k => (
              <div key={k} className="leading-relaxed">
                <span className="text-primary/80 mr-1">"{k}":</span>
                <JsonTree value={(value as Record<string, unknown>)[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="text-muted-foreground">{String(value)}</span>;
}

export default function Decrypt() {
  const [input, setInput]       = useState("");
  const [result, setResult]     = useState<DecryptResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleDecrypt() {
    const ed = input.trim();
    if (!ed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ditto/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ed }),
      });
      const data = await res.json() as DecryptResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function handlePaste() {
    navigator.clipboard.readText().then(text => {
      setInput(text.trim());
      setResult(null);
    }).catch(() => {
      textareaRef.current?.focus();
    });
  }

  function handleCopy() {
    if (!result?.result) return;
    navigator.clipboard.writeText(
      typeof result.result === "string"
        ? result.result
        : JSON.stringify(result.result, null, 2)
    ).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleClear() {
    setInput("");
    setResult(null);
    textareaRef.current?.focus();
  }

  const resultJson = result?.ok && result.result !== undefined
    ? (typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2))
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Lock className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase">Decrypt Tool</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AES-128-CBC · Key <span className="font-mono text-primary/70">a38e5f04f39b11ed</span> · 
            Paste any <span className="font-mono text-primary/70">ed</span> value (raw, URL-encoded, or from query string)
          </p>
        </div>
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Ciphertext (ed=…)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={handlePaste}>
              <ClipboardPaste className="w-3 h-3 mr-1" /> Paste
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={handleClear}>
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); setResult(null); }}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleDecrypt(); }}
          placeholder={"VW%2FLuu4fjYy7XTGY%2BBr0OSymhgPly…\n\nor raw base64:\nVW/Luu4fjYy7XTGY+Br0OSymhgPly…"}
          className="w-full h-32 bg-card border border-border rounded font-mono text-xs p-3 resize-none focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {input.length > 0 ? `${input.length} chars · Ctrl+Enter to decrypt` : ""}
          </span>
          <Button
            onClick={handleDecrypt}
            disabled={!input.trim() || loading}
            className="h-8 text-xs uppercase tracking-widest"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Decrypting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Unlock className="w-3 h-3" /> Decrypt
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`border rounded ${result.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
            <div className="flex items-center gap-2">
              {result.ok
                ? <Unlock className="w-3 h-3 text-primary" />
                : <Lock className="w-3 h-3 text-destructive" />}
              <span className={`text-xs font-bold tracking-widest ${result.ok ? "text-primary" : "text-destructive"}`}>
                {result.ok ? `DECRYPTED${result.layers === 2 ? " (2 layers)" : ""}${result.raw ? " · RAW TEXT" : " · JSON"}` : "DECRYPT FAILED"}
              </span>
            </div>
            {result.ok && resultJson && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={handleCopy}>
                <Copy className="w-3 h-3 mr-1" />
                {copied ? "Copied!" : "Copy JSON"}
              </Button>
            )}
          </div>

          <div className="p-3 overflow-auto max-h-[480px]">
            {!result.ok && (
              <p className="text-xs text-destructive font-mono">{result.error}</p>
            )}
            {result.ok && typeof result.result === "string" && (
              <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {result.result}
              </pre>
            )}
            {result.ok && typeof result.result === "object" && result.result !== null && (
              <div className="text-xs font-mono leading-relaxed">
                <JsonTree value={result.result} depth={0} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Examples */}
      {!result && !input && (
        <div className="border border-border/50 rounded p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Examples — click to load</p>
          <div className="space-y-2">
            {[
              {
                label: "URL-encoded ed (from query string)",
                value: "VW%2FLuu4fjYy7XTGY%2BBr0OSymhgPlyKzhgKO7QLSyUsWLFf%2FCCib%2F417YIoiDkegXZaguFu76LxNgqpLs1jBBT7Yxe9cC6UJZKWOzbLmdbdE%3D",
              },
              {
                label: "Raw base64 from POST body",
                value: "VW/Luu4fjYy7XTGY+Br0OSymhgPlyKzhgKO7QLSyUsWLFf/CCib/417YIoiDkegXZaguFu76LxNgqpLs1jBBT7Yxe9cC6UJZKWOzbLmdbdE=",
              },
            ].map(ex => (
              <button
                key={ex.label}
                className="w-full text-left border border-border/40 hover:border-primary/40 rounded p-2 group transition-colors"
                onClick={() => { setInput(ex.value); setResult(null); }}
              >
                <p className="text-[10px] text-muted-foreground group-hover:text-primary/70">{ex.label}</p>
                <p className="text-[9px] font-mono text-muted-foreground/50 truncate mt-0.5">{ex.value.slice(0, 80)}…</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
