"use client";

import { useEffect, useState } from "react";

interface TokenData {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: string;
  tokenAmount: number;
  bondingCurveKey: string;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  marketCapSol: number;
  name: string;
  symbol: string;
  description: string;
  image: string;
  metadata_uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  timestamp: number;
  twitterEmbedHtml?: string;
  isValidTweet?: boolean;
}

export default function Home() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // Load Twitter widgets script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket("wss://pumpportal.fun/api/data");

        ws.onopen = () => {
          setIsConnected(true);
          setConnectionStatus("Connected");

          // Subscribe to new token events
          const payload = {
            method: "subscribeNewToken",
          };
          ws?.send(JSON.stringify(payload));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // LOG THE RAW WEBSOCKET DATA
            console.log("=== RAW WEBSOCKET DATA ===");
            console.log(JSON.stringify(data, null, 2));
            console.log("========================");

            // Add timestamp if not present
            if (!data.timestamp) {
              data.timestamp = Date.now();
            }

            // Try to fetch token metadata from IPFS if metadata_uri exists
            if (data.uri) {
              try {
                console.log("Fetching metadata from:", data.uri);
                
                // Use CORS proxy for IPFS/metadata requests
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(data.uri)}`;
                
                const metadataResponse = await fetch(proxyUrl);
                if (metadataResponse.ok) {
                  const metadata = await metadataResponse.json();
                  console.log("=== IPFS METADATA ===");
                  console.log(JSON.stringify(metadata, null, 2));
                  console.log("====================");
                  // Merge IPFS metadata with websocket data
                  Object.assign(data, {
                    name: metadata.name,
                    symbol: metadata.symbol,
                    description: metadata.description,
                    image: metadata.image,
                    twitter: metadata.twitter,
                    telegram: metadata.telegram,
                    website: metadata.website,
                  });
                }
              } catch (metadataError) {
                console.error("Error fetching IPFS metadata:", metadataError);
              }
            }

            // Fetch Twitter embed HTML if twitter link exists
            if (data.twitter) {
              try {
                // Check if it's a tweet (has /status/) or a profile
                const isTweet = data.twitter.includes('/status/');
                
                if (isTweet) {
                  // For tweets, use oEmbed API
                  const tweetUrl = encodeURIComponent(data.twitter);
                  const oembedResponse = await fetch(
                    `https://publish.twitter.com/oembed?url=${tweetUrl}&theme=dark&dnt=true`
                  );
                  if (oembedResponse.ok) {
                    const oembedData = await oembedResponse.json();
                    data.twitterEmbedHtml = oembedData.html;
                    data.isValidTweet = true; // Mark as valid tweet
                  }
                } else {
                  // Skip profiles - we only want tweets
                  data.isValidTweet = false;
                }
              } catch (embedError) {
                console.error("Error fetching Twitter embed:", embedError);
                data.isValidTweet = false;
              }
            } else {
              data.isValidTweet = false;
            }

            // Only add tokens that have valid tweets
            if (data.isValidTweet) {
              setTokens((prev) => [data, ...prev].slice(0, 30)); // Keep last 30 tokens
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionStatus("Error occurred");
        };

        ws.onclose = () => {
          setIsConnected(false);
          setConnectionStatus("Disconnected. Reconnecting...");

          // Attempt to reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        };
      } catch (error) {
        console.error("Connection error:", error);
        setConnectionStatus("Failed to connect");
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(num);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-[#30D158]" : "bg-[#FF453A]"
                } animate-pulse`}
              ></div>
              <span className="text-white/60">{connectionStatus}</span>
            </div>
            <span className="text-white/30">•</span>
            <span className="text-white/60">
              {tokens.length} token{tokens.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Token List */}
        {tokens.length === 0 ? (
          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-white/80 text-lg">
              Waiting for tokens with tweets...
            </p>
            <p className="text-white/50 text-sm mt-2">
              Only showing pump.fun tokens with tweet links.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tokens.map((token, index) => (
              <div
                key={token.signature || index}
                className="bg-[#1C1C1E] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-200 ease-out animate-fadeIn"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex flex-col lg:flex-row lg:h-[580px]">
                  {/* Twitter Embed - Left Side */}
                  {token.twitter && (
                    <div className="lg:w-[420px] lg:h-full flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-black">
                      {token.twitterEmbedHtml ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: token.twitterEmbedHtml }}
                          className="twitter-embed-container p-3 h-full overflow-auto"
                          ref={(el) => {
                            if (el && (window as any).twttr?.widgets) {
                              (window as any).twttr.widgets.load(el);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                          <div className="text-white/50 text-sm">Loading tweet...</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Token Info - Right Side */}
                  <div className="flex-1 p-6 flex flex-col">
                    {/* Header: Token Name + Image */}
                    <div className="flex items-center gap-4 mb-6">
                      {token.image && (
                        <img
                          src={token.image}
                          alt={token.name}
                          className="w-16 h-16 rounded-2xl object-cover bg-[#2C2C2E] flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%232C2C2E'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='32' fill='%23636366'%3E?%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-white mb-1 truncate">
                          {token.name || "Unnamed Token"}
                        </h3>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-white/60 font-mono">
                            ${token.symbol || "N/A"}
                          </span>
                          <span className="text-white/30">•</span>
                          <span className="text-white/40">
                            {formatTimestamp(token.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {token.description && (
                      <div className="mb-6">
                        <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
                          {token.description}
                        </p>
                      </div>
                    )}

                    {/* Key Metrics */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {token.marketCapSol !== undefined && (
                        <div className="bg-[#2C2C2E] rounded-xl p-4">
                          <div className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider font-medium">
                            Market Cap
                          </div>
                          <div className="text-xl text-white font-semibold">
                            {formatNumber(token.marketCapSol)}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">SOL</div>
                        </div>
                      )}
                      {token.vSolInBondingCurve !== undefined && (
                        <div className="bg-[#2C2C2E] rounded-xl p-4">
                          <div className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider font-medium">
                            Bonding
                          </div>
                          <div className="text-xl text-white font-semibold">
                            {formatNumber(token.vSolInBondingCurve)}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">SOL</div>
                        </div>
                      )}
                      {token.vTokensInBondingCurve !== undefined && (
                        <div className="bg-[#2C2C2E] rounded-xl p-4">
                          <div className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider font-medium">
                            Supply
                          </div>
                          <div className="text-xl text-white font-semibold">
                            {formatNumber(token.vTokensInBondingCurve / 1000000)}M
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">tokens</div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      {token.mint && (
                        <button
                          onClick={() => copyToClipboard(token.mint)}
                          className="px-4 py-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-sm font-medium transition-colors"
                          title="Click to copy contract address"
                        >
                          {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                        </button>
                      )}
                      {token.twitter && (
                        <a
                          href={token.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white text-sm font-medium transition-colors text-center"
                        >
                          View Tweet
                        </a>
                      )}
                      {token.telegram && (
                        <a
                          href={token.telegram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-sm font-medium transition-colors text-center"
                        >
                          Telegram
                        </a>
                      )}
                      {token.website && (
                        <a
                          href={token.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-sm font-medium transition-colors text-center"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}