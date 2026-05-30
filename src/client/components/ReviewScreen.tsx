import type { DebriefReport, DebriefSession, PatternDiscovery, ActionAnchor, FocuserOutput } from '../../shared/types';
import { useState, useEffect, useCallback } from 'react';
import { client } from '../api';

interface Props {
  review: DebriefReport;
  debrief: DebriefSession | null;
  sessionId: string;
  onBack: () => void;
  onComplete: () => void;
}

// 状态机：tracking → moments → focuser → complete
type Phase = 'loading' | 'tracking' | 'moments' | 'focuser' | 'focuser-loading' | 'complete';

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

  // 聚焦器状态
  const [focuser, setFocuser] = useState<FocuserOutput | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [customContent, setCustomContent] = useState('');
  const [focuserSubmitting, setFocuserSubmitting] = useState(false);
  const [useFallbackAnchor, setUseFallbackAnchor] = useState(false);
  const [fallbackAnchorContent, setFallbackAnchorContent] = useState('');

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

  // 进入聚焦器阶段时，调用 AI 生成选项
  const loadFocuser = useCallback(async () => {
    setPhase('focuser-loading');
    try {
      const result = await client.generateFocuser(sessionId);
      if (result.focuser && result.focuser.options && result.focuser.options.length > 0) {
        setFocuser(result.focuser);
        setPhase('focuser');
      } else {
        // AI 失败或返回无效数据，降级为自由文本
        setUseFallbackAnchor(true);
        setPhase('focuser');
      }
    } catch {
      setUseFallbackAnchor(true);
      setPhase('focuser');
    }
  }, [sessionId]);

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
        await loadFocuser();
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
        await loadFocuser();
      }
    } catch (e) {
      alert('跳过失败：' + (e as Error).message);
    }
  };

  // ─── 聚焦器：选择选项 ───
  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    setCustomContent('');
  };

  // ─── 聚焦器：自定义输入 ───
  const handleCustomInput = (text: string) => {
    setCustomContent(text);
    setSelectedOptionId(null);
  };

  // ─── 聚焦器：确认锚点 ───
  const handleFocuserConfirm = async () => {
    let anchorText: string | null = null;

    if (selectedOptionId && focuser) {
      const option = focuser.options.find((o) => o.id === selectedOptionId);
      anchorText = option?.label ?? null;
    } else if (customContent.trim()) {
      anchorText = customContent.trim();
    }

    if (!anchorText) return;

    setFocuserSubmitting(true);
    try {
      await client.saveActionAnchor(sessionId, anchorText);
      await finishDebrief();
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
      setFocuserSubmitting(false);
    }
  };

  // ─── 聚焦器：跳过 ───
  const handleFocuserSkip = async () => {
    setFocuserSubmitting(true);
    try {
      await client.saveActionAnchor(sessionId, null);
      await finishDebrief();
    } catch (e) {
      setFocuserSubmitting(false);
    }
  };

  // ─── 降级锚点：确认 ───
  const handleFallbackConfirm = async () => {
    setFocuserSubmitting(true);
    try {
      await client.saveActionAnchor(sessionId, fallbackAnchorContent.trim() || null);
      await finishDebrief();
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
      setFocuserSubmitting(false);
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

  // ─── 聚焦器加载中 ───
  if (phase === 'focuser-loading') {
    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
        </div>
        <div className="focuser-loading">
          <div className="focuser-loading-icon">🪞</div>
          <p>罗杰斯正在聚焦...</p>
        </div>
      </div>
    );
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
          <div className="tracking-anchor">"{prevAnchor.content}"</div>
          <div className="tracking-question">你尝试了吗？发生了什么？</div>
          <textarea
            value={trackingAnswer}
            onChange={(e) => setTrackingAnswer(e.target.value)}
            placeholder="写下你的反馈..."
            rows={3}
          />
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleTrackSkip} disabled={trackingSubmitting}>没尝试</button>
            <button className="submit-btn" onClick={handleTrackSubmit} disabled={trackingSubmitting || !trackingAnswer.trim()}>
              {trackingSubmitting ? '保存中...' : '记录反馈'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── M3：苏格拉底提问界面 ───
  if (phase === 'moments' && currentKm) {
    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
          <div className="progress">{currentKmIdx + 1} / {keyMoments.length}</div>
        </div>
        <div className="moment-card">
          <div className="moment-type">{currentKm.type_label}</div>
          <div className="moment-context">
            {currentKm.context.map((c, i) => (
              <div key={i} className={'ctx-line ' + (c.speaker === 'USER' ? 'ctx-user' : 'ctx-her')}>
                <span className="ctx-speaker">{c.speaker === 'USER' ? '你' : '她'}：</span>
                <span className="ctx-text">{c.content.replace(' [关键节点]', '')}</span>
              </div>
            ))}
          </div>
          {currentKm.system_question && (
            <div className="socrates-question">
              <span className="socrates-icon">🤔</span>
              <span>{currentKm.system_question}</span>
            </div>
          )}
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="写下你的想法..."
            rows={3}
          />
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleSkipMoment} disabled={submitting}>跳过</button>
            <button className="submit-btn" onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()}>
              {submitting ? '保存中...' : '下一个'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 聚焦器界面（降级：自由文本锚点） ───
  if (phase === 'focuser' && useFallbackAnchor) {
    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
        </div>
        <div className="focuser-section">
          <div className="focuser-fallback-notice">聚焦器暂时不可用，请手动写下锚点</div>
          <div className="focuser-label">下次你想试试什么？</div>
          <textarea
            value={fallbackAnchorContent}
            onChange={(e) => setFallbackAnchorContent(e.target.value)}
            placeholder="下次我想试试..."
            rows={3}
          />
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleFocuserSkip} disabled={focuserSubmitting}>这次先不写</button>
            <button className="submit-btn" onClick={handleFallbackConfirm} disabled={focuserSubmitting || !fallbackAnchorContent.trim()}>
              {focuserSubmitting ? '保存中...' : '写下锚点'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 聚焦器界面（正常：AI 生成选项） ───
  if (phase === 'focuser' && focuser) {
    const hasSelection = selectedOptionId !== null || customContent.trim().length > 0;

    return (
      <div className="review-screen">
        <div className="review-header">
          <button onClick={onBack} className="back-btn">&larr; 返回</button>
          <h1>对话复盘</h1>
        </div>

        <div className="focuser-section">
          {/* 镜像摘要 */}
          <div className="focuser-mirror">
            <span className="focuser-mirror-icon">🪞</span>
            <span className="focuser-mirror-text">"{focuser.mirror_summary}"</span>
          </div>

          {/* 选项卡片 */}
          <div className="focuser-options">
            {focuser.options.map((opt) => (
              <button
                key={opt.id}
                className={'focuser-option' + (selectedOptionId === opt.id ? ' selected' : '')}
                onClick={() => handleSelectOption(opt.id)}
              >
                <span className="focuser-option-id">{opt.id}</span>
                <span className="focuser-option-label">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* 自定义输入 */}
          <div className="focuser-custom">
            <div className="focuser-custom-label">✏️ 自定义</div>
            <textarea
              value={customContent}
              onChange={(e) => handleCustomInput(e.target.value)}
              onFocus={() => setSelectedOptionId(null)}
              placeholder="写下你自己的锚点..."
              rows={2}
            />
          </div>

          {/* 操作按钮 */}
          <div className="answer-actions">
            <button className="skip-btn" onClick={handleFocuserSkip} disabled={focuserSubmitting}>跳过</button>
            <button className="submit-btn" onClick={handleFocuserConfirm} disabled={focuserSubmitting || !hasSelection}>
              {focuserSubmitting ? '保存中...' : '确认锚点'}
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
