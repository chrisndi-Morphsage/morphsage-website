import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a Multi-Agent AI system for Morphsage, a Belgian real estate agency.
You handle incoming lead messages by acting as one of these agents:
- LeadResponder: First contact, warm welcome, identify buy/rent intent
- Qualifier: Collect budget, timeline, property type, location preferences — ONE question at a time
- BookingAgent: Schedule property visits, share booking link https://calendly.com/morphsage
- FollowUpAgent: Re-engage cold leads, send reminders, post-visit follow-up

Rules:
1. Reply in the lead's language (FR/NL/EN).
2. Be friendly, concise, and natural — not robotic.
3. Ask only ONE question per reply.
4. Classify the lead:
   - HOT: clear intent + budget + urgency
   - WARM: interest shown but incomplete info
   - COLD: no engagement or vague interest
5. Route to null next_agent only when a human agent must take over (deal close, offer stage).

You MUST respond with ONLY valid JSON — no markdown, no explanation, just the JSON object:
{
  "next_agent": "LeadResponder" | "Qualifier" | "BookingAgent" | "FollowUpAgent" | null,
  "lead_status": "HOT" | "WARM" | "COLD",
  "message": "your reply to the lead",
  "collected_info": {
    "budget": null | "string value",
    "timeline": null | "string value",
    "type": null | "buy" | "rent",
    "visit_interest": null | "yes" | "no"
  },
  "booking_link": null | "https://calendly.com/morphsage",
  "appointment_confirmed": null | true | false,
  "reason": "brief routing explanation"
}`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversation_history = [], lead_message, property_info } = req.body;

  if (!lead_message?.trim()) {
    return res.status(400).json({ error: 'lead_message is required' });
  }

  // Build user content
  let userContent = `Lead message: "${lead_message}"`;
  if (property_info) {
    userContent += `\nProperty context: ${JSON.stringify(property_info)}`;
  }

  const messages = [
    ...conversation_history,
    { role: 'user', content: userContent }
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const raw = response.content[0]?.text ?? '';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let agentResponse;
    try {
      agentResponse = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Agent returned invalid JSON', raw });
    }

    // Attach the assistant turn so caller can append it to history
    agentResponse._assistant_turn = { role: 'assistant', content: cleaned };

    return res.status(200).json(agentResponse);

  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited — please try again in a moment.' });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'Invalid API key — check ANTHROPIC_API_KEY in Vercel.' });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(500).json({ error: `Claude API error: ${error.message}` });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
