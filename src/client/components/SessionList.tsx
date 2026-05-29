import type { DistilledPersona, SessionSummary } from "../../shared/types";

interface Props {
  persona: DistilledPersona;
  sessions: SessionSummary[];
  terminated: boolean;
  onNewSession: () => void;
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, sessionInfo: string) => void;
  onBack: () => void;
}

function getStage(score: number): string {
  if (score >= 350) return "恋人";
  if (score >= 200) return "暧昧期";
  if (score >= 100) return "好朋友";
  if (score >= 30) return "普通朋友";
  return "陌生人";
}

export function SessionList({ persona, sessions, terminated, onNewSession, onResumeSession, onDeleteSession, onBack }: Props) {
  return (
    <div className="session-list-page">
      <div className="session-list-header">
        <button onClick={onBack} className="back-btn">← 返回</button>
        <h1>{persona.name}</h1>
        <p className="role-subtitle">{persona.role} · 《{persona.source}》</p>
        <div className="bank-score-header">
          <span className={`score ${persona.emotionalBankScore >= 0 ? "positive" : "negative"}`}>
            💳 情感账户：{persona.emotionalBankScore >= 0 ? "+" : ""}{persona.emotionalBankScore}
          </span>
          <span className="stage">（{getStage(persona.emotionalBankScore)}）</span>
        </div>
        {terminated && <div className="terminated-badge">💀 关系已终止 — 可查看历史，不能创建新聊天</div>}
      </div>

      {!terminated && (
        <button className="new-session-btn" onClick={onNewSession}>
          💬 开始新的聊天
        </button>
      )}

      {sessions.length > 0 && (
        <div className="session-history">
          <h2>历史聊天</h2>
          {sessions.map((s, i) => {
            const sessionNum = sessions.length - i;
            const date = new Date(s.createdAt).toLocaleString("zh-CN", {
              month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
            });
            const info = `第${sessionNum}次聊天 ${date} ${s.turnCount}轮 ${s.status === "reviewed" ? "已复盘" : "进行中"}`;
            return (
              <div key={s.id} className="session-item-row">
                <button
                  className={`session-item ${s.status}`}
                  onClick={() => onResumeSession(s.id)}
                >
                  <div className="session-meta">
                    <span className="session-num">第{sessionNum}次聊天</span>
                    <span className="session-date">{date}</span>
                    <span className={`session-status ${s.status}`}>
                      {s.status === "reviewed" ? "已复盘" : "进行中"}
                    </span>
                  </div>
                  <div className="session-preview">
                    {s.turnCount}轮 · {s.lastMessage || "暂无消息"}...{s.lastMessageRole === "persona" && s.status === "active" && <span className="ghost-warning" title="对方最后发了消息，你没有回复"> 👻</span>}
                  </div>
                </button>
                <button
                  className="delete-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id, info);
                  }}
                  title="永久删除此会话"
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="empty-sessions">暂无聊天记录</div>
      )}
    </div>
  );
}