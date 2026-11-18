import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || Capacitor.isNativePlatform()) {
    return null;
  }

  if (isInstallable) {
    return (
      <button type="button" onClick={() => void install()} className="pwa-install-btn">
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setShowGuide(true)} className="pwa-install-btn">
          Install on iPhone
        </button>
        {showGuide && (
          <div className="pwa-modal-backdrop" role="dialog" aria-modal="true" aria-label="Install instructions">
            <div className="pwa-modal">
              <h3>Install Bright Mind</h3>
              <p>
                1. Tap the <strong>Share</strong> button in Safari.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button type="button" className="primary" onClick={() => setShowGuide(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setShowGuide(true)} className="pwa-install-btn">
        Mobile App
      </button>
      {showGuide && (
        <div className="pwa-modal-backdrop" role="dialog" aria-modal="true" aria-label="Mobile install guide">
          <div className="pwa-modal">
            <h3>Install on Mobile (No Laptop Needed)</h3>
            <p>
              Open the live Shared App URL in <strong>Chrome on Android</strong>, tap the browser menu (<strong>⋮</strong>) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. It installs directly onto your phone and connects to Firebase anytime.
            </p>
            <button type="button" className="primary" onClick={() => setShowGuide(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
