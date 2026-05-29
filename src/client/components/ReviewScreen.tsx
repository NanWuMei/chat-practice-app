import type { DualReviewReport } from "../../shared/types";

interface Props { review: DualReviewReport; onBack: () => void; }

export function ReviewScreen({ review, onBack }: Props) {
  const { tongReview, gottmanReview, ariadneScoring, mergedSummary } = review;

  return (
    <div className="review-screen">
      <div className="review-header">
        <button onClick={onBack} className="back-btn">← 重新练习</button>
        <h1>📊 三导师复盘报告</h1>
        <div className="review-bank-header">
          <span className={`bank-score ${review.bankScore >= 0 ? "positive" : "negative"}`}>
            💳 本轮：{review.bankScore >= 0 ? "+" : ""}{review.bankScore}
          </span>
          <span className="stage">阶段：{review.relationshipStage}</span>
        </div>
        {review.behaviorMetrics && (
          <div className="behavior-metrics">
            <span className={`metric ${review.behaviorMetrics.isShortChat ? "warning" : "ok"}`}>
              💬 {review.behaviorMetrics.turnCount}轮{review.behaviorMetrics.isShortChat ? "（短聊）" : ""}
            </span>
            {review.behaviorMetrics.ghostPenalty > 0 && (
              <span className="metric penalty">👻 已读不回 -{review.behaviorMetrics.ghostPenalty}</span>
            )}
            {review.behaviorMetrics.frequencyDelta > 0 && (
              <span className="metric bonus">🔥 频繁聊天 +{review.behaviorMetrics.frequencyDelta}</span>
            )}
            {review.behaviorMetrics.frequencyDelta < 0 && (
              <span className="metric penalty">💤 疏远 {review.behaviorMetrics.frequencyDelta}</span>
            )}
            {review.behaviorMetrics.daysSinceLastSession !== null && (
              <span className="metric info">📅 距上次 {review.behaviorMetrics.daysSinceLastSession}天</span>
            )}
            {review.behaviorMetrics.daysSinceLastSession === null && (
              <span className="metric info">📅 第一次聊天</span>
            )}
          </div>
        )}
        <p className="merged-summary">{mergedSummary}</p>
      </div>

      <div className="review-columns">
        <div className="review-col tong-col">
          <h2>🎤 童锦程 · 实战点评</h2>
          <p className="col-desc">具体哪句话说得好/不好，怎么改</p>
          <div className="section"><h3>整体评价</h3><p>{tongReview.overallAssessment}</p></div>
          {tongReview.topStrengths.length > 0 && <div className="section"><h3>✅ 亮点</h3><ul>{tongReview.topStrengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {tongReview.topMistakes.length > 0 && <div className="section"><h3>❌ 待改进</h3><ul>{tongReview.topMistakes.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
          <div className="section">
            <h3>📝 逐条分析</h3>
            {tongReview.messageReviews.map((mr, i) => (
              <div key={i} className={`msg-review rating-${mr.rating}`}>
                <div className="msg-text"><span className="label">你说：</span>{mr.userMessage}</div>
                <div className="rating-badge">{mr.rating === "good" ? "👍 好" : mr.rating === "neutral" ? "➖ 一般" : "👎 待改进"}</div>
                <div className="analysis">{mr.analysis}</div>
                {mr.keyPoint && <div className="key-point">💡 对方信号：{mr.keyPoint}</div>}
                {mr.betterVersion && <div className="better"><strong>更好的说法：</strong>{mr.betterVersion}<br /><em>{mr.whyBetter}</em></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="review-col gottman-col">
          <h2>🧠 Gottman · 心理分析</h2>
          <p className="col-desc">底层心理学规律，为什么这么说有效</p>
          <div className="section"><h3>关系阶段</h3><p>{gottmanReview.relationshipStage}</p></div>

          <div className="section">
            <h3>🐴 四大骑士检查</h3>
            <div className="horsemen-grid">
              <span className={gottmanReview.fourHorsemenCheck.criticism ? "active" : ""}>{gottmanReview.fourHorsemenCheck.criticism ? "⚠️" : "✅"} 批评</span>
              <span className={gottmanReview.fourHorsemenCheck.contempt ? "active" : ""}>{gottmanReview.fourHorsemenCheck.contempt ? "⚠️" : "✅"} 蔑视</span>
              <span className={gottmanReview.fourHorsemenCheck.defensiveness ? "active" : ""}>{gottmanReview.fourHorsemenCheck.defensiveness ? "⚠️" : "✅"} 防御</span>
              <span className={gottmanReview.fourHorsemenCheck.stonewalling ? "active" : ""}>{gottmanReview.fourHorsemenCheck.stonewalling ? "⚠️" : "✅"} 石墙</span>
            </div>
            {gottmanReview.fourHorsemenCheck.details.length > 0 && <ul className="details">{gottmanReview.fourHorsemenCheck.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
          </div>
          <div className="section bank-account-card">
            <h3>💳 情感账户</h3>
            <div className={`balance ${gottmanReview.emotionalBankAccount.balance}`}>
              余额：{gottmanReview.emotionalBankAccount.balance === "positive" ? "✅ 正向" : gottmanReview.emotionalBankAccount.balance === "neutral" ? "➖ 持平" : "⚠️ 负向"}
            </div>
            <div className="bank-details">
              <div className="bank-score-display">
                <span className={`score-big ${gottmanReview.emotionalBankAccount.score >= 0 ? "positive" : "negative"}`}>
                  {gottmanReview.emotionalBankAccount.score >= 0 ? "+" : ""}{gottmanReview.emotionalBankAccount.score}
                </span>
                <span className="score-label">本轮得分</span>
              </div>
              <div className="bank-stage">
                <div className="stage-name">{gottmanReview.emotionalBankAccount.stage}</div>
                <div className="stage-reason">{gottmanReview.emotionalBankAccount.stageReason}</div>
              </div>
            </div>
            {gottmanReview.emotionalBankAccount.deposits.length > 0 && <div className="bank-list"><strong>存款：</strong><ul>{gottmanReview.emotionalBankAccount.deposits.map((d, i) => <li key={i} className="deposit">{d}</li>)}</ul></div>}
            {gottmanReview.emotionalBankAccount.withdrawals.length > 0 && <div className="bank-list"><strong>取款：</strong><ul>{gottmanReview.emotionalBankAccount.withdrawals.map((w, i) => <li key={i} className="withdrawal">{w}</li>)}</ul></div>}
          </div>
          {gottmanReview.patterns.length > 0 && <div className="section"><h3>📐 关系模式</h3>{gottmanReview.patterns.map((p, i) => <div key={i} className={`pattern severity-${p.severity}`}><strong>{p.pattern}</strong><p>{p.description}</p></div>)}</div>}
          <div className="section">
            <h3>⚖️ 导师讨论</h3>
            {(() => {
              const md = (gottmanReview as any).mentorDiscussion ?? (gottmanReview as any).agreeOrChallengeTong;
              if (!md) return null;
              // New format: mentorDiscussion with discussionPoints
              if (md.discussionPoints) {
                return (
                  <>
                    {md.discussionPoints.map((dp: any, i: number) => (
                      <div key={i} className={`discussion-point ${dp.agreed ? "agreed" : "disagreed"}`}>
                        <div className="dp-topic">{dp.topic}</div>
                        <div className="dp-positions">
                          <div className="dp-tong"><span className="dp-label">🎤 童锦程：</span>{dp.tongPosition}</div>
                          <div className="dp-gottman"><span className="dp-label">🧠 Gottman：</span>{dp.gottmanPosition}</div>
                        </div>
                        <div className={`dp-verdict ${dp.agreed ? "agreed" : "disagreed"}`}>
                          {dp.agreed ? "✅ 共识" : "🤔 分歧"}：{dp.reasoning}
                        </div>
                      </div>
                    ))}
                    <div className="consensus"><strong>总结：</strong>{md.finalConsensus}</div>
                  </>
                );
              }
              // Legacy format: agreeOrChallengeTong
              return (
                <>
                  {md.agreePoints?.length > 0 && <div><strong>✅ 同意：</strong><ul>{md.agreePoints.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
                  {md.challengePoints?.length > 0 && <div><strong>🤔 反驳：</strong><ul>{md.challengePoints.map((ch: string, i: number) => <li key={i}>{ch}</li>)}</ul></div>}
                  <div className="consensus"><strong>共识：</strong>{md.finalConsensus}</div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="review-col ariadne-col">
          <h2>📊 Ariadne · 综合评分</h2>
          <p className="col-desc">结构化评分 + 关系洞察</p>
          <div className="section"><h3>一句话判断</h3><p className="summary-text">{ariadneScoring.summary}</p></div>
          <div className="section">
            <h3>📈 维度评分</h3>
            <div className="score-grid">
              {ariadneScoring.scores.map((s, i) => (
                <div key={i} className="score-card">
                  <div className="dim-name">{s.dimension}</div>
                  <div className="score-change">
                    <span className="start">{s.start}</span>
                    <span className="arrow">{s.delta > 0 ? "↑" : s.delta < 0 ? "↓" : "→"}</span>
                    <span className="end">{s.end}</span>
                    <span className={`delta ${s.delta > 0 ? "up" : s.delta < 0 ? "down" : ""}`}>({s.delta > 0 ? "+" : ""}{s.delta})</span>
                  </div>
                  <div className="reason">{s.reason}</div>
                </div>
              ))}
            </div>
          </div>
          {ariadneScoring.turningPoints.length > 0 && <div className="section"><h3>🔄 关键转折点</h3>{ariadneScoring.turningPoints.map((tp, i) => <div key={i} className="turning-point"><div className="tp-msg">"{tp.message}"</div><div className="tp-impact">{tp.impact}</div><div className="tp-why">{tp.why}</div></div>)}</div>}
          <div className="section"><h3>🎯 下一步目标</h3><p className="next-goal">{ariadneScoring.nextGoal}</p></div>
          {ariadneScoring.coreNeeds.length > 0 && <div className="section"><h3>💡 暴露的核心需求</h3><ul>{ariadneScoring.coreNeeds.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
        </div>
      </div>
    </div>
  );
}