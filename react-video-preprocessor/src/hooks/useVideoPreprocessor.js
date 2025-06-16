import { useEffect, useRef, useState } from 'react';
import Clock from '../deps/clock.js';

export default function useVideoPreprocessor() {
  const workerRef = useRef(null);
  const clockRef = useRef(new Clock());
  const [elapsed, setElapsed] = useState('');
  const [took, setTook] = useState('');
  const [download, setDownload] = useState(null);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onerror = (error) => {
      console.error('error worker', error);
    };
    worker.onmessage = ({ data }) => {
      if (data.status !== 'done') return;
      clockRef.current.stop();
      setElapsed(`Process took ${took.replace('ago', '')}`);
      if (data.buffers) {
        const blob = new Blob(data.buffers, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setDownload({ url, filename: data.filename });
      }
    };
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, [took]);

  const processFile = (file, canvas) => {
    const offscreen = canvas.transferControlToOffscreen();
    workerRef.current.postMessage({ file, canvas: offscreen }, [offscreen]);
    clockRef.current.start((time) => {
      setTook(time);
      setElapsed(`Process started ${time}`);
    });
  };

  return { processFile, elapsed, download };
}
