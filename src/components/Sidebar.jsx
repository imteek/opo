import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  return (
    <nav className="sidebar">
      <div className="logo">
        <h2>OPO Insights</h2>
      </div>
      <ul className="nav-links">
        <li className={location.pathname === '/dashboard' ? 'active' : ''}>
          <Link to="/dashboard">
            <i className="fas fa-home"></i> Dashboard
          </Link>
        </li>
        <li className={location.pathname === '/upload' ? 'active' : ''}>
          <Link to="/upload">
            <i className="fas fa-upload"></i> Data Upload
          </Link>
        </li>
        <li className={location.pathname === '/models' ? 'active' : ''}>
          <Link to="/models">
            <i className="fas fa-brain"></i> Models
          </Link>
        </li>
        <li className={location.pathname === '/analytics' ? 'active' : ''}>
          <Link to="/analytics">
            <i className="fas fa-chart-line"></i> Analytics
          </Link>
        </li>
        <li className={location.pathname === '/regional' ? 'active' : ''}>
          <Link to="/regional">
            <i className="fas fa-map-marker-alt"></i> Regional Data
          </Link>
        </li>
        <li className={location.pathname === '/trends' ? 'active' : ''}>
          <Link to="/trends">
            <i className="fas fa-calendar-alt"></i> Trends
          </Link>
        </li>
        <li className={location.pathname === '/reports' ? 'active' : ''}>
          <Link to="/reports">
            <i className="fas fa-file-alt"></i> Reports
          </Link>
        </li>
        <li className={location.pathname === '/settings' ? 'active' : ''}>
          <Link to="/settings">
            <i className="fas fa-cog"></i> Settings
          </Link>
        </li>
      </ul>
      <div className="user-info">
        <div>
          <h4>Fathom Research Group</h4>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar; 