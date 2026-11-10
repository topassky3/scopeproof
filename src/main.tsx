import React from 'react';
import { createRoot } from 'react-dom/client';
import { Entry } from './app/Entry';
import './shared/styles/base.css';
import './shared/styles/design-system.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Entry/></React.StrictMode>);
