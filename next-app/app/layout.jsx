import '../app/styles.css';

export const metadata = {
  title: 'DSA Sheets',
  description: 'Static-export Next.js version of the DSA Sheets browser.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
