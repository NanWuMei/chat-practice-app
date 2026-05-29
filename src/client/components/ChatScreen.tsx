import { useState, useRef, useEffect } from "react";
import type { TrainingSession, ChatMessage } from "../../shared/types";
import { client } from "../api";

interface Props {
  session: TrainingSession;
  hasReview: boolean;
  onEndAndReview: (sessionId: string) => void;
  onViewReview: () => void;
  onBack: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function ChatScreen({ session, hasReview, onEndAndReview, onViewReview, onBack }: Props) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.getMessages(session.id).then(setMsgs).catch(() => {});
  }, [session.id]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    const now = new Date().toISOString();
    setMsgs((prev) => [...prev, { id: "temp-" + Date.now(), sessionId: session.id, role: "user", content: text, createdAt: now }]);
    try {
      const res = await client.sendMessage(session.id, text);
      setMsgs((prev) => [...prev.filter((m) => !m.id.startsWith("temp-")), res.userMessage, res.message]);
    } catch (e) {
      setMsgs((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      setInput(text);
      alert("发送失败：" + (e as Error).message);
    } finally { setLoading(false); }
  };

  const handleEnd = async () => { setReviewing(true); await onEndAndReview(session.id); };
  const isActive = session.status === "active";

  return (
    <div className="phone-shell">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn">← 返回</button>
        <div><h1>梁友安</h1><p>27岁 · 体育经纪人</p></div>
        <div className="header-actions">
          {hasReview && (
            <button onClick={onViewReview} className="view-review-btn">📊 查看复盘</button>
          )}
          {isActive && (
            <button onClick={handleEnd} className="end-btn" disabled={reviewing}>
              {reviewing ? "复盘中..." : "结束并复盘"}
            </button>
          )}
          {!isActive && !hasReview && <span className="reviewed-badge">已结束</span>}
        </div>
      </div>
      <div className="context-strip">💡 你们在一个朋友聚会上认识，加了微信，偶尔聊聊。目前算是普通朋友。</div>
      <div className="message-list" ref={listRef}>
        {msgs.length === 0 && <div className="empty-hint">开始聊天吧！像在微信里一样自然地说就好。</div>}
        {msgs.map((m) => {
          if (m.role === "system") {
            return <div key={m.id} className="system-event">{m.content}</div>;
          }
          return (
            <div key={m.id} className={`message-row ${m.role === "user" ? "mine" : ""}`}>
              <div className="bubble">
                {m.content}
                <span className="msg-time">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {loading && <div className="message-row"><div className="bubble typing">对方正在输入...</div></div>}
      </div>
      {isActive && (
        <div className="composer">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="输入消息..." disabled={loading} />
          <button onClick={handleSend} disabled={loading || !input.trim()}>发送</button>
        </div>
      )}
      {!isActive && (
        <div className="composer-readonly">
          此会话已结束，仅供查看
          {hasReview && <button onClick={onViewReview} className="inline-review-btn">📊 查看复盘报告</button>}
        </div>
      )}
    </div>
  );
}