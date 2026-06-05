import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone } from 'lucide-react';

export default function RegisterLogin() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone_number: '',
    work_status: 'Available',
    relationship_status: 'Private'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGoogleAuth = () => {
    window.location.href = 'http://localhost:5000/auth/google';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    const submissionPayload = isLogin 
      ? { email: formData.email, password: formData.password }
      : formData;

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionPayload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication process failed.');
      }
      
      alert(data.message);
      
      if (data.success && data.user) {
        // ✅ FIXED: Safely parsing keys inside the nested data.user object
        const trueId = data.user.user_id || data.user.userId;
        
        if (trueId) {
          localStorage.setItem('userId', trueId.toString());
          localStorage.setItem('username', data.user.username || '');
          window.location.href = '/'; 
        } else {
          alert("Authentication error: User ID token missing.");
        }
      } else if (data.success && !isLogin) {
        setIsLogin(true); 
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-700 shadow-xl p-6 md:p-8">

        <div className="flex border-b border-slate-700 mb-6">
          <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Sign In</button>
          <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${!isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Create Account</button>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-indigo-400 tracking-wide">CREATOR.HUB</h2>
          <p className="text-xs text-slate-400 mt-1">{isLogin ? 'Welcome back! Log in to check updates.' : 'Join the community to collaborate.'}</p>
        </div>

        <button type="button" onClick={handleGoogleAuth} className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm py-2.5 px-4 rounded-xl transition shadow-sm mb-4">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.42 1.69l3.3-3.3C17.74 1.58 15.06 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.8 2.95C6.23 7.02 8.89 5.04 12 5.04z"/>
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.98 3.39-4.89 3.39-8.48z"/>
            <path fill="#FBBC05" d="M5.3 14.55c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3L1.5 7.01C.54 8.93 0 11.11 0 13.43s.54 4.5 1.5 6.42l3.8-2.95z"/>
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.11 0-5.77-1.98-6.71-4.91L1.49 16.38C3.4 20.21 7.35 23 12 23z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center my-4 text-xs text-slate-500 font-medium">
          <div className="flex-1 border-t border-slate-700/60"></div>
          <span className="px-3">OR USE EMAIL</span>
          <div className="flex-1 border-t border-slate-700/60"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User size={16}/></span>
                <input type="text" name="username" required value={formData.username} onChange={handleInputChange} className="w-full bg-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Mail size={16}/></span>
              <input type="email" name="email" required value={formData.email} onChange={formData.email ? handleInputChange : handleInputChange} className="w-full bg-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Mobile Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone size={16}/></span>
                <input type="tel" name="phone_number" required value={formData.phone_number} onChange={handleInputChange} className="w-full bg-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Lock size={16}/></span>
              <input type="password" name="password" required value={formData.password} onChange={handleInputChange} className="w-full bg-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Work Status</label>
                <select name="work_status" value={formData.work_status} onChange={handleInputChange} className="w-full bg-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Available">Available</option>
                  <option value="Busy">Busy</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Relationship</label>
                {/* ✅ FIXED: Removed duplicate value attribute */}
                <select name="relationship_status" value={formData.relationship_status} onChange={handleInputChange} className="w-full bg-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Private">Private</option>
                  <option value="Public">Public</option>
                </select>
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 mt-2">
            {isLogin ? 'Sign In to Account' : 'Register Account'}
          </button>
        </form>

      </div>
    </div>
  );
}
