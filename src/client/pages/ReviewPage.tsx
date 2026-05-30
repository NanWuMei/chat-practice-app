import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { ReviewScreen } from '../components/ReviewScreen';
import type { DebriefSession } from '../../shared/types';
import { client } from '../api';

export default function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, review, resumeSession } = useAppStore();
  const [debrief, setDebrief] = useState<DebriefSession | null>(null);

  useEffect(() => {
    if (sessionId && !review) resumeSession(sessionId);
    if (sessionId) {
      client.getDebrief(sessionId).then(setDebrief).catch(() => {});
    }
  }, [sessionId, review, resumeSession]);

  const personaId = session?.personaId;

  if (!review) return <div>加载中...</div>;

  return (
    <ReviewScreen
      review={review}
      debrief={debrief}
      sessionId={sessionId!}
      onBack={() => navigate('/sessions/' + personaId)}
      onComplete={() => navigate('/sessions/' + personaId)}
    />
  );
}
