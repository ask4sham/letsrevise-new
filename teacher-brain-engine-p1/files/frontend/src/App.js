import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "@/pages/Landing";
import LessonView from "@/pages/LessonView";
import Library from "@/pages/Library";
import Login from "@/pages/Login";

// Manual crash test route. Visit /__boom to verify the ErrorBoundary fallback.
function Boom() {
  throw new Error("Manual crash from /__boom route (P0.4 verification)");
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/lesson/:id" element={<LessonView />} />
              <Route path="/library" element={<Library />} />
              <Route path="/login" element={<Login />} />
              <Route path="/__boom" element={<Boom />} />
            </Routes>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  );
}

export default App;
