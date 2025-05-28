import os
import sys
import json
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/reference-data/<city>', methods=['GET'])
def get_reference_data(city):
    # Map city to file name
    file_mapping = {
        'Baltimore': 'baltimore_reference.csv',
        'Boston': 'boston_reference.csv',
        'LA': 'la_reference.csv'
    }
    
    # Get the data directory
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    print(f"Looking for reference data in: {data_dir}")
    
    # List all files in the data directory
    try:
        files = os.listdir(data_dir)
        print(f"Files in data directory: {files}")
    except Exception as e:
        print(f"Error listing files in {data_dir}: {str(e)}")
        return jsonify({'error': f'Error listing files: {str(e)}'}), 500
    
    # Try to find the file
    file_name = file_mapping.get(city)
    if not file_name or file_name not in files:
        # Try to find a file that contains the city name
        for f in files:
            if city.lower() in f.lower() and f.lower().endswith('.csv'):
                file_name = f
                print(f"Found matching file for {city}: {f}")
                break
    
    if not file_name:
        return jsonify({'error': f'Reference data file not found for {city}'}), 404
    
    file_path = os.path.join(data_dir, file_name)
    print(f"Using reference file: {file_path}")
    
    try:
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Print column names for debugging
        print(f"Columns in {file_name}: {df.columns.tolist()}")
        
        # Convert to JSON
        records = df.to_dict(orient='records')
        
        # Print the first record for debugging
        if records:
            print(f"First record from {city} reference data:")
            for key, value in records[0].items():
                print(f"  {key}: {value}")
        
        return jsonify(records)
    except Exception as e:
        print(f"Error reading {file_path}: {str(e)}")
        return jsonify({'error': f'Failed to read reference data: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=True) 