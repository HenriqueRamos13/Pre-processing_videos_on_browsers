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
  const { processFile, elapsed, download } = useVideoPreprocessor();

  const onSelectFile = () => {
    inputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    processFile(file, canvasRef.current);
  };

  useEffect(() => {
    if (!download) return;
    const a = document.createElement('a');
    a.href = download.url;
    a.download = download.filename;
    a.click();
    URL.revokeObjectURL(download.url);
  }, [download]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      <button onClick={onSelectFile}>Select Videos to Upload</button>
      {fileInfo && (
        <div>
          <div>{fileInfo.name}</div>
          <div>{fileInfo.size}</div>
          <canvas ref={canvasRef} width="320" height="240" />
          <p>{elapsed}</p>
        </div>
      )}
    </div>
  );
}
