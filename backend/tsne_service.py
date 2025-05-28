from flask import Blueprint, request, jsonify
from sklearn.manifold import TSNE
import numpy as np
import pandas as pd
import json
import os

tsne_bp = Blueprint('tsne', __name__)

# Cache for T-SNE results
tsne_cache = {}

@tsne_bp.route('/api/tsne/<city>', methods=['POST'])
def generate_tsne(city):
    try:
        data = request.json
        target_record = data.get('targetRecord')
        record_id = target_record.get('PTR_SEQUENCE_NUM', 'unknown')
        
        # Check cache first
        cache_key = f"{city}_{record_id}"
        if cache_key in tsne_cache:
            print(f"Using cached T-SNE for {cache_key}")
            return jsonify(tsne_cache[cache_key])
        
        print(f"Generating T-SNE for {city}, record {record_id}")
        
        # Get the important features for this city
        features = get_important_features(city)
        
        # Load the dataset for the city
        city_data = load_city_data(city)
        
        if not city_data or len(city_data) == 0:
            return jsonify({'error': f'No data available for {city}'}), 404
            
        print(f"Processing {len(city_data)} records for T-SNE")
        
        # Extract the target record features
        target_features = []
        for feature in features:
            value = target_record.get(feature, 0)
            # Convert to float if possible
            try:
                value = float(value)
            except (ValueError, TypeError):
                value = 0
            target_features.append(value)
            
        # Extract features from the city dataset
        X = []
        for record in city_data:
            record_features = []
            for feature in features:
                value = record.get(feature, 0)
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    value = 0
                record_features.append(value)
            X.append(record_features)
            
        # Combine target record with city data
        X_combined = [target_features] + X
        
        # Convert to numpy array
        X_np = np.array(X_combined)
        
        # Handle NaN values
        X_np = np.nan_to_num(X_np)
        
        # For large datasets, consider using a sample
        max_points = 5000  # Adjust based on performance needs
        if len(X_np) > max_points:
            print(f"Sampling {max_points} points from {len(X_np)} total points")
            # Always keep the target record (index 0)
            indices = np.random.choice(len(X_np) - 1, min(max_points - 1, len(X_np) - 1), replace=False) + 1
            indices = np.append([0], indices)  # Add target record index
            X_np = X_np[indices]
        
        # Generate T-SNE
        perplexity = min(30, len(X_np) - 1)  # Perplexity should be less than n_samples
        print(f"Running T-SNE with perplexity {perplexity} on {len(X_np)} points")
        
        tsne = TSNE(n_components=2, perplexity=perplexity, 
                   random_state=42, n_iter=1000)
        tsne_result = tsne.fit_transform(X_np)
        
        # Convert to list for JSON serialization
        tsne_coordinates = tsne_result.tolist()
        
        # Prepare response
        response = {
            'coordinates': tsne_coordinates,
            'recordId': record_id
        }
        
        # Cache the result
        tsne_cache[cache_key] = response
        
        return jsonify(response)
        
    except Exception as e:
        import traceback
        print(f"Error generating T-SNE: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

def get_important_features(city):
    """Get the important features for a specific city."""
    feature_map = {
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
    }
    return feature_map.get(city, [])

def load_city_data(city):
    """Load data for a specific city from CSV files."""
    try:
        # Map city names to file paths
        city_file_map = {
            'Baltimore': 'data/baltimore_reference.csv',
            'LA': 'data/la_reference.csv',
            'Boston': 'data/boston_reference.csv'
        }
        
        # Get the file path for the city
        file_path = city_file_map.get(city)
        if not file_path:
            print(f"No reference file defined for city: {city}")
            return []
            
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"Reference file not found: {file_path}")
            return []
            
        # Load the CSV file
        print(f"Loading reference data from {file_path}")
        df = pd.read_csv(file_path)
        
        # Convert DataFrame to list of dictionaries
        records = df.to_dict('records')
        print(f"Loaded {len(records)} records for {city}")
        
        return records
        
    except Exception as e:
        print(f"Error loading reference data for {city}: {str(e)}")
        return [] 