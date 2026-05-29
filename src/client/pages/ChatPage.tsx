import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { ChatScreen } from "../components/ChatScreen";

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, review, resumeSession, endAndReview } = useAppStore();

  useEffect(() => {
    if (sessionId) resumeSession(sessionId);
  }, [sessionId]);

  const handleEndAndReview = async (sid: string) => {
    await endAndReview(sid);
    navigate(`/review/${sid}`);
  };

  const handleViewReview = () => {
    if (sessionId) navigate(`/review/${sessionId}`);
  };

  // Derive personaId for back navigation
  const personaId = session?.personaId;

  if (!session) return <div>加载中...</div>;

  return (
    <ChatScreen
      session={session}
      hasReview={!!review}
      onEndAndReview={handleEndAndReview}
      onViewReview={handleViewReview}
      onBack={() => navigate(`/sessions/${personaId}`)}
    />
  );
}
