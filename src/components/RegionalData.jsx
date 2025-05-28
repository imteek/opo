import React, { useEffect } from 'react';

const RegionalData = () => {
  useEffect(() => {
    console.log('RegionalData component mounted');
  }, []);

  return (
    <div className="regional-data-container">
      <header>
        <div className="header-content">
          <h1>Regional Data Analysis</h1>
          <p>Explore organ acceptance patterns across different regions</p>
        </div>
      </header>
      
      <div className="regional-content">
        <div className="placeholder-message">
          <i className="fas fa-map-marked-alt"></i>
          <h3>US Map Coming Soon</h3>
          <p>An interactive map of the United States will be displayed here.</p>
        </div>
      </div>
      
      <style jsx>{`
        .regional-data-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        header {
          margin-bottom: 30px;
        }
        
        .header-content h1 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }
        
        .header-content p {
          margin: 0;
          color: #7f8c8d;
        }
        
        .regional-content {
          background-color: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .placeholder-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #7f8c8d;
        }
        
        .placeholder-message i {
          font-size: 48px;
          color: #3498db;
          margin-bottom: 20px;
        }
        
        .placeholder-message h3 {
          margin: 0 0 12px 0;
          color: #2c3e50;
          font-size: 20px;
        }
        
        .placeholder-message p {
          margin: 0;
          color: #7f8c8d;
        }
      `}</style>
    </div>
  );
};

export default RegionalData; 