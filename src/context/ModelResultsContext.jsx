import React, { createContext, useState, useContext } from 'react';

const ModelResultsContext = createContext();

export const ModelResultsProvider = ({ children }) => {
  const [modelResults, setModelResults] = useState({
    predictions: [],
    fileData: [],
    similarKidneys: [],
    regionalAcceptance: {} // Will store regional acceptance probabilities
  });

  const updateModelResults = (newResults) => {
    setModelResults(prev => ({
      ...prev,
      ...newResults
    }));
  };

  const clearModelResults = () => {
    setModelResults({
      predictions: [],
      fileData: [],
      similarKidneys: [],
      regionalAcceptance: {}
    });
  };

  return (
    <ModelResultsContext.Provider value={{ 
      modelResults, 
      updateModelResults,
      clearModelResults 
    }}>
      {children}
    </ModelResultsContext.Provider>
  );
};

export const useModelResults = () => useContext(ModelResultsContext); 