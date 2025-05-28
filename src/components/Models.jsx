/**
 * Models.jsx
 * 
 * This component provides a comprehensive interface for running, analyzing, and comparing
 * kidney transplant prediction models. It allows users to:
 * - Select from uploaded data files
 * - Run multiple prediction models simultaneously
 * - Compare prediction results across models
 * - Find similar kidney profiles for comparison
 * - Visualize data with interactive charts
 */
import React, { useState, useEffect, useRef } from 'react';
import SimilarKidneysModal from './SimilarKidneysModal';

// Sample model data - in a real app, this would come from your backend
// These models serve as fallback data if API calls fail
const sampleModels = [
  {
    id: 1,
    name: "Kidney Viability Predictor",
    type: "XGBoost",
    description: "Predicts the viability of kidney transplants based on donor and recipient characteristics",
    accuracy: 0.89,
    lastUpdated: "2023-10-15",
    parameters: {
      max_depth: 6,
      learning_rate: 0.1,
      n_estimators: 100,
      objective: "binary:logistic",
      booster: "gbtree",
      gamma: 0,
      min_child_weight: 1,
      subsample: 0.8,
      colsample_bytree: 0.8,
      reg_alpha: 0,
      reg_lambda: 1
    },
    features: ["donor_age", "donor_bmi", "cold_ischemia_time", "hla_mismatch", "recipient_age", "recipient_bmi", "dialysis_duration"]
  },
  {
    id: 2,
    name: "Liver Transplant Outcome Model",
    type: "XGBoost",
    description: "Predicts post-transplant outcomes for liver recipients",
    accuracy: 0.85,
    lastUpdated: "2023-09-22",
    parameters: {
      max_depth: 5,
      learning_rate: 0.05,
      n_estimators: 150,
      objective: "multi:softprob",
      booster: "gbtree",
      gamma: 0.1,
      min_child_weight: 2,
      subsample: 0.7,
      colsample_bytree: 0.7,
      reg_alpha: 0.1,
      reg_lambda: 0.5
    },
    features: ["donor_age", "meld_score", "cold_ischemia_time", "recipient_diagnosis", "donor_cause_of_death", "recipient_age", "previous_abdominal_surgery"]
  },
  {
    id: 3,
    name: "Heart Transplant Survival Predictor",
    type: "XGBoost",
    description: "Predicts 1-year and 5-year survival rates for heart transplant recipients",
    accuracy: 0.82,
    lastUpdated: "2023-11-05",
    parameters: {
      max_depth: 4,
      learning_rate: 0.08,
      n_estimators: 120,
      objective: "binary:logistic",
      booster: "gbtree",
      gamma: 0.2,
      min_child_weight: 1.5,
      subsample: 0.9,
      colsample_bytree: 0.9,
      reg_alpha: 0.01,
      reg_lambda: 1.2
    },
    features: ["donor_age", "ischemic_time", "recipient_diagnosis", "recipient_age", "recipient_gender", "previous_cardiac_surgery", "ventilator_support"]
  }
];

const Models = () => {
  // State to store available prediction models fetched from the backend
  const [models, setModels] = useState([]);
  // State to store files uploaded by the user (loaded from localStorage)
  const [uploadedFiles, setUploadedFiles] = useState([]);
  // Currently selected file ID for analysis
  const [selectedFile, setSelectedFile] = useState(null);
  // Loading state for async operations
  const [isLoading, setIsLoading] = useState(false);
  // Error messages from API calls or data processing
  const [error, setError] = useState(null);
  // Results from all prediction models
  const [allPredictions, setAllPredictions] = useState([]);
  // Track missing features required by models but not present in input data
  const [missingFeatures, setMissingFeatures] = useState({});
  // Parsed data from the selected file
  const [fileData, setFileData] = useState(null);
  // Similar kidney records found for comparison
  const [similarKidneys, setSimilarKidneys] = useState([]);
  // Controls visibility of the similar kidneys modal
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  // Currently selected record for similar kidney comparison
  const [selectedRecord, setSelectedRecord] = useState(null);
  // Currently selected model for similar kidney comparison
  const [selectedModel, setSelectedModel] = useState(null);
  // Reference to the modal DOM element for click-outside detection
  const modalRef = useRef(null);
  // Reference data for each city, loaded on demand
  const [referenceData, setReferenceData] = useState({
    Baltimore: null,
    Boston: null,
    LA: null
  });
  // Loading state for reference data
  const [loadingReference, setLoadingReference] = useState(false);
  // Error messages specific to reference data loading
  const [referenceError, setReferenceError] = useState(null);
  // Track which result sections are expanded to show all records
  const [showAllResults, setShowAllResults] = useState({});
  // Controls visibility of the details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // Record to display in the details modal
  const [detailsRecord, setDetailsRecord] = useState(null);
  // Active tab in the details modal
  const [activeTab, setActiveTab] = useState('city');
  // Reference to the details modal DOM element
  const detailsModalRef = useRef(null);
  // Reference records for comparison in details modal
  const [referenceRecords, setReferenceRecords] = useState([]);
  // Probability values for reference records
  const [referenceProbabilities, setReferenceProbabilities] = useState([]);
  // Number of top kidneys to display in results
  const [topKidneysCount, setTopKidneysCount] = useState(10);

  // Updated Average KDPI (Kidney Donor Profile Index) by CTR (Center for Transplant Registry) code
  // These values represent the average KDPI for each transplant center
  const avgKdpiByCtr = {
    '13051': 0.5976591375770022,
    '24552': 0.48170124481327803,
    '23901': 0.45426267281106,
    '2573': null,
    '651': null,
    '12958': 0.2892258064516129,
    '13237': 0.31423913043478263,
    '6727': null,
    '24335': 0.3833561643835616,
    '2666': null,
    '24800': 0.45672727272727276
  };

  // Updated Average KDPI by City
  // These values represent the average KDPI for each city region
  const avgKdpiByCity = {
    'LA': 0.5038325991189427,
    'Boston': 0.3300508905852417,
    'Baltimore': 0.45672727272727276
  };

  // Important features for each city used in similarity calculations
  // These features have been identified as most significant for each region
  const importantFeatures = {
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

  // Mapping from transplant center codes to city names
  // Used to identify which city a transplant center belongs to
  const ctrCodeToCity = {
    '13051': 'LA',
    '24552': 'LA',
    '23901': 'LA',
    '2573': 'LA',
    '651': 'Boston',
    '12958': 'Boston',
    '13237': 'Boston',
    '6727': 'Boston',
    '24335': 'Boston',
    '2666': 'Baltimore',
    '24800': 'Baltimore'
  };

  // Alternative mapping format from cities to transplant center codes
  // Used for city-based filtering and grouping
  const cityToCtrCodes = {
    'LA': ['13051', '24552', '23901', '2573'],
    'Boston': ['651', '12958', '13237', '6727', '24335'],
    'Baltimore': ['2666', '24800']
  };

  /**
   * Gets the average KDPI value for a model based on its name
   * Used to display comparative KDPI data in the UI
   * 
   * @param {string} modelName - The name of the model to look up
   * @returns {number|null} - The average KDPI value or null if not found
   */
  const getAvgKdpiForModel = (modelName) => {
    // Check if it's a baseline model
    if (modelName.includes('Baseline')) {
      if (modelName.includes('Boston')) return avgKdpiByCity['Boston'];
      if (modelName.includes('LA')) return avgKdpiByCity['LA'];
      if (modelName.includes('Baltimore')) return avgKdpiByCity['Baltimore'];
      return null;
    }
    
    // Check if it's a facility model
    for (const ctrCode in avgKdpiByCtr) {
      if (modelName.includes(ctrCode)) {
        return avgKdpiByCtr[ctrCode];
      }
    }
    
    return null;
  };

  /**
   * Extracts the city name from a model name
   * Used to associate models with specific geographic regions
   * 
   * @param {string} modelName - The name of the model to analyze
   * @returns {string|null} - The extracted city name or null if not found
   */
  const getCityFromModelName = (modelName) => {
    if (modelName.includes('Baltimore')) return 'Baltimore';
    if (modelName.includes('Boston')) return 'Boston';
    if (modelName.includes('LA')) return 'LA';
    
    // Check for CTR codes
    for (const ctrCode in ctrCodeToCity) {
      if (modelName.includes(ctrCode)) {
        return ctrCodeToCity[ctrCode];
      }
    }
    
    return null;
  };

  /**
   * Enhanced function to retrieve a value from an object with case-insensitive key matching
   * Helps handle inconsistent case in data fields across different data sources
   * 
   * @param {Object} obj - The object to search in
   * @param {string} key - The key to look for (case-insensitive)
   * @returns {*} - The value if found, null otherwise
   */
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

  /**
   * Calculates the Euclidean distance between two records based on specified features
   * Used to find similar kidney records by comparing feature values
   * 
   * @param {Object} record1 - First record to compare
   * @param {Object} record2 - Second record to compare
   * @param {Array<string>} features - Array of feature names to include in comparison
   * @returns {number} - The calculated distance (lower values mean more similar)
   */
  const calculateEuclideanDistance = (record1, record2, features) => {
    let sumSquaredDiff = 0;
    let validFeatureCount = 0;
    
    for (const feature of features) {
      // Get values with case-insensitive matching
      const val1 = getValueCaseInsensitive(record1, feature);
      const val2 = getValueCaseInsensitive(record2, feature);
      
      // Skip if either value doesn't exist
      if (val1 === null || val2 === null) {
        continue;
      }
      
      // Try to convert to numbers
      const num1 = parseFloat(val1);
      const num2 = parseFloat(val2);
      
      // Skip if either value is not a number
      if (isNaN(num1) || isNaN(num2)) {
        continue;
      }
      
      // Calculate squared difference
      const diff = num1 - num2;
      sumSquaredDiff += diff * diff;
      validFeatureCount++;
    }
    
    // If no valid features were found, return Infinity
    if (validFeatureCount === 0) {
      return Infinity;
    }
    
    // Return the square root of the average squared difference
    return Math.sqrt(sumSquaredDiff / validFeatureCount);
  };

  /**
   * Loads reference data for a specific city from the backend API
   * Caches the data in state to avoid redundant API calls
   * 
   * @param {string} city - The city to load reference data for (Baltimore, Boston, LA)
   * @returns {Promise<Array|null>} - The reference data or null if an error occurs
   */
  const loadReferenceData = async (city) => {
    if (referenceData[city]) {
      // Data already loaded
      return referenceData[city];
    }
    
    setLoadingReference(true);
    setReferenceError(null);
    
    try {
      const response = await fetch(`http://localhost:5001/api/reference-data/${city}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reference data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Loaded ${data.length} reference records for ${city}`);
      
      // Update the reference data state
      setReferenceData(prev => ({
        ...prev,
        [city]: data
      }));
      
      return data;
    } catch (error) {
      console.error(`Error loading reference data for ${city}:`, error);
      setReferenceError(`Failed to load reference data for ${city}: ${error.message}`);
      return null;
    } finally {
      setLoadingReference(false);
    }
  };

  /**
   * Finds similar kidneys to a selected record using Euclidean distance
   * Compares the selected kidney with reference data based on important features
   * 
   * @param {number} recordId - ID of the record to find similar kidneys for
   * @param {string} modelName - Name of the model (used to determine city/region)
   * @returns {Promise<Array>} - Array of similar kidney records with distance metrics
   */
  const findSimilarKidneys = async (recordId, modelName) => {
    // Get the record from the uploaded data
    if (!fileData || !Array.isArray(fileData) || recordId >= fileData.length) {
      console.error('Invalid record ID or file data');
      return [];
    }
    
    const record = fileData[recordId];
    if (!record) {
      console.error('Record not found');
      return [];
    }
    
    // Get the city for this model
    const city = getCityFromModelName(modelName);
    if (!city) {
      console.error('Could not determine city for model:', modelName);
      return [];
    }
    
    // Get the important features for this city
    const features = importantFeatures[city];
    if (!features || !features.length) {
      console.error('No important features found for city:', city);
      return [];
    }
    
    // Load reference data for this city if not already loaded
    let cityReferenceData = referenceData[city];
    if (!cityReferenceData) {
      try {
        const response = await fetch(`http://localhost:5001/api/reference-data/${city}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch reference data: ${response.status} ${response.statusText}`);
        }
        
        cityReferenceData = await response.json();
        console.log(`Loaded ${cityReferenceData.length} reference records for ${city}`);
        
        // Update the reference data state
        setReferenceData(prev => ({
          ...prev,
          [city]: cityReferenceData
        }));
      } catch (error) {
        console.error(`Error loading reference data for ${city}:`, error);
        setReferenceError(`Failed to load reference data for ${city}: ${error.message}`);
        return [];
      }
    }
    
    if (!cityReferenceData || cityReferenceData.length === 0) {
      console.error(`No reference data available for ${city}`);
      return [];
    }
    
    // Calculate distances for all records in the reference dataset
    const distances = cityReferenceData.map((refRecord, index) => {
      const distance = calculateEuclideanDistance(record, refRecord, features);
      return { 
        index, 
        distance, 
        record: refRecord,
        accepted: refRecord.OFFER_ACCEPT === '1' || refRecord.OFFER_ACCEPT === 1
      };
    });
    
    // Sort by distance and take the top results
    // Lower distance means more similar
    const sortedDistances = distances
      .filter(d => d.distance !== Infinity)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 1000);
    
    return sortedDistances;
  };

  // Function to handle "Find Similar" button click
  const handleFindSimilar = async (recordId, modelName) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Determine if this is a baseline model
      const isBaselineModel = modelName.toLowerCase().includes('baseline');
      
      // Get the selected kidney data
      const selectedKidney = fileData[recordId];
      if (!selectedKidney) {
        throw new Error(`Record #${recordId} not found in the uploaded data`);
      }
      
      console.log(`Finding similar kidneys for ${modelName} (Baseline: ${isBaselineModel})`);
      console.log('Selected kidney:', selectedKidney);
      
      // Set the selected record and model
      setSelectedRecord(selectedKidney);
      setSelectedModel(modelName);
    
      // Show the similar kidneys modal
      setShowSimilarModal(true);
      
      // Find similar kidneys
      const similarResults = await findSimilarKidneys(recordId, modelName);
      console.log(`Found ${similarResults.length} similar kidneys`);
      setSimilarKidneys(similarResults);
      
    } catch (err) {
      console.error('Error finding similar kidneys:', err);
      setError(`Failed to find similar kidneys: ${err.message}`);
      setReferenceError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to close the modal
  const closeModal = () => {
    setShowSimilarModal(false);
    setSimilarKidneys([]);
    setSelectedRecord(null);
    setSelectedModel(null);
    setReferenceError(null);
  };

  // Add this useEffect to handle clicking outside the modal to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        closeModal();
      }
    };

    if (showSimilarModal) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSimilarModal]);

  // Fetch models from backend
  useEffect(() => {
    const fetchModels = async () => {
      try {
        console.log('Fetching models from backend...');
        const response = await fetch('http://localhost:5001/api/models');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Models loaded:', data);
        setModels(data);
      } catch (error) {
        console.error('Error fetching models:', error);
        setError(`Failed to load models: ${error.message}. Please check if the backend server is running.`);
      }
    };

    fetchModels();
    
    // Get uploaded files from localStorage
    const storedFiles = localStorage.getItem('uploadedFiles');
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles);
        console.log('Loaded files from localStorage:', parsedFiles);
        setUploadedFiles(parsedFiles);
      } catch (e) {
        console.error('Error parsing files from localStorage:', e);
      }
    } else {
      console.log('No files found in localStorage');
    }
  }, []);

  const handleFileSelect = (e) => {
    const fileId = e.target.value;
    setSelectedFile(fileId);
    setAllPredictions([]);
    setMissingFeatures({});
    setError(null);
    
    // Load the file data
    if (fileId) {
      const selectedFileObj = uploadedFiles.find(f => f.id.toString() === fileId);
      if (selectedFileObj) {
        let fileDataArray = selectedFileObj.data;
        
        // Check if data is in the expected format
        if (fileDataArray.allRows && Array.isArray(fileDataArray.allRows)) {
          fileDataArray = fileDataArray.allRows;
        }
        
        setFileData(fileDataArray);
      }
    } else {
      setFileData(null);
    }
  };

  const runAllPredictions = async () => {
    if (!selectedFile) {
      setError('Please select a data file first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAllPredictions([]);
    setMissingFeatures({});
    
    try {
      // Find the selected file object from the uploadedFiles array based on its ID
      const fileObj = uploadedFiles.find(f => f.id.toString() === selectedFile);
      if (!fileObj) {
        // Throw error if file not found - important for error handling
        throw new Error('Selected file not found');
      }
      
      console.log('Selected file:', fileObj);
      
      // Extract the actual data from the file object
      let fileData = fileObj.data;
      
      // Handle different data formats - sometimes the data is wrapped in an allRows property
      // This ensures consistent data structure regardless of source format
      if (fileData.allRows && Array.isArray(fileData.allRows)) {
        fileData = fileData.allRows;
      } else if (!Array.isArray(fileData)) {
        // Ensure we have an array of records, otherwise the predictions won't work
        throw new Error('Invalid data format. Expected an array of records.');
      }
      
      console.log('File data sample:', fileData.slice(0, 2));
      
      // Extract all feature names from the first record to identify available columns
      const availableFeatures = Object.keys(fileData[0] || {});
      console.log('Available features:', availableFeatures);
      
      // Remove 'utilization_probability' from required features for all models
      // This feature is the prediction target, not an input feature
      const modelsWithoutUtilization = models.map(model => {
        const features = (model.features || []).filter(f => f !== 'utilization_probability');
        return { ...model, features };
      });
      
      // Categorize models into three types for proper prediction sequence:
      // 1. Baseline models - provide basic predictions
      // 2. Facility models - use baseline predictions as inputs
      // 3. Other models - don't fit into the above categories
      const baselineModels = modelsWithoutUtilization.filter(model => 
        model.name.includes('Baseline') || model.id.includes('baseline')
      );
      
      const facilityModels = modelsWithoutUtilization.filter(model => 
        model.name.includes('Facility') || model.id.includes('facility')
      );
      
      const otherModels = modelsWithoutUtilization.filter(model => 
        !model.name.includes('Baseline') && !model.id.includes('baseline') &&
        !model.name.includes('Facility') && !model.id.includes('facility')
      );
      
      console.log('Baseline models:', baselineModels);
      console.log('Facility models:', facilityModels);
      console.log('Other models:', otherModels);
      
      // Store baseline model predictions for later use by facility models
      const baselinePredictions = [];
      // Track missing features for each model to display to the user
      const missingFeaturesMap = {};
      
      // Inner function to run predictions for a specific model and dataset
      // This is the core prediction function used for all model types
      const runModelPrediction = async (model, data) => {
        console.log(`Processing model: ${model.name}`);
        
        // Get the features required by this model
        const requiredFeatures = model.features || [];
        console.log('Required features:', requiredFeatures);
        
        // Filter out KDRI_MED and KDRI_RAO from required features
        // These are derived features that can cause issues if missing
        const filteredRequiredFeatures = requiredFeatures.filter(
          feature => feature !== 'KDRI_MED' && feature !== 'KDRI_RAO'
        );
        
        // For facility models, don't check for baseline_prob features
        // These will be added later to the enhanced data
        const featuresToCheck = model.name.includes('Facility') || model.id.includes('facility')
          ? filteredRequiredFeatures.filter(f => !f.includes('baseline_prob'))
          : filteredRequiredFeatures;
        
        // Check if any required features are missing from the data
        const missingModelFeatures = featuresToCheck.filter(
          feature => !Object.keys(data[0]).includes(feature)
        );
        
        // If there are missing features, log them and return null
        // This model will be skipped in predictions
        if (missingModelFeatures.length > 0) {
          console.log('Missing features for model:', missingModelFeatures);
          missingFeaturesMap[model.id] = missingModelFeatures;
          return null;
        }
        
        try {
          // Determine which city/region this model is for
          const city = getCityFromModelName(model.name);
          if (!city) {
            console.error(`Could not determine city for model: ${model.name}`);
            return null;
          }
          
          // Load reference data for this city if not already loaded
          // Reference data contains real-world transplant records for comparison
          let cityReferenceData = referenceData[city];
          if (!cityReferenceData) {
            try {
              // Fetch reference data from the backend API
              const response = await fetch(`http://localhost:5001/api/reference-data/${city}`);
              
              if (!response.ok) {
                throw new Error(`Failed to fetch reference data: ${response.status} ${response.statusText}`);
              }
              
              cityReferenceData = await response.json();
              console.log(`Loaded ${cityReferenceData.length} reference records for ${city}`);
              
              // Cache the reference data in state to avoid refetching
              setReferenceData(prev => ({
                ...prev,
                [city]: cityReferenceData
              }));
            } catch (error) {
              console.error(`Error loading reference data for ${city}:`, error);
              setReferenceError(`Failed to load reference data for ${city}: ${error.message}`);
              return null;
            }
          }
          
          // Ensure reference data was successfully loaded
          if (!cityReferenceData || cityReferenceData.length === 0) {
            console.error(`No reference data available for ${city}`);
            return null;
          }
          
          // Process each record in the uploaded data
          const allResults = [];
          
          for (let recordIndex = 0; recordIndex < data.length; recordIndex++) {
            const record = data[recordIndex];
            
            // Process in batches to avoid overwhelming the server
            // Create multiple hybrid records for each input record
            const totalReferences = 10; // Number of reference records to use per input record
            const batchSize = 10; // Maximum records per API call
            const numBatches = Math.ceil(totalReferences / batchSize);
            
            // Array to store all probability results
            let allProbabilities = [];
            
            // Track used indices to avoid duplicates
            const usedIndices = new Set();
            
            // Process in batches for better performance and reliability
            for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
              // Create a batch of hybrid records by combining input data with reference data
              const hybridRecordsBatch = [];
              
              // Calculate how many records to create for this batch
              const recordsToCreate = Math.min(batchSize, totalReferences - (batchIndex * batchSize));
              
              // Create hybrid records for this batch by randomly selecting reference records
              while (hybridRecordsBatch.length < recordsToCreate) {
                // Get a random reference record that hasn't been used yet
                const randomIndex = Math.floor(Math.random() * cityReferenceData.length);
                
                // Only use this record if we haven't used this index before (avoid duplicates)
                if (!usedIndices.has(randomIndex)) {
                  usedIndices.add(randomIndex);
                  const referenceRecord = cityReferenceData[randomIndex];
                  
                  // Create hybrid record: start with reference record, override with donor features
                  // This simulates placing the input kidney in different recipient scenarios
                  const hybridRecord = { ...referenceRecord };
                  
                  // Add donor features from the uploaded kidney to the reference record
                  // This preserves the donor characteristics while using different recipient data
                  Object.keys(record).forEach(key => {
                    if (key.endsWith('_DON')) {
                      hybridRecord[key] = record[key];
                    }
                  });
                  
                  // Filter to only include required features to reduce data size
                  const filteredRecord = {};
                  filteredRequiredFeatures.forEach(feature => {
                    if (feature in hybridRecord) {
                      filteredRecord[feature] = hybridRecord[feature];
                    } else {
                      filteredRecord[feature] = null;
                    }
                  });
                  
                  hybridRecordsBatch.push(filteredRecord);
                }
              }
              
              // Send this batch of hybrid records to the model API for prediction
              try {
                console.log(`Sending batch ${batchIndex + 1}/${numBatches} (${hybridRecordsBatch.length} records) for record ${recordIndex}`);
                
                // Make API call to backend prediction service
                const response = await fetch(`http://localhost:5001/api/predict/${model.id}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(hybridRecordsBatch),
                });
                
                if (!response.ok) {
                  throw new Error(`Prediction failed: ${response.status}`);
                }
                
                const result = await response.json();
                
                // Extract and store probability values from API response
                if (result && result.results && result.results.length > 0) {
                  const batchProbabilities = result.results.map(res => res.probability);
                  allProbabilities = [...allProbabilities, ...batchProbabilities];
                }
              } catch (error) {
                console.error(`Error predicting batch ${batchIndex + 1} for record ${recordIndex}:`, error);
                // Continue with next batch even if this one failed
              }
            }
            
            // Calculate average probability across all batches for this record
            // This represents the overall utilization probability across different scenarios
            if (allProbabilities.length > 0) {
              const sum = allProbabilities.reduce((acc, prob) => acc + prob, 0);
              const avgProb = sum / allProbabilities.length;
              
              // Store the result for this record
              allResults.push({
                id: recordIndex,
                probability: avgProb
              });
              
              console.log(`Record ${recordIndex}: Processed ${allProbabilities.length} reference organs, avg probability: ${avgProb}`);
            } else {
              // Handle case where no valid probabilities were obtained
              allResults.push({
                id: recordIndex,
                probability: 0
              });
              
              console.log(`Record ${recordIndex}: No valid probabilities`);
            }
          }
          
          // Calculate overall average probability across all records
          // This represents the model's overall prediction for the entire dataset
          const avgProbability = allResults.reduce(
            (sum, item) => sum + item.probability, 
            0
          ) / allResults.length;
          
          // Return complete prediction results for this model
          return {
            modelId: model.id,
            modelName: model.name,
            modelType: model.type || 'XGBoost',
            avgProbability: avgProbability,
            results: allResults,
            accuracy: model.accuracy || 0.8
          };
        } catch (modelError) {
          console.error(`Error with model ${model.name}:`, modelError);
          return null;
        }
      };
      
      // Step 1: Run baseline models first
      // These models provide initial probability estimates
      for (const model of baselineModels) {
        const prediction = await runModelPrediction(model, fileData);
        if (prediction) {
          baselinePredictions.push(prediction);
        }
      }
      
      console.log('Baseline predictions:', baselinePredictions);
      
      // Step 2: Prepare enhanced data for facility models by adding baseline probabilities
      // Facility models use baseline predictions as input features
      const enhancedData = fileData.map((record, index) => {
        const enhancedRecord = { ...record };
        
        // Add baseline probabilities from corresponding baseline models
        // Match each baseline model to its appropriate city
        baselinePredictions.forEach(prediction => {
          const area = prediction.modelName.includes('Boston') ? 'Boston' : 
                      prediction.modelName.includes('LA') ? 'LA' : 
                      prediction.modelName.includes('Baltimore') ? 'Baltimore' : '';
          
          if (area && index < prediction.results.length) {
            // Add city-specific baseline probability
            enhancedRecord[`${area}_baseline_prob`] = prediction.results[index].probability;
            // Also add a generic baseline_prob for backward compatibility
            enhancedRecord['baseline_prob'] = prediction.results[index].probability;
          }
        });
        
        return enhancedRecord;
      });
      
      console.log('Enhanced data with baseline probabilities:', enhancedData.slice(0, 2));
      
      // Step 3: Run facility models with enhanced data
      // These models use both original features and baseline probabilities
      const facilityPredictions = [];
      
      for (const model of facilityModels) {
        // Determine which baseline probability to use based on the facility's location
        let baselineProbField = 'baseline_prob';
        
        if (model.name.includes('Boston')) {
          baselineProbField = 'Boston_baseline_prob';
        } else if (model.name.includes('LA')) {
          baselineProbField = 'LA_baseline_prob';
        } else if (model.name.includes('Baltimore')) {
          baselineProbField = 'Baltimore_baseline_prob';
        }
        
        // Create a copy of the model with updated feature requirements
        // This ensures the model uses the correct city-specific baseline probability
        const updatedModel = { 
          ...model,
          features: (model.features || []).map(f => 
            f === 'baseline_prob' ? baselineProbField : f
          )
        };
        
        const prediction = await runModelPrediction(updatedModel, enhancedData);
        if (prediction) {
          facilityPredictions.push(prediction);
        }
      }
      
      console.log('Facility predictions:', facilityPredictions);
      
      // Step 4: Run any other models that don't fit into the baseline/facility categories
      const otherPredictions = [];
      
      for (const model of otherModels) {
        const prediction = await runModelPrediction(model, fileData);
        if (prediction) {
          otherPredictions.push(prediction);
        }
      }
      
      // Step 5: Combine all predictions from all model types
      const allModelPredictions = [
        ...baselinePredictions,
        ...facilityPredictions,
        ...otherPredictions
      ];
      
      // Sort predictions by average probability (highest first) for display
      const sortedPredictions = allModelPredictions.sort(
        (a, b) => b.avgProbability - a.avgProbability
      );
      
      console.log('All predictions:', sortedPredictions);
      
      // Update state with all prediction results and missing features
      setAllPredictions(sortedPredictions);
      setMissingFeatures(missingFeaturesMap);
      
      // Display appropriate error messages if no predictions could be generated
      if (sortedPredictions.length === 0 && Object.keys(missingFeaturesMap).length > 0) {
        setError('None of the models could be used with this data due to missing features.');
      } else if (sortedPredictions.length === 0) {
        setError('No predictions could be generated. Please check the console for details.');
      }
    } catch (error) {
      // Handle any unexpected errors during the prediction process
      console.error('Prediction error:', error);
      setError(error.message || 'An error occurred during prediction');
    } finally {
      // Always reset loading state when done, regardless of success or failure
      setIsLoading(false);
    }
  };

  /**
   * Scrolls the view to a specific model's detailed results section
   * Used when clicking "View Details" in the summary table
   * 
   * @param {string} modelId - ID of the model to scroll to
   */
  const scrollToModelDetails = (modelId) => {
    const element = document.getElementById(`model-details-${modelId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Extracts the KDPI (Kidney Donor Profile Index) value from a record
   * Handles different possible formats and casing of the KDPI field
   * 
   * @param {number} recordId - ID of the record to get KDPI from
   * @returns {string} - The KDPI value or 'N/A' if not found
   */
  const getKdpiFromData = (recordId) => {
    if (!fileData || !Array.isArray(fileData) || recordId >= fileData.length) {
      console.log('No file data available or invalid record ID:', recordId);
      return 'N/A';
    }
    
    const record = fileData[recordId];
    if (!record) {
      console.log('Record not found for ID:', recordId);
      return 'N/A';
    }
    
    console.log('Record data for KDPI extraction:', record);
    
    // Look for exact KDPI column first
    if (record.KDPI !== undefined) {
      return `${record.KDPI}`;
    }
    
    // If not found, try case-insensitive match but only for exact "KDPI" (not partial matches)
    const keys = Object.keys(record);
    const kdpiKey = keys.find(key => key.toUpperCase() === 'KDPI');
    
    if (kdpiKey) {
      return `${record[kdpiKey]}`;
    }
    
    console.log('KDPI not found in record');
    return 'N/A';
  };

  /**
   * Formats a KDPI value for display
   * Ensures consistent formatting with 5 decimal places
   * 
   * @param {number} kdpi - KDPI value to format
   * @returns {string} - Formatted KDPI value or 'N/A' if null/undefined
   */
  const formatKdpi = (kdpi) => {
    if (kdpi === null || kdpi === undefined) return 'N/A';
    return kdpi.toFixed(5); // Display as decimal with 5 decimal places
  };

  // This variable holds all predictions without filtering out baseline models
  // Previous versions may have excluded baseline models from display
  const displayPredictions = allPredictions;

  /**
   * Displays all features for a specific kidney record in an alert dialog
   * Provides a quick way to inspect record details
   * 
   * @param {number} recordId - ID of the record to show features for
   */
  const handleShowFeatures = (recordId) => {
    if (!fileData || recordId >= fileData.length) {
      console.log('No file data available or invalid record ID:', recordId);
      return;
    }
    
    const record = fileData[recordId];
    if (!record) {
      console.log('Record not found for ID:', recordId);
      return;
    }
    
    // Create a formatted string of features
    const featuresText = Object.entries(record)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    // Show features in an alert or modal
    alert(`Features for Record #${recordId}:\n\n${featuresText}`);
    
    // Alternatively, you could implement a modal to show this information
    // in a more user-friendly way
  };

  /**
   * Toggles the expanded/collapsed state of a model's results table
   * Controls whether all records are shown or just the top ones
   * 
   * @param {string} modelId - ID of the model to toggle results for
   */
  const toggleShowAllResults = (modelId) => {
    setShowAllResults(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  const handleShowMoreInfo = async (recordId, modelId) => {
    if (!fileData || recordId >= fileData.length) {
      console.log('No file data available or invalid record ID:', recordId);
      return;
    }
    
    const record = fileData[recordId];
    if (!record) {
      console.log('Record not found for ID:', recordId);
      return;
    }
    
    // Set the record for the modal
    setDetailsRecord(record);
    setActiveTab('city');
    setShowDetailsModal(true);
    
    // Find the model
    const model = models.find(m => m.id === modelId);
    if (!model) {
      console.error('Model not found:', modelId);
      return;
    }
    
    // Get the city for this model
    const city = getCityFromModelName(model.name);
    if (!city) {
      console.error('Could not determine city for model:', model.name);
      return;
    }
    
    // Load reference data for this city if not already loaded
    let cityReferenceData = referenceData[city];
    if (!cityReferenceData) {
      try {
        const response = await fetch(`http://localhost:5001/api/reference-data/${city}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch reference data: ${response.status} ${response.statusText}`);
        }
        
        cityReferenceData = await response.json();
        console.log(`Loaded ${cityReferenceData.length} reference records for ${city}`);
        
        // Update the reference data state
        setReferenceData(prev => ({
          ...prev,
          [city]: cityReferenceData
        }));
      } catch (error) {
        console.error(`Error loading reference data for ${city}:`, error);
        setReferenceError(`Failed to load reference data for ${city}: ${error.message}`);
        return;
      }
    }
    
    if (!cityReferenceData || cityReferenceData.length === 0) {
      console.error(`No reference data available for ${city}`);
      return;
    }
    
    // Select 30 unique random reference records
    const selectedReferences = [];
    const usedIndices = new Set();
    
    // Determine how many reference records we can select (minimum of 30 or available records)
    const numToSelect = Math.min(50, cityReferenceData.length);
    
    // Keep selecting random records until we have enough unique ones
    while (selectedReferences.length < numToSelect) {
      const randomIndex = Math.floor(Math.random() * cityReferenceData.length);
      
      // Only add this record if we haven't used this index before
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        selectedReferences.push(cityReferenceData[randomIndex]);
      }
    }
    
    // Store the reference records
    setReferenceRecords(selectedReferences);
    
    // Now calculate probabilities for each reference record
    const probabilities = [];
    
    // Process in batches of 10 to avoid overwhelming the server
    const batchSize = 10;
    const numBatches = Math.ceil(selectedReferences.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      // Create a batch of hybrid records
      const hybridRecordsBatch = [];
      
      // Calculate start and end indices for this batch
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, selectedReferences.length);
      
      // Create hybrid records for this batch
      for (let i = startIdx; i < endIdx; i++) {
        const referenceRecord = selectedReferences[i];
        
        // Create hybrid record: start with reference record, override with donor features
        const hybridRecord = { ...referenceRecord };
        
        // Add donor features from the uploaded kidney
        Object.keys(record).forEach(key => {
          if (key.endsWith('_DON')) {
            hybridRecord[key] = record[key];
          }
        });
        
        // Filter to only include required features
        const filteredRecord = {};
        const requiredFeatures = model.features || [];
        const filteredRequiredFeatures = requiredFeatures.filter(
          feature => feature !== 'KDRI_MED' && feature !== 'KDRI_RAO'
        );
        
        filteredRequiredFeatures.forEach(feature => {
          if (feature in hybridRecord) {
            filteredRecord[feature] = hybridRecord[feature];
          } else {
            filteredRecord[feature] = null;
          }
        });
        
        hybridRecordsBatch.push(filteredRecord);
      }
      
      // Send this batch of hybrid records to the model
      try {
        console.log(`Sending batch ${batchIndex + 1}/${numBatches} for probability calculation`);
        
        const response = await fetch(`http://localhost:5001/api/predict/${model.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(hybridRecordsBatch),
        });
        
        if (!response.ok) {
          throw new Error(`Prediction failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Add probabilities from this batch to our collection
        if (result && result.results && result.results.length > 0) {
          for (let i = 0; i < result.results.length; i++) {
            probabilities.push(result.results[i].probability);
          }
        }
      } catch (error) {
        console.error(`Error calculating probabilities for batch ${batchIndex + 1}:`, error);
        // Fill with zeros for this batch
        for (let i = startIdx; i < endIdx; i++) {
          probabilities.push(0);
        }
      }
    }
    
    // Store the probabilities
    setReferenceProbabilities(probabilities);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setDetailsRecord(null);
  };

  // Update the function to determine the city from CTR_CODE with better debugging
  const getCityFromCtrCode = (ctrCode) => {
    console.log('Getting city for CTR code:', ctrCode);
    
    if (!ctrCode) {
      console.log('CTR code is null or undefined');
      return 'Unknown';
    }
    
    // Convert to string in case it's a number
    const ctrCodeStr = ctrCode.toString();
    console.log('CTR code as string:', ctrCodeStr);
    
    const city = ctrCodeToCity[ctrCodeStr];
    console.log('Mapped city:', city);
    
    return city || 'Unknown';
  };

  // Add this useEffect to handle clicking outside the modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (detailsModalRef.current && !detailsModalRef.current.contains(event.target)) {
        closeDetailsModal();
      }
    };

    if (showDetailsModal) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetailsModal]);

  // Add a useEffect to draw the chart when the tab changes or probabilities update
  useEffect(() => {
    if (activeTab === 'reference' && referenceProbabilities.length > 0 && referenceRecords.length > 0) {
      drawProbabilityChart();
    }
  }, [activeTab, referenceProbabilities, referenceRecords]);

  // Function to draw the probability chart with improved aesthetics
  const drawProbabilityChart = () => {
    const canvas = document.getElementById('probability-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set chart dimensions with more padding for labels
    const leftPadding = 60;  // More space for y-axis labels
    const rightPadding = 40;
    const topPadding = 40;
    const bottomPadding = 60; // More space for x-axis labels
    
    const chartWidth = canvas.width - (leftPadding + rightPadding);
    const chartHeight = canvas.height - (topPadding + bottomPadding);
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(leftPadding, topPadding);
    ctx.lineTo(leftPadding, canvas.height - bottomPadding);
    ctx.lineTo(canvas.width - rightPadding, canvas.height - bottomPadding);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw axis labels with better positioning
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.fillText('Reference Records (PTR_SEQUENCE_NUM)', canvas.width / 2, canvas.height - 15);
    
    // Draw title
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.fillText('Probability Distribution Across Reference Records', canvas.width / 2, 20);
    
    // Draw data points
    if (referenceProbabilities.length === 0) return;
    
    const maxProb = Math.max(...referenceProbabilities, 0.1); // Ensure we have a non-zero max
    
    // Group data by PTR_SEQUENCE_NUM and average probabilities for duplicates
    const ptrMap = new Map();
    
    referenceRecords.forEach((record, index) => {
      const ptr = record.PTR_SEQUENCE_NUM || index;
      const prob = referenceProbabilities[index] || 0;
      
      if (ptrMap.has(ptr)) {
        const existing = ptrMap.get(ptr);
        existing.totalProb += prob;
        existing.count += 1;
      } else {
        ptrMap.set(ptr, {
          totalProb: prob,
          count: 1
        });
      }
    });
    
    // Convert map to array of averaged data points
    const uniqueData = Array.from(ptrMap.entries()).map(([ptr, data]) => ({
      ptr,
      probability: data.totalProb / data.count
    }));
    
    // Sort by PTR_SEQUENCE_NUM
    const sortedData = uniqueData.sort((a, b) => a.ptr - b.ptr);
    
    console.log('Sorted data for chart:', sortedData);
    
    if (sortedData.length === 0) {
      console.error('No data to plot after processing');
      return;
    }
    
    // Draw x-axis labels (PTR numbers)
    const xStep = chartWidth / (sortedData.length - 1 || 1);

    // Determine how many labels to show to avoid overcrowding
    const labelCount = Math.min(10, sortedData.length);
    const labelInterval = Math.ceil(sortedData.length / labelCount);
    
    for (let i = 0; i < sortedData.length; i += labelInterval) {
      const x = leftPadding + (i * xStep);
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - bottomPadding);
      ctx.lineTo(x, canvas.height - bottomPadding + 5);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw label
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(sortedData[i].ptr, x, canvas.height - bottomPadding + 20);
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - bottomPadding);
      ctx.lineTo(x, topPadding);
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Draw y-axis labels (probabilities)
    const yStep = chartHeight / 10;
    for (let i = 0; i <= 10; i++) {
      const y = canvas.height - bottomPadding - (i * yStep);
      const probValue = (i / 10) * maxProb;
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(leftPadding - 5, y);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw label
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'right';
      ctx.fillText((probValue * 100).toFixed(1) + '%', leftPadding - 10, y + 5);
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(canvas.width - rightPadding, y);
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Create gradient for the area under the line
    const gradient = ctx.createLinearGradient(0, topPadding, 0, canvas.height - bottomPadding);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.6)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.1)');
    
    // Draw the area under the line
    ctx.beginPath();
    ctx.moveTo(leftPadding, canvas.height - bottomPadding);
    
    for (let i = 0; i < sortedData.length; i++) {
      const x = leftPadding + (i * xStep);
      const y = canvas.height - bottomPadding - ((sortedData[i].probability / maxProb) * chartHeight);
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(leftPadding + ((sortedData.length - 1) * xStep), canvas.height - bottomPadding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw the line connecting data points
    ctx.beginPath();
    for (let i = 0; i < sortedData.length; i++) {
      const x = leftPadding + (i * xStep);
      const y = canvas.height - bottomPadding - ((sortedData[i].probability / maxProb) * chartHeight);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw data points
    for (let i = 0; i < sortedData.length; i++) {
      const x = leftPadding + (i * xStep);
      const y = canvas.height - bottomPadding - ((sortedData[i].probability / maxProb) * chartHeight);
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3498db';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
   
  };

  return (
    // Main container for the entire Models component
    <div className="models-container">
      {/* Header section with title and description */}
      <header>
        <div className="header-content">
          <h1>Predictive Models</h1>
          <p>Run all models on your uploaded data</p>
        </div>
      </header>

      {/* Error message display - only shown when an error occurs */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
      
      {/* Main prediction control panel */}
      <div className="prediction-panel">
        {/* File selection dropdown and run button */}
        <div className="file-selection">
          <div className="form-group">
            <label htmlFor="file-select">Select Data File:</label>
            <select 
              id="file-select"
              value={selectedFile || ''} 
              onChange={handleFileSelect}
              className="file-select"
            >
              <option value="">-- Select a file --</option>
              {/* Dynamically generate options from uploaded files */}
              {uploadedFiles.map(file => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </div>
          {/* Run predictions button with loading indicator */}
          <button 
            className="run-all-btn" 
            onClick={runAllPredictions}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? (
              // Loading spinner shown during prediction processing
              <>
                <i className="fas fa-spinner fa-spin"></i> Processing...
              </>
            ) : (
              // Default button state
              <>
                <i className="fas fa-play-circle"></i> Run All Models
              </>
            )}
          </button>
        </div>
        
        {/* Results section - only shown when predictions exist */}
        {allPredictions.length > 0 && (
          <div className="all-predictions">
            <h2>Model Predictions Ranked by Probability</h2>
            
            {/* Summary table of all model predictions */}
            <div className="predictions-table-container">
              <table className="predictions-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Organ KDPI</th>
                    <th>Avg. Center KDPI</th>
                    <th>Avg. Probability</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Map through all predictions to create rows */}
                  {displayPredictions.map((prediction, index) => (
                    <tr key={prediction.modelId} className={prediction.modelName.toLowerCase().includes('baseline') ? 'baseline-model-row' : ''}>
                      <td>{index + 1}</td>
                      <td>{prediction.modelName}</td>
                      {/* Determine if this is a baseline or augmented model */}
                      <td>{prediction.modelName.toLowerCase().includes('baseline') ? 'Baseline' : 'Augmented'}</td>
                      {/* Display KDPI for the first result or N/A if none */}
                      <td>{prediction.results && prediction.results.length > 0 ? 
                          getKdpiFromData(prediction.results[0].id) : 'N/A'}</td>
                      {/* Show average KDPI for this model's center */}
                      <td>{formatKdpi(getAvgKdpiForModel(prediction.modelName))}</td>
                      {/* Visual probability bar with percentage */}
                      <td>
                        <div className="probability-bar-container">
                          <div 
                            className="probability-bar" 
                            style={{ width: `${prediction.avgProbability * 100}%` }}
                          >
                            <span className="probability-text" style={{ color: 'black' }}>{(prediction.avgProbability * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </td>
                      {/* Button to jump to detailed results section */}
                      <td>
                        <button 
                          className="details-btn"
                          onClick={() => scrollToModelDetails(prediction.modelId)}
                        >
                          <i className="fas fa-chart-bar"></i> View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Detailed results section for each model */}
            <div className="detailed-results">
              <h2>Detailed Results</h2>
              {/* Map through each prediction to create detailed card */}
              {displayPredictions.map((prediction) => (
                <div 
                  key={prediction.modelId} 
                  id={`model-details-${prediction.modelId}`}
                  className={`model-prediction-details ${prediction.modelName.toLowerCase().includes('baseline') ? 'baseline-model-details' : ''}`}
                >
                  <h3>{prediction.modelName}</h3>
                  <p>Average Probability: <strong>{(prediction.avgProbability * 100).toFixed(2)}%</strong></p>
                  <p>Model Type: <strong>{prediction.modelName.toLowerCase().includes('baseline') ? 'Baseline' : 'Augmented'}</strong></p>
                  
                  {/* Table of individual prediction results */}
                  <div className="results-table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Record #</th>
                          <th>Probability</th>
                          <th>Actions</th>
                          <th>Detailed Analysis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Show only top 10 results unless expanded */}
                        {prediction.results.slice(0, showAllResults[prediction.modelId] ? prediction.results.length : 10).map(result => (
                          <tr key={result.id}>
                            <td>{result.id}</td>
                            <td>{(result.probability * 100).toFixed(2)}%</td>
                            <td>
                              {/* Button to find similar kidneys */}
                              <button 
                                className="action-btn similar-btn"
                                onClick={() => handleFindSimilar(result.id, prediction.modelName)}
                              >
                                <i className="fas fa-search"></i> Find Similar
                              </button>
                            </td>
                            <td>
                              {/* Button to show detailed analysis modal */}
                              <button 
                                className="action-btn info-btn"
                                onClick={() => handleShowMoreInfo(result.id, prediction.modelId)}
                                style={{
                                  backgroundColor: '#3498db',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <i className="fas fa-info-circle" style={{ marginRight: '5px' }}></i> More Information
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* "View All" button - shown when results are collapsed and there are more than 10 */}
                        {prediction.results.length > 10 && !showAllResults[prediction.modelId] && (
                          <tr>
                            <td colSpan="4" className="more-results">
                              <button 
                                className="view-all-btn"
                                onClick={() => toggleShowAllResults(prediction.modelId)}
                              >
                                <i className="fas fa-chevron-down"></i> View All {prediction.results.length} Records
                              </button>
                            </td>
                          </tr>
                        )}
                        {/* "Collapse View" button - shown when results are expanded */}
                        {prediction.results.length > 10 && showAllResults[prediction.modelId] && (
                          <tr>
                            <td colSpan="4" className="more-results">
                              <button 
                                className="collapse-btn"
                                onClick={() => toggleShowAllResults(prediction.modelId)}
                              >
                                <i className="fas fa-chevron-up"></i> Collapse View
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Missing features section - shows which models couldn't be used due to missing data */}
        {Object.keys(missingFeatures).length > 0 && (
          <div className="missing-features-section">
            <h3>Models with Missing Features</h3>
            <p>The following models couldn't be used because the selected data is missing required features:</p>
            
            <div className="missing-features-list">
              {/* List each model and its missing features */}
              {Object.entries(missingFeatures).map(([modelId, features]) => {
                const model = models.find(m => m.id === modelId);
                return (
                  <div key={modelId} className="missing-feature-item">
                    <h4>{model ? model.name : modelId}</h4>
                    <p>Missing features:</p>
                    <ul>
                      {features.map(feature => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Empty state message shown when no files are available */}
        {!selectedFile && uploadedFiles.length === 0 && (
          <div className="no-files-message">
            <i className="fas fa-file-upload"></i>
            <h3>No Data Files Available</h3>
            <p>Please upload CSV files in the Data Upload section first</p>
            <button 
              className="upload-redirect-btn"
              onClick={() => window.location.href = "#data-upload"}
            >
              Go to Data Upload
            </button>
          </div>
        )}
      </div>
      
      {/* Models list section - displays all available models */}
      <div className="models-list-section">
        <h2>Available Models ({models.length})</h2>
        <div className="models-grid">
          {/* Create a card for each model */}
          {models.map(model => (
            <div key={model.id} className="model-card">
              <div className="model-card-header">
                <div className="model-icon">
                  <i className="fas fa-brain"></i>
                </div>
                <h3>{model.name}</h3>
              </div>
              <p className="model-description">{model.description}</p>
              <div className="model-meta">
                <div className="meta-item">
                  <span className="meta-label">Type:</span>
                  <span className="meta-value">{model.type || 'XGBoost'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Features:</span>
                  <span className="meta-value">{(model.features || []).filter(f => f !== 'utilization_probability').length}</span>
                </div>
              </div>
              {/* Display a preview of model features */}
              <div className="model-features-preview">
                {(model.features || [])
                  .filter(f => f !== 'utilization_probability')
                  .slice(0, 3)
                  .map(feature => (
                    <span key={feature} className="feature-tag">{feature}</span>
                  ))}
                {/* Show count of additional features if more than 3 */}
                {(model.features || []).filter(f => f !== 'utilization_probability').length > 3 && (
                  <span className="more-features">+{(model.features || []).filter(f => f !== 'utilization_probability').length - 3} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Similar kidneys modal component */}
        <SimilarKidneysModal
          show={showSimilarModal}
          onClose={closeModal}
          selectedRecord={selectedRecord}
          selectedModel={selectedModel}
          similarKidneys={similarKidneys}
          loadingReference={loadingReference}
          referenceError={referenceError}
          importantFeatures={importantFeatures}
          getCityFromModelName={getCityFromModelName}
        />

      {/* Detailed analysis modal - conditionally rendered when showDetailsModal is true */}
      {showDetailsModal && detailsRecord && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          {/* Modal container with ref for click-outside detection */}
          <div 
            ref={detailsModalRef}
            className="modal-container" 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal header with title and close button */}
            <div className="modal-header" style={{
              padding: '15px 20px',
              borderBottom: '1px solid #eaeaea',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Detailed Analysis</h3>
              <button 
                onClick={closeDetailsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#7f8c8d'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Modal tabs for navigation between content sections */}
            <div className="modal-tabs" style={{
              display: 'flex',
              borderBottom: '1px solid #eaeaea',
              backgroundColor: '#f9f9f9'
            }}>
              {/* City information tab */}
              <button 
                onClick={() => setActiveTab('city')}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'city' ? '2px solid #3498db' : 'none',
                  fontWeight: activeTab === 'city' ? 'bold' : 'normal',
                  color: activeTab === 'city' ? '#3498db' : '#666'
                }}
              >
                City Information
              </button>
              {/* Reference records tab */}
              <button 
                onClick={() => setActiveTab('reference')}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'reference' ? '2px solid #3498db' : 'none',
                  fontWeight: activeTab === 'reference' ? 'bold' : 'normal',
                  color: activeTab === 'reference' ? '#3498db' : '#666'
                }}
              >
                Reference Records
              </button>
            </div>
            
            {/* Modal content area - changes based on active tab */}
            <div className="modal-content" style={{ 
              padding: '20px',
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 120px)'
            }}>
              {/* City information tab content */}
              {activeTab === 'city' && (
                <div className="city-info">
                  {/* Kidney origin information card */}
                  <div style={{
                    backgroundColor: '#f0f7ff',
                    borderRadius: '6px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '1px solid #d0e3ff'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Kidney Origin</h4>
                    
                    {/* Show transplant center info if available */}
                    {detailsRecord.LISTING_CTR_CODE ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', width: '150px' }}>Center Code:</span>
                          <span>{detailsRecord.LISTING_CTR_CODE}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', width: '150px' }}>City:</span>
                          <span style={{ 
                            backgroundColor: '#3498db', 
                            color: 'white', 
                            padding: '4px 10px', 
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {getCityFromCtrCode(detailsRecord.LISTING_CTR_CODE)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: '#7f8c8d' }}>No center code information available for this kidney.</p>
                    )}
                  </div>
                  
                  {/* Additional city-specific information */}
                  <div style={{
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    padding: '20px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Additional Information</h4>
                    <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>
                      This kidney was processed at a transplant center in {getCityFromCtrCode(detailsRecord.LISTING_CTR_CODE) || 'an unknown location'}.
                      Centers in this region have specific characteristics and outcomes that may influence the prediction results.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Reference records tab content */}
              {activeTab === 'reference' && (
                <div className="reference-info">
                  {/* Reference records information card */}
                  <div style={{
                    backgroundColor: '#f0f7ff',
                    borderRadius: '6px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '1px solid #d0e3ff'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Reference Records</h4>
                    
                    {/* Grid of reference record cards */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: '10px',
                      marginBottom: '20px'
                    }}>
                      {/* Create a card for each reference record */}
                      {referenceRecords.map((record, index) => (
                        <div key={index} style={{
                          backgroundColor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          padding: '10px',
                          textAlign: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                            Record #{index + 1}
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                            {record.PTR_SEQUENCE_NUM || 'N/A'}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#3498db', 
                            marginTop: '5px',
                            fontWeight: 'bold'
                          }}>
                            {referenceProbabilities[index] ? 
                              (referenceProbabilities[index] * 100).toFixed(2) + '%' : 
                              'N/A'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#7f8c8d',
                            marginTop: '5px',
                            backgroundColor: '#f8f9fa',
                            padding: '3px 6px',
                            borderRadius: '3px',
                            display: 'inline-block'
                          }}>
                            {record.LISTING_CTR_CODE ? getCityFromCtrCode(record.LISTING_CTR_CODE) : 'Unknown City'}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Probability distribution chart section */}
                    <h4 style={{ margin: '20px 0 15px 0', color: '#2c3e50' }}>Probability Distribution</h4>
                    <div style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      padding: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      marginBottom: '15px'
                    }}>
                      {/* Canvas for the probability chart */}
                      <canvas 
                        id="probability-chart" 
                        width="800" 
                        height="500"
                        style={{ width: '100%', height: 'auto' }}
                      ></canvas>
                    </div>
                  </div>
                  
                  {/* Explanatory information about reference records */}
                  <div style={{
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    padding: '20px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Why Reference Records Matter</h4>
                    <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>
                      Reference records are used to create hybrid scenarios for prediction. 
                      The model combines donor features from your kidney with recipient and transplant 
                      features from these reference records to estimate utilization probability.
                      The chart above shows how the probability varies across different reference records.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Models; 

<style>
{`
  /* 
   * Styles for the probability text display in probability bars
   * Makes the text visible regardless of bar color/length
   */
  .probability-text {
    color: #000000;
    font-weight: bold;
    text-shadow: 0px 0px 3px rgba(255, 255, 255, 1);
    position: absolute;
    left: 5px;
  }
  
  /* 
   * Styles for the colored probability bar itself
   * Creates a visual representation of probability percentages
   */
  .probability-bar {
    background-color: #4CAF50;
    height: 100%;
    border-radius: 4px;
    display: flex;
    align-items: center;
    position: relative;
    min-width: 40px;
  }
  
  /* 
   * Container for the probability bar to ensure consistent sizing
   * Provides the gray background for the bar
   */
  .probability-bar-container {
    width: 100%;
    background-color: #f1f1f1;
    border-radius: 4px;
    height: 24px;
    position: relative;
  }
  
  /* 
   * Shared styles for action buttons (Find Similar, Features)
   * Creates consistent look for interactive elements
   */
  .action-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  /* Ensures consistent spacing between icon and text in buttons */
  .action-btn i {
    margin-right: 4px;
  }
  
  /* Specific styling for the "Find Similar" button */
  .similar-btn {
    background-color: #3498db;
    color: white;
  }
  
  /* Hover effect for the Find Similar button */
  .similar-btn:hover {
    background-color: #2980b9;
  }
  
  /* Specific styling for the Features button */
  .features-btn {
    background-color: #9b59b6;
    color: white;
  }
  
  /* Hover effect for the Features button */
  .features-btn:hover {
    background-color: #8e44ad;
  }
  
  /* 
   * Table styling for detailed results section
   * Centers all content in table cells for better readability
   */
  .model-prediction-details th,
  .model-prediction-details td {
    text-align: center;
    vertical-align: middle;
  }
  
  /* Ensures buttons remain centered in table cells */
  .model-prediction-details td .action-btn {
    margin: 0 auto;
  }
  
  /* Styling for the "View All/Collapse" row */
  .more-results {
    text-align: center;
    font-style: italic;
    color: #666;
    padding: 8px 0;
  }
  
  /* Center text in the main predictions summary table */
  .predictions-table th,
  .predictions-table td {
    text-align: center;
    vertical-align: middle;
  }
  
  /*
   * Modal styles for popups like the Similar Kidneys modal
   * Creates a semi-transparent overlay over the entire page
   */
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
  
  /* 
   * Styles for the modal window itself
   * Creates a clean white container with rounded corners
   */
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

  /* Animation for modal entrance */
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
  
  /* Styles for the modal header section */
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
  
  /* Title styling in modal header */
  .modal-header h2 {
    margin: 0;
    color: #333;
    font-size: 22px;
    font-weight: 600;
  }
  
  /* Close button in modal header */
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
  
  /* Hover effect for close button */
  .close-btn:hover {
    background-color: #f5f5f5;
    color: #333;
  }
  
  /* Content area within modal */
  .modal-content {
    padding: 24px;
  }
  
  /* Loading indicator for async operations */
  .loading-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    font-size: 16px;
    color: #666;
  }
  
  /* Spinner icon in loading indicator */
  .loading-indicator i {
    margin-right: 12px;
    color: #3498db;
    font-size: 24px;
  }
  
  /* Error message display */
  .error-message {
    background-color: #ffebee;
    color: #d32f2f;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
  }
  
  /* Error icon in error message */
  .error-message i {
    margin-right: 12px;
    font-size: 20px;
  }
  
  /* Container for displaying the current kidney's details */
  .current-kidney {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }
  
  /* Section title in current kidney details */
  .current-kidney h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  /* Layout for kidney details information */
  .kidney-details {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
  }
  
  /* Text in kidney details */
  .kidney-details p {
    margin: 8px 0;
    font-size: 15px;
  }
  
  /* Bold text in kidney details */
  .kidney-details strong {
    color: #555;
  }
  
  /* Container for similar kidneys results */
  .similar-kidneys-container {
    margin-top: 20px;
  }
  
  /* Section title in similar kidneys container */
  .similar-kidneys-container h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  /* Summary of acceptance statistics */
  .acceptance-summary {
    margin-bottom: 20px;
    font-size: 16px;
    background-color: #e3f2fd;
    padding: 12px 16px;
    border-radius: 8px;
    color: #0d47a1;
  }
  
  /* Bold text in acceptance summary */
  .acceptance-summary strong {
    font-weight: 600;
  }
  
  /* Container for the similar kidneys table */
  .similar-kidneys-table-container {
    margin-bottom: 24px;
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  /* Table for displaying similar kidneys */
  .similar-kidneys-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
  }
  
  /* Table cells in similar kidneys table */
  .similar-kidneys-table th,
  .similar-kidneys-table td {
    padding: 14px 16px;
    text-align: center;
  }
  
  /* Table header in similar kidneys table */
  .similar-kidneys-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    color: #333;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Table rows in similar kidneys table */
  .similar-kidneys-table tr {
    border-bottom: 1px solid #eee;
  }
  
  /* Remove border from last row */
  .similar-kidneys-table tr:last-child {
    border-bottom: none;
  }
  
  /* Highlight for accepted kidney rows */
  .similar-kidneys-table tr.accepted {
    background-color: rgba(76, 175, 80, 0.08);
  }
  
  /* Highlight for rejected kidney rows */
  .similar-kidneys-table tr.rejected {
    background-color: rgba(244, 67, 54, 0.08);
  }
  
  /* Hover effect for table rows */
  .similar-kidneys-table tr:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  /* Badge for showing outcome status */
  .outcome-badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Success outcome badge (accepted) */
  .outcome-badge.success {
    background-color: #4CAF50;
    color: white;
  }
  
  /* Failure outcome badge (rejected) */
  .outcome-badge.failure {
    background-color: #F44336;
    color: white;
  }
  
  /* Feature comparison section */
  .feature-comparison {
    margin-top: 30px;
  }
  
  /* Section title in feature comparison */
  .feature-comparison h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  /* Container for feature comparison table */
  .feature-comparison-table-container {
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  /* Table for feature comparison */
  .feature-comparison-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
  }
  
  /* Table cells in feature comparison */
  .feature-comparison-table th,
  .feature-comparison-table td {
    padding: 14px 16px;
    text-align: left;
  }
  
  /* Table header in feature comparison */
  .feature-comparison-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    color: #333;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Table rows in feature comparison */
  .feature-comparison-table tr {
    border-bottom: 1px solid #eee;
  }
  
  /* Remove border from last row */
  .feature-comparison-table tr:last-child {
    border-bottom: none;
  }
  
  /* Hover effect for table rows */
  .feature-comparison-table tr:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  /* Empty state for no results */
  .no-results {
    padding: 40px;
    text-align: center;
    color: #666;
    background-color: #f9f9f9;
    border-radius: 8px;
    margin-top: 20px;
  }
  
  /* Text in empty state */
  .no-results p {
    font-size: 16px;
    margin: 0;
  }
  
  /* Info button styling */
  .info-btn {
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  /* Hover effect for info button */
  .info-btn:hover {
    background-color: #2980b9;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
  }
  
  /* Icon in info button */
  .info-btn i {
    margin-right: 5px;
  }
  
  /* Controls for filtering results */
  .filter-controls {
    margin: 10px 0;
    padding: 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  
  /* Input for specifying number of top kidneys to show */
  .top-kidneys-input {
    width: 60px;
    margin: 0 8px;
    padding: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
  }
`}
</style> 