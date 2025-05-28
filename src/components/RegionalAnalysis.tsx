import React, { useState, useEffect, useRef } from 'react';
import './RegionalAnalysis.css';
import { Map, Marker } from 'pigeon-maps';

interface ModelResult {
  date: string;
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  keyFeatures: {
    name: string;
    importance: number;
  }[];
}

interface RegionData {
  name: string;
  donorCount: number;
  transplantCount: number;
  waitlistCount: number;
  successRate: number;
  stateCode: string;
  modelResults: ModelResult[];
  demographics: {
    category: string;
    values: {
      label: string;
      percentage: number;
    }[];
  }[];
}

const RegionalAnalysis: React.FC = () => {
  const [activeRegion, setActiveRegion] = useState<string>('boston');
  const [activeTab, setActiveTab] = useState<string>('modelResults');
  const [mapView, setMapView] = useState<boolean>(false);

  // Sample data for different regions
  const regionData: Record<string, RegionData> = {
    boston: {
      name: 'Boston',
      donorCount: 842,
      transplantCount: 1256,
      waitlistCount: 4489,
      successRate: 92.4,
      stateCode: 'MA',
      modelResults: [
        {
          date: '2023-06-15',
          modelName: 'Random Forest Classifier',
          accuracy: 0.89,
          precision: 0.87,
          recall: 0.92,
          f1Score: 0.89,
          auc: 0.91,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.24 },
            { name: 'Cold Ischemia Time', importance: 0.18 },
            { name: 'HLA Matching', importance: 0.15 },
            { name: 'Recipient Health Score', importance: 0.12 },
            { name: 'Distance', importance: 0.09 }
          ]
        },
        {
          date: '2023-08-22',
          modelName: 'Gradient Boosting',
          accuracy: 0.91,
          precision: 0.89,
          recall: 0.93,
          f1Score: 0.91,
          auc: 0.94,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.22 },
            { name: 'Cold Ischemia Time', importance: 0.20 },
            { name: 'HLA Matching', importance: 0.17 },
            { name: 'Recipient Health Score', importance: 0.14 },
            { name: 'Distance', importance: 0.08 }
          ]
        }
      ],
      demographics: [
        {
          category: 'Age Groups',
          values: [
            { label: '18-34', percentage: 22 },
            { label: '35-49', percentage: 31 },
            { label: '50-64', percentage: 28 },
            { label: '65+', percentage: 19 }
          ]
        },
        {
          category: 'Ethnicity',
          values: [
            { label: 'White', percentage: 68 },
            { label: 'Black', percentage: 8 },
            { label: 'Hispanic', percentage: 15 },
            { label: 'Asian', percentage: 7 },
            { label: 'Other', percentage: 2 }
          ]
        }
      ]
    },
    baltimore: {
      name: 'Baltimore',
      donorCount: 767,
      transplantCount: 1145,
      waitlistCount: 3876,
      successRate: 90.8,
      stateCode: 'MD',
      modelResults: [
        {
          date: '2023-05-10',
          modelName: 'Random Forest Classifier',
          accuracy: 0.87,
          precision: 0.85,
          recall: 0.89,
          f1Score: 0.87,
          auc: 0.90,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.21 },
            { name: 'Cold Ischemia Time', importance: 0.19 },
            { name: 'HLA Matching', importance: 0.16 },
            { name: 'Recipient Health Score', importance: 0.13 },
            { name: 'Distance', importance: 0.10 }
          ]
        },
        {
          date: '2023-09-05',
          modelName: 'Neural Network',
          accuracy: 0.90,
          precision: 0.88,
          recall: 0.91,
          f1Score: 0.89,
          auc: 0.92,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.20 },
            { name: 'Cold Ischemia Time', importance: 0.18 },
            { name: 'HLA Matching', importance: 0.17 },
            { name: 'Recipient Health Score', importance: 0.15 },
            { name: 'Distance', importance: 0.09 }
          ]
        }
      ],
      demographics: [
        {
          category: 'Age Groups',
          values: [
            { label: '18-34', percentage: 20 },
            { label: '35-49', percentage: 29 },
            { label: '50-64', percentage: 32 },
            { label: '65+', percentage: 19 }
          ]
        },
        {
          category: 'Ethnicity',
          values: [
            { label: 'White', percentage: 42 },
            { label: 'Black', percentage: 44 },
            { label: 'Hispanic', percentage: 8 },
            { label: 'Asian', percentage: 4 },
            { label: 'Other', percentage: 2 }
          ]
        }
      ]
    },
    losAngeles: {
      name: 'Los Angeles',
      donorCount: 1103,
      transplantCount: 1789,
      waitlistCount: 6532,
      successRate: 91.5,
      stateCode: 'CA',
      modelResults: [
        {
          date: '2023-04-20',
          modelName: 'XGBoost Classifier',
          accuracy: 0.88,
          precision: 0.86,
          recall: 0.90,
          f1Score: 0.88,
          auc: 0.91,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.23 },
            { name: 'Cold Ischemia Time', importance: 0.17 },
            { name: 'HLA Matching', importance: 0.16 },
            { name: 'Recipient Health Score', importance: 0.14 },
            { name: 'Distance', importance: 0.08 }
          ]
        },
        {
          date: '2023-10-12',
          modelName: 'Gradient Boosting',
          accuracy: 0.92,
          precision: 0.90,
          recall: 0.93,
          f1Score: 0.91,
          auc: 0.95,
          keyFeatures: [
            { name: 'Donor Age', importance: 0.21 },
            { name: 'Cold Ischemia Time', importance: 0.19 },
            { name: 'HLA Matching', importance: 0.18 },
            { name: 'Recipient Health Score', importance: 0.15 },
            { name: 'Distance', importance: 0.07 }
          ]
        }
      ],
      demographics: [
        {
          category: 'Age Groups',
          values: [
            { label: '18-34', percentage: 26 },
            { label: '35-49', percentage: 32 },
            { label: '50-64', percentage: 25 },
            { label: '65+', percentage: 17 }
          ]
        },
        {
          category: 'Ethnicity',
          values: [
            { label: 'White', percentage: 28 },
            { label: 'Hispanic', percentage: 48 },
            { label: 'Asian', percentage: 14 },
            { label: 'Black', percentage: 8 },
            { label: 'Other', percentage: 2 }
          ]
        }
      ]
    }
  };
  
  const currentRegion = regionData[activeRegion];
  
  // Render demographic bar chart
  const renderDemographicChart = (category: string) => {
    const demographicData = currentRegion.demographics.find((d) => d.category === category);

    if (!demographicData) return null;
    
    return (
      <div className="demographic-chart">
        <h3>{category}</h3>
        <div className="chart-bars">
          {demographicData.values.map((item, index) => (
            <div className="chart-bar-item" key={index}>
              <div className="chart-bar-label">{item.label}</div>
              <div className="chart-bar-container">
                <div
                  className="chart-bar"
                  style={{ width: `${item.percentage}%` }}
                >
                  <span className="chart-bar-value">{item.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>
    );
  };
  
  // Render model results
  const renderModelResults = () => {
    return (
      <div className="model-results">
        <div className="model-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-user"></i>
            </div>
            <div className="stat-info">
              <h3>Donors</h3>
              <div className="stat-value">{currentRegion.donorCount.toLocaleString()}</div>
              <div className="stat-label">Annual donors</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-heartbeat"></i>
            </div>
            <div className="stat-info">
              <h3>Transplants</h3>
              <div className="stat-value">{currentRegion.transplantCount.toLocaleString()}</div>
              <div className="stat-label">Annual procedures</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-hourglass-half"></i>
            </div>
            <div className="stat-info">
              <h3>Waitlist</h3>
              <div className="stat-value">{currentRegion.waitlistCount.toLocaleString()}</div>
              <div className="stat-label">Current patients</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-info">
              <h3>Success Rate</h3>
              <div className="stat-value">{currentRegion.successRate}%</div>
              <div className="stat-label">1-year survival</div>
            </div>
          </div>
        </div>

        <h3 className="section-title">Saved Model Results</h3>

        {currentRegion.modelResults.map((model, index) => (
          <div className="model-result-card" key={index}>
            <div className="model-header">
              <div className="model-name">{model.modelName}</div>
              <div className="model-date">Run on: {model.date}</div>
            </div>

            <div className="model-metrics">
              <div className="metric">
                <div className="metric-label">Accuracy</div>
                <div className="metric-value">{(model.accuracy * 100).toFixed(1)}%</div>
              </div>
              <div className="metric">
                <div className="metric-label">Precision</div>
                <div className="metric-value">{(model.precision * 100).toFixed(1)}%</div>
              </div>
              <div className="metric">
                <div className="metric-label">Recall</div>
                <div className="metric-value">{(model.recall * 100).toFixed(1)}%</div>
              </div>
              <div className="metric">
                <div className="metric-label">F1 Score</div>
                <div className="metric-value">{(model.f1Score * 100).toFixed(1)}%</div>
              </div>
              <div className="metric">
                <div className="metric-label">AUC</div>
                <div className="metric-value">{(model.auc * 100).toFixed(1)}%</div>
              </div>
            </div>

            <div className="feature-importance">
              <h4>Key Features</h4>
              <div className="feature-bars">
                {model.keyFeatures.map((feature, idx) => (
                  <div className="feature-bar-item" key={idx}>
                    <div className="feature-bar-label">{feature.name}</div>
                    <div className="feature-bar-container">
                      <div
                        className="feature-bar"
                        style={{ width: `${feature.importance * 200}%` }} // Multiply importance by 200 to get a percentage width
                      >
                        <span className="feature-bar-value">{(feature.importance * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render content based on active tab
  const renderTabContent = () => {
    if (mapView) {
      const regions = [
        { name: 'boston', position: [42.3601, -71.0589], label: 'Boston' },
        { name: 'baltimore', position: [39.2904, -76.6122], label: 'Baltimore' },
        { name: 'losAngeles', position: [34.0522, -118.2437], label: 'Los Angeles' }
      ];
      
      return (
        <div className="map-container">
          <h3 className="section-title">U.S. Regional Analysis</h3>
          <p className="map-instructions">Click on a marker to view regional data</p>
          <div className="pigeon-map-wrapper" style={{ height: '500px', borderRadius: '8px', overflow: 'hidden' }}>
            <Map
              defaultCenter={[39.8283, -98.5795]}
              defaultZoom={4}
              width={window.innerWidth > 800 ? 800 : window.innerWidth - 50}
              height={500}
              metaWheelZoom={true}
              twoFingerDrag={false}
              animate={true}
            >
              {regions.map((region) => (
                <Marker
                  key={region.name}
                  width={50}
                  anchor={region.position as [number, number]}
                  onClick={() => setActiveRegion(region.name)}
                  color={activeRegion === region.name ? '#3498db' : '#95a5a6'}
                />
              ))}
            </Map>
          </div>
          <div className="map-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#3498db' }}></div>
              <div className="legend-label">Selected Region</div>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#95a5a6' }}></div>
              <div className="legend-label">Available Region</div>
            </div>
          </div>
          <div className="region-labels">
            {regions.map(region => (
              <div key={region.name} className="region-label">
                {region.label}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'modelResults':
        return renderModelResults();

      case 'demographics':
        return (
          <div className="demographics-content">
            {renderDemographicChart('Age Groups')}
            {renderDemographicChart('Ethnicity')}
          </div>
        );

      default:
        return <div>Select a tab to view data</div>;
    }
  };
  
  return (
    <div className="regional-analysis-container">
      <div className="regional-header">
        <h1>Regional Transplant Analysis</h1>
        <p className="regional-subtitle">Comprehensive data analysis across transplant regions</p>
      </div>

      {/* Map toggle */}
      <div className="map-toggle">
        <button
          className={mapView ? 'active' : ''}
          onClick={() => setMapView(!mapView)}
        >
          <i className={`fas fa-${mapView ? 'chart-bar' : 'map-marked-alt'}`}></i>
          {mapView ? 'Show Data View' : 'Show Map View'}
        </button>
      </div>

      {!mapView && (
        <>
          {/* Region selector */}
          <div className="region-selector">
            <button
              className={activeRegion === 'boston' ? 'active' : ''}
              onClick={() => setActiveRegion('boston')}
            >
              Boston
            </button>
            <button
              className={activeRegion === 'baltimore' ? 'active' : ''}
              onClick={() => setActiveRegion('baltimore')}
            >
              Baltimore
            </button>
            <button
              className={activeRegion === 'losAngeles' ? 'active' : ''}
              onClick={() => setActiveRegion('losAngeles')}
            >
              Los Angeles
            </button>
          </div>

          {/* Region title */}
          <div className="region-title">
            <h2>{currentRegion.name} Region</h2>
          </div>

          {/* Content tabs */}
          <div className="content-tabs">
            <button
              className={activeTab === 'modelResults' ? 'active' : ''}
              onClick={() => setActiveTab('modelResults')}
            >
              Model Results
            </button>
            <button
              className={activeTab === 'demographics' ? 'active' : ''}
              onClick={() => setActiveTab('demographics')}
            >
              Demographics
            </button>
          </div>
        </>
      )}

      {/* Tab content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>

      {/* Data source info */}
      <div className="data-source">
        <p>Data source: OPO Insights Database, updated quarterly. Last update: Q4 2023</p>
      </div>
    </div>
  );
};

export default RegionalAnalysis;
