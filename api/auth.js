export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let password;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    password = body?.password ?? '';
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!process.env.DEMO_PASSWORD || !process.env.DEMO_TOKEN) {
    return res.status(500).json({ error: 'Server not configured. Set DEMO_PASSWORD and DEMO_TOKEN in Vercel.' });
  }

  if (password !== process.env.DEMO_PASSWORD) {
    // Small delay to slow brute force
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  res.setHeader(
    'Set-Cookie',
    `demo_auth=${process.env.DEMO_TOKEN}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
  );
  return res.status(200).json({ success: true });
}
