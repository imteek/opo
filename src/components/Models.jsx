import React, { useState, useEffect, useRef } from 'react';
import SimilarKidneysModal from './SimilarKidneysModal';

// Sample model data - in a real app, this would come from your backend
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
  const [models, setModels] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allPredictions, setAllPredictions] = useState([]);
  const [missingFeatures, setMissingFeatures] = useState({});
  const [fileData, setFileData] = useState(null);
  const [similarKidneys, setSimilarKidneys] = useState([]);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const modalRef = useRef(null);
  const [referenceData, setReferenceData] = useState({
    Baltimore: null,
    Boston: null,
    LA: null
  });
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState(null);
  const [showAllResults, setShowAllResults] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('city');
  const detailsModalRef = useRef(null);
  const [referenceRecords, setReferenceRecords] = useState([]);
  const [referenceProbabilities, setReferenceProbabilities] = useState([]);
  const [topKidneysCount, setTopKidneysCount] = useState(10);

  // Updated Average KDPI by CTR code
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
  const avgKdpiByCity = {
    'LA': 0.5038325991189427,
    'Boston': 0.3300508905852417,
    'Baltimore': 0.45672727272727276
  };

  // Important features for each city
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

  // Update the CTR code to city mapping
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

  // Alternative format that matches your provided structure
  const cityToCtrCodes = {
    'LA': ['13051', '24552', '23901', '2573'],
    'Boston': ['651', '12958', '13237', '6727', '24335'],
    'Baltimore': ['2666', '24800']
  };

  // Function to get average KDPI for a model
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

  // Function to get city from model name
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

  // Enhance the getValueCaseInsensitive function to be more robust
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

  // Function to calculate Euclidean distance
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

  // Function to load reference data for a city
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

  // Function to find similar kidneys
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
    
    // Sort by distance and take the top 7
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
      // Find the selected file
      const fileObj = uploadedFiles.find(f => f.id.toString() === selectedFile);
      if (!fileObj) {
        throw new Error('Selected file not found');
      }
      
      console.log('Selected file:', fileObj);
      
      // Get the file data
      let fileData = fileObj.data;
      
      // Check if data is in the expected format
      if (fileData.allRows && Array.isArray(fileData.allRows)) {
        fileData = fileData.allRows;
      } else if (!Array.isArray(fileData)) {
        throw new Error('Invalid data format. Expected an array of records.');
      }
      
      console.log('File data sample:', fileData.slice(0, 2));
      
      // Get all available features in the dataset
      const availableFeatures = Object.keys(fileData[0] || {});
      console.log('Available features:', availableFeatures);
      
      // Remove utilization_probability from required features for all models
      const modelsWithoutUtilization = models.map(model => {
        const features = (model.features || []).filter(f => f !== 'utilization_probability');
        return { ...model, features };
      });
      
      // Separate baseline models and facility models
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
      
      // Run predictions for baseline models first
      const baselinePredictions = [];
      const missingFeaturesMap = {};
      
      // Function to run predictions for a model
      const runModelPrediction = async (model, data) => {
        console.log(`Processing model: ${model.name}`);
        
        // Check if the model has the required features
        const requiredFeatures = model.features || [];
        console.log('Required features:', requiredFeatures);
        
        // Filter out KDRI_MED and KDRI_RAO from required features
        const filteredRequiredFeatures = requiredFeatures.filter(
          feature => feature !== 'KDRI_MED' && feature !== 'KDRI_RAO'
        );
        
        // For facility models, don't check for baseline_prob features as they'll be added later
        const featuresToCheck = model.name.includes('Facility') || model.id.includes('facility')
          ? filteredRequiredFeatures.filter(f => !f.includes('baseline_prob'))
          : filteredRequiredFeatures;
        
        const missingModelFeatures = featuresToCheck.filter(
          feature => !Object.keys(data[0]).includes(feature)
        );
        
        if (missingModelFeatures.length > 0) {
          console.log('Missing features for model:', missingModelFeatures);
          missingFeaturesMap[model.id] = missingModelFeatures;
          return null;
        }
        
        try {
          // Get the city for this model
          const city = getCityFromModelName(model.name);
          if (!city) {
            console.error(`Could not determine city for model: ${model.name}`);
            return null;
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
              return null;
            }
          }
          
          if (!cityReferenceData || cityReferenceData.length === 0) {
            console.error(`No reference data available for ${city}`);
            return null;
          }
          
          // Process each record in the uploaded data
          const allResults = [];
          
          for (let recordIndex = 0; recordIndex < data.length; recordIndex++) {
            const record = data[recordIndex];
            
            // Process in batches of 10 to avoid overwhelming the server
            const totalReferences = 10; // Changed from 10 to 30
            const batchSize = 10;
            const numBatches = Math.ceil(totalReferences / batchSize);
            
            // Array to store all probabilities for this record
            let allProbabilities = [];
            
            // Track used indices to avoid duplicates
            const usedIndices = new Set();
            
            // Process in batches
            for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
              // Create a batch of hybrid records
              const hybridRecordsBatch = [];
              
              // Calculate how many records to create for this batch
              const recordsToCreate = Math.min(batchSize, totalReferences - (batchIndex * batchSize));
              
              // Create hybrid records for this batch
              while (hybridRecordsBatch.length < recordsToCreate) {
                // Get a random reference record that hasn't been used yet
                const randomIndex = Math.floor(Math.random() * cityReferenceData.length);
                
                // Only use this record if we haven't used this index before
                if (!usedIndices.has(randomIndex)) {
                  usedIndices.add(randomIndex);
                  const referenceRecord = cityReferenceData[randomIndex];
                  
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
              
              // Send this batch of hybrid records to the model
              try {
                console.log(`Sending batch ${batchIndex + 1}/${numBatches} (${hybridRecordsBatch.length} records) for record ${recordIndex}`);
                
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
                  const batchProbabilities = result.results.map(res => res.probability);
                  allProbabilities = [...allProbabilities, ...batchProbabilities];
                }
              } catch (error) {
                console.error(`Error predicting batch ${batchIndex + 1} for record ${recordIndex}:`, error);
                // Continue with next batch
              }
            }
            
            // Calculate average probability across all batches for this record
            if (allProbabilities.length > 0) {
              const sum = allProbabilities.reduce((acc, prob) => acc + prob, 0);
              const avgProb = sum / allProbabilities.length;
              
              allResults.push({
                id: recordIndex,
                probability: avgProb
              });
              
              console.log(`Record ${recordIndex}: Processed ${allProbabilities.length} reference organs, avg probability: ${avgProb}`);
            } else {
              // No valid probabilities for this record
              allResults.push({
                id: recordIndex,
                probability: 0
              });
              
              console.log(`Record ${recordIndex}: No valid probabilities`);
            }
          }
          
          // Calculate overall average probability
          const avgProbability = allResults.reduce(
            (sum, item) => sum + item.probability, 
            0
          ) / allResults.length;
          
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
      
      // Run baseline models first
      for (const model of baselineModels) {
        const prediction = await runModelPrediction(model, fileData);
        if (prediction) {
          baselinePredictions.push(prediction);
        }
      }
      
      console.log('Baseline predictions:', baselinePredictions);
      
      // Prepare data for facility models by adding baseline_prob
      const enhancedData = fileData.map((record, index) => {
        const enhancedRecord = { ...record };
        
        // Add baseline probabilities from corresponding baseline models
        baselinePredictions.forEach(prediction => {
          const area = prediction.modelName.includes('Boston') ? 'Boston' : 
                      prediction.modelName.includes('LA') ? 'LA' : 
                      prediction.modelName.includes('Baltimore') ? 'Baltimore' : '';
          
          if (area && index < prediction.results.length) {
            enhancedRecord[`${area}_baseline_prob`] = prediction.results[index].probability;
            // Also add a generic baseline_prob for backward compatibility
            enhancedRecord['baseline_prob'] = prediction.results[index].probability;
          }
        });
        
        return enhancedRecord;
      });
      
      console.log('Enhanced data with baseline probabilities:', enhancedData.slice(0, 2));
      
      // Run facility models with enhanced data
      const facilityPredictions = [];
      
      for (const model of facilityModels) {
        // Determine which baseline probability to use
        let baselineProbField = 'baseline_prob';
        
        if (model.name.includes('Boston')) {
          baselineProbField = 'Boston_baseline_prob';
        } else if (model.name.includes('LA')) {
          baselineProbField = 'LA_baseline_prob';
        } else if (model.name.includes('Baltimore')) {
          baselineProbField = 'Baltimore_baseline_prob';
        }
        
        // Create a copy of the model with updated feature requirements
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
      
      // Run other models
      const otherPredictions = [];
      
      for (const model of otherModels) {
        const prediction = await runModelPrediction(model, fileData);
        if (prediction) {
          otherPredictions.push(prediction);
        }
      }
      
      // Combine all predictions
      const allModelPredictions = [
        ...baselinePredictions,
        ...facilityPredictions,
        ...otherPredictions
      ];
      
      // Sort predictions by average probability (highest first)
      const sortedPredictions = allModelPredictions.sort(
        (a, b) => b.avgProbability - a.avgProbability
      );
      
      console.log('All predictions:', sortedPredictions);
      setAllPredictions(sortedPredictions);
      setMissingFeatures(missingFeaturesMap);
      
      if (sortedPredictions.length === 0 && Object.keys(missingFeaturesMap).length > 0) {
        setError('None of the models could be used with this data due to missing features.');
      } else if (sortedPredictions.length === 0) {
        setError('No predictions could be generated. Please check the console for details.');
      }
    } catch (error) {
      console.error('Prediction error:', error);
      setError(error.message || 'An error occurred during prediction');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToModelDetails = (modelId) => {
    const element = document.getElementById(`model-details-${modelId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Function to get KDPI value from file data
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

  // Function to format KDPI value
  const formatKdpi = (kdpi) => {
    if (kdpi === null || kdpi === undefined) return 'N/A';
    return kdpi.toFixed(5); // Display as decimal with 3 decimal places
  };

  // Update the displayPredictions to include baseline models
  const displayPredictions = allPredictions;  // Remove the filter that excludes baseline models

  // Add this function if it doesn't exist
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
    <div className="models-container">
      <header>
        <div className="header-content">
          <h1>Predictive Models</h1>
          <p>Run all models on your uploaded data</p>
        </div>
      </header>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
      
      <div className="prediction-panel">
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
              {uploadedFiles.map(file => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </div>
          <button 
            className="run-all-btn" 
            onClick={runAllPredictions}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Processing...
              </>
            ) : (
              <>
                <i className="fas fa-play-circle"></i> Run All Models
              </>
            )}
          </button>
        </div>
        
        {allPredictions.length > 0 && (
          <div className="all-predictions">
            <h2>Model Predictions Ranked by Probability</h2>
            
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
                  {displayPredictions.map((prediction, index) => (
                    <tr key={prediction.modelId} className={prediction.modelName.toLowerCase().includes('baseline') ? 'baseline-model-row' : ''}>
                      <td>{index + 1}</td>
                      <td>{prediction.modelName}</td>
                      <td>{prediction.modelName.toLowerCase().includes('baseline') ? 'Baseline' : 'Augmented'}</td>
                      <td>{prediction.results && prediction.results.length > 0 ? 
                          getKdpiFromData(prediction.results[0].id) : 'N/A'}</td>
                      <td>{formatKdpi(getAvgKdpiForModel(prediction.modelName))}</td>
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
            
            <div className="detailed-results">
              <h2>Detailed Results</h2>
              {displayPredictions.map((prediction) => (
                <div 
                  key={prediction.modelId} 
                  id={`model-details-${prediction.modelId}`}
                  className={`model-prediction-details ${prediction.modelName.toLowerCase().includes('baseline') ? 'baseline-model-details' : ''}`}
                >
                  <h3>{prediction.modelName}</h3>
                  <p>Average Probability: <strong>{(prediction.avgProbability * 100).toFixed(2)}%</strong></p>
                  <p>Model Type: <strong>{prediction.modelName.toLowerCase().includes('baseline') ? 'Baseline' : 'Augmented'}</strong></p>
                  
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
                        {prediction.results.slice(0, showAllResults[prediction.modelId] ? prediction.results.length : 10).map(result => (
                          <tr key={result.id}>
                            <td>{result.id}</td>
                            <td>{(result.probability * 100).toFixed(2)}%</td>
                            <td>
                              <button 
                                className="action-btn similar-btn"
                                onClick={() => handleFindSimilar(result.id, prediction.modelName)}
                              >
                                <i className="fas fa-search"></i> Find Similar
                              </button>
                            </td>
                            <td>
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
        
        {Object.keys(missingFeatures).length > 0 && (
          <div className="missing-features-section">
            <h3>Models with Missing Features</h3>
            <p>The following models couldn't be used because the selected data is missing required features:</p>
            
            <div className="missing-features-list">
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
      
      <div className="models-list-section">
        <h2>Available Models ({models.length})</h2>
        <div className="models-grid">
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
              <div className="model-features-preview">
                {(model.features || [])
                  .filter(f => f !== 'utilization_probability')
                  .slice(0, 3)
                  .map(feature => (
                    <span key={feature} className="feature-tag">{feature}</span>
                  ))}
                {(model.features || []).filter(f => f !== 'utilization_probability').length > 3 && (
                  <span className="more-features">+{(model.features || []).filter(f => f !== 'utilization_probability').length - 3} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Use the new modal component */}
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
            
            <div className="modal-tabs" style={{
              display: 'flex',
              borderBottom: '1px solid #eaeaea',
              backgroundColor: '#f9f9f9'
            }}>
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
            
            <div className="modal-content" style={{ 
              padding: '20px',
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 120px)'
            }}>
              {activeTab === 'city' && (
                <div className="city-info">
                  <div style={{
                    backgroundColor: '#f0f7ff',
                    borderRadius: '6px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '1px solid #d0e3ff'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Kidney Origin</h4>
                    
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
              
              {activeTab === 'reference' && (
                <div className="reference-info">
                  <div style={{
                    backgroundColor: '#f0f7ff',
                    borderRadius: '6px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '1px solid #d0e3ff'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Reference Records</h4>
                    
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: '10px',
                      marginBottom: '20px'
                    }}>
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
                    
                    <h4 style={{ margin: '20px 0 15px 0', color: '#2c3e50' }}>Probability Distribution</h4>
                    <div style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      padding: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      marginBottom: '15px'
                    }}>
                      <canvas 
                        id="probability-chart" 
                        width="800" 
                        height="500"
                        style={{ width: '100%', height: 'auto' }}
                      ></canvas>
                    </div>
                  </div>
                  
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
  .probability-text {
    color: #000000;
    font-weight: bold;
    text-shadow: 0px 0px 3px rgba(255, 255, 255, 1);
    position: absolute;
    left: 5px;
  }
  
  .probability-bar {
    background-color: #4CAF50;
    height: 100%;
    border-radius: 4px;
    display: flex;
    align-items: center;
    position: relative;
    min-width: 40px;
  }
  
  .probability-bar-container {
    width: 100%;
    background-color: #f1f1f1;
    border-radius: 4px;
    height: 24px;
    position: relative;
  }
  
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
  
  .action-btn i {
    margin-right: 4px;
  }
  
  .similar-btn {
    background-color: #3498db;
    color: white;
  }
  
  .similar-btn:hover {
    background-color: #2980b9;
  }
  
  .features-btn {
    background-color: #9b59b6;
    color: white;
  }
  
  .features-btn:hover {
    background-color: #8e44ad;
  }
  
  /* Center all column headings and entries in detailed results */
  .model-prediction-details th,
  .model-prediction-details td {
    text-align: center;
    vertical-align: middle;
  }
  
  /* Make sure buttons remain centered */
  .model-prediction-details td .action-btn {
    margin: 0 auto;
  }
  
  /* Ensure the more results row is centered */
  .more-results {
    text-align: center;
    font-style: italic;
    color: #666;
    padding: 8px 0;
  }
  
  /* Center text in the predictions table */
  .predictions-table th,
  .predictions-table td {
    text-align: center;
    vertical-align: middle;
  }
  
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
    padding: 24px;
  }
  
  .loading-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    font-size: 16px;
    color: #666;
  }
  
  .loading-indicator i {
    margin-right: 12px;
    color: #3498db;
    font-size: 24px;
  }
  
  .error-message {
    background-color: #ffebee;
    color: #d32f2f;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
  }
  
  .error-message i {
    margin-right: 12px;
    font-size: 20px;
  }
  
  .current-kidney {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }
  
  .current-kidney h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  .kidney-details {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
  }
  
  .kidney-details p {
    margin: 8px 0;
    font-size: 15px;
  }
  
  .kidney-details strong {
    color: #555;
  }
  
  .similar-kidneys-container {
    margin-top: 20px;
  }
  
  .similar-kidneys-container h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  .acceptance-summary {
    margin-bottom: 20px;
    font-size: 16px;
    background-color: #e3f2fd;
    padding: 12px 16px;
    border-radius: 8px;
    color: #0d47a1;
  }
  
  .acceptance-summary strong {
    font-weight: 600;
  }
  
  .similar-kidneys-table-container {
    margin-bottom: 24px;
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .similar-kidneys-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .similar-kidneys-table th,
  .similar-kidneys-table td {
    padding: 14px 16px;
    text-align: center;
  }
  
  .similar-kidneys-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    color: #333;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .similar-kidneys-table tr {
    border-bottom: 1px solid #eee;
  }
  
  .similar-kidneys-table tr:last-child {
    border-bottom: none;
  }
  
  .similar-kidneys-table tr.accepted {
    background-color: rgba(76, 175, 80, 0.08);
  }
  
  .similar-kidneys-table tr.rejected {
    background-color: rgba(244, 67, 54, 0.08);
  }
  
  .similar-kidneys-table tr:hover {
    background-color: rgba(0, 0, 0, 0.02);
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
  
  .feature-comparison {
    margin-top: 30px;
  }
  
  .feature-comparison h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }
  
  .feature-comparison-table-container {
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .feature-comparison-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .feature-comparison-table th,
  .feature-comparison-table td {
    padding: 14px 16px;
    text-align: left;
  }
  
  .feature-comparison-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    color: #333;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .feature-comparison-table tr {
    border-bottom: 1px solid #eee;
  }
  
  .feature-comparison-table tr:last-child {
    border-bottom: none;
  }
  
  .feature-comparison-table tr:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  .no-results {
    padding: 40px;
    text-align: center;
    color: #666;
    background-color: #f9f9f9;
    border-radius: 8px;
    margin-top: 20px;
  }
  
  .no-results p {
    font-size: 16px;
    margin: 0;
  }
  
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
  
  .info-btn:hover {
    background-color: #2980b9;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
  }
  
  .info-btn i {
    margin-right: 5px;
  }
  
  .filter-controls {
    margin: 10px 0;
    padding: 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  
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