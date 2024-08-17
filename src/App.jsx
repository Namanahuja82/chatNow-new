import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ChatRoom from './pages/ChatRoom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat/:room" element={<ChatRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;