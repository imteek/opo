import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './components/HomePage'
import Dashboard from './components/Dashboard'
import RegionalData from './components/RegionalData'
import './App.css'
import Sidebar from './components/Sidebar'
import Trends from './components/Trends'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/regional" element={<RegionalData />} />
      <Route path="/trends" element={<Trends />} />
    </Routes>
  )
}

export default App
