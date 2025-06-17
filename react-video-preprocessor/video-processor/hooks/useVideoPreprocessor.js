import { useEffect, useRef, useState } from 'react';
import Clock from '../deps/clock.js';
import { uploadVideoAction } from '../../../actions';
import { toast } from 'sonner';

export default function useVideoPreprocessor() {
  const workerRef = useRef(null);
  const clockRef = useRef(new Clock());
  const [elapsed, setElapsed] = useState('');
  const [took, setTook] = useState('');
  const [download, setDownload] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onerror = (error) => {
      console.error('error worker', error);
      setError(error.message);
    };
    worker.onmessage = async ({ data }) => {
      if (data.status === 'error') {
        console.error('Worker error:', data.error);
        setError(data.error);
        return;
      }

      if (data.status !== 'done') return;

      clockRef.current.stop();
      setElapsed(`Process took ${took.replace('ago', '')}`);

      if (data.buffers) {
        try {
          const blob = new Blob(data.buffers, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setDownload({ url, filename: data.filename });

          // Force download
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          // Create a File object from the Blob
          const processedFile = new File([blob], data.filename, { type: 'video/webm' });

          try {
            setIsUploading(true);
            // Create FormData and append the file
            const formData = new FormData();
            formData.append('video', processedFile);

            // Upload using the server action
            const result = await uploadVideoAction(formData);

            if (result.success) {
              toast.success('Video uploaded successfully');
            } else {
              toast.error(result.message || 'Failed to upload video');
              setError(result.message);
            }
          } catch (err) {
            console.error('Upload error:', err);
            toast.error('Failed to upload video');
            setError(err.message);
          } finally {
            setIsUploading(false);
            // Cleanup the URL after everything is done
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          console.error('Error processing video data:', err);
          setError(err.message);
        }
      }
    };
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []); // Only run once when component mounts

  const processFile = (file, canvas) => {
    try {
      if (!canvas) {
        throw new Error('Canvas element is not available');
      }

      if (!canvas.getContext) {
        throw new Error('Invalid canvas element');
      }

      if (!workerRef.current) {
        throw new Error('Worker is not initialized');
      }

      setError(null); // Clear any previous errors
      const offscreen = canvas.transferControlToOffscreen();
      workerRef.current.postMessage({ file, canvas: offscreen }, [offscreen]);
      clockRef.current.start((time) => {
        setTook(time);
        setElapsed(`Process started ${time}`);
      });
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err.message);
      setElapsed('');
      setTook('');
    }
  };

  return { processFile, elapsed, download, error, isUploading };
}
