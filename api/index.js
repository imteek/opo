// This is a Vercel serverless function that will proxy requests to your Express app
const express = require('express');
const cors = require('cors');

// Import the routes from your Express app
const server = require('../backend/server');

// Create a minimal Express app for Vercel
const app = express();
app.use(cors());

// Use the routes from your server
app.use('/', server);

// Export the Express API
module.exports = app; 