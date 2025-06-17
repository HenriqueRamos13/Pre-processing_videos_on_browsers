"use client"

import React, { useRef, useState, useEffect } from 'react';
import useVideoPreprocessor from '../hooks/useVideoPreprocessor.js';

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) {
    return `${Math.round(mb / 1024)}GB`;
  }
  return `${Math.round(mb)}MB`;
}

export default function VideoUploader() {
  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const [fileInfo, setFileInfo] = useState(null);
  const { processFile, elapsed, download, error, isUploading } = useVideoPreprocessor();
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  useEffect(() => {
    // Check if canvas is ready after component mount
    if (canvasRef.current) {
      console.log('🎨 Canvas initialized');
      setIsCanvasReady(true);
    } else {
      console.warn('⚠️ Canvas not ready');
    }
  }, []);

  const onSelectFile = () => {
    console.log('📁 Opening file selector');
    inputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.warn('⚠️ No file selected');
      return;
    }

    console.log('📄 File selected:', {
      name: file.name,
      type: file.type,
      size: formatBytes(file.size)
    });

    if (!isCanvasReady) {
      console.error('❌ Canvas not ready for processing');
      return;
    }

    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    console.log('🎬 Starting file processing');
    processFile(file, canvasRef.current);
  };

  useEffect(() => {
    if (!download) return;
    console.log('💾 Download ready:', download);
  }, [download]);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        // accept="video/mp4"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      <button
        onClick={onSelectFile}
        disabled={!isCanvasReady || isUploading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isUploading ? 'Uploading...' : 'Select Videos to Upload'}
      </button>

      {error && (
        <div className="text-red-500 p-2 bg-red-50 rounded">
          Error: {error}
        </div>
      )}

      <div className="space-y-2">
        {fileInfo && (
          <div className="text-sm text-gray-600">
            <div>File: {fileInfo.name}</div>
            <div>Size: {fileInfo.size}</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width="320"
          height="240"
          className="border border-gray-300 rounded"
        />
        {elapsed && (
          <p className="text-sm text-gray-600">{elapsed}</p>
        )}
        {isUploading && (
          <div className="text-blue-500">
            Uploading video to server...
          </div>
        )}
      </div>
    </div>
  );
}
