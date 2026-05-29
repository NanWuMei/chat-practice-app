import type { DistilledPersona } from "../../shared/types";

interface Props {
  basePersonaId: string;
  personas: (DistilledPersona & { terminated?: boolean })[];
  onSelect: (p: DistilledPersona) => void;
  onClone: (personaId: string) => void;
  onDeleteClone: (personaId: string) => void;
  onBack: () => void;
}

function getStage(score: number): string {
  if (score >= 350) return "恋人";
  if (score >= 200) return "暧昧期";
  if (score >= 100) return "好朋友";
  if (score >= 30) return "普通朋友";
  return "陌生人";
}

export function ClonePicker({ basePersonaId, personas, onSelect, onClone, onDeleteClone, onBack }: Props) {
  const versions = personas.filter((p) => {
    return p.id === basePersonaId || p.id.startsWith(basePersonaId + "-clone-");
  });
  const basePersona = versions.find((p) => p.id === basePersonaId);

  return (
    <div className="clone-picker">
      <div className="clone-picker-header">
        <button onClick={onBack} className="back-btn">← 返回</button>
        <h1>{basePersona?.name ?? "角色"} · 选择版本</h1>
        <p className="subtitle">选择要互动的版本，或创建新分身重新开始</p>
      </div>

      <button className="new-clone-btn" onClick={() => onClone(basePersonaId)}>
        🪞 创建新分身（情感账户归零）
      </button>

      <div className="clone-grid">
        {versions.map((v) => {
          const terminated = v.terminated ?? v.emotionalBankScore < -10;
          const isClone = v.id.includes("-clone-");
          return (
            <div key={v.id} className={`clone-card-wrapper ${terminated ? "terminated" : ""}`}>
              <button
                className="clone-card"
                onClick={() => onSelect(v)}
              >
                <div className="clone-card-header">
                  <h2>{v.name}</h2>
                  {isClone && <span className="clone-tag">分身</span>}
                  {!isClone && <span className="original-tag">原版</span>}
                </div>
                <div className="bank-score-badge">
                  <span className={`score ${v.emotionalBankScore >= 0 ? "positive" : "negative"}`}>
                    💳 {v.emotionalBankScore >= 0 ? "+" : ""}{v.emotionalBankScore}
                  </span>
                  <span className="stage">{getStage(v.emotionalBankScore)}</span>
                </div>
                {terminated && <div className="terminated-badge">💀 关系已终止</div>}
                {!terminated && <div className="clone-hint">点击进入聊天</div>}
                {terminated && <div className="clone-hint">点击查看历史记录</div>}
              </button>
              {isClone && (
                <button
                  className="delete-clone-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除分身「${v.name}」吗？\n\n该分身的所有聊天记录和复盘数据都会被永久删除。`)) {
                      onDeleteClone(v.id);
                    }
                  }}
                  title="删除此分身"
                >
                  🗑️
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}