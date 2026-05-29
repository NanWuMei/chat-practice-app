import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { ReviewScreen } from "../components/ReviewScreen";

export default function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, review, resumeSession } = useAppStore();

  useEffect(() => {
    if (sessionId && !review) resumeSession(sessionId);
  }, [sessionId, review, resumeSession]);

  const personaId = session?.personaId;

  if (!review) return <div>加载中...</div>;

  return (
    <ReviewScreen
      review={review}
      onBack={() => navigate(`/sessions/${personaId}`)}
    />
  );
}
