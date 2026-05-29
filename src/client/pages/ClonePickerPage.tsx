import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { ClonePicker } from "../components/ClonePicker";

export default function ClonePickerPage() {
  const { basePersonaId } = useParams<{ basePersonaId: string }>();
  const navigate = useNavigate();
  const { personas, loadPersonas, selectPersona, clonePersona, deleteClone } = useAppStore();

  useEffect(() => { loadPersonas(); }, [loadPersonas]);

  const handleSelect = (p: { id: string }) => {
    selectPersona(p as any);
    navigate(`/sessions/${p.id}`);
  };

  return (
    <ClonePicker
      basePersonaId={basePersonaId!}
      personas={personas}
      onSelect={handleSelect}
      onClone={clonePersona}
      onDeleteClone={deleteClone}
      onBack={() => navigate("/")}
    />
  );
}
