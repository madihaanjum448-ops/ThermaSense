import React, { useState, useEffect } from 'react';
import './App.css';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If path starts with /dashboard, render Dashboard, else LandingPage
  if (currentPath === '/dashboard' || currentPath.startsWith('/dashboard')) {
    return <Dashboard onNavigateHome={() => navigateTo('/')} />;
  }

  return <LandingPage onNavigateDashboard={() => navigateTo('/dashboard')} />;
}

export default App;
