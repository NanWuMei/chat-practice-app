import type { DistilledPersona } from "../../shared/types";

interface Props {
  personas: (DistilledPersona & { terminated?: boolean })[];
  onSelect: (p: DistilledPersona) => void;
}

export function PersonaPicker({ personas, onSelect }: Props) {
  const basePersonas = personas.filter((p) => !p.id.includes("-clone-"));
  return (
    <div className="picker">
      <h1>🎯 聊天练习</h1>
      <p className="subtitle">选择一个练习对象，开始训练你的聊天能力</p>
      <div className="persona-grid">
        {basePersonas.map((p) => {
          const terminated = p.terminated ?? false;
          return (
            <button
              key={p.id}
              className={`persona-card ${terminated ? "terminated" : ""}`}
              onClick={() => onSelect(p)}
            >
              <h2>{p.name}</h2>
              <p className="role">{p.role}</p>
              <p className="source">《{p.source}》</p>
              {terminated && <div className="terminated-badge">💀 关系已终止</div>}
              <div className="tags">{p.personality.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}</div>
              <p className="background">{p.background}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}