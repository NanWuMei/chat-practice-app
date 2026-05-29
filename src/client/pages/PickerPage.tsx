import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { PersonaPicker } from "../components/PersonaPicker";

export default function PickerPage() {
  const navigate = useNavigate();
  const { personas, loadPersonas, selectBase } = useAppStore();

  useEffect(() => { loadPersonas(); }, [loadPersonas]);

  const handleSelect = (p: { id: string }) => {
    selectBase(p.id);
    navigate(`/clone/${p.id}`);
  };

  return <PersonaPicker personas={personas} onSelect={handleSelect} />;
}
