import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Gate from './auth/Gate.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { BusyProvider, ConfirmProvider, ToastProvider } from './ui';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <BusyProvider>
            <AuthProvider>
              <Gate />
            </AuthProvider>
          </BusyProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
