import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Community from './pages/Community';

test('renders Community component without crashing', () => {
  render(
    <AuthProvider>
      <BrowserRouter>
        <Community />
      </BrowserRouter>
    </AuthProvider>
  );
});
