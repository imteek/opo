// This is a Web Worker file that runs the t-SNE algorithm in a separate thread

// We'll use a self-contained t-SNE implementation
// This is a simplified version of the algorithm for demonstration
// For production, you might want to use a more optimized implementation

import TSNE from 'tsne-js';

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { dataMatrix, options } = event.data;
  
  try {
    // Create and configure the t-SNE model
    const model = new TSNE({
      dim: options.dim || 2,
      perplexity: options.perplexity || 30.0,
      earlyExaggeration: options.earlyExaggeration || 4.0,
      learningRate: options.learningRate || 100.0,
      nIter: options.nIter || 1000,
      metric: options.metric || 'euclidean'
    });
    
    // Initialize with data
    model.init({
      data: dataMatrix,
      type: 'dense'
    });
    
    // Run t-SNE iterations
    model.run();
    
    // Get output coordinates
    const tsneOutput = model.getOutputScaled();
    
    // Send the result back to the main thread
    self.postMessage({
      status: 'success',
      result: tsneOutput
    });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({
      status: 'error',
      error: error.message
    });
  }
});

// Simple t-SNE implementation (placeholder)
function simpleTSNE(data, options) {
  const n = data.length;
  const result = new Array(n);
  
  // Initialize with random positions
  for (let i = 0; i < n; i++) {
    result[i] = [
      Math.random() * 100 - 50,
      Math.random() * 100 - 50
    ];
  }
  
  // In a real implementation, you would perform the actual t-SNE algorithm here
  // For now, we'll just create a simple visualization based on the first two features
  
  // Find min/max for the first two features to normalize
  let min0 = Infinity, max0 = -Infinity;
  let min1 = Infinity, max1 = -Infinity;
  
  for (let i = 0; i < n; i++) {
    if (data[i][0] < min0) min0 = data[i][0];
    if (data[i][0] > max0) max0 = data[i][0];
    if (data[i][1] < min1) min1 = data[i][1];
    if (data[i][1] > max1) max1 = data[i][1];
  }
  
  // Create a simple 2D projection based on the first two features
  for (let i = 0; i < n; i++) {
    const x = (data[i][0] - min0) / (max0 - min0 || 1) * 100 - 50;
    const y = (data[i][1] - min1) / (max1 - min1 || 1) * 100 - 50;
    result[i] = [x, y];
  }
  
  return result;
} 