/**
 * SimilarKidneysModal Component
 * 
 * This component displays a modal with detailed information about kidneys that are similar
 * to a selected kidney. It provides multiple visualizations and comparison tools to help users
 * understand why specific kidneys were accepted or rejected based on similarity metrics.
 * 
 * Features:
 * - Summary view with acceptance statistics
 * - UMAP visualization for dimensional reduction and spatial representation
 * - T-SNE visualization as an alternative dimensionality reduction technique
 * - Interactive filtering and comparison of important features
 * - Detailed tabular comparison of all feature values
 */
import React, { useEffect, useRef, useState } from 'react';
import UmapVisualization from './UmapVisualization';
import './SimilarKidneysModal.css';
import TSNE from 'tsne-js';

/**
 * Important features mapping by city
 * 
 * This object defines the most significant features for each city/region that should be used
 * when calculating similarity between kidneys. Features are ordered by importance.
 * These were likely determined through statistical analysis of historical data.
 */
const importantFeaturesMap = {
  'Baltimore': [
    'PTR_SEQUENCE_NUM', 'CREAT_DON', 'DAYSQAIT_ALLOC', 'time_on_analysis', 'KDPI', 
    'AGE_DON', 'HGT_CM_CALC', 'MICRO_FAT_LI_DON', 'BUN_DON', 'DIURETICS_N', 
    'KIL_BACK_TBL_FLUSH', 'INIT_EPTS', 'DAYSWAIT_CHRON', 'NUM_ORG_DISC', 'END_CPRA', 
    'PO2_DON', 'KIP_REASON_CD', 'time_since_gfr_less_than_20', 'REGION_IDENTICAL', 'LENGTH_LEFT_LUNG'
  ],
  'Boston': [
    'PTR_SEQUENCE_NUM', 'time_on_dialysis', 'DAYSWAIT_ALLOC', 'KDPI', 'PUMP_KI_N', 
    'KIR_FINAL_FLUSH', 'KIR_REASON_CD', 'time_since_gfr_less_than_20', 'DAYSWAIT_CHRON', 
    'LENGTH_LEFT_LUNG', 'AGE_DON', 'PO2_DON', 'CREAT_DON', 'WGT_KG_DON_CALC', 'BMI_DON_CALC', 
    'INIT_EPTS', 'BUN_DON', 'CREAT_TRR', 'PRI_PAYMENT_TRR_KI', 'PH_DON'
  ],
  'LA': [
    'PTR_SEQUENCE_NUM', 'DAYSWAIT_ALLOC', 'time_on_dialysis', 'KDPI', 'KIR_REASON_CD', 
    'CREAT_DON', 'CREAT_TRR', 'C1_0', 'NUM_ORG_DISC', 'LENGTH_LEFT_LUNG', 'SEPTAL_WALL', 
    'CARDARREST_DOWNTM_DURATION', 'BMI_CALC', 'DAYSWAIT_CHRON', 'SHARE_TY_Local', 'PH_DON', 
    'HGT_CM_CALC', 'INIT_EPTS', 'AGE_DON', 'MEETS_DBL_KI_CRITERIA'
  ]
};

/**
 * SimilarKidneysModal component props:
 * 
 * @param {boolean} show - Controls visibility of the modal
 * @param {function} onClose - Callback function to close the modal
 * @param {object} selectedRecord - The kidney record that was selected for comparison
 * @param {string} selectedModel - The model used to generate predictions
 * @param {array} similarKidneys - Array of kidneys similar to the selected record
 * @param {boolean} loadingReference - Indicates if reference data is currently loading
 * @param {string} referenceError - Error message if reference data loading failed
 * @param {object} importantFeatures - Features to prioritize in similarity calculations
 * @param {function} getCityFromModelName - Function to extract city name from model name
 * @param {string} city - The city/region associated with the selected model
 */
const SimilarKidneysModal = ({ 
  show, 
  onClose, 
  selectedRecord, 
  selectedModel, 
  similarKidneys, 
  loadingReference, 
  referenceError,
  importantFeatures,
  getCityFromModelName,
  city
}) => {
  // Reference to the modal container for click-outside detection
  const modalRef = useRef(null);
  
  // State to track which tab is currently active
  const [activeTab, setActiveTab] = useState('summary');
  
  // UMAP visualization states
  const [umapImage, setUmapImage] = useState(null);
  const [isLoadingUmap, setIsLoadingUmap] = useState(false);
  const [umapError, setUmapError] = useState(null);
  
  // Canvas reference for drawing visualizations
  const canvasRef = useRef(null);
  
  // Interaction states for the visualization
  const [hoveredKidney, setHoveredKidney] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [circleRadius, setCircleRadius] = useState(50);
  const [isDraggingRadius, setIsDraggingRadius] = useState(false);
  
  // Statistics for kidneys within the visualization circle
  const [acceptanceStats, setAcceptanceStats] = useState({ accepted: 0, rejected: 0, total: 0, rate: 0 });
  
  // Visualization filter states
  const [maskOutsideCircle, setMaskOutsideCircle] = useState(false);
  const [topKidneysCount, setTopKidneysCount] = useState(10);
  const [showFilterTooltip, setShowFilterTooltip] = useState(false);
  const [showOnlyAccepted, setShowOnlyAccepted] = useState(false);
  const [showNearestRejected, setShowNearestRejected] = useState(false);
  const [tsneData, setTsneData] = useState(null);
  const [isLoadingTsne, setIsLoadingTsne] = useState(false);
  const [tsneError, setTsneError] = useState(null);
  const tsneCacheRef = useRef({});
  // Add a ref to store the worker instance
  const tsneWorkerRef = useRef(null);

  // Function to safely get a value from an object with case-insensitive key matching
  const getValueCaseInsensitive = (obj, key) => {
    if (!obj || typeof obj !== 'object') return null;
    
    // Try direct access first
    if (obj[key] !== undefined) return obj[key];
    
    // Try case-insensitive matching
    const keyLower = key.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === keyLower) {
        return obj[k];
      }
    }
    
    return null;
  };

  // Handle clicking outside the modal to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'auto';
    };
  }, [show, onClose]);

  // Calculate acceptance rate
  const acceptedCount = similarKidneys.filter(k => k.record.OFFER_ACCEPT === '1' || k.record.OFFER_ACCEPT === 1).length;
  const acceptanceRate = similarKidneys.length > 0 ? (acceptedCount / similarKidneys.length) * 100 : 0;

  // Get important features for the current model
  const getImportantFeatures = () => {
    if (!selectedModel || !getCityFromModelName) return [];
    const city = getCityFromModelName(selectedModel);
    return city && importantFeatures[city] ? importantFeatures[city] : [];
  };

  const features = getImportantFeatures();
  console.log("Important features:", features);
  console.log("Selected model:", selectedModel);
  console.log("City:", selectedModel ? getCityFromModelName(selectedModel) : null);

  useEffect(() => {
    // Reset UMAP when modal is opened/closed
    if (!show) {
      setUmapImage(null);
    }
  }, [show]);
  
  // Update the useEffect that handles tab changes and UMAP loading
  useEffect(() => {
    if (activeTab === 'umap' && show && selectedRecord && city) {
      console.log('UMAP tab conditions met:', {
        activeTab,
        show,
        hasSelectedRecord: !!selectedRecord,
        city,
        hasUmapImage: !!umapImage,
        isLoadingUmap
      });
      
      if (!umapImage && !isLoadingUmap) {
        console.log('Triggering UMAP visualization load');
        loadUmapVisualization();
      }
    }
  }, [activeTab, show, selectedRecord, city, umapImage, isLoadingUmap]);
  
  // Add this useEffect to draw the visualization when the tab is active
  useEffect(() => {
    if (show && activeTab === 'umap' && similarKidneys && similarKidneys.length > 0 && canvasRef.current) {
      drawUmapVisualization();
    }
  }, [show, activeTab, similarKidneys, showOnlyAccepted, showNearestRejected]);

  const loadUmapVisualization = async () => {
    setIsLoadingUmap(true);
    setUmapError(null);
    
    console.log('Loading UMAP visualization for city:', city);
    console.log('Selected record:', selectedRecord);
    
    try {
      // Log the request being sent
      console.log('Sending UMAP request to:', `http://localhost:5001/api/umap/${city}`);
      
      const response = await fetch(`http://localhost:5001/api/umap/${city}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetRecord: selectedRecord,
          recordId: selectedRecord?.PTR_SEQUENCE_NUM || 'unknown'
        }),
      });
      
      console.log('UMAP response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('UMAP error response:', errorText);
        throw new Error(`Failed to generate UMAP: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('UMAP data received:', Object.keys(data));
      
      if (!data.image) {
        console.error('No image data in UMAP response');
        throw new Error('No image data received from server');
      }
      
      console.log('Image data length:', data.image.length);
      setUmapImage(data.image);
    } catch (error) {
      console.error('Error loading UMAP visualization:', error);
      setUmapError(`Failed to load UMAP visualization: ${error.message}`);
    } finally {
      setIsLoadingUmap(false);
    }
  };

  // Make sure the drawUmapVisualization function has proper error handling
  const drawUmapVisualization = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('Canvas reference is null');
      return;
    }
    
    const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      // Set canvas dimensions
      canvas.width = 700;
      canvas.height = 500;
    
      // Add a subtle gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#f8f9fa');
      gradient.addColorStop(1, '#e9ecef');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add a grid pattern
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 1;
      
      // Draw vertical grid lines
      for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Draw horizontal grid lines
      for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Calculate center point
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Draw the interactive circle first (so it appears behind everything)
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
      ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw circle handle for dragging
      const handleAngle = Math.PI / 4; // 45 degrees
      const handleX = centerX + circleRadius * Math.cos(handleAngle);
      const handleY = centerY + circleRadius * Math.sin(handleAngle);
      
      ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Find max distance to normalize distances
      const maxDistance = Math.max(...similarKidneys.map(k => k.distance || 0));
      
      // Draw connecting lines first (so they appear behind the points)
      similarKidneys.forEach((kidney) => {
        if (!shouldShowKidney(kidney)) {
          return; // Skip this kidney
        }
        
        const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
        const isNearestRejected = showNearestRejected && !isAccepted;
        
        if (showOnlyAccepted && !isAccepted && !isNearestRejected) {
          return; // Skip drawing lines for this kidney
        }
        
        const normalizedDistance = kidney.distance ? (kidney.distance / maxDistance) : 0.5;
        const distanceFactor = 0.2 + (normalizedDistance * 0.8); // Scale between 20% and 100% of max radius
        
        const recordId = kidney.record.PTR_SEQUENCE_NUM || kidney.record.id || '';
        const seed = String(recordId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const angle = (seed % 100) / 100 * Math.PI * 2;
        
        // Use a larger radius for the bigger canvas
        const radius = 250 * distanceFactor;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        kidney.visualX = x;
        kidney.visualY = y;
      
        // If masking is enabled, only draw lines for points inside the circle
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (!maskOutsideCircle || distanceFromCenter <= circleRadius) {
          const gradient = ctx.createLinearGradient(centerX, centerY, x, y);
          gradient.addColorStop(0, 'rgb(0, 153, 255)'); // Blue (current kidney)
          
          const endColor = isAccepted ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)';
          gradient.addColorStop(1, endColor);
          
          ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      });
      
      // Draw the current kidney (blue) in the center
      const currentGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 12);
      currentGradient.addColorStop(0, '#3498db');
      currentGradient.addColorStop(1, '#2980b9');
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = currentGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw similar kidneys
      similarKidneys.forEach((kidney, index) => {
        if (!shouldShowKidney(kidney)) {
          return; // Skip this kidney
        }
        
        const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
        const isNearestRejected = showNearestRejected && !isAccepted;
        
        if (showOnlyAccepted && !isAccepted && !isNearestRejected) {
          return; // Skip drawing points for this kidney
        }
        
        const x = kidney.visualX;
        const y = kidney.visualY;
        
        // Check if this kidney should be drawn (based on masking)
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (!maskOutsideCircle || distanceFromCenter <= circleRadius) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
          if (isAccepted) {
            gradient.addColorStop(0, 'rgba(46, 204, 113, 0.3)'); // semi-transparent green (0.3 alpha)
            gradient.addColorStop(1, 'rgba(39, 174, 96, 0.3)');
          } else {
            gradient.addColorStop(0, 'rgba(231, 76, 60, 0.3)'); // semi-transparent red (0.3 alpha)
            gradient.addColorStop(1, 'rgba(192, 57, 43, 0.3)');
          }
          
          const isHovered = hoveredKidney === index;
          
          ctx.shadowColor = isHovered ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = isHovered ? 10 : 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          // Increase the radius for better hover detection
          const radius = isHovered ? 12 : 10; // Increased size
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          kidney.hitArea = {
            x,
            y,
            radius: 14, // Slightly larger for easier hovering
          };
        } else {
          // If we're masking, still keep the hit area but make it invisible
          kidney.hitArea = null;
        }
      });
      
      // Draw stats panel with radius information
      const statsX = 20;
      const statsY = canvas.height - 140;
      const statsWidth = 280;
      const statsHeight = 120;
      
      // Clear background
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(statsX, statsY, statsWidth, statsHeight, 5);
      ctx.fill();
      ctx.stroke();
      
      // Title
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px Arial'; // Larger font
      ctx.fillText('Circle Statistics', statsX + 12, statsY + 24);
      
      // Lines to separate sections
      ctx.strokeStyle = '#eee';
      ctx.beginPath();
      ctx.moveTo(statsX + 10, statsY + 32);
      ctx.lineTo(statsX + statsWidth - 10, statsY + 32);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(statsX + 140, statsY + 40);
      ctx.lineTo(statsX + 140, statsY + statsHeight - 10);
      ctx.stroke();
      
      // Stats values - carefully positioned
      ctx.font = '13px Arial'; // Consistent, slightly larger font
      
      // Left column
      ctx.fillText(`Accepted:`, statsX + 15, statsY + 50);
      ctx.fillText(`${acceptanceStats.accepted}`, statsX + 90, statsY + 50);
      
      ctx.fillText(`Rejected:`, statsX + 15, statsY + 75);
      ctx.fillText(`${acceptanceStats.rejected}`, statsX + 90, statsY + 75);
      
      ctx.fillText(`Distance:`, statsX + 15, statsY + 100);
      ctx.fillText(`${pixelRadiusToNormalizedDistance(circleRadius).toFixed(3)}`, statsX + 90, statsY + 100);
      
      // Right column - adjust position of "Accept Rate" to prevent overlap
      ctx.fillText(`Total:`, statsX + 155, statsY + 50);
      ctx.fillText(`${acceptanceStats.total}`, statsX + 220, statsY + 50);
      
      ctx.fillText(`Radius:`, statsX + 155, statsY + 75);
      ctx.fillText(`${Math.round(circleRadius)}px`, statsX + 220, statsY + 75);
      
      // Give more space for acceptance rate
      ctx.fillText(`Accept Rate:`, statsX + 155, statsY + 100);
      if (acceptanceStats.total > 0) {
        ctx.fillText(`${acceptanceStats.rate.toFixed(1)}%`, statsX + 235, statsY + 100); // Move value further right
      } else {
        ctx.fillText(`N/A`, statsX + 235, statsY + 100); // Move value further right
      }
      
      // Draw mask toggle button
      const buttonX = canvas.width - 150;
      const buttonY = 20;
      const buttonWidth = 130;
      const buttonHeight = 30;
      
      // Button background
      ctx.fillStyle = maskOutsideCircle ? 'rgba(52, 152, 219, 0.8)' : 'rgba(200, 200, 200, 0.8)';
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 5);
      ctx.fill();
      ctx.stroke();
      
      // Button text
      ctx.fillStyle = maskOutsideCircle ? 'white' : '#333';
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(maskOutsideCircle ? 'Show All Points' : 'Mask Outside Circle', buttonX + buttonWidth/2, buttonY + buttonHeight/2 + 4);
      
      // Store button position for click detection
      canvas.maskButtonArea = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
      };
      
      // Draw tooltip if a kidney is being hovered
      if (hoveredKidney !== null && mousePosition.x && mousePosition.y) {
        const kidney = similarKidneys[hoveredKidney];
        if (kidney) {
          // Tooltip content
          const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
          const tooltipText = [
            `Kidney #${hoveredKidney + 1}`,
            `Distance: ${kidney.distance.toFixed(3)}`,
            `Outcome: ${isAccepted ? 'Accepted' : 'Rejected'}`
          ];
          
          // Calculate tooltip dimensions
          const tooltipWidth = 160;
          const tooltipHeight = 70;
          const padding = 10;
      
          // Position tooltip near the mouse but ensure it stays within canvas
          let tooltipX = mousePosition.x + 15;
          let tooltipY = mousePosition.y - tooltipHeight - 5;
          
          // Adjust if tooltip would go off the right edge
          if (tooltipX + tooltipWidth > canvas.width) {
            tooltipX = mousePosition.x - tooltipWidth - 15;
          }
          
          // Adjust if tooltip would go off the top edge
          if (tooltipY < 0) {
            tooltipY = mousePosition.y + 15;
          }
          
          // Draw tooltip background with shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
          ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
      ctx.fill();
      
          // Draw tooltip border
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.strokeStyle = isAccepted ? '#27ae60' : '#c0392b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
          ctx.stroke();
          
          // Draw tooltip content
          ctx.fillStyle = '#333';
          ctx.textAlign = 'left';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(tooltipText[0], tooltipX + padding, tooltipY + padding + 12);
          
          ctx.font = '12px Arial';
          ctx.fillText(tooltipText[1], tooltipX + padding, tooltipY + padding + 32);
          
          ctx.fillStyle = isAccepted ? '#27ae60' : '#c0392b';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(tooltipText[2], tooltipX + padding, tooltipY + padding + 52);
        }
      }
    } catch (error) {
      console.error('Error in drawUmapVisualization:', error);
    }
  };

  /**
   * Effect hook to handle mouse interactions with the UMAP visualization
   * Sets up event listeners for dragging the circle radius handle,
   * hovering over kidney points, clicking the mask toggle button,
   * and updating statistics based on these interactions.
   */
  useEffect(() => {
    if (!canvasRef.current || !show || activeTab !== 'umap') return;
    
    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    /**
     * Handles mouse down events on the canvas
     * Checks for clicks on the mask toggle button or the circle resize handle
     * 
     * @param {MouseEvent} event - The mouse down event
     */
    const handleMouseDown = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Check if click is on the mask toggle button
      if (canvas.maskButtonArea) {
        const { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight } = canvas.maskButtonArea;
        if (x >= buttonX && x <= buttonX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
          setMaskOutsideCircle(!maskOutsideCircle);
          return;
        }
      }
      
      // Check if click is near the handle
      const handleAngle = Math.PI / 4;
      const handleX = centerX + circleRadius * Math.cos(handleAngle);
      const handleY = centerY + circleRadius * Math.sin(handleAngle);
      
      const dx = x - handleX;
      const dy = y - handleY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 12) { // Handle has radius 8 + some margin
        setIsDraggingRadius(true);
      }
    };
    
    /**
     * Handles mouse movement over the canvas
     * Updates mouse position for tooltips, manages circle resizing,
     * and detects hover over kidney points
     * 
     * @param {MouseEvent} event - The mouse move event
     */
    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      setMousePosition({ x, y });
      
      if (isDraggingRadius) {
        // Calculate new radius based on mouse position
        const dx = x - centerX;
        const dy = y - centerY;
        const newRadius = Math.sqrt(dx * dx + dy * dy);
        
        // Limit radius to reasonable bounds
        const limitedRadius = Math.max(20, Math.min(newRadius, 300));
        setCircleRadius(limitedRadius);
        
        // Update acceptance stats
        const stats = calculateAcceptanceStats(limitedRadius);
        setAcceptanceStats(stats);
        
        // Redraw
        drawUmapVisualization();
      } else {
        // Check if mouse is over any kidney
        let hoveredIndex = null;
        for (let i = 0; i < similarKidneys.length; i++) {
          const kidney = similarKidneys[i];
          if (kidney.hitArea) {
            const dx = x - kidney.hitArea.x;
            const dy = y - kidney.hitArea.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= kidney.hitArea.radius) {
              hoveredIndex = i;
              break;
            }
          }
        }
        
        if (hoveredIndex !== hoveredKidney) {
          setHoveredKidney(hoveredIndex);
          drawUmapVisualization();
        }
      }
    };
    
    /**
     * Handles mouse up events
     * Finalizes circle resizing operations and updates statistics
     * 
     * @param {MouseEvent} event - The mouse up event
     */
    const handleMouseUp = () => {
      if (isDraggingRadius) {
        setIsDraggingRadius(false);
        // Update acceptance stats one final time
        const stats = calculateAcceptanceStats(circleRadius);
        setAcceptanceStats(stats);
      }
    };
    
    /**
     * Handles mouse leaving the canvas
     * Resets drag and hover states
     * 
     * @param {MouseEvent} event - The mouse leave event
     */
    const handleMouseLeave = () => {
      setIsDraggingRadius(false);
      setHoveredKidney(null);
      drawUmapVisualization();
    };
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Calculate initial stats
    const stats = calculateAcceptanceStats(circleRadius);
    setAcceptanceStats(stats);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [show, activeTab, similarKidneys, hoveredKidney, circleRadius, isDraggingRadius, maskOutsideCircle, showNearestRejected]);

  /**
   * Calculates acceptance statistics for kidneys within the circle
   * Counts accepted and rejected kidneys, and calculates the acceptance rate
   * 
   * @param {number} radius - The radius of the filtering circle in pixels
   * @returns {object} - Object containing acceptance statistics: {accepted, rejected, total, rate}
   */
  const calculateAcceptanceStats = (radius) => {
    const centerX = canvasRef.current?.width / 2 || 350;
    const centerY = canvasRef.current?.height / 2 || 250;
    
    let accepted = 0;
    let rejected = 0;
    
    similarKidneys.forEach(kidney => {
      if (!kidney.visualX || !kidney.visualY) return;
      
      const dx = kidney.visualX - centerX;
      const dy = kidney.visualY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= radius) {
        if (kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1) {
          accepted++;
        } else {
          rejected++;
        }
      }
    });
    
    const total = accepted + rejected;
    const rate = total > 0 ? (accepted / total) * 100 : 0;
    
    return { accepted, rejected, total, rate };
  };

  /**
   * Converts pixel radius on the visualization to normalized distance
   * This helps users understand the actual similarity threshold represented by the circle
   * 
   * @param {number} pixelRadius - The radius in pixels
   * @returns {number} - The normalized distance value that corresponds to the pixel radius
   */
  const pixelRadiusToNormalizedDistance = (pixelRadius) => {
    // Find max distance to normalize
    const maxDistance = Math.max(...similarKidneys.map(k => k.distance || 0));
    
    // Calculate what proportion of the max visualization radius this represents
    const maxVisualizationRadius = 250; // This should match the value used in drawUmapVisualization
    const normalizedRadius = (pixelRadius / maxVisualizationRadius) * maxDistance;
    
    return normalizedRadius;
  };

  /**
   * Standardizes feature values across kidneys to make them comparable
   * Uses percentile-based normalization (30%-70%) to handle outliers better than min/max
   * 
   * @param {Array} kidneys - Array of kidney objects to standardize
   * @param {Array} features - Array of feature names to standardize
   * @returns {Array} - New array of kidneys with standardized feature values
   */
  const standardizeFeatures = (kidneys, features) => {
    // Create a copy of the kidneys array to avoid modifying the original
    const standardizedKidneys = JSON.parse(JSON.stringify(kidneys));
    
    // Calculate 30% and 70% percentiles for each feature
    const percentiles = {};
    features.forEach(feature => {
      // Extract all values for this feature
      const values = kidneys
        .map(k => parseFloat(k.record[feature]))
        .filter(val => !isNaN(val));
      
      // Sort values to calculate percentiles
      values.sort((a, b) => a - b);
      
      // Calculate 30% and 70% percentiles
      const p5Index = Math.floor(values.length * 0.30);
      const p95Index = Math.floor(values.length * 0.70);
      
      percentiles[feature] = {
        p5: values[p5Index],
        p95: values[p95Index],
        range: values[p95Index] - values[p5Index]
      };
    });
    
    // Standardize each kidney's features
    standardizedKidneys.forEach(kidney => {
      // Add a standardizedRecord object to store standardized values
      kidney.standardizedRecord = {};
      
      features.forEach(feature => {
        const rawValue = parseFloat(kidney.record[feature]);
        
        if (!isNaN(rawValue) && percentiles[feature].range > 0) {
          // Standardize based on 30% and 70% percentiles
          const standardizedValue = (rawValue - percentiles[feature].p5) / percentiles[feature].range;
          
          // Clip values to [0, 1] range
          kidney.standardizedRecord[feature] = Math.max(0, Math.min(1, standardizedValue));
        } else {
          // Handle cases where standardization isn't possible
          kidney.standardizedRecord[feature] = 0;
        }
      });
    });
    
    return standardizedKidneys;
  };

  /**
   * Finds similar kidneys using standardized Euclidean distance
   * 
   * @param {Object} uploadedKidney - The kidney to find similar matches for
   * @param {Array} allKidneys - Array of potential kidney matches
   * @param {Array} features - The features to use for similarity calculation
   * @param {number} numSimilar - Number of similar kidneys to return
   * @returns {Array} - Sorted array of similar kidneys with distance scores
   */
  const findSimilarKidneys = (uploadedKidney, allKidneys, features, numSimilar = 7) => {
    // Standardize all kidneys including the uploaded one
    const standardizedKidneys = standardizeFeatures([uploadedKidney, ...allKidneys], features);
    
    // Extract the standardized uploaded kidney
    const standardizedUploadedKidney = standardizedKidneys[0];
    
    // Calculate distances using standardized values
    const kidneysWithDistances = standardizedKidneys.slice(1).map(kidney => {
      let sumSquaredDiff = 0;
      
      features.forEach(feature => {
        const diff = standardizedUploadedKidney.standardizedRecord[feature] - kidney.standardizedRecord[feature];
        sumSquaredDiff += diff * diff;
      });
      
      // Calculate Euclidean distance
      const distance = Math.sqrt(sumSquaredDiff);
      
      // Return the original kidney (not standardized) with the distance
      return {
        ...allKidneys[standardizedKidneys.indexOf(kidney) - 1], // Get the original kidney
        distance: distance
      };
    });
    
    // Sort by distance and take the top numSimilar
    return kidneysWithDistances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, numSimilar);
  };

  /**
   * Fetches and processes similar kidneys data from backend services
   * This is a placeholder function showing the typical workflow
   */
  const fetchSimilarKidneys = async () => {
    try {
      // Your existing code to fetch data
      
      // Calculate similar kidneys using standardization
      const standardizedSimilarKidneys = findSimilarKidneys(selectedRecord, referenceData, features);
      setSimilarKidneys(standardizedSimilarKidneys);
      
    } catch (error) {
      console.error('Error fetching similar kidneys:', error);
    }
  };

  /**
   * Resets to first tab when modal opens
   */
  useEffect(() => {
    if (show) {
      setActiveTab('summary');
    }
  }, [show]);

  /**
   * Handles changes to the slider for filtering top similar kidneys
   * 
   * @param {Event} e - The change event from the slider input
   */
  const handleTopKidneysChange = (e) => {
    const value = parseInt(e.target.value, 10);
    const maxKidneys = similarKidneys ? similarKidneys.length : 10;
    // Only limit to minimum 1 and maximum the number of similar kidneys
    setTopKidneysCount(Math.max(1, Math.min(maxKidneys, value || 10)));
  };

  /**
   * Combines important features from all cities into a single deduplicated list
   * 
   * @returns {Array} - Combined list of all unique important features
   */
  const getAllImportantFeatures = () => {
    // Create a Set to automatically remove duplicates
    const allFeaturesSet = new Set();
    
    // Add all features from all cities
    Object.values(importantFeaturesMap).forEach(cityFeatures => {
      cityFeatures.forEach(feature => allFeaturesSet.add(feature));
    });
    
    // Convert back to array
    return Array.from(allFeaturesSet);
  };

  // Store the combined list as a constant
  const allImportantFeatures = getAllImportantFeatures();
  console.log("Combined important features:", allImportantFeatures);

  /**
   * Filters the combined feature list to only include features present in the data
   * 
   * @returns {Array} - List of features available in the current dataset
   */
  const getFeaturesToDisplay = () => {
    // If we have similarKidneys, filter the combined list to only include features that exist
    if (similarKidneys && similarKidneys.length > 0) {
      return allImportantFeatures.filter(feature => 
        feature in similarKidneys[0].record
      );
    }
    
    // If no similarKidneys, return the full combined list
    return allImportantFeatures;
  };

  /**
   * Determines if a value is numeric for comparison purposes
   * 
   * @param {*} value - The value to check
   * @returns {boolean} - True if the value is numeric
   */
  const isNumeric = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  };

  /**
   * Calculates normalized difference between two feature values
   * Handles both numeric and categorical values appropriately
   * 
   * @param {*} value1 - First value to compare
   * @param {*} value2 - Second value to compare
   * @returns {number|null} - Normalized difference (0-1) or null if comparison isn't possible
   */
  const calculateDifference = (value1, value2) => {
    // Handle NA values
    if (value1 === 'N/A' || value2 === 'N/A' || value1 === undefined || value2 === undefined) {
      return null; // No difference calculation possible
    }
    
    // For numeric values, calculate normalized absolute difference
    if (isNumeric(value1) && isNumeric(value2)) {
      const num1 = parseFloat(value1);
      const num2 = parseFloat(value2);
      
      // If values are identical, return 0 (no difference)
      if (num1 === num2) return 0;
      
      // Calculate absolute difference
      const absDiff = Math.abs(num1 - num2);
      
      // Normalize based on the magnitude of the values
      const maxVal = Math.max(Math.abs(num1), Math.abs(num2));
      return maxVal > 0 ? absDiff / maxVal : 0;
    }
    
    // For categorical values, binary difference (0 if same, 1 if different)
    return value1 === value2 ? 0 : 1;
  };

  /**
   * Determines background color intensity based on difference between values
   * Used for visual comparison in the features table
   * 
   * @param {number|null} difference - Normalized difference value (0-1) or null
   * @returns {string} - CSS color string with appropriate opacity
   */
  const getBackgroundColor = (difference) => {
    // If difference is null, return transparent (no coloring)
    if (difference === null) return 'transparent';
    
    // Calculate color intensity (0 to 1, where 0 is closest/darkest)
    // Invert the difference so smaller differences get darker colors
    const intensity = difference;
    
    // Use a blue color scheme with varying opacity
    return `rgba(59, 130, 246, ${1 - intensity})`;
  };

  /**
   * Retrieves the 10 nearest rejected kidneys for visualization and comparison
   * 
   * @returns {Array} - List of the 10 closest rejected kidneys
   */
  const getNearestRejectedKidneys = () => {
    // Create a list of rejected kidneys
    const rejectedKidneys = similarKidneys.filter(
      kidney => !(kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1)
    );
    
    // Sort by distance
    const sortedRejected = [...rejectedKidneys].sort((a, b) => 
      (a.distance || 0) - (b.distance || 0)
    );
    
    // Return the 10 nearest
    return sortedRejected.slice(0, 10);
  };

  // Store the IDs of the 10 nearest rejected kidneys
  const nearestRejectedIds = showNearestRejected 
    ? getNearestRejectedKidneys().map(k => k.record.PTR_SEQUENCE_NUM || k.record.id)
    : [];

  console.log("Nearest rejected IDs:", nearestRejectedIds);

  /**
   * Determines if a kidney should be displayed based on current filter settings
   * 
   * @param {Object} kidney - The kidney record to check
   * @returns {boolean} - True if the kidney should be shown
   */
  const shouldShowKidney = (kidney) => {
    const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
    
    // If showing all kidneys
    if (!showOnlyAccepted && !showNearestRejected) {
      return true;
    }
    
    // If showing only accepted kidneys
    if (showOnlyAccepted && !showNearestRejected) {
      return isAccepted;
    }
    
    // Get the 10 nearest rejected kidneys
    const rejectedKidneys = similarKidneys
      .filter(k => !(k.record.OFFER_ACCEPT === '1' || k.record.OFFER_ACCEPT === 1))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 10);
    
    const nearestRejectedIds = rejectedKidneys.map(k => k.record.PTR_SEQUENCE_NUM || k.record.id);
    const kidneyId = kidney.record.PTR_SEQUENCE_NUM || kidney.record.id;
    const isNearestRejected = nearestRejectedIds.includes(kidneyId);
    
    // If showing nearest rejected (with or without accepted)
    if (showNearestRejected) {
      if (showOnlyAccepted) {
        // Show accepted + 10 nearest rejected
        return isAccepted || isNearestRejected;
      } else {
        // Show all accepted + 10 nearest rejected
        return isAccepted || isNearestRejected;
      }
    }
    
    return true; // Default fallback
  };

  // Initialize and clean up the worker in a useEffect
  useEffect(() => {
    // Create the worker when the component mounts
    tsneWorkerRef.current = new Worker(
      new URL('../workers/tsneWorker.js', import.meta.url),
      { type: 'module' }  // This tells the browser that the worker uses imports
    );
    
    // Set up the message handler
    tsneWorkerRef.current.onmessage = (event) => {
      const { status, result, error } = event.data;
      
      if (status === 'success') {
        console.log('T-SNE calculation complete');
        
        // Cache the results
        const cacheKey = selectedRecord?.PTR_SEQUENCE_NUM || 'unknown';
        tsneCacheRef.current[cacheKey] = result;
        
        setTsneData(result);
        setIsLoadingTsne(false);
      } else if (status === 'error') {
        console.error('Error in T-SNE worker:', error);
        setTsneError(`Failed to generate T-SNE visualization: ${error}`);
        setIsLoadingTsne(false);
      }
    };
    
    // Clean up the worker when the component unmounts
    return () => {
      if (tsneWorkerRef.current) {
        tsneWorkerRef.current.terminate();
      }
    };
  }, []);

  // Update the generateTsne function to correctly use the city from the model
  const generateTsne = async () => {
    setIsLoadingTsne(true);
    setTsneError(null);
    
    try {
      // Get the city from the current model context
      const currentCity = city || (selectedRecord && selectedRecord.DONOR_CITY) || 'Baltimore';
      
      console.log(`Requesting T-SNE visualization from backend for city: ${currentCity}`);
      
      if (!selectedRecord) {
        throw new Error('Selected record is required for T-SNE visualization');
      }
      
      // Call the backend API with the current city
      const response = await fetch(`http://localhost:5002/api/tsne/${currentCity}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetRecord: selectedRecord,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate T-SNE visualization');
      }
      
      const data = await response.json();
      console.log('Received T-SNE data:', data);
      
      // Cache the results
      const cacheKey = selectedRecord?.PTR_SEQUENCE_NUM || 'unknown';
      tsneCacheRef.current[cacheKey] = data.coordinates;
      
      // Set the data for rendering
      setTsneData(data.coordinates);
      setIsLoadingTsne(false);
    } catch (error) {
      console.error('Error generating T-SNE:', error);
      setTsneError(error.message);
      setIsLoadingTsne(false);
    }
  };

  const drawTsneVisualization = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('Canvas reference is null');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }
      
      // Set canvas dimensions
      canvas.width = 700;
      canvas.height = 500;
      
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Add a subtle gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#f8f9fa');
      gradient.addColorStop(1, '#e9ecef');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add a grid pattern
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 1;
      
      // Draw vertical grid lines
      for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Draw horizontal grid lines
      for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Calculate center point
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Draw the interactive circle
      //ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
      //ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      //ctx.lineWidth = 2;
      //ctx.setLineDash([5, 3]);
      //ctx.beginPath();
      //ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      //ctx.fill();
      //ctx.stroke();
      //ctx.setLineDash([]);
      
      // Draw circle handle for dragging
      const handleAngle = Math.PI / 4; // 45 degrees
      const handleX = centerX + circleRadius * Math.cos(handleAngle);
      const handleY = centerY + circleRadius * Math.sin(handleAngle);
      
      //ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
      //ctx.strokeStyle = 'white';
      //ctx.lineWidth = 2;
      //ctx.beginPath();
      //ctx.arc(handleX, handleY, 8, 0, Math.PI * 2);
      //ctx.fill();
      //ctx.stroke();
      
      if (!tsneData || tsneData.length === 0) {
        // Draw a message if no data
        ctx.fillStyle = '#6c757d';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No T-SNE data available', canvas.width / 2, canvas.height / 2);
        return;
      }
      
      // Find min/max values for scaling
      const xValues = tsneData.map(point => point[0]);
      const yValues = tsneData.map(point => point[1]);
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      
      // Scale function to map t-SNE coordinates to canvas
      const scaleX = (x) => {
        return 50 + ((x - xMin) / (xMax - xMin)) * (canvas.width - 100);
      };
      
      const scaleY = (y) => {
        return 50 + ((y - yMin) / (yMax - yMin)) * (canvas.height - 100);
      };
      
      // Draw connecting lines first (so they appear behind the points)
      similarKidneys.forEach((kidney, index) => {
        if (!shouldShowKidney(kidney) || index >= tsneData.length - 1) {
          return; // Skip this kidney
        }
        
        const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
        
        // Current kidney is at index 0
        const currentX = scaleX(tsneData[0][0]);
        const currentY = scaleY(tsneData[0][1]);
        
        // This kidney's coordinates (index+1 because current kidney is at 0)
        const x = scaleX(tsneData[index + 1][0]);
        const y = scaleY(tsneData[index + 1][1]);
        
        kidney.visualX = x;
        kidney.visualY = y;
        
        // If masking is enabled, only draw lines for points inside the circle
        //const dx = x - centerX;
        //const dy = y - centerY;
        //const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        //if (!maskOutsideCircle || distanceFromCenter <= circleRadius) {
         // const gradient = ctx.createLinearGradient(currentX, currentY, x, y);
          //gradient.addColorStop(0, 'rgba(52, 152, 219, 0.7)'); // Blue (current kidney)
          
          //const endColor = isAccepted ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)';
          //gradient.addColorStop(1, endColor);
          
          //ctx.strokeStyle = gradient;
          //ctx.lineWidth = 2;
          //ctx.beginPath();
          //ctx.moveTo(currentX, currentY);
          //ctx.lineTo(x, y);
          //ctx.stroke();
        //}
      });
      
      
      
      // Draw similar kidneys
      similarKidneys.forEach((kidney, index) => {
        if (!shouldShowKidney(kidney) || index >= tsneData.length - 1) {
          return; // Skip this kidney
        }
        
        const isAccepted = kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1;
        
        // This kidney's coordinates (index+1 because current kidney is at 0)
        const x = kidney.visualX;
        const y = kidney.visualY;
        
        // Check if this kidney should be drawn (based on masking)
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (!maskOutsideCircle || distanceFromCenter <= circleRadius) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
          if (isAccepted) {
            gradient.addColorStop(0, 'rgba(46, 204, 113, 1.0)'); // semi-transparent green (0.3 alpha)
            gradient.addColorStop(1, 'rgba(39, 174, 96, 1)');
          } else {
            gradient.addColorStop(0, 'rgba(231, 76, 60, 0.2)'); // semi-transparent red (0.3 alpha)
            gradient.addColorStop(1, 'rgba(192, 57, 43, 0.2)');
          }
          
          const isHovered = hoveredKidney === index;
          
          ctx.shadowColor = isHovered ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = isHovered ? 10 : 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          // Increase the radius for better hover detection
          const radius = isHovered ? 12 : 10;
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          kidney.hitArea = {
            x,
            y,
            radius: 14, // Slightly larger for easier hovering
          };
        } else {
          // If we're masking, still keep the hit area but make it invisible
          kidney.hitArea = null;
        }
      });

      // Draw the current kidney (blue) in the center
      const currentX = scaleX(tsneData[0][0]);
      const currentY = scaleY(tsneData[0][1]);
      
      const currentGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 12);
      currentGradient.addColorStop(0, '#3498db');
      currentGradient.addColorStop(1, '#2980b9');
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Stronger shadow
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = currentGradient;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Add a white border to make it stand out more
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw stats panel with radius information (same as UMAP)
      // ... (copy your existing stats panel drawing code)
    } catch (error) {
      console.error('Error in drawTsneVisualization:', error);
    }
  };

  useEffect(() => {
    if (show && activeTab === 'tsne' && tsneData && similarKidneys && similarKidneys.length > 0 && canvasRef.current) {
      drawTsneVisualization();
    }
  }, [show, activeTab, tsneData, similarKidneys, showOnlyAccepted, showNearestRejected, maskOutsideCircle, circleRadius]);

  // Add these functions if they don't already exist in your component
  // or modify the canvas element to use your existing handlers

  // This function handles mouse movement over the canvas
  const handleCanvasMouseMove = (event) => {
    if (!canvasRef.current || (activeTab !== 'umap' && activeTab !== 'tsne')) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    // Check if mouse is over the circle handle (for resizing)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const handleAngle = Math.PI / 4; // 45 degrees
    const handleX = centerX + circleRadius * Math.cos(handleAngle);
    const handleY = centerY + circleRadius * Math.sin(handleAngle);
    
    const dx = x - handleX;
    const dy = y - handleY;
    const distanceToHandle = Math.sqrt(dx * dx + dy * dy);
    
    if (distanceToHandle <= 10) {
      canvas.style.cursor = 'pointer';
    } else {
      // Check if mouse is over any kidney
      let hoveredIndex = -1;
      
      similarKidneys.forEach((kidney, index) => {
        if (kidney.hitArea) {
          const dx = x - kidney.hitArea.x;
          const dy = y - kidney.hitArea.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= kidney.hitArea.radius) {
            hoveredIndex = index;
            canvas.style.cursor = 'pointer';
          }
        }
      });
      
      if (hoveredIndex === -1) {
        canvas.style.cursor = 'default';
      }
      
      setHoveredKidney(hoveredIndex);
    }
    
    // Handle dragging the circle radius
    if (isDraggingRadius) {
      const dx = x - centerX;
      const dy = y - centerY;
      const newRadius = Math.sqrt(dx * dx + dy * dy);
      setCircleRadius(Math.max(20, Math.min(250, newRadius)));
      
      // Redraw the visualization
      if (activeTab === 'umap') {
        drawUmapVisualization();
      } else if (activeTab === 'tsne') {
        drawTsneVisualization();
      }
    }
  };

  // This function handles clicks on the canvas
  const handleCanvasClick = (event) => {
    if (!canvasRef.current || (activeTab !== 'umap' && activeTab !== 'tsne')) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is on the circle handle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const handleAngle = Math.PI / 4; // 45 degrees
    const handleX = centerX + circleRadius * Math.cos(handleAngle);
    const handleY = centerY + circleRadius * Math.sin(handleAngle);
    
    const dx = x - handleX;
    const dy = y - handleY;
    const distanceToHandle = Math.sqrt(dx * dx + dy * dy);
    
    if (distanceToHandle <= 10) {
      setIsDraggingRadius(true);
      
      // Add mouse move and mouse up event listeners to the document
      const handleMouseMove = (e) => {
        handleCanvasMouseMove(e);
      };
      
      const handleMouseUp = () => {
        setIsDraggingRadius(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      // Check if click is on any kidney
      similarKidneys.forEach((kidney, index) => {
        if (kidney.hitArea) {
          const dx = x - kidney.hitArea.x;
          const dy = y - kidney.hitArea.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= kidney.hitArea.radius) {
            console.log('Clicked on kidney:', kidney.record);
            // You can add additional functionality here, like showing details
          }
        }
      });
    }
  };

  // Add this useEffect to trigger T-SNE generation when the tab is selected
  useEffect(() => {
    if (
      activeTab === 'tsne' &&
      show &&
      selectedRecord &&
      similarKidneys.length &&
      !tsneData &&
      !isLoadingTsne
    ) {
      console.log('T-SNE tab conditions met, starting calculation');
      
      // Use cached output if we have it
      const cacheKey = selectedRecord?.PTR_SEQUENCE_NUM || 'unknown';
      if (tsneCacheRef.current[cacheKey]) {
        console.log('Using cached T-SNE data');
        setTsneData(tsneCacheRef.current[cacheKey]);
      } else {
        console.log('Generating new T-SNE visualization');
        generateTsne();
      }
    }
  }, [activeTab, show, selectedRecord, similarKidneys, tsneData, isLoadingTsne]);

  /**
   * Effect hook to clear the canvas when switching between tabs
   * Ensures no visualization artifacts remain when changing views
   */
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [activeTab]);

  // Don't render anything if modal is not visible
  if (!show) return null;

  return (
    <div className="modal-overlay">
      {/* Main modal container with ref for click-outside detection */}
      <div className="similar-modal" ref={modalRef}>
        {/* Modal header with title and close button */}
        <div className="modal-header">
          <h2>Similar Kidneys Analysis</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* Tab navigation bar */}
        <div className="modal-tabs">
          {/* Summary tab button - shows acceptance rate statistics */}
          <button 
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          {/* UMAP visualization tab button - shows 2D projection of kidney data */}
          <button 
            className={`tab-btn ${activeTab === 'umap' ? 'active' : ''}`}
            onClick={() => setActiveTab('umap')}
          >
            UMAP Visualization
          </button>
          {/* All Features tab button - shows detailed feature comparison table */}
          <button 
            className={`tab-btn ${activeTab === 'all-features' ? 'active' : ''}`}
            onClick={() => setActiveTab('all-features')}
          >
            All Features
          </button>
          {/* T-SNE tab button - alternative visualization technique */}
          <button 
            className={`tab-btn ${activeTab === 'tsne' ? 'active' : ''}`}
            onClick={() => setActiveTab('tsne')}
          >
            T-SNE
          </button>
        </div>
        
        {/* Modal content area - changes based on active tab */}
        <div className="modal-content">
          {/* Loading indicator displayed while fetching reference data */}
          {loadingReference && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading reference data...</p>
            </div>
          )}
          
          {/* Error message displayed if reference data fails to load */}
          {referenceError && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              <div>
                <h4>Error Loading Data</h4>
                <p>{referenceError}</p>
              </div>
            </div>
          )}
          
          {/* Content only displayed when data is loaded successfully */}
          {!loadingReference && !referenceError && (
            <>
              {/* SUMMARY TAB CONTENT */}
              {activeTab === 'summary' && (
                <div className="tab-content">
                  {/* Card displaying key metrics for the currently selected kidney */}
                  {selectedRecord && (
                    <div className="current-kidney-card">
                      <div className="card-header">
                        <h3>Current Kidney Profile</h3>
                      </div>
                      <div className="card-content">
                        <div className="kidney-metrics">
                          {/* KDPI metric - Kidney Donor Profile Index - key predictor of graft failure */}
                          <div className="metric">
                            <div className="metric-value">{getValueCaseInsensitive(selectedRecord, 'KDPI') || 'N/A'}</div>
                            <div className="metric-label">KDPI</div>
                          </div>
                          {/* Donor age metric - important clinical factor */}
                          <div className="metric">
                            <div className="metric-value">{getValueCaseInsensitive(selectedRecord, 'AGE_DON') || 'N/A'}</div>
                            <div className="metric-label">Donor Age</div>
                          </div>
                          {/* Creatinine metric - kidney function indicator */}
                          <div className="metric">
                            <div className="metric-value">{getValueCaseInsensitive(selectedRecord, 'CREAT_DON') || 'N/A'}</div>
                            <div className="metric-label">Creatinine</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Results container for similar kidneys data */}
                  {similarKidneys.length > 0 ? (
                    <div className="results-container">
                      {/* Card showing acceptance rate summary with visual gauge */}
                      <div className="summary-card">
                        <div className="summary-header">
                          <h3>Acceptance Summary</h3>
                        </div>
                        <div className="summary-content">
                          {/* Circular gauge visualization of acceptance rate */}
                          <div className="acceptance-gauge">
                            {/* Dynamic conic gradient creates pie chart effect */}
                            <div className="gauge-value" style={{ 
                              background: `conic-gradient(
                                ${acceptanceRate >= 70 ? '#4CAF50' : acceptanceRate >= 30 ? '#FF9800' : '#F44336'} 
                                ${acceptanceRate * 3.6}deg, 
                                #e0e0e0 ${acceptanceRate * 3.6}deg 360deg
                              )` 
                            }}>
                              {/* Center of gauge showing percentage */}
                              <div className="gauge-center">
                                <span>{Math.round(acceptanceRate)}%</span>
                              </div>
                            </div>
                            <div className="gauge-label">Acceptance Rate</div>
                          </div>
                          
                          {/* Detailed acceptance statistics */}
                          <div className="acceptance-stats">
                            {/* Count of accepted kidneys */}
                            <div className="stat">
                              <div className="stat-value">{acceptedCount}</div>
                              <div className="stat-label">Accepted</div>
                            </div>
                            {/* Count of rejected kidneys */}
                            <div className="stat">
                              <div className="stat-value">{similarKidneys.length - acceptedCount}</div>
                              <div className="stat-label">Rejected</div>
                            </div>
                            {/* Total number of similar kidneys */}
                            <div className="stat">
                              <div className="stat-value">{similarKidneys.length}</div>
                              <div className="stat-label">Total</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Card showing table of similar kidneys with key metrics */}
                      <div className="similar-kidneys-card">
                        <div className="card-header">
                          <h3>Similar Kidneys</h3>
                        </div>
                        <div className="card-content">
                          <div className="similar-kidneys-table-container">
                            <table className="similar-kidneys-table">
                              <thead>
                                <tr>
                                  <th>KDPI</th>
                                  <th>Age</th>
                                  <th>Creatinine</th>
                                  <th>Outcome</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Map over similar kidneys to create table rows */}
                                {similarKidneys.map((item, index) => (
                                  <tr key={index} className={item.record.OFFER_ACCEPT === '1' || item.record.OFFER_ACCEPT === 1 ? 'accepted' : 'rejected'}>
                                    <td>{getValueCaseInsensitive(item.record, 'KDPI') || 'N/A'}</td>
                                    <td>{getValueCaseInsensitive(item.record, 'AGE_DON') || 'N/A'}</td>
                                    <td>{getValueCaseInsensitive(item.record, 'CREAT_DON') || 'N/A'}</td>
                                    <td>
                                      {/* Outcome badge with color coding based on acceptance status */}
                                      <span className={`outcome-badge ${item.record.OFFER_ACCEPT === '1' || item.record.OFFER_ACCEPT === 1 ? 'success' : 'failure'}`}>
                                        {item.record.OFFER_ACCEPT === '1' || item.record.OFFER_ACCEPT === 1 ? 'Accepted' : 'Rejected'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : !loadingReference && !referenceError && (
                    // Display when no similar kidneys are found
                    <div className="no-results">
                      <div className="no-results-icon">
                        <i className="fas fa-search"></i>
                      </div>
                      <h3>No Similar Kidneys Found</h3>
                      <p>Please try a different record or model.</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* UMAP VISUALIZATION TAB CONTENT */}
              {activeTab === 'umap' && (
                <div className="umap-tab">
                  {/* Filter controls for the UMAP visualization */}
                  <div className="umap-filter-controls">
                    {/* Toggle button to show only accepted kidneys or all kidneys */}
                    <button 
                      className={`filter-button ${showOnlyAccepted ? 'active' : ''}`}
                      onClick={() => setShowOnlyAccepted(!showOnlyAccepted)}
                    >
                      {showOnlyAccepted ? 'Show All Kidneys' : 'Show Only Accepted'}
                    </button>
                    
                    {/* Toggle button to show/hide the 10 nearest rejected kidneys */}
                    <button 
                      className={`filter-button ${showNearestRejected ? 'active' : ''}`}
                      onClick={() => setShowNearestRejected(!showNearestRejected)}
                    >
                      {showNearestRejected ? 'Hide Nearest Rejected' : 'Show 10 Nearest Rejected'}
                    </button>
                  </div>
                  
                  {/* Canvas container for the UMAP visualization */}
                  <div className="canvas-container">
                    {/* Canvas element where the visualization is drawn */}
                    <canvas 
                      ref={canvasRef} 
                      width="900" 
                      height="700"
                    />
                    {/* Message shown when no data is available for visualization */}
                    {(!similarKidneys || similarKidneys.length === 0) && (
                      <div className="no-data-message">
                        <p>No similar kidneys data available for visualization</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* ALL FEATURES TAB CONTENT */}
              {activeTab === 'all-features' && (
                <div className="tab-content">
                  {/* Controls for filtering the features table */}
                  <div className="filter-controls">
                    <div className="filter-header">
                      <h4>Filter Similar Kidneys</h4>
                      {/* Information tooltip to explain the filter functionality */}
                      <div className="info-tooltip-container">
                        <button 
                          className="info-button"
                          onMouseEnter={() => setShowFilterTooltip(true)}
                          onMouseLeave={() => setShowFilterTooltip(false)}
                        >
                          <i className="fas fa-info-circle"></i>
                        </button>
                        {/* Tooltip content that appears on hover */}
                        {showFilterTooltip && (
                          <div className="tooltip">
                            Adjust the slider to show more or fewer similar kidneys.
                            The current kidney is always shown at the top.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Slider control to adjust how many similar kidneys are displayed */}
                    <div className="slider-container">
                      <span className="slider-label">Show top</span>
                      <div className="slider-with-value">
                        <input
                          type="range"
                          min="1"
                          max={similarKidneys ? similarKidneys.length : 10}
                          value={topKidneysCount}
                          onChange={handleTopKidneysChange}
                          className="kidney-slider"
                        />
                        <div className="slider-value-container">
                          <input
                            type="number"
                            min="1"
                            max={similarKidneys ? similarKidneys.length : 10}
                            value={topKidneysCount}
                            onChange={handleTopKidneysChange}
                            className="kidney-count-input"
                          />
                        </div>
                      </div>
                      <span className="slider-label">kidneys</span>
                    </div>
                  </div>
                  
                  {/* Color legend explaining the color-coding in the features table */}
                  <div className="color-legend">
                    <div className="legend-title">Color Legend:</div>
                    <div className="legend-items">
                      {/* Very similar values - dark blue */}
                      <div className="legend-item">
                        <div className="color-sample" style={{ backgroundColor: 'rgba(59, 130, 246, 1)' }}></div>
                        <span>Very Similar</span>
                      </div>
                      {/* Somewhat similar values - medium blue */}
                      <div className="legend-item">
                        <div className="color-sample" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }}></div>
                        <span>Somewhat Similar</span>
                      </div>
                      {/* Less similar values - light blue */}
                      <div className="legend-item">
                        <div className="color-sample" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}></div>
                        <span>Less Similar</span>
                      </div>
                      {/* N/A or missing values - transparent */}
                      <div className="legend-item">
                        <div className="color-sample" style={{ backgroundColor: 'transparent', border: '1px solid #e2e8f0' }}></div>
                        <span>N/A</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Table container for the detailed features comparison */}
                  <div className="features-table-container">
                    <table className="features-table">
                      <thead>
                        <tr className="features-header-row">
                          {/* Fixed column headers */}
                          <th className="kidney-column">Kidney</th>
                          <th className="distance-column">Distance</th>
                          <th className="outcome-column">Outcome</th>
                          {/* Dynamic column headers for each feature */}
                          {getFeaturesToDisplay().map((feature, idx) => (
                            <th key={idx} className="feature-column">{feature}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Always show the original kidney first as a reference */}
                        {selectedRecord && (
                          <tr className="original-kidney-row">
                            <td className="kidney-column">
                              <span className="kidney-badge original">Current</span>
                            </td>
                            <td className="distance-column">-</td>
                            <td className="outcome-column">-</td>
                            {/* Show all feature values for the current kidney */}
                            {getFeaturesToDisplay().map((feature, idx) => (
                              <td 
                                key={idx} 
                                className="feature-column"
                                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                              >
                                <span className="feature-value">{selectedRecord[feature] || 'N/A'}</span>
                              </td>
                            ))}
                          </tr>
                        )}
                        
                        {/* Then show the filtered similar kidneys */}
                        {similarKidneys
                          .slice(0, topKidneysCount)
                          .map((kidney, idx) => {
                            if (!shouldShowKidney(kidney)) {
                              return null; // Skip kidneys that don't meet filter criteria
                            }
                            return (
                              <tr 
                                key={idx}
                                className={`kidney-row ${kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1 ? 'accepted-row' : 'rejected-row'}`}
                              >
                                <td className="kidney-column">
                                  <span className="kidney-badge similar">{idx + 1}</span>
                                </td>
                                <td className="distance-column">
                                  <span className="distance-value">{kidney.distance.toFixed(4)}</span>
                                </td>
                                <td className="outcome-column">
                                  <span className={`outcome-badge ${kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1 ? 'success' : 'failure'}`}>
                                    {kidney.record.OFFER_ACCEPT === '1' || kidney.record.OFFER_ACCEPT === 1 ? 'Accepted' : 'Rejected'}
                                  </span>
                                </td>
                                {/* Show all feature values with color-coding based on similarity */}
                                {getFeaturesToDisplay().map((feature, featureIdx) => {
                                  // Get current kidney's value for this feature
                                  const currentValue = selectedRecord ? (selectedRecord[feature] || 'N/A') : 'N/A';
                                  
                                  // Get this kidney's value
                                  const kidneyValue = kidney.record[feature] || 'N/A';
                                  
                                  // Calculate difference to determine color intensity
                                  const difference = calculateDifference(currentValue, kidneyValue);
                                  
                                  // Get background color based on difference
                                  const backgroundColor = getBackgroundColor(difference);
                                  
                                  return (
                                    <td 
                                      key={featureIdx} 
                                      className="feature-column"
                                      style={{ backgroundColor }}
                                    >
                                      <span className="feature-value">{kidneyValue}</span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* T-SNE VISUALIZATION TAB CONTENT */}
              {activeTab === 'tsne' && (
                <div className="tsne-tab">
                  {/* Filter controls for the T-SNE visualization, same as UMAP */}
                  <div className="umap-filter-controls">
                    <button 
                      className={`filter-button ${showOnlyAccepted ? 'active' : ''}`}
                      onClick={() => setShowOnlyAccepted(!showOnlyAccepted)}
                    >
                      {showOnlyAccepted ? 'Show All Kidneys' : 'Show Only Accepted'}
                    </button>
                    
                    <button 
                      className={`filter-button ${showNearestRejected ? 'active' : ''}`}
                      onClick={() => setShowNearestRejected(!showNearestRejected)}
                    >
                      {showNearestRejected ? 'Hide Nearest Rejected' : 'Show 10 Nearest Rejected'}
                    </button>
                    
                    {/* Information about how many rejected kidneys are shown */}
                    {showNearestRejected && (
                      <span className="filter-info">
                        Showing {nearestRejectedIds.length} nearest rejected kidneys
                      </span>
                    )}
                  </div>
                  
                  {/* Canvas container for the T-SNE visualization */}
                  <div className="canvas-container">
                    {/* Show loading spinner while T-SNE is being calculated */}
                    {isLoadingTsne ? (
                      <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Generating T-SNE visualization...</p>
                      </div>
                    ) : tsneError ? (
                      /* Show error message if T-SNE calculation failed */
                      <div className="error-container">
                        <p className="error-message">{tsneError}</p>
                        <button onClick={generateTsne} className="retry-button">
                          Retry
                        </button>
                      </div>
                    ) : (
                      /* Canvas for T-SNE visualization with mouse event handlers */
                      <canvas 
                        ref={canvasRef}
                        onMouseMove={handleCanvasMouseMove}
                        onClick={handleCanvasClick}
                        className="visualization-canvas"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <style jsx>{`
        /* Modal styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }

        .similar-modal {
          background-color: white;
          border-radius: 12px;
          width: 90%;
          max-width: 1000px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          position: relative;
          animation: modalFadeIn 0.3s ease-out;
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #eee;
          position: sticky;
          top: 0;
          background-color: white;
          z-index: 10;
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
        }

        .modal-tabs {
          display: flex;
          border-bottom: 1px solid #e0e6ed;
          background-color: #f8fafc;
          position: sticky;
          top: 60px;
          z-index: 5;
        }

        .tab-btn {
          padding: 16px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 15px;
          font-weight: 600;
          color: #7f8c8d;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: #2c3e50;
        }

        .tab-btn.active {
          color: #2196F3;
          border-bottom-color: #2196F3;
        }

        .tab-content {
          padding: 24px;
        }

        .modal-header h2 {
          margin: 0;
          color: #333;
          font-size: 22px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #666;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .close-btn:hover {
          background-color: #f5f5f5;
          color: #333;
        }

        .modal-content {
          padding: 0;
        }

        .loading-indicator {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px 20px;
          font-size: 16px;
          color: #666;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(33, 150, 243, 0.1);
          border-radius: 50%;
          border-top-color: #2196F3;
          animation: spin 1s ease-in-out infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          background-color: #ffebee;
          color: #d32f2f;
          padding: 20px;
          border-radius: 8px;
          margin: 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .error-message i {
          font-size: 24px;
        }

        .error-message h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }

        .error-message p {
          margin: 0;
          font-size: 14px;
        }

        .current-kidney-card,
        .summary-card,
        .similar-kidneys-card,
        .feature-comparison-card,
        .all-features-card {
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          margin-bottom: 24px;
        }

        .card-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          background-color: #f8fafc;
        }

        .card-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 18px;
          font-weight: 600;
        }

        .card-content {
          padding: 20px;
        }

        .kidney-metrics {
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
          gap: 20px;
        }

        .metric {
          text-align: center;
          padding: 16px;
          background-color: #f8fafc;
          border-radius: 8px;
          min-width: 120px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 14px;
          color: #7f8c8d;
          font-weight: 500;
        }

        .results-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        @media (min-width: 768px) {
          .results-container.with-grid {
            display: grid;
            grid-template-columns: 1fr 2fr;
          }
        }

        .summary-card {
          display: flex;
          flex-direction: column;
        }

        .summary-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 40px;
          padding: 18px 0;
        }

        .acceptance-gauge {
          position: relative;
          width: 160px;
          height: 160px;
          margin: 0 auto;
        }

        .gauge-value {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          position: relative;
        }

        .gauge-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 70%;
          height: 70%;
          background-color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gauge-center span {
          font-size: 24px;
          font-weight: 700;
          color: #2c3e50;
        }

        .gauge-label {
          text-align: center;
          margin-top: 16px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #7f8c8d;
          font-weight: 500;
        }

        .acceptance-stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          width: 100%;
        }

        .stat {
          text-align: center;
          min-width: 80px;
        }

        .similar-kidneys-table-container,
        .feature-comparison-table-container,
        .all-features-table-container {
          overflow-x: auto;
          border-radius: 8px;
        }

        .similar-kidneys-table,
        .feature-comparison-table,
        .all-features-table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 8px;
          overflow: hidden;
        }

        .similar-kidneys-table th,
        .similar-kidneys-table td,
        .feature-comparison-table th,
        .feature-comparison-table td,
        .all-features-table th,
        .all-features-table td {
          padding: 14px 16px;
          text-align: center;
        }

        .similar-kidneys-table th,
        .feature-comparison-table th,
        .all-features-table th {
          background-color: #f8fafc;
          font-weight: 600;
          color: #2c3e50;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .similar-kidneys-table tr,
        .feature-comparison-table tr,
        .all-features-table tr {
          border-bottom: 1px solid #e0e6ed;
        }

        .similar-kidneys-table tr:last-child,
        .feature-comparison-table tr:last-child,
        .all-features-table tr:last-child {
          border-bottom: none;
        }

        .similar-kidneys-table tr.accepted,
        .accepted-cell {
          background-color: rgba(76, 175, 80, 0.05);
        }

        .similar-kidneys-table tr.rejected,
        .rejected-cell {
          background-color: rgba(244, 67, 54, 0.05);
        }

        .similar-kidneys-table tr:hover,
        .feature-comparison-table tr:hover,
        .all-features-table tr:hover {
          background-color: rgba(0, 0, 0, 0.02);
        }

        .feature-name {
          font-weight: 600;
          text-align: left !important;
        }

        .outcome-badge {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .outcome-badge.success {
          background-color: #4CAF50;
          color: white;
        }

        .outcome-badge.failure {
          background-color: #F44336;
          color: white;
        }

        .no-results {
          padding: 60px 20px;
          text-align: center;
          color: #7f8c8d;
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .no-results-icon {
          font-size: 48px;
          color: #bdc3c7;
          margin-bottom: 20px;
        }

        .no-results h3 {
          margin: 0 0 12px 0;
          color: #2c3e50;
          font-size: 20px;
        }

        .no-results p {
          margin: 0;
          color: #7f8c8d;
        }

        .umap-container {
          padding: 24px;
        }

        .loading-umap {
          text-align: center;
          padding: 60px 20px;
          font-size: 16px;
          color: #666;
        }

        .umap-error {
          background-color: #ffebee;
          color: #d32f2f;
          padding: 20px;
          border-radius: 8px;
          margin: 24px;
        }

        .umap-image-container {
          position: relative;
          padding: 24px;
        }

        .umap-image {
          width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .umap-description {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px;
          background-color: rgba(255, 255, 255, 0.8);
          border-radius: 0 0 8px 8px;
        }

        .umap-tab {
          text-align: center;
          padding: 12px;
          width: 100%;
        }

        .canvas-container {
          margin: 0 auto;
          width: 100%;
          max-width: 700px;
        }

        .visualization-description {
          text-align: left;
          padding: 16px;
          background-color: #f8fafc;
          border-radius: 8px;
          margin-top: 16px;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
        }

        .comparison-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .comparison-section {
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }

        .comparison-section h3 {
          margin: 0 0 16px 0;
          color: #2c3e50;
          font-size: 18px;
          font-weight: 600;
        }

        .comparison-section p {
          margin: 0 0 16px 0;
          color: #7f8c8d;
        }

        .comparison-metrics {
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }

        .metrics-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .metric-card {
          background-color: #f8fafc;
          border-radius: 8px;
          padding: 16px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 14px;
          color: #7f8c8d;
          font-weight: 500;
        }

        .metric-description {
          font-size: 12px;
          color: #7f8c8d;
        }

        .filter-controls {
          background-color: #f8fafc;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
        }
        
        .filter-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .filter-header h4 {
          margin: 0;
          font-size: 16px;
          color: #2c3e50;
          font-weight: 600;
        }
        
        .info-tooltip-container {
          position: relative;
          margin-left: 8px;
        }
        
        .info-button {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          font-size: 16px;
        }
        
        .tooltip {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background-color: #334155;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          width: 200px;
          z-index: 10;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .slider-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .slider-label {
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }
        
        .slider-with-value {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 12px;
        }
        
        .kidney-slider {
          flex: 1;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: #e2e8f0;
          border-radius: 3px;
          outline: none;
        }
        
        .kidney-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .kidney-slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }
        
        .kidney-count-input {
          width: 50px;
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          text-align: center;
          font-size: 14px;
        }
        
        .features-table-container {
          overflow-x: auto;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
        }
        
        .features-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        
        .features-header-row {
          background-color: #f1f5f9;
        }
        
        .features-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #334155;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
        }
        
        .features-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .kidney-column {
          width: 80px;
        }
        
        .distance-column {
          width: 100px;
        }
        
        .outcome-column {
          width: 120px;
        }
        
        .feature-column {
          min-width: 100px;
        }
        
        .kidney-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .kidney-badge.original {
          background-color: #3b82f6;
          color: white;
        }
        
        .kidney-badge.similar {
          background-color: #f1f5f9;
          color: #334155;
        }
        
        .original-kidney-row {
          background-color: rgba(59, 130, 246, 0.05);
          border-left: 3px solid #3b82f6;
        }
        
        .kidney-row:hover {
          background-color: #f8fafc;
        }
        
        .accepted-row {
          border-left: 3px solid #10b981;
        }
        
        .rejected-row {
          border-left: 3px solid #ef4444;
        }
        
        .distance-value {
          font-family: monospace;
          font-size: 13px;
          color: #475569;
        }
        
        .feature-value {
          font-family: system-ui, -apple-system, sans-serif;
          color: #334155;
        }
        
        .outcome-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .outcome-badge.success {
          background-color: #10b981;
          color: white;
        }
        
        .outcome-badge.failure {
          background-color: #ef4444;
          color: white;
        }

        .color-legend {
          margin: 12px 0;
          padding: 8px 12px;
          background-color: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
        }

        .legend-title {
          font-weight: 600;
          margin-bottom: 6px;
          color: #334155;
        }

        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .color-sample {
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }

        .no-data-message {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #64748b;
          font-size: 16px;
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .umap-filter-controls {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 15px;
          gap: 10px;
        }

        .filter-button {
          padding: 8px 16px;
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-button:hover {
          background-color: #e2e8f0;
        }

        .filter-button.active {
          background-color: #3b82f6;
          color: white;
          border-color: #2563eb;
        }

        .table-filter-controls {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 15px;
        }

        .table-filter-controls .filter-button {
          padding: 8px 16px;
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s;
        }

        .table-filter-controls .filter-button:hover {
          background-color: #e2e8f0;
        }

        .table-filter-controls .filter-button.active {
          background-color: #3b82f6;
          color: white;
          border-color: #2563eb;
        }

        .tsne-tab {
          text-align: center;
          padding: 12px;
          width: 100%;
        }

        .canvas-container {
          margin: 0 auto;
          width: 100%;
          max-width: 700px;
        }

        .visualization-canvas {
          width: 100%;
          height: 500px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background-color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          background-color: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(33, 150, 243, 0.3);
          border-radius: 50%;
          border-top-color: #2196F3;
          animation: spin 1s ease-in-out infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          background-color: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .error-message {
          color: #d32f2f;
          font-size: 16px;
          margin-bottom: 20px;
        }

        .retry-button {
          padding: 10px 20px;
          background-color: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .retry-button:hover {
          background-color: #1976D2;
        }

        .filter-info {
          color: #7f8c8d;
          font-size: 14px;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
};

export default SimilarKidneysModal; 