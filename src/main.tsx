import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/styles/base.css';
import './shared/styles/design-system.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
