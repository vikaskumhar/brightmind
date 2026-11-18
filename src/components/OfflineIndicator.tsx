import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="pwa-offline-banner" role="status">
      Offline Mode — Exercises remain playable; Firebase sync resumes when online.
    </div>
  );
};
