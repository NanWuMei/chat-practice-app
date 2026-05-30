import type { DebriefReport, DebriefSession, PatternDiscovery, ActionAnchor } from '../../shared/types';
import { useState, useEffect } from 'react';
import { client } from '../api';

interface Props {
  review: DebriefReport;
  debrief: DebriefSession | null;
  sessionId: string;
  onBack: () => void;
  onComplete: () => void;
}

// 状态机：tracking → moments → anchor → complete
type Phase = 'loading' | 'tracking' | 'moments' | 'anchor' | 'complete';

export function ReviewScreen({ review, debrief, sessionId, onBack, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentKmIdx, setCurrentKmIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [patterns, setPatterns] = useState<PatternDiscovery | null>(null);

  // CHG-2：回溯状态
  const [prevAnchor, setPrevAnchor] = useState<ActionAnchor | null>(null);
  const [trackingAnswer, setTrackingAnswer] = useState('');
  const [trackingSubmitting, setTrackingSubmitting] = useState(false);

  // CHG-1：行动锚点状态
  const [anchorContent, setAnchorContent] = useState('');
  const [anchorSubmitting, setAnchorSubmitting] = useState(false);

  // 模式分类展开状态
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const keyMoments = debrief?.key_moments ?? review.m1.key_moments;
  const currentKm = keyMoments[currentKmIdx];

  // 初始化：检查是否有上次未追踪的锚点
  useEffect(() => {
    if (phase !== 'loading') return;
    client.getPreviousAnchor(sessionId).then((r) => {
      if (r.anchor) {
        setPrevAnchor(r.anchor);
        setPhase('tracking');
      } else {
        setPhase('moments');
      }
    }).catch(() => setPhase('moments'));
  }, [sessionId, phase]);

  // ─── CHG-2：提交回溯结果 ───
  const handleTrackSubmit = async () => {
    if (!trackingAnswer.trim()) return;
    setTrackingSubmitting(true);
    try {
      await client.trackPreviousAnchor(sessionId, trackingAnswer.trim());
      setPhase('moments');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    } finally {
      setTrackingSubmitting(false);
    }
  };

  const handleTrackSkip = async () => {
    setTrackingSubmitting(true);
    try {
      await client.trackPreviousAnchor(sessionId, '未尝试');
      setPhase('moments');
    } catch (e) {
      setPhase('moments');
    } finally {
      setTrackingSubmitting(false);
    }
  };

  // ─── M3：提交反思答案 ───
  const handleSubmitAnswer = async () => {
    if (!currentKm || !answer.trim()) return;
    setSubmitting(true);
    try {
      await client.submitDebriefAnswer(sessionId, currentKm.km_id, answer.trim());
      setAnswer('');
      if (currentKmIdx < keyMoments.length - 1) {
        setCurrentKmIdx(currentKmIdx + 1);
      } else {
        setPhase('anchor');
      }
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipMoment = async () => {
    if (!currentKm) return;
    try {
      await client.skipDebriefMoment(sessionId, currentKm.km_id);
      setAnswer('');
      if (currentKmIdx < keyMoments.length - 1) {
        setCurrentKmIdx(currentKmIdx + 1);
      } else {
        setPhase('anchor');
      }
    } catch (e) {
      alert('跳过失败：' + (e as Error).message);
    }
  };

  // ─── CHG-1：M2.5 行动锚点 ───
  const handleSaveAnchor = async () => {
    setAnchorSubmitting(true);
    try {
      await client.saveActionAnchor(sessionId, anchorContent.trim() || null);
      await finishDebrief();
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
      setAnchorSubmitting(false);
    }
  };

  const handleSkipAnchor = async () => {
    setAnchorSubmitting(true);
    try {
      await client.saveActionAnchor(sessionId, null);
      await finishDebrief();
    } catch (e) {
      setAnchorSubmitting(false);
    }
  };

  const finishDebrief = async () => {
    try {
      const result = await client.completeDebrief(sessionId);
      if (result.pattern_discovery) {
        setPatterns(result.pattern_discovery);
      }
      setPhase('complete');
    } catch (e) {
      setPhase('complete');
    }
  };

  // ─── Loading ───
  if (phase === 'loading') {
    return <div className="review-screen"><p>加载中...</p></div>;
  }

  // ─── CHG-2：回溯追踪界面 ───
  if (phase === 'tracking' && prevAnchor) {
    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
        </div>
        <div className="tracking-card">
          <div className="tracking-title">上次的行动锚点</div>
          <div className="tracking-quote">"{prevAnchor.content}"</div>
          <div className="tracking-question">你试了吗？发生了什么？</div>
          <textarea
            value={trackingAnswer}
            onChange={(e) => setTrackingAnswer(e.target.value)}
            placeholder="写下你的经历..."
            rows={3}
          />
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleTrackSkip} disabled={trackingSubmitting}>没有机会试</button>
            <button className="submit-btn" onClick={handleTrackSubmit} disabled={trackingSubmitting || !trackingAnswer.trim()}>
              {trackingSubmitting ? '保存中...' : '提交'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── M3：关键时刻提问 ───
  if (phase === 'moments') {
    if (!currentKm || keyMoments.length === 0) {
      // 无关键时刻，直接跳到行动锚点
      setPhase('anchor');
      return <div className="review-screen"><p>加载中...</p></div>;
    }

    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
          <p className="review-meta">{keyMoments.length}个值得停一停的时刻</p>
        </div>
        <div className="moment-card">
          <div className="moment-progress">时刻 {currentKmIdx + 1} / {keyMoments.length}</div>
          <div className="moment-type">{currentKm.type_label}</div>
          <div className="moment-context">
            {currentKm.context.map((c, i) => (
              <div key={i} className={'context-line ' + (c.speaker === 'USER' ? 'user' : 'her')}>
                <span className="speaker">{c.speaker === 'USER' ? '用户' : '她'}：</span>
                <span className="content">{c.content}</span>
              </div>
            ))}
          </div>
          {currentKm.system_question && (
            <div className="socrates-question">
              <span className="question-icon">?</span>
              <span className="question-text">{currentKm.system_question}</span>
            </div>
          )}
          <div className="answer-section">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="你的想法..."
              rows={4}
            />
            <div className="answer-actions">
              <button className="skip-btn" onClick={handleSkipMoment}>跳过</button>
              <button className="submit-btn" onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()}>
                {submitting ? '保存中...' : '完成这个时刻'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CHG-1：M2.5 行动锚点 ───
  if (phase === 'anchor') {
    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
        </div>
        <div className="anchor-card">
          <div className="anchor-title">行动锚点</div>
          <div className="anchor-description">
            基于刚才的发现，下次跟梁友安聊天时，<br />
            你想试的一个小变化是什么？<br />
            <span className="anchor-hint">不需要是大事。可以是一句话、一个态度、一个尝试。</span>
          </div>
          <textarea
            value={anchorContent}
            onChange={(e) => setAnchorContent(e.target.value)}
            placeholder="下次我想试试..."
            rows={3}
          />
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleSkipAnchor} disabled={anchorSubmitting}>这次先不写</button>
            <button className="submit-btn" onClick={handleSaveAnchor} disabled={anchorSubmitting || !anchorContent.trim()}>
              {anchorSubmitting ? '保存中...' : '写下锚点'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 完成态 ───
  return (
    <div className="review-screen">
      <div className="review-header">
        <button onClick={onBack} className="back-btn">&larr; 返回</button>
        <h1>对话复盘</h1>
      </div>

      {patterns && patterns.patterns.length > 0 && (
        <div className="patterns-section">
          <h2>你的历史模式</h2>
          <p className="patterns-subtitle">点击展开查看详情</p>
          {patterns.patterns.map((p, i) => {
            // 按问题分组
            const questionGroups: Record<string, typeof p.items> = {};
            for (const item of p.items) {
              const q = item.question || '（无问题）';
              if (!questionGroups[q]) questionGroups[q] = [];
              questionGroups[q].push(item);
            }
            const questions = Object.entries(questionGroups).sort((a, b) => b[1].length - a[1].length);

            return (
              <div key={i} className={'pattern-category' + (expandedPattern === i ? ' expanded' : '')}>
                <button
                  className="pattern-category-header"
                  onClick={() => { setExpandedPattern(expandedPattern === i ? null : i); setExpandedQuestion(null); }}
                >
                  <span className="pattern-category-icon">{expandedPattern === i ? '▼' : '▶'}</span>
                  <span className="pattern-category-label">「{p.km_label}」</span>
                  <span className="pattern-category-count">{p.frequency}次 · {questions.length}种场景</span>
                </button>
                {expandedPattern === i && (
                  <div className="pattern-category-body">
                    {questions.map(([q, items], qi) => {
                      const qKey = i + '-' + qi;
                      return (
                        <div key={qi} className="question-group">
                          <button
                            className="question-group-header"
                            onClick={() => setExpandedQuestion(expandedQuestion === qKey ? null : qKey)}
                          >
                            <span className="question-group-icon">{expandedQuestion === qKey ? '▼' : '▶'}</span>
                            <span className="question-group-text">{q}</span>
                            <span className="question-group-count">{items.length}次</span>
                          </button>
                          {expandedQuestion === qKey && (
                            <div className="question-group-body">
                              {items.map((item, j) => (
                                <div key={j} className="reflection-item">
                                  <span className="reflection-date">[{item.session_date}]</span>
                                  {item.context && item.context.length > 0 && (
                                    <div className="reflection-context">
                                      {item.context.map((c, k) => (
                                        <div key={k} className={'ctx-line ' + (c.speaker === 'USER' ? 'ctx-user' : 'ctx-her')}>
                                          <span className="ctx-speaker">{c.speaker === 'USER' ? '你' : '她'}：</span>
                                          <span className="ctx-text">{c.content}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <span className="reflection-answer">你的想法："{item.user_answer}"</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {patterns.aggregate_question && i === 0 && (
                      <div className="aggregate-question">
                        <p>{patterns.aggregate_question}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="archive-message">已存档。</div>
      <button onClick={onComplete} className="complete-btn">完成</button>
    </div>
  );
}
