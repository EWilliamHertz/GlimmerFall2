import React from 'react';
import ReactDOMServer from 'react-dom/server';
import Community from './src/pages/Community';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './src/lib/auth';

try {
  const html = ReactDOMServer.renderToString(
    <AuthProvider>
      <BrowserRouter>
        <Community />
      </BrowserRouter>
    </AuthProvider>
  );
  console.log("SUCCESS length:", html.length);
} catch (err) {
  console.error("RUNTIME CRASH:", err);
}
