import React, { useState, useEffect } from 'react';
import './Trends.css';

// Import Boston SHAP plot images
import bostonImage1 from '../assets/SHAP Plots/Boston_area/Baseline/image1.png';
import bostonImage2 from '../assets/SHAP Plots/Boston_area/Baseline/image2.png';
import bostonImage3 from '../assets/SHAP Plots/Boston_area/Baseline/image3.png';
import bostonImage4 from '../assets/SHAP Plots/Boston_area/Baseline/image4.png';

// Import Baltimore SHAP plot images
import baltimoreImage1 from '../assets/SHAP Plots/Baltimore_area/Baseline/image1.png';
import baltimoreImage2 from '../assets/SHAP Plots/Baltimore_area/Baseline/image2.png';
import baltimoreImage3 from '../assets/SHAP Plots/Baltimore_area/Baseline/image3.png';
import baltimoreImage4 from '../assets/SHAP Plots/Baltimore_area/Baseline/image4.png';

// Import LA SHAP plot images
import laImage1 from '../assets/SHAP Plots/LA_area/Baseline/image1.png';
import laImage2 from '../assets/SHAP Plots/LA_area/Baseline/image2.png';
import laImage3 from '../assets/SHAP Plots/LA_area/Baseline/image3.png';
import laImage4 from '../assets/SHAP Plots/LA_area/Baseline/image4.png';

const Trends = () => {
  const [activeCity, setActiveCity] = useState('boston');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // City data with SHAP plot images and descriptions
  const cityData = {
    boston: {
      name: 'Boston',
      images: [
        {
          url: bostonImage1,
          title: 'Boston SHAP Analysis - Key Features',
          description: 'This SHAP plot highlights the most influential features affecting organ donation outcomes in the Boston area. Positive values (red) indicate features that increase donation likelihood.'
        },
        {
          url: bostonImage2,
          title: 'Boston Feature Importance',
          description: 'Ranking of feature importance for the Boston area model. Higher bars indicate features with greater impact on model predictions.'
        },
        {
          url: bostonImage3,
          title: 'Boston Correlation Analysis',
          description: 'Correlation between key features in the Boston dataset, showing relationships between donor demographics and successful transplant outcomes.'
        },
        {
          url: bostonImage4,
          title: 'Boston Prediction Distribution',
          description: 'Distribution of model predictions for the Boston area, showing the spread of probability scores across the dataset.'
        }
      ]
    },
    baltimore: {
      name: 'Baltimore',
      images: [
        {
          url: baltimoreImage1,
          title: 'Baltimore SHAP Analysis - Key Features',
          description: 'This SHAP plot highlights the most influential features affecting organ donation outcomes in the Baltimore area. Positive values (red) indicate features that increase donation likelihood.'
        },
        {
          url: baltimoreImage2,
          title: 'Baltimore Feature Importance',
          description: 'Ranking of feature importance for the Baltimore area model. Higher bars indicate features with greater impact on model predictions.'
        },
        {
          url: baltimoreImage3,
          title: 'Baltimore Correlation Analysis',
          description: 'Correlation between key features in the Baltimore dataset, showing relationships between donor demographics and successful transplant outcomes.'
        },
        {
          url: baltimoreImage4,
          title: 'Baltimore Prediction Distribution',
          description: 'Distribution of model predictions for the Baltimore area, showing the spread of probability scores across the dataset.'
        }
      ]
    },
    losAngeles: {
      name: 'Los Angeles',
      images: [
        {
          url: laImage1,
          title: 'Los Angeles SHAP Analysis - Key Features',
          description: 'This SHAP plot highlights the most influential features affecting organ donation outcomes in the Los Angeles area. Positive values (red) indicate features that increase donation likelihood.'
        },
        {
          url: laImage2,
          title: 'Los Angeles Feature Importance',
          description: 'Ranking of feature importance for the Los Angeles area model. Higher bars indicate features with greater impact on model predictions.'
        },
        {
          url: laImage3,
          title: 'Los Angeles Correlation Analysis',
          description: 'Correlation between key features in the Los Angeles dataset, showing relationships between donor demographics and successful transplant outcomes.'
        },
        {
          url: laImage4,
          title: 'Los Angeles Prediction Distribution',
          description: 'Distribution of model predictions for the Los Angeles area, showing the spread of probability scores across the dataset.'
        }
      ]
    }
  };

  // Handle smooth transitions between images
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentImageIndex, activeCity]);

  // Navigate to previous image
  const prevImage = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrentImageIndex((prevIndex) => 
        prevIndex === 0 ? cityData[activeCity].images.length - 1 : prevIndex - 1
      );
    }
  };

  // Navigate to next image
  const nextImage = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrentImageIndex((prevIndex) => 
        prevIndex === cityData[activeCity].images.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  // Change city tab
  const changeCity = (city) => {
    if (activeCity !== city) {
      setActiveCity(city);
      setCurrentImageIndex(0);
    }
  };

  // Get current city's images
  const currentCityImages = cityData[activeCity].images;
  const currentImage = currentCityImages[currentImageIndex];

  return (
    <div className="trends-container">
      <div className="trends-header">
        <h1 className="trends-title">Regional SHAP Analysis</h1>
        <p className="trends-subtitle">Exploring feature importance in organ donation models across major metropolitan areas</p>
      </div>
      
      {/* City tabs */}
      <div className="city-tabs-container">
        <div className="city-tabs">
          <button 
            className={`city-tab ${activeCity === 'boston' ? 'active' : ''}`}
            onClick={() => changeCity('boston')}
          >
            <i className="fas fa-city"></i>
            <span>Boston</span>
          </button>
          <button 
            className={`city-tab ${activeCity === 'baltimore' ? 'active' : ''}`}
            onClick={() => changeCity('baltimore')}
          >
            <i className="fas fa-city"></i>
            <span>Baltimore</span>
          </button>
          <button 
            className={`city-tab ${activeCity === 'losAngeles' ? 'active' : ''}`}
            onClick={() => changeCity('losAngeles')}
          >
            <i className="fas fa-city"></i>
            <span>Los Angeles</span>
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="trends-content">
        {/* Image showcase */}
        <div className="image-showcase">
          <div className={`image-container ${isTransitioning ? 'transitioning' : ''}`}>
            <img 
              src={currentImage.url} 
              alt={`${cityData[activeCity].name} - ${currentImage.title}`} 
            />
            <div className="image-overlay">
              <div className="image-counter">
                {currentImageIndex + 1} / {currentCityImages.length}
              </div>
            </div>
          </div>
          
          {/* Navigation arrows */}
          <button className="nav-arrow prev" onClick={prevImage} aria-label="Previous image">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button className="nav-arrow next" onClick={nextImage} aria-label="Next image">
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        
        {/* Image info */}
        <div className="image-info">
          <h2 className="image-title">{currentImage.title}</h2>
          <p className="image-description">{currentImage.description}</p>
          
          {/* Image indicators */}
          <div className="image-indicators">
            {currentCityImages.map((_, index) => (
              <button 
                key={index} 
                className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                onClick={() => setCurrentImageIndex(index)}
                aria-label={`View image ${index + 1}`}
              ></button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Thumbnail gallery */}
      <div className="thumbnail-gallery">
        {currentCityImages.map((image, index) => (
          <div 
            key={index} 
            className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
            onClick={() => setCurrentImageIndex(index)}
          >
            <img 
              src={image.url} 
              alt={`${cityData[activeCity].name} - ${image.title}`} 
            />
            <div className="thumbnail-overlay">
              <span className="thumbnail-title">{image.title}</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Data source info */}
      <div className="data-source">
        <p>Data source: OPO Insights SHAP Analysis, Baseline Models. Last update: Q2 2023</p>
      </div>
    </div>
  );
};

export default Trends; 