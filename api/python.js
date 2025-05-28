// This will be a proxy to your Python Flask app
const { spawn } = require('child_process');
const { parse } = require('url');

module.exports = (req, res) => {
  // Parse the URL to get the path
  const { pathname, query } = parse(req.url, true);
  
  // Extract the city parameter from the path
  const cityMatch = pathname.match(/\/api\/tsne\/([^\/]+)/);
  const city = cityMatch ? cityMatch[1] : null;
  
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }
  
  // Create a temporary Python script that will run your Flask app logic
  const pythonProcess = spawn('python', ['-c', `
import sys
import json
import numpy as np
import base64
from io import BytesIO
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import umap

# Parse the input data
input_data = json.loads('''${JSON.stringify(req.body)}''')
target_record = input_data.get('targetRecord', {})

# Your existing TSNE/UMAP logic here
# This is a simplified version - you'll need to adapt your actual logic
try:
    # Process the data
    # ...
    
    # Generate the visualization
    # ...
    
    # Return the result
    result = {
        "coordinates": [[0, 0], [1, 1]], # Placeholder
        "image": "base64_encoded_image_here"
    }
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
  `]);
  
  let dataString = '';
  
  pythonProcess.stdout.on('data', (data) => {
    dataString += data.toString();
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });
  
  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Python process failed' });
    }
    
    try {
      const result = JSON.parse(dataString);
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse Python output' });
    }
  });
}; 