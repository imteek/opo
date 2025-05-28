/**
 * UmapVisualization Component
 * 
 * A React component that generates a UMAP (Uniform Manifold Approximation and Projection) 
 * visualization for kidney transplant data. UMAP is a dimensionality reduction technique 
 * that helps visualize high-dimensional data in 2D space, showing similarities between kidneys.
 * 
 * The component takes a target kidney record and reference data, runs the UMAP algorithm,
 * and renders an interactive D3 visualization showing how the target kidney relates to 
 * historical reference kidneys from the same region.
 */
import React, { useEffect, useRef, useState } from 'react';
import { UMAP } from 'umap-js'; // UMAP implementation for JavaScript
import * as d3 from 'd3'; // D3 visualization library

/**
 * @param {Object} targetRecord - The kidney record being analyzed
 * @param {Array} similarKidneys - Array of kidneys identified as similar to the target
 * @param {String} selectedModel - The prediction model currently being used (contains city info)
 */
const UmapVisualization = ({ targetRecord, similarKidneys, selectedModel }) => {
  // Reference to the SVG element for D3 visualization
  const svgRef = useRef(null);
  // Loading state for visualization generation
  const [isLoading, setIsLoading] = useState(true);
  // Error state for handling visualization failures
  const [error, setError] = useState(null);
  // Size of points in the visualization (adjustable by user)
  const [circleRadius, setCircleRadius] = useState(5); // Default radius
  // Toggle to filter visualization to show only accepted kidneys
  const [showOnlyAccepted, setShowOnlyAccepted] = useState(false);
  
  /**
   * Extracts city name from the model name for region-specific reference data
   * 
   * @param {string} modelName - The name of the prediction model
   * @returns {string} - The city/region name (Boston, LA, Baltimore)
   */
  const getCityFromModel = (modelName) => {
    if (modelName.includes('Boston')) return 'Boston';
    if (modelName.includes('LA')) return 'LA';
    if (modelName.includes('Baltimore')) return 'Baltimore';
    return 'Unknown';
  };
  
  /**
   * Effect hook to initialize global reference data if not already available
   * Checks for cityReferenceData in the window object and tries to load from localStorage
   * This data is used as the reference dataset for UMAP projections
   */
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
  
  /**
   * Main effect hook to generate the UMAP visualization
   * Runs when the targetRecord, selectedModel, or similarKidneys change
   * Handles data preparation, UMAP algorithm execution, and rendering
   */
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
    
    /**
     * Asynchronous function to generate the UMAP visualization
     * Handles data preparation, dimensionality reduction, and rendering
     */
    const generateUmap = async () => {
      try {
        setIsLoading(true);
        
        // Use the target kidney and ALL reference kidneys for this city
        const allRecords = [targetRecord, ...cityReferenceData];
        
        console.log(`Generating UMAP with ${allRecords.length} records (1 target + ${cityReferenceData.length} reference)`);
        
        if (allRecords.length < 4) {
          throw new Error(`Not enough data points (${allRecords.length}). Need at least 4.`);
        }
        
        // Extract numerical features that can be used for UMAP calculation
        const numericalFeatures = Object.keys(targetRecord).filter(key => {
          const value = targetRecord[key];
          return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        });
        
        // Filter out non-informative features that would skew the visualization
        const filteredFeatures = numericalFeatures.filter(feature => 
          feature !== 'PTR_SEQUENCE_NUM' && 
          feature !== 'OFFER_ACCEPT' &&
          feature !== 'KDRI_MED' && 
          feature !== 'KDRI_RAO'
        );
        
        console.log('Using features for UMAP:', filteredFeatures.slice(0, 10), '...');
        
        // Create feature matrix - each row is a kidney, each column is a feature
        const featureMatrix = allRecords.map(record => {
          return filteredFeatures.map(feature => {
            const value = record[feature];
            if (value === undefined || value === null) return 0;
            return typeof value === 'number' ? value : parseFloat(value) || 0;
          });
        });
        
        // Standardize the data to ensure all features have similar influence
        const standardizedData = standardizeData(featureMatrix);
        
        // Run UMAP with adjusted parameters for the dataset
        const umap = new UMAP({
          nComponents: 2,
          nNeighbors: Math.min(15, Math.floor(allRecords.length / 10)), // Adjust neighborhood based on data size
          minDist: 0.1,
          spread: 1.0,
          random: Math.random
        });
        
        // Generate the 2D embedding
        const embedding = umap.fit(standardizedData);
        
        // Render the visualization using D3
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
  
  /**
   * Standardizes feature data using z-score normalization
   * Ensures all features have mean 0 and standard deviation 1,
   * which is important for distance-based algorithms like UMAP
   * 
   * @param {Array} data - 2D array of feature values (rows=kidneys, columns=features)
   * @returns {Array} - Standardized 2D array with the same shape
   */
  const standardizeData = (data) => {
    const numFeatures = data[0].length;
    const numSamples = data.length;
    
    // Calculate mean and std for each feature
    const means = Array(numFeatures).fill(0);
    const stds = Array(numFeatures).fill(0);
    
    // Calculate means for each feature
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        means[j] += data[i][j] / numSamples;
      }
    }
    
    // Calculate standard deviations for each feature
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        stds[j] += Math.pow(data[i][j] - means[j], 2) / numSamples;
      }
    }
    
    for (let j = 0; j < numFeatures; j++) {
      stds[j] = Math.sqrt(stds[j]);
      // Prevent division by zero for constant features
      if (stds[j] === 0) stds[j] = 1;
    }
    
    // Apply z-score normalization: (value - mean) / std
    const standardized = data.map(sample => {
      return sample.map((value, j) => (value - means[j]) / stds[j]);
    });
    
    return standardized;
  };
  
  /**
   * Renders the UMAP visualization using D3.js
   * Creates an interactive scatterplot showing kidney positions in 2D space
   * 
   * @param {Array} embedding - 2D array with UMAP coordinates for each kidney
   * @param {Array} records - Array of kidney records corresponding to the embedding points
   */
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
    
    // Create scales based on filtered data with padding
    const xExtent = d3.extent(filteredEmbedding, d => d[0]);
    const yExtent = d3.extent(filteredEmbedding, d => d[1]);
    
    // Create x-axis scale
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 1, xExtent[1] + 1]) // Add padding
      .range([margin.left, width - margin.right]);
    
    // Create y-axis scale
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 1, yExtent[1] + 1]) // Add padding
      .range([height - margin.bottom, margin.top]);
    
    // Add x-axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));
    
    // Add y-axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));
    
    // Add x-axis label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .style('text-anchor', 'middle')
      .text('UMAP Dimension 1');
    
    // Add y-axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .style('text-anchor', 'middle')
      .text('UMAP Dimension 2');
    
    // Add title with filter status and kidney count
    const cityName = getCityFromModel(selectedModel);
    const filterText = showOnlyAccepted ? ' (Accepted Only)' : '';
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top / 2)
      .style('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`UMAP Projection - ${cityName} Region${filterText} (${filteredRecords.length} kidneys)`);
    
    // Create a set of similar kidney indices for highlighting
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
    
    // Draw kidney points with dynamic sizing and coloring
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
    
    // Plot the target kidney (index 0) on top with distinct styling
    svg.append('circle')
      .attr('class', 'target')
      .attr('cx', xScale(filteredEmbedding[0][0]))
      .attr('cy', yScale(filteredEmbedding[0][1]))
      .attr('r', circleRadius + 2)
      .attr('fill', '#1976D2') // Blue for target kidney
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5)
      .append('title')
      .text('Target Kidney');
    
    // Add legend to explain the visualization colors
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right - 120}, ${margin.top + 10})`);
    
    // Target kidney legend item
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
    
    // Accepted kidney legend item
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
      // Rejected kidney legend item
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
    
    // Similar kidney legend item (if any similar kidneys exist)
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
  
  /**
   * Handles changes to the circle radius slider
   * Updates point sizes in the visualization
   * 
   * @param {Event} event - The slider change event
   */
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
  
  /**
   * Toggles the filter to show only accepted kidneys or all kidneys
   * Triggers re-rendering of the visualization with the new filter
   */
  const toggleAcceptedFilter = () => {
    setShowOnlyAccepted(!showOnlyAccepted);
  };
  
  return (
    <div className="umap-container">
      <h3>UMAP Visualization</h3>
      
      {/* Loading state indicator */}
      {isLoading && (
        <div className="loading-umap">
          <p>Generating UMAP visualization...</p>
        </div>
      )}
      
      {/* Error message display */}
      {error && (
        <div className="umap-error">
          <p>{error}</p>
        </div>
      )}
      
      {/* UMAP visualization with controls */}
      {!isLoading && !error && (
        <div className="umap-svg-container">
          {/* SVG element where D3 will render the visualization */}
          <svg ref={svgRef} className="umap-svg"></svg>
          
          {/* Visualization controls */}
          <div className="umap-controls">
            {/* Toggle button to filter accepted/rejected kidneys */}
            <button 
              className={`filter-button ${showOnlyAccepted ? 'active' : ''}`}
              onClick={toggleAcceptedFilter}
            >
              {showOnlyAccepted ? 'Show All Kidneys' : 'Show Only Accepted'}
            </button>
            
            {/* Slider to control point size */}
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
          
          {/* Explanatory text for the visualization */}
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