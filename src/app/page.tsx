"use client";

import { useState } from "react";
import Image from "next/image";

type AnalysisResult = {
  status?: string;
  message?: string;
  segregated_category?: string;
  detected_labels?: string[];
  confidence?: number;
  document_id?: string;
  
  // Additional fields for fullness analysis
  fullness_level?: string;
  fill_percentage?: number;
};

export default function Home() {
  const [selectedOption, setSelectedOption] = useState<'segregation' | 'fullness' | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!uploadedFile || !selectedOption) return;

    setIsAnalyzing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('type', selectedOption);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error('Analysis error:', error);
      // Fallback to mock data on error
      if (selectedOption === 'segregation') {
        setAnalysisResult({
          status: 'Error',
          message: 'Analysis failed, showing mock data',
          segregated_category: 'Plastic',
          detected_labels: ['bottle', 'plastic', 'recyclable'],
          confidence: 0.85,
          document_id: 'mock_doc_id'
        });
      } else {
        setAnalysisResult({
          status: 'Error',
          message: 'Analysis failed, showing mock data',
          fullness_level: 'Medium',
          fill_percentage: 65,
          detected_labels: ['container', 'waste', 'bin'],
          confidence: 0.78,
          document_id: 'mock_doc_id'
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setAnalysisResult(null);
    setSelectedOption(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mr-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
              Smart Dustbin Manager
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Upload images to identify waste types for proper segregation or check dustbin capacity levels
          </p>
        </div>

        {/* Option Selection */}
        {!selectedOption && (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            <div 
              onClick={() => setSelectedOption('segregation')}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 cursor-pointer transform transition-transform hover:scale-105 border-2 border-transparent hover:border-green-500"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">
                  Waste Segregation
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Upload an image of waste items to identify the type and get recommendations for proper disposal and recycling
                </p>
              </div>
            </div>

            <div 
              onClick={() => setSelectedOption('fullness')}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 cursor-pointer transform transition-transform hover:scale-105 border-2 border-transparent hover:border-orange-500"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">
                  Dustbin Fullness Check
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Upload an image of your dustbin to analyze its fullness level and get notifications when it needs emptying
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        {selectedOption && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                  {selectedOption === 'segregation' ? 'Waste Segregation Analysis' : 'Dustbin Fullness Check'}
                </h2>
                <button 
                  onClick={resetUpload}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Image
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500">
                  <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                        <span>Upload a file</span>
                        <input 
                          id="file-upload" 
                          name="file-upload" 
                          type="file" 
                          className="sr-only" 
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              </div>

              {/* File Preview */}
              {uploadedFile && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Uploaded File:</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-8 h-8 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyze Button */}
              {uploadedFile && !isAnalyzing && !analysisResult && (
                <button 
                  onClick={analyzeImage}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Analyze Image
                </button>
              )}

              {/* Loading State */}
              {isAnalyzing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing image...</p>
                </div>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    {selectedOption === 'segregation' ? '♻️ Waste Segregation Results' : '📏 Dustbin Fullness Results'}
                  </h3>
                  
                  {/* Common Results */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Status: </span>
                        <span className={`font-semibold ${
                          analysisResult.status === 'Success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {analysisResult.status}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Confidence: </span>
                        <span className="text-blue-600 font-semibold">
                          {analysisResult.confidence ? `${(analysisResult.confidence * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Message: </span>
                      <span className="text-blue-700 dark:text-blue-300">{analysisResult.message}</span>
                    </div>

                    {selectedOption === 'segregation' && analysisResult.segregated_category && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Detected Category: </span>
                        <span className="text-green-700 dark:text-green-300 font-semibold text-lg">
                          {analysisResult.segregated_category}
                        </span>
                      </div>
                    )}

                    {selectedOption === 'fullness' && analysisResult.fullness_level && (
                      <div className="space-y-3">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Fullness Level: </span>
                          <span className="text-orange-700 dark:text-orange-300 font-semibold text-lg">
                            {analysisResult.fullness_level}
                          </span>
                        </div>
                        
                        {analysisResult.fill_percentage && (
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Fill Percentage:</span>
                              <span className="font-semibold">{analysisResult.fill_percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-600">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  analysisResult.fill_percentage >= 80 ? 'bg-red-600' : 
                                  analysisResult.fill_percentage >= 60 ? 'bg-yellow-600' : 'bg-green-600'
                                }`}
                                style={{ width: `${analysisResult.fill_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {analysisResult.detected_labels && analysisResult.detected_labels.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300 block mb-2">Detected Labels:</span>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.detected_labels.map((label, index) => (
                            <span 
                              key={index}
                              className="px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full text-sm"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysisResult.document_id && (
                      <div className="border-t pt-4">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Document ID: </span>
                        <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                          {analysisResult.document_id}
                        </span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={resetUpload}
                    className="mt-6 w-full bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    Analyze Another Image
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
