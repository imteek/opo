import React, { useState } from 'react';
import DataUpload from './DataUpload';
import Models from './Models';
import Trends from './Trends';
import RegionalAnalysis from './RegionalAnalysis';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch(activeTab) {
      case 'data-upload':
        return <DataUpload />;
      case 'regional-analysis':
        return <RegionalAnalysis />;
      case 'models':
        return <Models />;
      case 'trends':
        return <Trends />;
      case 'dashboard':
      default:
        return (
          <>
            <header>
              <div className="header-content">
                <h1>Welcome to OPO Insights Dashboard</h1>
                <div className="search-bar">
                  <input type="text" placeholder="Search..." />
                  <button><i className="fas fa-search"></i></button>
                </div>
                <div className="notifications">
                  <i className="far fa-bell"></i>
                  <span className="badge">3</span>
                </div>
              </div>
            </header>

            <div className="dashboard-summary">
              {/* Summary cards content */}
              <div className="summary-card">
                <div className="card-icon donor">
                  <i className="fas fa-user-plus"></i>
                </div>
                <div className="card-info">
                  <h3>Total Donors</h3>
                  <p className="number">1,248</p>
                  <p className="trend positive"><i className="fas fa-arrow-up"></i> 12% from last month</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon transplant">
                  <i className="fas fa-heartbeat"></i>
                </div>
                <div className="card-info">
                  <h3>Successful Transplants</h3>
                  <p className="number">3,567</p>
                  <p className="trend positive"><i className="fas fa-arrow-up"></i> 8% from last month</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon waiting">
                  <i className="fas fa-hourglass-half"></i>
                </div>
                <div className="card-info">
                  <h3>Waiting List</h3>
                  <p className="number">5,892</p>
                  <p className="trend negative"><i className="fas fa-arrow-up"></i> 3% from last month</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon efficiency">
                  <i className="fas fa-chart-pie"></i>
                </div>
                <div className="card-info">
                  <h3>Conversion Rate</h3>
                  <p className="number">76%</p>
                  <p className="trend positive"><i className="fas fa-arrow-up"></i> 5% from last month</p>
                </div>
              </div>
            </div>

            <div className="dashboard-charts">
              {/* Charts content */}
              <div className="chart-container large">
                <div className="chart-header">
                  <h3>Donor Trends</h3>
                  <div className="chart-controls">
                    <select>
                      <option>Last 12 Months</option>
                      <option>Last 6 Months</option>
                      <option>Last 3 Months</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Organ Distribution</h3>
                  <div className="chart-controls">
                    <button className="active">All</button>
                    <button>Heart</button>
                    <button>Kidney</button>
                    <button>Liver</button>
                    <button>Lung</button>
                  </div>
                </div>
              </div>
              
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Regional Performance</h3>
                  <div className="chart-controls">
                    <button><i className="fas fa-download"></i> Export</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="recent-activity">
              {/* Recent activity content */}
              <div className="section-header">
                <h3>Recent Activity</h3>
                <button>View All</button>
              </div>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon success">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="activity-details">
                    <h4>Successful Kidney Transplant</h4>
                    <p>Memorial Hospital - 2 hours ago</p>
                  </div>
                  <div className="activity-status">
                    <span className="badge success">Completed</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon pending">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="activity-details">
                    <h4>New Donor Registration</h4>
                    <p>City Medical Center - 4 hours ago</p>
                  </div>
                  <div className="activity-status">
                    <span className="badge pending">Processing</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon alert">
                    <i className="fas fa-exclamation-circle"></i>
                  </div>
                  <div className="activity-details">
                    <h4>Urgent Liver Match Found</h4>
                    <p>University Hospital - 6 hours ago</p>
                  </div>
                  <div className="activity-status">
                    <span className="badge alert">Urgent</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon success">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="activity-details">
                    <h4>Successful Heart Transplant</h4>
                    <p>General Hospital - 1 day ago</p>
                  </div>
                  <div className="activity-status">
                    <span className="badge success">Completed</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="container">
      <nav className="sidebar">
        <div className="logo">
          <h2>OPO Insights</h2>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'dashboard' ? 'active' : ''}>
            <a href="#" onClick={() => setActiveTab('dashboard')}>
              <i className="fas fa-home"></i> Dashboard
            </a>
          </li>
          <li className={activeTab === 'data-upload' ? 'active' : ''}>
            <a href="#" onClick={() => setActiveTab('data-upload')}>
              <i className="fas fa-upload"></i> Data Upload
            </a>
          </li>
          <li className={activeTab === 'models' ? 'active' : ''}>
            <a href="#" onClick={() => setActiveTab('models')}>
              <i className="fas fa-brain"></i> Models
            </a>
          </li>
          <li className={activeTab === 'trends' ? 'active' : ''}>
            <a href="#" onClick={() => setActiveTab('trends')}>
              <i className="fas fa-calendar-alt"></i> Trends
            </a>
          </li>
          <li className={activeTab === 'regional-analysis' ? 'active' : ''}>
            <a href="#" onClick={() => setActiveTab('regional-analysis')}>
              <i className="fas fa-calendar-alt"></i> Regional Analysis
            </a>
          </li>
          <li>
            <a href="#">
              <i className="fas fa-file-alt"></i> Reports
            </a>
          </li>
          <li>
            <a href="#">
              <i className="fas fa-cog"></i> Settings
            </a>
          </li>
        </ul>
        <div className="user-info">
          <div>
            <h4>Fathom Research Group</h4>
          </div>
        </div>
      </nav>

      <main className="content">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
