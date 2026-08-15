Cavaner — Resume Optimizer

Quick start (dev):

1. Install dependencies:
   npm install

2. Run the API server (local proxy that uses GROQ if GROQ_API_KEY is set):
   npm run start-server

3. Run the frontend dev server:
   npm run dev

Features added:
- Optimize resume from pasted text and optional job description
- Export optimized resume as a TXT file (Export TXT)
- Generate a formatted CV as HTML (Generate CV), preview it in-app, and download the HTML file

Notes:
- The server uses GROQ if GROQ_API_KEY is provided; otherwise a fallback heuristic is used
- For PDF export you can open the generated HTML in browser and print-to-PDF
