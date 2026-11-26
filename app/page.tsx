"use client";

// Phase 1: Live crypto price table
// Streams real-time prices from Binance's public WebSocket (no API key needed).

import { useEffect, useRef, useState } from "react";

// Coins to track (Binance symbols, lowercase for the stream URL)
const SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "adausdt", "dogeusdt"];

type Ticker = {
  symbol: string;      // e.g. BTCUSDT
  price: number;       // last traded price
  changePct: number;   // 24h % change
  high: number;        // 24h high
  low: number;         // 24h low
  volume: number;      // 24h quote volume (USDT)
  flash: "up" | "down" | null; // briefly highlight price moves
};

const STREAM_URL =
  "wss://stream.binance.com:9443/stream?streams=" +
  SYMBOLS.map((s) => `${s}@ticker`).join("/");

export default function Home() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(STREAM_URL);
      wsRef.current = ws;

      ws.onopen = () => setStatus("live");

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const d = msg.data; // Binance 24hr ticker payload
        if (!d?.s) return;

        setTickers((prev) => {
          const old = prev[d.s];
          const price = parseFloat(d.c);
          const flash = old ? (price > old.price ? "up" : price < old.price ? "down" : old.flash) : null;
          return {
            ...prev,
            [d.s]: {
              symbol: d.s,
              price,
              changePct: parseFloat(d.P),
              high: parseFloat(d.h),
              low: parseFloat(d.l),
              volume: parseFloat(d.q),
              flash,
            },
          };
        });
      };

      // Auto-reconnect if the connection drops
      ws.onclose = () => {
        setStatus("disconnected");
        retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      clearTimeout(retryTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // stop reconnecting on unmount
        wsRef.current.close();
      }
    };
  }, []);

  const rows = SYMBOLS.map((s) => tickers[s.toUpperCase()]).filter(Boolean) as Ticker[];

  const fmtPrice = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
  const fmtVol = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toFixed(0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Crypto Paper-Trading Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Live market prices via Binance WebSocket</p>
          </div>
          <span
            className={`text-xs font-medium px-3 py-1 rounded-full ${
              status === "live"
                ? "bg-emerald-500/15 text-emerald-400"
                : status === "connecting"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            ● {status === "live" ? "Live" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        </header>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3">Coin</th>
                <th className="text-right p-3">Price (USDT)</th>
                <th className="text-right p-3">24h Change</th>
                <th className="text-right p-3 hidden md:table-cell">24h High</th>
                <th className="text-right p-3 hidden md:table-cell">24h Low</th>
                <th className="text-right p-3 hidden sm:table-cell">24h Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Waiting for live data…
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.symbol} className="border-t border-slate-800 hover:bg-slate-900/60">
                  <td className="p-3 font-semibold">{t.symbol.replace("USDT", "")}</td>
                  <td
                    className={`p-3 text-right font-mono transition-colors ${
                      t.flash === "up" ? "text-emerald-400" : t.flash === "down" ? "text-rose-400" : ""
                    }`}
                  >
                    {fmtPrice(t.price)}
                  </td>
                  <td className={`p-3 text-right font-mono ${t.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.changePct >= 0 ? "+" : ""}
                    {t.changePct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right font-mono hidden md:table-cell">{fmtPrice(t.high)}</td>
                  <td className="p-3 text-right font-mono hidden md:table-cell">{fmtPrice(t.low)}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmtVol(t.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Paper trading only.  No real money is used. Market data from Binance public streams.
        </p>
      </div>
    </main>
  );
}
