"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Reply = {
  id?: string;
  message_id?: string;
  contact_id?: string | null;
  body?: string;
  label?: string;
  created_at?: string;
  received_at?: string;
  from?: string;
  to?: string;
};

type Message = {
  id: string; // currently contact_email in demo store
  opened?: boolean;
  replied?: boolean;
  label?: string | null;
  variant?: string;
  subject?: string;
  body?: string;
  sent_at?: string;
  from?: string;
  to?: string;
};

function short(s: any, n: number) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

export default function InboxPage() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, m] = await Promise.all([
        api<{ replies: Reply[] }>("/replies", "GET"),
        api<{ messages: Message[] }>("/messages", "GET"),
      ]);
      setReplies(Array.isArray(r?.replies) ? r.replies : []);
      setMessages(Array.isArray(m?.messages) ? m.messages : []);
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load inbox"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo(() => {
    const byMessageId = new Map<string, { messageId: string; message?: Message | null; replies: Reply[] }>();

    for (const msg of messages || []) {
      const mid = String(msg?.id || "").trim();
      if (!mid) continue;
      byMessageId.set(mid, { messageId: mid, message: msg, replies: [] });
    }
    for (const rep of replies || []) {
      const mid = String(rep?.message_id || "").trim();
      const key = mid || String(rep?.id || "").trim() || "unknown";
      const cur = byMessageId.get(key) || { messageId: key, message: null, replies: [] };
      cur.replies.push(rep);
      byMessageId.set(key, cur);
    }

    const out = Array.from(byMessageId.values());
    // Sort: most recent reply (best-effort)
    out.sort((a, b) => {
      const at = String(a.replies?.[a.replies.length - 1]?.received_at || a.replies?.[a.replies.length - 1]?.created_at || "");
      const bt = String(b.replies?.[b.replies.length - 1]?.received_at || b.replies?.[b.replies.length - 1]?.created_at || "");
      return bt.localeCompare(at);
    });
    return out;
  }, [messages, replies]);

  const unreadCount = useMemo(() => {
    return (messages || []).filter((m) => m && m.replied).length;
  }, [messages]);

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Inbox</h1>
              <div className="mt-1 text-sm text-white/70">
                Unified inbox: replies from cold outreach land here regardless of which sending address was used.
              </div>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-white/10 bg-black/20 text-white/80 hover:bg-white/10 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {err ? (
            <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 mb-6">
            <div className="px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-xs text-white/70">
              Threads: <span className="font-semibold text-white/85">{threads.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-xs text-white/70">
              Replies: <span className="font-semibold text-white/85">{replies.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-xs text-white/70">
              Sent (tracked): <span className="font-semibold text-white/85">{messages.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-xs text-white/70">
              Replied (tracked): <span className="font-semibold text-white/85">{unreadCount}</span>
            </div>
          </div>

          {loading && threads.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
              Loading inbox…
            </div>
          ) : threads.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
              No replies yet.
              <div className="mt-2 text-xs text-white/60">
                Once you start sending campaigns, replies (and mock replies) will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((t) => {
                const last = t.replies?.[t.replies.length - 1];
                const label = String(last?.label || t.message?.label || "").trim();
                const badge =
                  label === "positive"
                    ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
                    : label === "ooo"
                      ? "bg-blue-500/15 border-blue-400/30 text-blue-200"
                      : label === "objection"
                        ? "bg-orange-500/15 border-orange-400/30 text-orange-200"
                        : "bg-white/5 border-white/10 text-white/70";

                return (
                  <div key={`thr_${t.messageId}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {t.message?.to || t.messageId}
                        </div>
                        <div className="mt-0.5 text-xs text-white/60 truncate">
                          {t.message?.subject ? short(t.message.subject, 110) : "Reply thread"}
                        </div>
                      </div>
                      {label ? (
                        <span className={`shrink-0 px-2 py-1 rounded-full border text-[11px] font-semibold ${badge}`}>
                          {label}
                        </span>
                      ) : null}
                    </div>

                    {last?.body ? (
                      <div className="mt-3 text-sm text-white/75 whitespace-pre-wrap">
                        {short(last.body, 420)}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-white/60">
                        No reply content yet.
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50">
                      <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">
                        Replies: {t.replies.length}
                      </span>
                      {t.message?.variant ? (
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">
                          Variant: {t.message.variant}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

