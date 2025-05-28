// This is a Vercel serverless function that will proxy requests to your Express app
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Import your Express app
const expressApp = require('../backend/server');

// Create a handler for Vercel
module.exports = (req, res) => {
  // Pass the request to your Express app
  return expressApp(req, res);
}; 