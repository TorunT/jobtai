export const metadata = {
  title: 'JobTAi — AI-Powered Job Search & Resume Builder',
  description: 'JobTAi uses AI to find matching US jobs, generate tailored ATS-optimized resumes, and write cover letters. Free to start.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
