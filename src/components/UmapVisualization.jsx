import React, { useEffect, useRef, useState } from 'react';
import { UMAP } from 'umap-js';
import * as d3 from 'd3';

const UmapVisualization = ({ targetRecord, similarKidneys, selectedModel }) => {
  const svgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [circleRadius, setCircleRadius] = useState(5); // Default radius
  const [showOnlyAccepted, setShowOnlyAccepted] = useState(false);
  
  // Extract city from model name for display purposes only
  const getCityFromModel = (modelName) => {
    if (modelName.includes('Boston')) return 'Boston';
    if (modelName.includes('LA')) return 'LA';
    if (modelName.includes('Baltimore')) return 'Baltimore';
    return 'Unknown';
  };
  
  // At the beginning of your component, ensure cityReferenceData is available
  useEffect(() => {
    // Initialize global reference data if it doesn't exist
    if (!window.cityReferenceData) {
      console.log("City reference data not found in window object, initializing...");
      
      // If you have the reference data elsewhere, initialize it here
      // For example, from localStorage, context, or a redux store
      
      // Option 1: Try to get it from localStorage
      try {
        const storedData = localStorage.getItem('cityReferenceData');
        if (storedData) {
          window.cityReferenceData = JSON.parse(storedData);
          console.log("Loaded city reference data from localStorage");
        }
      } catch (e) {
        console.error("Failed to load from localStorage:", e);
      }
      
      // Option 2: If you have a way to fetch it from the server
      // fetchCityReferenceData().then(data => {
      //   window.cityReferenceData = data;
      //   console.log("Loaded city reference data from server");
      // });
    }
  }, []);
  
  // Generate UMAP with all city reference data
  useEffect(() => {
    // Add a check to prevent regenerating if already processed
    const umapGenerationKey = `${selectedModel}-${targetRecord?.id || 'unknown'}`;
    
    // Use this key to prevent regenerating the same UMAP multiple times
    if (window.lastUmapGenerationKey === umapGenerationKey) {
      console.log('Skipping duplicate UMAP generation');
      return;
    }
    
    window.lastUmapGenerationKey = umapGenerationKey;
    
    if (!targetRecord) {
      setError('No target kidney data available');
      setIsLoading(false);
      return;
    }
    
    // Get the city for this model
    const city = getCityFromModel(selectedModel);
    console.log(`Generating UMAP for city: ${city}`);
    
    // Access reference data directly from the global object
    // Adding more detailed logging to debug
    console.log("Looking for reference data in:", window.cityReferenceData);
    const cityReferenceData = window.cityReferenceData?.[city] || [];
    console.log(`Found ${cityReferenceData.length} reference records for ${city}`);
    
    if (!cityReferenceData || cityReferenceData.length === 0) {
      setError(`No reference data available for ${city}`);
      setIsLoading(false);
      return;
    }
    
    const generateUmap = async () => {
      try {
        setIsLoading(true);
        
        // Use the target kidney and ALL reference kidneys for this city
        const allRecords = [targetRecord, ...cityReferenceData];
        
        console.log(`Generating UMAP with ${allRecords.length} records (1 target + ${cityReferenceData.length} reference)`);
        
        if (allRecords.length < 4) {
          throw new Error(`Not enough data points (${allRecords.length}). Need at least 4.`);
        }
        
        // Extract numerical features
        const numericalFeatures = Object.keys(targetRecord).filter(key => {
          const value = targetRecord[key];
          return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        });
        
        // Filter out non-informative features
        const filteredFeatures = numericalFeatures.filter(feature => 
          feature !== 'PTR_SEQUENCE_NUM' && 
          feature !== 'OFFER_ACCEPT' &&
          feature !== 'KDRI_MED' && 
          feature !== 'KDRI_RAO'
        );
        
        console.log('Using features for UMAP:', filteredFeatures.slice(0, 10), '...');
        
        // Create feature matrix
        const featureMatrix = allRecords.map(record => {
          return filteredFeatures.map(feature => {
            const value = record[feature];
            if (value === undefined || value === null) return 0;
            return typeof value === 'number' ? value : parseFloat(value) || 0;
          });
        });
        
        // Standardize the data
        const standardizedData = standardizeData(featureMatrix);
        
        // Run UMAP with adjusted parameters for the dataset
        const umap = new UMAP({
          nComponents: 2,
          nNeighbors: Math.min(15, Math.floor(allRecords.length / 10)), // Adjust neighborhood based on data size
          minDist: 0.1,
          spread: 1.0,
          random: Math.random
        });
        
        const embedding = umap.fit(standardizedData);
        
        // Render the visualization
        renderVisualization(embedding, allRecords);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error generating UMAP:', err);
        setError(`Failed to generate UMAP: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    generateUmap();
  }, [targetRecord, selectedModel, similarKidneys.length]); // Only re-run when these change
  
  // Function to standardize data (z-score normalization)
  const standardizeData = (data) => {
    const numFeatures = data[0].length;
    const numSamples = data.length;
    
    // Calculate mean and std for each feature
    const means = Array(numFeatures).fill(0);
    const stds = Array(numFeatures).fill(0);
    
    // Calculate means
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        means[j] += data[i][j] / numSamples;
      }
    }
    
    // Calculate standard deviations
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        stds[j] += Math.pow(data[i][j] - means[j], 2) / numSamples;
      }
    }
    
    for (let j = 0; j < numFeatures; j++) {
      stds[j] = Math.sqrt(stds[j]);
      // Prevent division by zero
      if (stds[j] === 0) stds[j] = 1;
    }
    
    // Standardize the data
    const standardized = data.map(sample => {
      return sample.map((value, j) => (value - means[j]) / stds[j]);
    });
    
    return standardized;
  };
  
  // Function to render the visualization using D3
  const renderVisualization = (embedding, records) => {
    if (!svgRef.current) return;
    
    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    
    const width = 600;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // Filter records based on showOnlyAccepted
    const filteredEmbedding = [];
    const filteredRecords = [];
    
    // Always include the target kidney (index 0)
    filteredEmbedding.push(embedding[0]);
    filteredRecords.push(records[0]);
    
    // Filter the rest based on acceptance status
    for (let i = 1; i < records.length; i++) {
      const accepted = records[i].OFFER_ACCEPT === '1' || records[i].OFFER_ACCEPT === 1;
      if (!showOnlyAccepted || accepted) {
        filteredEmbedding.push(embedding[i]);
        filteredRecords.push(records[i]);
      }
    }
    
    // Create scales based on filtered data
    const xExtent = d3.extent(filteredEmbedding, d => d[0]);
    const yExtent = d3.extent(filteredEmbedding, d => d[1]);
    
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 1, xExtent[1] + 1])
      .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 1, yExtent[1] + 1])
      .range([height - margin.bottom, margin.top]);
    
    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));
    
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));
    
    // Add axis labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .style('text-anchor', 'middle')
      .text('UMAP Dimension 1');
    
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .style('text-anchor', 'middle')
      .text('UMAP Dimension 2');
    
    // Add title with filter status
    const cityName = getCityFromModel(selectedModel);
    const filterText = showOnlyAccepted ? ' (Accepted Only)' : '';
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top / 2)
      .style('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`UMAP Projection - ${cityName} Region${filterText} (${filteredRecords.length} kidneys)`);
    
    // Find similar kidneys in the reference data
    const similarKidneyIndices = new Set();
    if (similarKidneys && similarKidneys.length > 0) {
      // Create a lookup for PTR_SEQUENCE_NUM or other unique identifiers
      similarKidneys.forEach(similar => {
        // Try to find the corresponding index in the full dataset
        const index = filteredRecords.findIndex((record, idx) => 
          idx > 0 && // Skip the target record (index 0)
          record.PTR_SEQUENCE_NUM === similar.record?.PTR_SEQUENCE_NUM
        );
        if (index > 0) similarKidneyIndices.add(index);
      });
    }
    
    // Use circleRadius state instead of hardcoded values
    const circles = svg.selectAll('circle')
      .data(filteredEmbedding)
      .enter()
      .append('circle')
      .attr('cx', (d, i) => xScale(d[0]))
      .attr('cy', (d, i) => yScale(d[1]))
      .attr('r', (d, i) => {
        if (i === 0) return circleRadius + 2; // Target kidney (slightly larger)
        
        // For similar kidneys, use the state value
        const isSimilar = similarKidneyIndices.has(i);
        return isSimilar ? circleRadius : circleRadius - 1;
      })
      .attr('fill', (d, i) => {
        const accepted = filteredRecords[i].OFFER_ACCEPT === '1' || filteredRecords[i].OFFER_ACCEPT === 1;
        return accepted ? '#4CAF50' : '#F44336'; // Green for accepted, red for rejected
      })
      .attr('opacity', (d, i) => {
        // ... existing opacity logic ...
      });
    
    // Plot the target kidney (index 0) on top
    svg.append('circle')
      .attr('class', 'target')
      .attr('cx', xScale(filteredEmbedding[0][0]))
      .attr('cy', yScale(filteredEmbedding[0][1]))
      .attr('r', circleRadius + 2)
      .attr('fill', '#1976D2')
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5)
      .append('title')
      .text('Target Kidney');
    
    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right - 120}, ${margin.top + 10})`);
    
    // Target kidney
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', 10)
      .attr('r', 6)
      .attr('fill', '#1976D2')
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', 15)
      .text('Target Kidney');
    
    // Accepted kidney
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', 35)
      .attr('r', 5)
      .attr('fill', '#4CAF50');
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', 40)
      .text('Accepted');
    
    // Only show rejected in legend if not filtered
    if (!showOnlyAccepted) {
      // Rejected kidney
      legend.append('circle')
        .attr('cx', 10)
        .attr('cy', 60)
        .attr('r', 5)
        .attr('fill', '#F44336');
      
      legend.append('text')
        .attr('x', 25)
        .attr('y', 65)
        .text('Rejected');
    }
    
    // Similar kidney (optional)
    if (similarKidneyIndices.size > 0) {
      const yOffset = showOnlyAccepted ? 60 : 85;
      legend.append('circle')
        .attr('cx', 10)
        .attr('cy', yOffset)
        .attr('r', 4)
        .attr('fill', '#888')
        .attr('opacity', 0.8);
      
      legend.append('text')
        .attr('x', 25)
        .attr('y', yOffset + 5)
        .text('Similar to Target');
    }
  };
  
  // Function to handle slider changes
  const handleRadiusChange = (event) => {
    const newRadius = parseInt(event.target.value);
    setCircleRadius(newRadius);
    
    // If UMAP is already rendered, update circle sizes
    if (!isLoading && svgRef.current) {
      d3.select(svgRef.current).selectAll('circle')
        .attr('r', (d, i) => {
          if (i === 0) return newRadius + 2; // Target kidney
          
          const isSimilar = similarKidneyIndices.has(i);
          return isSimilar ? newRadius : newRadius - 1;
        });
    }
  };
  
  // Add this function to toggle the filter
  const toggleAcceptedFilter = () => {
    setShowOnlyAccepted(!showOnlyAccepted);
  };
  
  return (
    <div className="umap-container">
      <h3>UMAP Visualization</h3>
      
      {isLoading && (
        <div className="loading-umap">
          <p>Generating UMAP visualization...</p>
        </div>
      )}
      
      {error && (
        <div className="umap-error">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && !error && (
        <div className="umap-svg-container">
          <svg ref={svgRef} className="umap-svg"></svg>
          
          <div className="umap-controls">
            <button 
              className={`filter-button ${showOnlyAccepted ? 'active' : ''}`}
              onClick={toggleAcceptedFilter}
            >
              {showOnlyAccepted ? 'Show All Kidneys' : 'Show Only Accepted'}
            </button>
            
            <div className="radius-control">
              <label htmlFor="radius-slider">Point Size: </label>
              <input
                id="radius-slider"
                type="range"
                min="2"
                max="10"
                value={circleRadius}
                onChange={handleRadiusChange}
                className="radius-slider"
              />
              <span className="radius-value">{circleRadius}</span>
            </div>
          </div>
          
          <div className="umap-description">
            <p>
              This UMAP visualization shows how the current kidney (blue) relates to all reference kidneys in this region.
              Green points represent accepted kidneys, red points represent rejected kidneys.
              Kidneys that are closer together in this visualization have similar characteristics.
            </p>
            <p>
              Brighter, larger points indicate kidneys that were identified as most similar to your target kidney.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UmapVisualization; 