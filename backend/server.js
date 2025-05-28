const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const csv = require('csv-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Models storage
const MODELS_DIR = path.join(__dirname, 'models');
const models = {};

// Add this right after your imports to create the directory structure if it doesn't exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    console.log(`Created directory: ${directory}`);
  }
};

// Create the reference data directory
const referenceDataDir = path.join(__dirname, 'data', 'reference');
ensureDirectoryExists(referenceDataDir);

// Create empty placeholder files if they don't exist
const createEmptyCSVIfNotExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    // Create a minimal CSV with headers
    const headers = 'KDPI,AGE_DON,CREAT_DON,OFFER_ACCEPT\n';
    fs.writeFileSync(filePath, headers);
    console.log(`Created empty CSV file: ${filePath}`);
  }
};

createEmptyCSVIfNotExists(path.join(referenceDataDir, 'baltimore_reference.csv'));
createEmptyCSVIfNotExists(path.join(referenceDataDir, 'boston_reference.csv'));
createEmptyCSVIfNotExists(path.join(referenceDataDir, 'la_reference.csv'));

// Load model metadata
function loadModels() {
  console.log('Models directory:', MODELS_DIR);
  
  try {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
      console.log('Created models directory');
      return;
    }
    
    const files = fs.readdirSync(MODELS_DIR);
    const modelFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of modelFiles) {
      const modelName = path.basename(file, '.json');
      const modelPath = path.join(MODELS_DIR, file);
      
      try {
        // Read file as string
        const modelContent = fs.readFileSync(modelPath, 'utf8');
        
        // Replace NaN with a special token we can identify later
        const fixedContent = modelContent.replace(/NaN/g, '"__NAN__"');
        
        try {
          // Parse the JSON with our placeholder
          const modelJson = JSON.parse(fixedContent, (key, value) => {
            // Convert "__NAN__" strings back to actual NaN
            if (value === "NaN") return NaN;
            return value;
          });
          
          // Store model metadata and path
          models[modelName] = {
            path: modelPath,
            metadata: modelJson
          };
          console.log(`Loaded model metadata: ${modelName}`);
        } catch (jsonError) {
          console.error(`Error parsing JSON for ${file}:`, jsonError.message);
        }
      } catch (err) {
        console.error(`Error reading file ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error reading models directory:', err.message);
  }
}

// Extract model information from your XGBoost model format
function extractModelInfo(modelName, metadata) {
  try {
    // If this is a model file with the structure you described
    if (metadata.learner) {
      const learner = metadata.learner;
      const objective = learner.objective ? learner.objective.name : 'unknown';
      const numTrees = learner.gradient_booster?.model?.gbtree_model_param?.num_trees || '0';
      const numFeatures = learner.learner_model_param?.num_feature || '0';
      const featureNames = learner.feature_names || [];
      
      // Try to extract scikit-learn attributes if available
      let modelType = 'XGBoost';
      let additionalInfo = {};
      
      if (learner.attributes && learner.attributes.scikit_learn) {
        try {
          const scikitAttrs = JSON.parse(learner.attributes.scikit_learn);
          if (scikitAttrs._estimator_type) {
            modelType = `XGBoost ${scikitAttrs._estimator_type}`;
          }
          additionalInfo = scikitAttrs;
        } catch (e) {
          console.log('Could not parse scikit-learn attributes');
        }
      }
      
      // Extract parameters
      const parameters = {
        objective: objective,
        num_trees: numTrees,
        num_features: numFeatures,
        base_score: learner.learner_model_param?.base_score || '0.5'
      };
      
      // Add any additional parameters from gradient_booster if available
      if (learner.gradient_booster?.model?.trees && learner.gradient_booster.model.trees.length > 0) {
        const firstTree = learner.gradient_booster.model.trees[0];
        if (firstTree.tree_param) {
          Object.assign(parameters, firstTree.tree_param);
        }
      }
      
      return {
        id: modelName,
        name: modelName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: modelType,
        description: `XGBoost model with ${numTrees} trees and ${numFeatures} features`,
        accuracy: additionalInfo.accuracy || additionalInfo.score || 0.8,
        lastUpdated: new Date().toISOString().split('T')[0], // Current date as fallback
        parameters: parameters,
        features: featureNames
      };
    } 
    // If this is a separate metadata file
    else {
      return {
        id: modelName,
        name: metadata.name || metadata.model_name || modelName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: metadata.type || metadata.model_type || 'XGBoost',
        description: metadata.description || metadata.model_description || 'No description available',
        accuracy: metadata.accuracy || metadata.model_accuracy || 0.8,
        lastUpdated: metadata.last_updated || metadata.updated_at || new Date().toISOString().split('T')[0],
        parameters: metadata.parameters || metadata.hyperparameters || {},
        features: metadata.features || metadata.feature_names || []
      };
    }
  } catch (error) {
    console.error(`Error extracting model info for ${modelName}:`, error);
    // Return default info if extraction fails
    return {
      id: modelName,
      name: modelName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'XGBoost',
      description: 'No description available',
      accuracy: 0.8,
      lastUpdated: new Date().toISOString().split('T')[0],
      parameters: {},
      features: []
    };
  }
}

// Get all models
app.get('/api/models', (req, res) => {
  const modelList = Object.keys(models).map(modelName => {
    const metadata = models[modelName].metadata || {};
    return extractModelInfo(modelName, metadata);
  });
  
  res.json(modelList);
});

// Run prediction using Python as a fallback
app.post('/api/predict/:modelId', async (req, res) => {
  try {
    // Log the input data
    console.log('Model ID:', req.params.modelId);
    console.log('Input data sample:', JSON.stringify(req.body[0], null, 2));
    
    const modelId = req.params.modelId;
    const inputData = req.body;
    
    if (!models[modelId]) {
      return res.status(404).json({ error: `Model ${modelId} not found` });
    }
    
    // Create a temporary Python script to run the prediction
    const scriptPath = path.join(__dirname, `temp_script_${Date.now()}.py`);
    const modelPath = models[modelId].path;
    
    // Log model path
    console.log('Loading model from:', modelPath);
    
    // Check if model file exists
    if (!fs.existsSync(modelPath)) {
      console.error('Model file does not exist:', modelPath);
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Preprocess the data to handle non-numeric values
    const processedData = inputData.map(record => {
      const processed = {};
      Object.keys(record).forEach(key => {
        // Convert string values that should be numeric
        if (record[key] === null || record[key] === undefined) {
          processed[key] = 0; // Default value for missing data
        } else if (typeof record[key] === 'string') {
          // Try to convert to number if possible
          const num = parseFloat(record[key]);
          if (!isNaN(num)) {
            processed[key] = num;
          } else {
            // Handle categorical values - convert to numeric codes
            processed[key] = 0;
          }
        } else {
          processed[key] = record[key];
        }
      });
      return processed;
    });
    
    // Create Python script content with diagnostic outputs for all prediction formats
    const scriptContent = `
import sys
import json
import numpy as np
import xgboost as xgb
import pickle
import os

def main():
    try:
        model_path = '${modelPath.replace(/\\/g, '\\\\')}'
        print(f"Loading model from: {model_path}", file=sys.stderr)
        
        # Check if the file is a JSON file
        if model_path.endswith('.json'):
            # For JSON model files, we need to load differently
            print("Detected JSON model file, using XGBoost native loader", file=sys.stderr)
            model = xgb.Booster()
            model.load_model(model_path)
            
            # Get feature names - for JSON models we need to extract them properly
            feature_names = []
            objective = None
            
            # Try to read the metadata to get feature names and objective
            try:
                with open(model_path, 'r') as f:
                    model_json = json.load(f)
                    if 'learner' in model_json:
                        if 'feature_names' in model_json['learner']:
                            feature_names = model_json['learner']['feature_names']
                            print(f"Found {len(feature_names)} feature names in model JSON", file=sys.stderr)
                        
                        # Extract objective function
                        if 'objective' in model_json['learner']:
                            objective = model_json['learner']['objective'].get('name')
                            print(f"Model objective: {objective}", file=sys.stderr)
                    else:
                        raise ValueError("Model JSON does not contain learner attribute")
            except Exception as e:
                print(f"Error reading metadata from JSON: {str(e)}", file=sys.stderr)
                raise ValueError("Could not determine feature names from model. This is required for accurate predictions.")
        else:
            # For pickle files, load normally
            print("Loading pickle model file", file=sys.stderr)
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            
            # Get feature names from the model
            feature_names = getattr(model, 'feature_names', None)
            
            # If feature_names not available, try to get from feature_names_in_
            if not feature_names:
                feature_names = getattr(model, 'feature_names_in_', None)
            
            if not feature_names:
                raise ValueError("Could not determine feature names from model. This is required for accurate predictions.")
            
            # Try to get objective from model
            objective = getattr(model, 'objective', None)
            if objective:
                print(f"Model objective: {objective}", file=sys.stderr)
        
        print(f"Using feature names: {feature_names}", file=sys.stderr)
        
        # Parse input data
        input_data = json.loads('''${JSON.stringify(processedData)}''')
        
        # Convert input data to DMatrix format with strict feature ordering
        rows = []
        for record in input_data:
            try:
                # Create row with exact feature ordering from model
                row = []
                for feature in feature_names:
                    value = record.get(feature, 0)
                    try:
                        row.append(float(value))
                    except (ValueError, TypeError):
                        # If conversion fails, use 0 as default
                        print(f"Warning: Could not convert value '{value}' for feature '{feature}' to float. Using 0.", file=sys.stderr)
                        row.append(0.0)
                rows.append(row)
            except Exception as e:
                print(f"Error processing record: {str(e)}", file=sys.stderr)
                continue
        
        if not rows:
            print("No valid rows to process", file=sys.stderr)
            sys.exit(1)
        
        # Create DMatrix with explicit feature names to ensure correct ordering
        print(f"Creating DMatrix with {len(rows)} rows and {len(feature_names)} features", file=sys.stderr)
        dmatrix = xgb.DMatrix(np.array(rows), feature_names=feature_names)
        
        # Make predictions with both raw scores and probabilities
        print("Running predictions with different output formats", file=sys.stderr)
        
        # Get raw scores (margin values)
        raw_scores = model.predict(dmatrix, output_margin=True)
        print(f"Generated {len(raw_scores)} raw scores", file=sys.stderr)
        print(f"Raw scores shape: {raw_scores.shape if hasattr(raw_scores, 'shape') else 'scalar'}", file=sys.stderr)
        
        # Get probabilities (apply sigmoid internally)
        probabilities = model.predict(dmatrix, output_margin=False)
        print(f"Generated {len(probabilities)} probabilities", file=sys.stderr)
        print(f"Probabilities shape: {probabilities.shape if hasattr(probabilities, 'shape') else 'scalar'}", file=sys.stderr)
        
        # Process predictions with multiple interpretations
        results = []
        for i in range(len(raw_scores)):
            # Initialize result entry with ID
            result_entry = {"id": i}
            
            # Get raw score - handle both array and scalar cases
            if isinstance(raw_scores[i], np.ndarray):
                raw_score = float(raw_scores[i][0])
                result_entry["raw_score_array"] = [float(s) for s in raw_scores[i]]
            else:
                raw_score = float(raw_scores[i])
            
            result_entry["raw_score"] = raw_score
            
            # Get probability - handle both array and scalar cases
            if isinstance(probabilities[i], np.ndarray):
                # If array output, store all values
                result_entry["prob_array"] = [float(p) for p in probabilities[i]]
                
                if len(probabilities[i]) > 1:
                    result_entry["prob_index_0"] = float(probabilities[i][0])
                    result_entry["prob_index_1"] = float(probabilities[i][1])
                    # Use index 1 as the main probability (common for binary classification)
                    prob = float(probabilities[i][1])
                else:
                    # Single value array
                    result_entry["prob_array_single"] = float(probabilities[i][0])
                    prob = float(probabilities[i][0])
            else:
                # If scalar output
                result_entry["prob_scalar"] = float(probabilities[i])
                prob = float(probabilities[i])
            
            # Always calculate sigmoid manually from raw score
            sigmoid_prob = 1.0 / (1.0 + np.exp(-raw_score))
            result_entry["sigmoid_prob"] = float(sigmoid_prob)
            
            # Always calculate inverse sigmoid
            result_entry["inverse_sigmoid_prob"] = float(1.0 - sigmoid_prob)
            
            # Store the probability we would use (from model's output)
            result_entry["probability"] = prob
            
            # Determine outcomes using different thresholds
            result_entry["outcome_standard"] = "Accepted" if prob > 0.5 else "Rejected"
            result_entry["outcome_sigmoid"] = "Accepted" if sigmoid_prob > 0.5 else "Rejected"
            result_entry["outcome_inverse"] = "Accepted" if (1.0 - sigmoid_prob) > 0.5 else "Rejected"
            
            # Set the main outcome
            result_entry["outcome"] = "Accepted" if prob > 0.5 else "Rejected"
            
            results.append(result_entry)
        
        # Output results as JSON
        print(json.dumps({"results": results}))
    except Exception as e:
        print(f"Error in Python script: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

    fs.writeFileSync(scriptPath, scriptContent);
    
    // Execute the Python script with proper error handling
    try {
      const { stdout, stderr } = await new Promise((resolve, reject) => {
        exec(`python ${scriptPath}`, (error, stdout, stderr) => {
          if (error) {
            console.error('Exec error:', error.message);
            console.error('Stderr:', stderr);
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
      
      // Clean up the temporary script
      fs.unlinkSync(scriptPath);
      
      if (stderr) {
        console.error(`Python stderr:`, stderr);
        // Don't return error if there's also stdout - some libraries print to stderr
        if (!stdout) {
          return res.status(500).json({ error: `Error running prediction: ${stderr}` });
        }
      }
      
      // Parse and return the results
      try {
        const results = JSON.parse(stdout);
        return res.json(results);
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.error('Raw output:', stdout);
        return res.status(500).json({ error: `Error parsing prediction results: ${parseError.message}` });
      }
    } catch (execError) {
      // Clean up the temporary script
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      
      console.error('Exec error:', execError);
      return res.status(500).json({ error: `Error executing Python script: ${execError.message}` });
    }
  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: `Error running prediction: ${error.message}` });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    models_loaded: Object.keys(models).length
  });
});

// Remove the Python proxy middleware and revert to the original reference data endpoint
app.get('/api/reference-data/:city', (req, res) => {
  const city = req.params.city;
  let filePath;
  
  // Map city to the appropriate reference data file
  switch(city) {
    case 'Baltimore':
      filePath = path.join(__dirname, 'data', 'baltimore_reference.csv');
      break;
    case 'Boston':
      filePath = path.join(__dirname, 'data', 'boston_reference.csv');
      break;
    case 'LA':
      filePath = path.join(__dirname, 'data', 'la_reference.csv');
      break;
    default:
      return res.status(400).json({ error: `Invalid city: ${city}` });
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Reference file not found: ${filePath}`);
    return res.status(404).json({ error: `Reference data file not found for ${city}` });
  }
  
  // Read and parse the CSV file
  const results = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      console.log(`Loaded ${results.length} reference records for ${city}`);
      res.json(results);
    })
    .on('error', (error) => {
      console.error(`Error reading reference data for ${city}:`, error);
      res.status(500).json({ error: `Failed to read reference data: ${error.message}` });
    });
});

// Add UMAP endpoint
app.post('/api/umap/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const targetRecord = req.body.targetRecord;
    const recordId = req.body.recordId || 'unknown';
    
    console.log(`Generating UMAP for ${city} with record ID ${recordId}`);
    console.log('Target record keys:', Object.keys(targetRecord));
    
    // Check if reference data exists
    const referenceDataPath = path.join(__dirname, 'reference_data', city + '.json');
    if (!fs.existsSync(referenceDataPath)) {
      console.error(`Reference data file not found: ${referenceDataPath}`);
      return res.status(404).json({ error: `Reference data for ${city} not found` });
    }
    
    // Create a temporary Python script for UMAP
    const scriptPath = path.join(__dirname, `umap_script_${Date.now()}.py`);
    
    // Generate the Python script content
    const pythonScript = `
import sys
import json
import numpy as np
import os
import base64
from io import BytesIO
import matplotlib.pyplot as plt
import umap
from sklearn.preprocessing import StandardScaler

# Load input data
target_record = json.loads('''${JSON.stringify(targetRecord)}''')
record_id = "${recordId}"

# Define reference data path
reference_path = "${path.join(__dirname, 'reference_data', city + '.json')}"
print(f"Loading reference data from: {reference_path}")

# Check if reference file exists
if not os.path.exists(reference_path):
    print(f"Error: Reference file does not exist: {reference_path}")
    sys.exit(1)

try:
    # Load the reference data
    with open(reference_path, 'r') as f:
        reference_data = json.load(f)
    
    print(f"Loaded {len(reference_data)} reference records")
    
    # Get numerical features only
    numerical_features = []
    for key in target_record:
        try:
            float(target_record[key])
            numerical_features.append(key)
        except (ValueError, TypeError):
            pass
    
    # Filter out non-numerical features from reference data
    filtered_reference = []
    for record in reference_data:
        filtered_record = {}
        for feature in numerical_features:
            if feature in record and record[feature] is not None:
                try:
                    filtered_record[feature] = float(record[feature])
                except (ValueError, TypeError):
                    filtered_record[feature] = 0.0
            else:
                filtered_record[feature] = 0.0
        filtered_reference.append(filtered_record)
    
    # Prepare target record
    filtered_target = {}
    for feature in numerical_features:
        if feature in target_record and target_record[feature] is not None:
            try:
                filtered_target[feature] = float(target_record[feature])
            except (ValueError, TypeError):
                filtered_target[feature] = 0.0
        else:
            filtered_target[feature] = 0.0
    
    # Combine target and reference for UMAP
    all_records = [filtered_target] + filtered_reference
    
    # Extract features as a matrix
    feature_matrix = []
    for record in all_records:
        features = [record[feature] for feature in numerical_features]
        feature_matrix.append(features)
    
    # Convert to numpy array
    data = np.array(feature_matrix)
    
    # Standardize the data
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)
    
    # Apply UMAP
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, n_components=2, random_state=42)
    embedding = reducer.fit_transform(scaled_data)
    
    # Extract target and reference embeddings
    target_embedding = embedding[0]
    reference_embeddings = embedding[1:]
    
    # Get acceptance status for coloring
    acceptance_status = [1 if record.get('OFFER_ACCEPT', '0') in ['1', 1] else 0 
                         for record in reference_data]
    
    # Calculate distances from target to each reference point
    distances = np.sqrt(np.sum((reference_embeddings - target_embedding) ** 2, axis=1))
    
    # Get indices of 50 closest points
    closest_indices = np.argsort(distances)[:50]
    
    # Create the plot
    plt.figure(figsize=(10, 8))
    
    # Plot reference points (gray for background)
    plt.scatter(reference_embeddings[:, 0], reference_embeddings[:, 1], 
                c='lightgray', alpha=0.3, s=30)
    
    # Plot 50 closest points (colored by acceptance)
    for idx in closest_indices:
        color = 'green' if acceptance_status[idx] == 1 else 'red'
        plt.scatter(reference_embeddings[idx, 0], reference_embeddings[idx, 1], 
                    c=color, alpha=0.7, s=50)
    
    # Plot target point (larger and blue)
    plt.scatter(target_embedding[0], target_embedding[1], c='blue', s=150, 
                edgecolors='black', linewidths=1.5, label='Target Kidney')
    
    plt.title(f'UMAP Projection - {city} Region')
    plt.xlabel('UMAP Dimension 1')
    plt.ylabel('UMAP Dimension 2')
    
    # Add legend
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], marker='o', color='w', markerfacecolor='blue', markersize=10, label='Target Kidney'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='green', markersize=8, label='Accepted'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='red', markersize=8, label='Rejected'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='lightgray', alpha=0.5, markersize=8, label='Other Kidneys')
    ]
    plt.legend(handles=legend_elements, loc='upper right')
    
    # Save plot to a base64 string
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=100)
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    
    # Prepare result with embeddings and image
    result = {
        "target": target_embedding.tolist(),
        "reference": reference_embeddings.tolist(),
        "closest_indices": closest_indices.tolist(),
        "acceptance": acceptance_status,
        "image": image_base64
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
`;

    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    console.log(`Executing Python script: ${scriptPath}`);
    
    // Execute the Python script with increased maxBuffer
    exec(`python ${scriptPath}`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      // Clean up the temporary script
      fs.unlinkSync(scriptPath);
      
      if (error) {
        console.error(`Error executing UMAP script: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        return res.status(500).json({ error: `Error executing UMAP script: ${error.message}`, details: stderr });
      }
      
      if (stderr) {
        console.warn(`UMAP script warnings: ${stderr}`);
      }
      
      console.log(`UMAP script completed, stdout length: ${stdout.length}`);
      
      try {
        // Parse the last line of stdout as JSON
        const outputLines = stdout.trim().split('\n');
        const lastLine = outputLines[outputLines.length - 1];
        
        // Check if the last line looks like JSON
        if (!lastLine.startsWith('{') && !lastLine.startsWith('[')) {
          console.error('Last line is not JSON:', lastLine);
          return res.status(500).json({ 
            error: 'Invalid output format from Python script',
            output: stdout
          });
        }
        
        const result = JSON.parse(lastLine);
        console.log('UMAP result keys:', Object.keys(result));
        
        if (!result.image) {
          console.error('No image in UMAP result');
          return res.status(500).json({ error: 'No image generated by UMAP script' });
        }
        
        return res.json(result);
      } catch (parseError) {
        console.error(`Error parsing UMAP output: ${parseError.message}`);
        console.error(`Raw output: ${stdout}`);
        return res.status(500).json({ 
          error: `Error parsing UMAP output: ${parseError.message}`,
          rawOutput: stdout.substring(0, 1000) + '...' // Send first 1000 chars for debugging
        });
      }
    });
  } catch (error) {
    console.error(`Server error in UMAP endpoint: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Add endpoint to serve reference data
app.get('/api/reference/:city', (req, res) => {
  const city = req.params.city;
  console.log(`Received request for reference data for city: ${city}`);
  
  // Map city parameter to actual file names
  const cityFileMapping = {
    'boston': 'boston_reference.csv',
    'la': 'la_reference.csv',
    'baltimore': 'baltimore_reference.csv',
    // Add other cities as needed
  };
  
  const fileName = cityFileMapping[city.toLowerCase()];
  
  if (!fileName) {
    console.error(`Unknown city: ${city}`);
    return res.status(404).json({ error: `Unknown city: ${city}` });
  }
  
  const filePath = path.join(__dirname, 'data', fileName);
  console.log(`Looking for reference data at: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Reference data file not found: ${filePath}`);
    return res.status(404).json({ error: `Reference data for ${city} not found` });
  }
  
  try {
    // Read CSV file
    const csvData = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV to JSON
    const jsonData = parseCSV(csvData);
    
    console.log(`Successfully loaded ${jsonData.length} records for ${city}`);
    return res.json(jsonData);
  } catch (error) {
    console.error(`Error reading reference data: ${error.message}`);
    return res.status(500).json({ error: `Error reading reference data: ${error.message}` });
  }
});

// Helper function to parse CSV to JSON
function parseCSV(csvData) {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  const jsonData = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    const obj = {};
    
    for (let j = 0; j < headers.length; j++) {
      // Handle quoted values
      let value = values[j];
      if (value === undefined) {
        value = '';
      }
      
      // Try to convert to number if possible
      const numValue = Number(value);
      obj[headers[j]] = isNaN(numValue) ? value : numValue;
    }
    
    jsonData.push(obj);
  }
  
  return jsonData;
}

// Start server
loadModels();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 