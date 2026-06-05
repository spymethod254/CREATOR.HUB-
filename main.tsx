import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Homepage from './Homepage';
import RegisterLogin from './RegisterLogin';
import ChatWindow from './ChatWindow';
import UserProfile from './UserProfile';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<RegisterLogin />} />
        <Route path="/chat" element={<ChatWindow />} />
        <Route path="/profile" element={<UserProfile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
