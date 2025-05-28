import React, { useState, useEffect, useRef } from 'react';

const DataUpload = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [expandedFileId, setExpandedFileId] = useState(null);

  // Load files from localStorage on component mount
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      
      // Preview CSV data
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      
      // Parse CSV with proper handling of quoted fields
      const parseCSVLine = (line) => {
        const result = [];
        let cell = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // End of cell
            result.push(cell);
            cell = '';
          } else {
            cell += char;
          }
        }
        
        // Add the last cell
        result.push(cell);
        return result;
      };
      
      const rows = text.split(/\r?\n/); // Handle both CRLF and LF line endings
      const headers = parseCSVLine(rows[0]);
      
      // Remove KDRI_MED and KDRI_RAO columns
      const filteredHeaders = headers.filter(header => 
        header !== 'KDRI_MED' && header !== 'KDRI_RAO'
      );
      
      // Get indices of columns to remove
      const indicesToRemove = [];
      headers.forEach((header, index) => {
        if (header === 'KDRI_MED' || header === 'KDRI_RAO') {
          indicesToRemove.push(index);
        }
      });
      
      // Limit the number of columns shown in preview (first 5 columns)
      const previewHeaders = filteredHeaders.slice(0, 5);
      if (filteredHeaders.length > 5) {
        previewHeaders.push('...');
      }
      
      const previewRows = rows.slice(1, 6).map(row => {
        if (!row.trim()) return null; // Skip empty rows
        
        const values = parseCSVLine(row);
        
        // Remove KDRI_MED and KDRI_RAO values
        const filteredValues = values.filter((_, index) => !indicesToRemove.includes(index));
        
        const previewValues = {};
        
        // Only include the first 5 columns in preview
        previewHeaders.forEach((header, index) => {
          if (header === '...') {
            previewValues[header] = '...';
          } else {
            previewValues[header] = index < filteredValues.length ? filteredValues[index] : '';
          }
        });
        
        return previewValues;
      }).filter(row => row !== null);
      
      // Create full data structure for all rows
      const allRows = rows.slice(1).map(row => {
        if (!row.trim()) return null; // Skip empty rows
        
        const values = parseCSVLine(row);
        
        // Remove KDRI_MED and KDRI_RAO values
        const filteredValues = values.filter((_, index) => !indicesToRemove.includes(index));
        
        return filteredHeaders.reduce((obj, header, index) => {
          obj[header] = index < filteredValues.length ? filteredValues[index] : '';
          return obj;
        }, {});
      }).filter(row => row !== null); // Remove null entries
      
      setPreviewData({
        headers: previewHeaders,
        rows: previewRows,
        // Store all data for the full view
        allHeaders: filteredHeaders,
        allRows: allRows
      });
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    // In a real application, you would send the file to your server here
    // For this example, we'll simulate a successful upload
    setUploadStatus('Uploading...');
    
    setTimeout(() => {
      const newFile = {
        id: Date.now(),
        name: fileName,
        date: new Date().toLocaleDateString(),
        size: (file.size / 1024).toFixed(2) + ' KB',
        type: file.type,
        data: previewData
      };
      
      const updatedFiles = [...uploadedFiles, newFile];
      setUploadedFiles(updatedFiles);
      
      // Save to localStorage
      localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
      
      setUploadStatus('File uploaded successfully!');
      setFile(null);
      setFileName('');
      setPreviewData(null);
    }, 1500);
  };

  const toggleFilePreview = (fileId) => {
    if (expandedFileId === fileId) {
      setExpandedFileId(null); // Hide preview if already expanded
    } else {
      setExpandedFileId(fileId); // Show preview for this file
    }
  };

  const handleDeleteFile = (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
      setUploadedFiles(updatedFiles);
      
      // Update localStorage
      localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
      
      if (expandedFileId === fileId) {
        setExpandedFileId(null);
      }
    }
  };

  return (
    <div className="data-upload-container">
      <header>
        <h1>Data Upload</h1>
        <p>Upload CSV files containing organ donor information for analysis</p>
      </header>

      <div className="upload-section-centered">
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
            {fileName && (
              <div className="selected-file">
                <i className="fas fa-file-alt"></i>
                <span>{fileName}</span>
              </div>
            )}
          </div>
          <div className="upload-actions">
            <button 
              className="upload-btn" 
              onClick={handleUpload}
              disabled={!file}
            >
              <i className="fas fa-upload"></i> Upload File
            </button>
            {uploadStatus && (
              <div className={`upload-status ${uploadStatus.includes('success') ? 'success' : ''}`}>
                {uploadStatus}
              </div>
            )}
          </div>
        </div>

        {previewData && (
          <div className="preview-card">
            <h3>Data Preview</h3>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {previewData.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
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
                {uploadedFiles.map((file) => (
                  <React.Fragment key={file.id}>
                    <tr>
                      <td>{file.name}</td>
                      <td>{file.date}</td>
                      <td>{file.size}</td>
                      <td>{file.type}</td>
                      <td>
                        <button 
                          className={`action-btn view-btn ${expandedFileId === file.id ? 'active' : ''}`}
                          onClick={() => toggleFilePreview(file.id)}
                        >
                          <i className={`fas ${expandedFileId === file.id ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteFile(file.id)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                    {expandedFileId === file.id && (
                      <tr className="file-preview-row">
                        <td colSpan="5">
                          <div className="inline-preview">
                            <h4>File Preview</h4>
                            <div className="preview-table-container">
                              <table className="preview-table">
                                <thead>
                                  <tr>
                                    {file.data.headers.map((header, index) => (
                                      <th key={index}>{header}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
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