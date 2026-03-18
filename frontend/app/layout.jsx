import './globals.css';

export const metadata = {
  title: 'KYC AI Verification System | Flairminds Software',
  description: 'Intelligent, AI-powered Know Your Customer verification platform by Flairminds Software Pvt. Ltd.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
