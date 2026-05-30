import type { DistilledPersona, SessionSummary } from '../../shared/types';

interface Props {
  persona: DistilledPersona;
  sessions: SessionSummary[];
  onNewSession: () => void;
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, sessionInfo: string) => void;
  onBack: () => void;
}

export function SessionList({ persona, sessions, onNewSession, onResumeSession, onDeleteSession, onBack }: Props) {
  return (
    <div className="session-list-page">
      <div className="session-list-header">
        <button onClick={onBack} className="back-btn">&larr; 返回</button>
        <h1>{persona.name}</h1>
        <p className="role-subtitle">{persona.role} &middot; 《{persona.source}》</p>
      </div>

      <button className="new-session-btn" onClick={onNewSession}>
        💬 开始新的聊天
      </button>

      {sessions.length > 0 && (
        <div className="session-history">
          <h2>历史聊天</h2>
          {sessions.map((s, i) => {
            const sessionNum = sessions.length - i;
            const date = new Date(s.createdAt).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const info = '第' + sessionNum + '次聊天 ' + date + ' ' + s.turnCount + '轮 ' + (s.status === 'reviewed' ? '已复盘' : '进行中');
            return (
              <div key={s.id} className="session-item-row">
                <button className={'session-item ' + s.status} onClick={() => onResumeSession(s.id)}>
                  <div className="session-meta">
                    <span className="session-num">第{sessionNum}次聊天</span>
                    <span className="session-date">{date}</span>
                    <span className={'session-status ' + s.status}>
                      {s.status === 'reviewed' ? '已复盘' : '进行中'}
                    </span>
                  </div>
                  <div className="session-preview">
                    {s.turnCount}轮 &middot; {s.lastMessage || '暂无消息'}...
                    {s.lastMessageRole === 'persona' && s.status === 'active' && <span className="ghost-warning" title="对方最后发了消息，你没有回复"> 👻</span>}
                  </div>
                </button>
                <button
                  className="delete-session-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id, info); }}
                  title="永久删除此会话"
                >🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {sessions.length === 0 && <div className="empty-sessions">暂无聊天记录</div>}
    </div>
  );
}
