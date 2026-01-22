import { useState } from 'react';
import { TermsOfService } from '../pages/TermsOfService';
import { PrivacyPolicy } from '../pages/PrivacyPolicy';

export const Footer = () => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (showTerms) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        zIndex: 10000,
        overflowY: 'auto'
      }}>
        <button
          onClick={() => setShowTerms(false)}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          閉じる
        </button>
        <TermsOfService />
      </div>
    );
  }

  if (showPrivacy) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        zIndex: 10000,
        overflowY: 'auto'
      }}>
        <button
          onClick={() => setShowPrivacy(false)}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          閉じる
        </button>
        <PrivacyPolicy />
      </div>
    );
  }

  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '0.5rem',
      background: 'rgba(255, 255, 255, 0.9)',
      display: 'flex',
      justifyContent: 'center',
      gap: '1rem',
      fontSize: '0.875rem',
      zIndex: 100,
      backdropFilter: 'blur(10px)'
    }}>
      <button
        onClick={() => setShowTerms(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          color: '#333'
        }}
      >
        利用規約
      </button>
      <button
        onClick={() => setShowPrivacy(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          color: '#333'
        }}
      >
        プライバシーポリシー
      </button>
      <a
        href="https://github.com/AKITO-AKI/AIRIA-BEYOND"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#333',
          textDecoration: 'underline'
        }}
      >
        GitHub
      </a>
    </footer>
  );
};
