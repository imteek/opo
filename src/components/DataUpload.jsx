/**
 * DataUpload Component
 * 
 * This component provides a CSV file upload interface for the application.
 * It allows users to:
 * - Upload CSV files containing organ donor information
 * - Preview data before uploading
 * - View and manage previously uploaded files
 * - Store uploaded data in localStorage for persistence
 */
import React, { useState, useEffect, useRef } from 'react';

const DataUpload = () => {
  // State for the currently selected file object
  const [file, setFile] = useState(null);
  
  // State for the name of the currently selected file
  const [fileName, setFileName] = useState('');
  
  // State for tracking and displaying upload status messages
  const [uploadStatus, setUploadStatus] = useState('');
  
  // State for storing all previously uploaded files
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  // State for storing preview data of the currently selected file
  const [previewData, setPreviewData] = useState(null);
  
  // State for tracking which file's preview is expanded in the list
  const [expandedFileId, setExpandedFileId] = useState(null);

  /**
   * Load previously uploaded files from localStorage when component mounts
   * This provides persistence of uploaded files between sessions
   */
  useEffect(() => {
    const storedFiles = localStorage.getItem('uploadedFiles');
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles);
        console.log('Loaded files from localStorage:', parsedFiles);
        setUploadedFiles(parsedFiles);
      } catch (e) {
        console.error('Error parsing files from localStorage:', e);
      }
    }
  }, []);

  /**
   * Handles file selection from the file input
   * Sets the selected file and generates a preview
   * 
   * @param {Event} e - The change event from the file input
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      
      // Generate preview by parsing the CSV
      parseCSV(selectedFile);
    }
  };

  /**
   * Parses a CSV file and generates preview data
   * Handles CSV parsing with special consideration for quoted fields
   * Removes specific columns (KDRI_MED and KDRI_RAO)
   * Creates both a limited preview and stores complete data
   * 
   * @param {File} file - The CSV file to parse
   */
  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      
      /**
       * Helper function to parse a CSV line with proper handling of quoted fields
       * Quotes can be used in CSV to escape commas within a field
       * 
       * @param {string} line - A single line from the CSV file
       * @return {Array} - Array of cell values from the line
       */
      const parseCSVLine = (line) => {
        const result = [];
        let cell = '';
        let inQuotes = false;
        
        // Process each character in the line
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            // Toggle quote state when we encounter a quote character
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // End of cell if we see a comma outside of quotes
            result.push(cell);
            cell = '';
          } else {
            // Add character to current cell
            cell += char;
          }
        }
        
        // Add the last cell after processing all characters
        result.push(cell);
        return result;
      };
      
      // Split the file content into rows (handles different line endings)
      const rows = text.split(/\r?\n/);
      
      // Parse the header row
      const headers = parseCSVLine(rows[0]);
      
      // Remove specific columns that should be excluded (KDRI_MED and KDRI_RAO)
      const filteredHeaders = headers.filter(header => 
        header !== 'KDRI_MED' && header !== 'KDRI_RAO'
      );
      
      // Get the indices of columns to remove for data consistency
      const indicesToRemove = [];
      headers.forEach((header, index) => {
        if (header === 'KDRI_MED' || header === 'KDRI_RAO') {
          indicesToRemove.push(index);
        }
      });
      
      // Create a limited set of headers for the preview (first 5 columns)
      const previewHeaders = filteredHeaders.slice(0, 5);
      if (filteredHeaders.length > 5) {
        previewHeaders.push('...'); // Add ellipsis to indicate more columns exist
      }
      
      // Process first 5 data rows for preview
      const previewRows = rows.slice(1, 6).map(row => {
        if (!row.trim()) return null; // Skip empty rows
        
        const values = parseCSVLine(row);
        
        // Remove KDRI_MED and KDRI_RAO values using the indices identified earlier
        const filteredValues = values.filter((_, index) => !indicesToRemove.includes(index));
        
        const previewValues = {};
        
        // Create an object with just the preview columns (first 5)
        previewHeaders.forEach((header, index) => {
          if (header === '...') {
            previewValues[header] = '...';
          } else {
            previewValues[header] = index < filteredValues.length ? filteredValues[index] : '';
          }
        });
        
        return previewValues;
      }).filter(row => row !== null); // Remove any null rows
      
      // Process all data rows for complete dataset storage
      const allRows = rows.slice(1).map(row => {
        if (!row.trim()) return null; // Skip empty rows
        
        const values = parseCSVLine(row);
        
        // Remove KDRI_MED and KDRI_RAO values
        const filteredValues = values.filter((_, index) => !indicesToRemove.includes(index));
        
        // Create a complete object with all columns
        return filteredHeaders.reduce((obj, header, index) => {
          obj[header] = index < filteredValues.length ? filteredValues[index] : '';
          return obj;
        }, {});
      }).filter(row => row !== null); // Remove null entries
      
      // Store both the preview and complete data
      setPreviewData({
        headers: previewHeaders,       // Limited headers for preview
        rows: previewRows,             // Limited rows for preview
        allHeaders: filteredHeaders,   // All headers for complete data
        allRows: allRows               // All rows for complete data
      });
    };
    
    // Start reading the file as text
    reader.readAsText(file);
  };

  /**
   * Handles the file upload process
   * In this implementation, it simulates an upload by storing data in localStorage
   * In a real application, this would send data to a backend server
   */
  const handleUpload = () => {
    // Validate that a file is selected
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    // Show uploading status
    setUploadStatus('Uploading...');
    
    // Simulate network delay with setTimeout (would be a real API call in production)
    setTimeout(() => {
      // Create a new file entry with metadata and parsed data
      const newFile = {
        id: Date.now(),                            // Unique ID based on timestamp
        name: fileName,                            // File name
        date: new Date().toLocaleDateString(),     // Current date
        size: (file.size / 1024).toFixed(2) + ' KB', // File size in KB
        type: file.type,                           // File MIME type
        data: previewData                          // Parsed data (both preview and complete)
      };
      
      // Add new file to the list of uploaded files
      const updatedFiles = [...uploadedFiles, newFile];
      setUploadedFiles(updatedFiles);
      
      // Save updated files list to localStorage for persistence
      localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
      
      // Reset state and show success message
      setUploadStatus('File uploaded successfully!');
      setFile(null);
      setFileName('');
      setPreviewData(null);
    }, 1500); // 1.5 second delay to simulate upload time
  };

  /**
   * Toggles the expanded preview state for a file in the list
   * 
   * @param {number} fileId - ID of the file to toggle preview for
   */
  const toggleFilePreview = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null); // Hide preview if already expanded
    } else {
      setExpandedFileId(fileId); // Show preview for this file
    }
  };

  /**
   * Handles deletion of an uploaded file
   * Confirms with user before deleting and updates localStorage
   * 
   * @param {number} fileId - ID of the file to delete
   */
  const handleDeleteFile = (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      // Filter out the file with the specified ID
      const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
      setUploadedFiles(updatedFiles);
      
      // Update localStorage with the new list
      localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
      
      // If the deleted file was expanded, collapse it
      if (expandedFileId === fileId) {
        setExpandedFileId(null);
      }
    }
  };

  return (
    <div className="data-upload-container">
      {/* Header section with title and description */}
      <header>
        <h1>Data Upload</h1>
        <p>Upload CSV files containing organ donor information for analysis</p>
      </header>

      {/* Main upload section with file selection and preview */}
      <div className="upload-section-centered">
        {/* File upload card with drag/drop area and file selection */}
        <div className="upload-card">
          <div className="upload-area">
            <i className="fas fa-file-csv"></i>
            <h3>Upload CSV File</h3>
            <p>Drag and drop your file here or click to browse</p>
            <input 
              type="file" 
              id="csv-upload" 
              accept=".csv" 
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="csv-upload" className="file-label">
              Select File
            </label>
            {/* Display selected filename if a file is chosen */}
            {fileName && (
              <div className="selected-file">
                <i className="fas fa-file-alt"></i>
                <span>{fileName}</span>
              </div>
            )}
          </div>
          
          {/* Upload button and status message */}
          <div className="upload-actions">
            <button 
              className="upload-btn" 
              onClick={handleUpload}
              disabled={!file} // Disable if no file selected
            >
              <i className="fas fa-upload"></i> Upload File
            </button>
            {/* Show upload status message if present */}
            {uploadStatus && (
              <div className={`upload-status ${uploadStatus.includes('success') ? 'success' : ''}`}>
                {uploadStatus}
              </div>
            )}
          </div>
        </div>

        {/* Preview card showing sample of the selected file data */}
        {previewData && (
          <div className="preview-card">
            <h3>Data Preview</h3>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {/* Render header row with column names */}
                    {previewData.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Render preview rows (limited to first 5) */}
                  {previewData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {previewData.headers.map((header, colIndex) => (
                        <td key={colIndex}>{row[header]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="preview-note">Showing first 5 rows and columns</p>
          </div>
        )}
      </div>

      {/* Table listing all previously uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-section">
          <h3>Uploaded Files</h3>
          <div className="files-table-container">
            <table className="files-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Upload Date</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Map through all uploaded files and render a row for each */}
                {uploadedFiles.map((file) => (
                  <React.Fragment key={file.id}>
                    {/* Main file row with metadata */}
                    <tr>
                      <td>{file.name}</td>
                      <td>{file.date}</td>
                      <td>{file.size}</td>
                      <td>{file.type}</td>
                      <td>
                        {/* View/hide toggle button */}
                        <button 
                          className={`action-btn view-btn ${expandedFileId === file.id ? 'active' : ''}`}
                          onClick={() => toggleFilePreview(file.id)}
                        >
                          <i className={`fas ${expandedFileId === file.id ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                        {/* Delete file button */}
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteFile(file.id)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expandable preview row - only shown when file is expanded */}
                    {expandedFileId === file.id && (
                      <tr className="file-preview-row">
                        <td colSpan="5">
                          <div className="inline-preview">
                            <h4>File Preview</h4>
                            <div className="preview-table-container">
                              <table className="preview-table">
                                <thead>
                                  <tr>
                                    {/* Render preview headers */}
                                    {file.data.headers.map((header, index) => (
                                      <th key={index}>{header}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Render preview rows */}
                                  {file.data.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {file.data.headers.map((header, colIndex) => (
                                        <td key={colIndex}>{row[header]}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="preview-note">Showing first 5 rows and columns</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guidelines section with tips for uploading */}
      <div className="upload-guidelines">
        <h3>Upload Guidelines</h3>
        <ul>
          <li>Files must be in CSV format</li>
          <li>Maximum file size: 10MB</li>
          <li>Required columns: Donor ID, Organ Type, Date, Hospital, Status</li>
          <li>Dates should be in MM/DD/YYYY format</li>
          <li>Each row should represent a single organ donation record</li>
        </ul>
      </div>
    </div>
  );
};

export default DataUpload; 