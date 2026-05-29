import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import PickerPage from "./pages/PickerPage";
import ClonePickerPage from "./pages/ClonePickerPage";
import SessionListPage from "./pages/SessionListPage";
import ChatPage from "./pages/ChatPage";
import ReviewPage from "./pages/ReviewPage";

export default function App() {
  const { error, setError } = useAppStore();

  return (
    <BrowserRouter>
      <div className="app">
        {error && <div className="error-banner" onClick={() => setError(null)}>❌ {error}（点击关闭）</div>}
        <Routes>
          <Route path="/" element={<PickerPage />} />
          <Route path="/clone/:basePersonaId" element={<ClonePickerPage />} />
          <Route path="/sessions/:personaId" element={<SessionListPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/review/:sessionId" element={<ReviewPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
