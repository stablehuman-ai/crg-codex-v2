import React, { useEffect, useState } from 'react';

export const App = () => {
  const [ipcStatus, setIpcStatus] = useState('Checking IPC...');

  useEffect(() => {
    let isMounted = true;

    window.electronAPI
      .ping()
      .then((response) => {
        if (isMounted) {
          setIpcStatus(response.message);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIpcStatus('IPC check failed');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <h1>CRG</h1>
      <p>{ipcStatus}</p>
    </div>
  );
};
