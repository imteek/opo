import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Welcome to OPO Insights</h1>
        <p>Your comprehensive platform for Organ Procurement Organization analytics and insights</p>
        <button 
          className="enter-dashboard-btn"
          onClick={() => navigate('/dashboard')}
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
};

export default HomePage; 