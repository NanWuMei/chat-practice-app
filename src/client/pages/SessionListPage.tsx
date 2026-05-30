import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { SessionList } from '../components/SessionList';

export default function SessionListPage() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const { personas, selectedPersona, sessions, loadPersonas, loadSessions, selectPersona, createSession, deleteSession } = useAppStore();

  useEffect(() => {
    loadPersonas();
    if (personaId) {
      loadSessions(personaId);
      const persona = personas.find((p) => p.id === personaId);
      if (persona) selectPersona(persona);
    }
  }, [personaId]);

  const persona = selectedPersona?.id === personaId ? selectedPersona : personas.find((p) => p.id === personaId);
  const basePersonaId = personaId?.includes('-clone-') ? personaId.split('-clone-')[0] : personaId;

  const handleNewSession = async () => {
    if (!personaId) return;
    const session = await createSession(personaId);
    if (session) navigate('/chat/' + session.id);
  };

  const handleResumeSession = (sessionId: string) => {
    navigate('/chat/' + sessionId);
  };

  const handleDeleteSession = async (sessionId: string, _info: string) => {
    await deleteSession(sessionId);
  };

  if (!persona) return <div>加载中...</div>;

  return (
    <SessionList
      persona={persona}
      sessions={sessions}
      onNewSession={handleNewSession}
      onResumeSession={handleResumeSession}
      onDeleteSession={handleDeleteSession}
      onBack={() => navigate('/clone/' + basePersonaId)}
    />
  );
}
