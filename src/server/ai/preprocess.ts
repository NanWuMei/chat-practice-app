import type { ChatMessage, M0Output, M0LogEntry } from '../../shared/types';

// ============================================================
// M0：输入预处理（v3.0镜子模式）
// 纯计算模块，不调用AI
// ============================================================

export function preprocessMessages(
  messages: ChatMessage[],
  sessionId: string,
  baselineHerLength: number,
): M0Output {
  const chatMsgs = messages.filter((m) => m.role === 'user' || m.role === 'persona');

  const userMsgs = chatMsgs.filter((m) => m.role === 'user');
  const herMsgs = chatMsgs.filter((m) => m.role === 'persona');

  const avgHerLength = herMsgs.length > 0
    ? Math.round(herMsgs.reduce((sum, m) => sum + m.content.length, 0) / herMsgs.length)
    : 0;

  const log: M0LogEntry[] = chatMsgs.map((m, i) => ({
    index: i + 1,
    speaker: m.role === 'user' ? 'USER' : 'HER',
    content: m.content,
  }));

  return {
    session_id: sessionId,
    stats: {
      total_messages: chatMsgs.length,
      user_count: userMsgs.length,
      her_count: herMsgs.length,
      avg_her_length: avgHerLength,
      baseline_her_length: baselineHerLength,
    },
    log,
  };
}
