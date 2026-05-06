import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '100mb' }));

// Google Drive Scopes
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.APP_URL}/auth-callback`;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

// --- API ROUTES ---

// 1. Get Auth URL
app.get('/api/auth/url', (req, res) => {
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Exchange code for tokens
app.post('/api/auth/token', async (req, res) => {
  const { code } = req.body;
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    res.json(tokens);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Auth Callback - Popup Handler
app.get(['/auth-callback', '/auth-callback/'], async (req, res) => {
  const { code } = req.query;
  // Note: We don't exchange the code here because the client-side exchange is easier for state management in this applet
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
        <div style="text-align: center;">
          <h2 style="color: #1e293b;">Authenticating...</h2>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: '${code}' }, '*');
              window.close();
            } else {
              window.location.href = '/?code=${code}';
            }
          </script>
        </div>
      </body>
    </html>
  `);
});

// 3. List Team Folders
app.get('/api/drive/teams', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });

  try {
    const tokens = JSON.parse(authHeader);
    const client = getOAuthClient();
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

    // Find the main folder: "Standups and Retros - Recordings"
    const rootSearch = await drive.files.list({
      q: "name = 'Standups and Retros - Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
    });

    if (!rootSearch.data.files?.length) {
      console.log('Main folder not found in Drive. Query: name = \'Standups and Retros - Recordings\'');
      return res.status(404).json({ error: 'Main folder "Standups and Retros - Recordings" not found. Please create it at the root of your Google Drive.' });
    }

    const rootId = rootSearch.data.files[0].id;

    // List subfolders
    const subfolders = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
    });

    res.json(subfolders.data.files || []);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('Fetch Teams Error:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// 4. List Files in a Team Folder
app.get('/api/drive/files/:folderId', async (req, res) => {
  const { folderId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });

  try {
    const tokens = JSON.parse(authHeader);
    const client = getOAuthClient();
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

    const files = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime, size, webViewLink, thumbnailLink)',
      orderBy: 'createdTime desc',
    });

    res.json(files.data.files || []);
  } catch (error: any) {
    console.error('Fetch Files Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get File Base64 (for frontend analysis)
app.get('/api/drive/content/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });

  try {
    const tokens = JSON.parse(authHeader);
    const client = getOAuthClient();
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

    // 1. Get file metadata to check mimeType
    const metadata = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType, name'
    });

    const mimeType = metadata.data.mimeType;
    let response;

    // 2. Direct download or Export based on mimeType
    if (mimeType?.startsWith('application/vnd.google-apps.')) {
      // It's a Google Workspace file, we must export it
      // Preferred export type is text/plain for LLM analysis
      let exportMimeType = 'text/plain';
      
      // Special cases for spreadsheets or presentations if text/plain isn't ideal
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        exportMimeType = 'text/csv';
      }

      response = await drive.files.export({
        fileId: fileId,
        mimeType: exportMimeType,
      }, { responseType: 'arraybuffer' });
    } else {
      // Regular file (PDF, TXT, Audio, etc.)
      response = await drive.files.get({
        fileId: fileId,
        alt: 'media',
      }, { responseType: 'arraybuffer' });
    }

    const buffer = Buffer.from(response.data as ArrayBuffer);
    
    // Limit to 40MB to prevent "Invalid string length" and respect Gemini inlineData limits
    const MAX_SIZE = 40 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new Error(`File is too large for AI analysis (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max limit is 40MB.`);
    }

    const base64 = buffer.toString('base64');
    
    // Determine the effective mime type (the one Gemini should see)
    let effectiveMimeType = mimeType;
    if (mimeType?.includes('application/vnd.google-apps.document')) effectiveMimeType = 'text/plain';
    if (mimeType?.includes('application/vnd.google-apps.spreadsheet')) effectiveMimeType = 'text/csv';
    
    res.json({ base64, mimeType: effectiveMimeType });
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`Fetch Content Error (${fileId}):`, errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
