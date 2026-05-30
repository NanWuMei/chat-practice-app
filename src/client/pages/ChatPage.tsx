import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { ChatScreen } from '../components/ChatScreen';
import { client } from '../api';

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, review, resumeSession, endAndReview } = useAppStore();
  const [stage, setStage] = useState('试探期');
  const [temperature, setTemperature] = useState('T3');

  useEffect(() => {
    if (sessionId) {
      resumeSession(sessionId);
      // 获取当前关系状态
      client.getSession(sessionId).then((s) => {
        // 通过 personaId 获取 growth record 来拿 stage/temp
        // 简化：直接从 debrief API 获取
        client.getDebrief(sessionId).then((d) => {
          // debrief 里没有 stage/temp，需要另一个方式
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [sessionId]);

  // 从 session 的 personaId 获取关系状态
  useEffect(() => {
    if (!session) return;
    // 通过一个简单 API 调用获取 growth record
    // 暂时用 fetch 直接调
    fetch('http://localhost:8787/api/personas/' + session.personaId + '/growth')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.relationship_state) {
          setStage(data.relationship_state.current_stage);
          setTemperature(data.relationship_state.current_temperature);
        }
      })
      .catch(() => {});
  }, [session]);

  const handleEndAndReview = async (sid: string) => {
    await endAndReview(sid);
    navigate('/review/' + sid);
  };

  const handleViewReview = () => {
    if (sessionId) navigate('/review/' + sessionId);
  };

  const personaId = session?.personaId;

  if (!session) return <div>加载中...</div>;

  return (
    <ChatScreen
      session={session}
      hasReview={!!review}
      stage={stage}
      temperature={temperature}
      onEndAndReview={handleEndAndReview}
      onViewReview={handleViewReview}
      onBack={() => navigate('/sessions/' + personaId)}
    />
  );
}
