import type { DistilledPersona } from '../../shared/types';

interface Props {
  basePersonaId: string;
  personas: DistilledPersona[];
  onSelect: (p: DistilledPersona) => void;
  onClone: (personaId: string) => void;
  onDeleteClone: (personaId: string) => void;
  onBack: () => void;
}

export function ClonePicker({ basePersonaId, personas, onSelect, onClone, onDeleteClone, onBack }: Props) {
  const versions = personas.filter((p) => p.id === basePersonaId || p.id.startsWith(basePersonaId + '-clone-'));
  const basePersona = versions.find((p) => p.id === basePersonaId);

  return (
    <div className="clone-picker">
      <div className="clone-picker-header">
        <button onClick={onBack} className="back-btn">&larr; 返回</button>
        <h1>{basePersona?.name ?? '角色'} &middot; 选择版本</h1>
        <p className="subtitle">选择要互动的版本，或创建新分身重新开始</p>
      </div>

      <button className="new-clone-btn" onClick={() => onClone(basePersonaId)}>
        🪞 创建新分身
      </button>

      <div className="clone-grid">
        {versions.map((v) => {
          const isClone = v.id.includes('-clone-');
          return (
            <div key={v.id} className="clone-card-wrapper">
              <button className="clone-card" onClick={() => onSelect(v)}>
                <div className="clone-card-header">
                  <h2>{v.name}</h2>
                  {isClone && <span className="clone-tag">分身</span>}
                  {!isClone && <span className="original-tag">原版</span>}
                </div>
                <div className="clone-hint">点击进入聊天</div>
              </button>
              {isClone && (
                <button
                  className="delete-clone-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('确定要删除分身「' + v.name + '」吗？')) {
                      onDeleteClone(v.id);
                    }
                  }}
                  title="删除此分身"
                >🗑️</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
