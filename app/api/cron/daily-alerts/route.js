import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const maxDuration = 300;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: subscribers, error } = await supabase
    .from('subscribers')
    .select('*')
    .eq('active', true);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subscribers?.length) return Response.json({ message: 'No active subscribers' });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://jobtai.org';
  const results = [];

  for (const sub of subscribers) {
    try {
      const jobs = await searchJobs(sub);
      if (!jobs.length) { results.push({ email: sub.email, status: 'no jobs' }); continue; }

      const jobCards = jobs.map(j => `
        <div style="background:#fff;border-radius:12px;border:1px solid #e5e1d8;padding:18px 20px;margin-bottom:14px;">
          <div style="font-size:15px;font-weight:600;color:#1a1916;">${j.title}</div>
          <div style="font-size:13px;color:#6b6860;">${j.company} · ${j.location}</div>
          <div style="font-size:12px;color:#9e9b94;">via ${j.source}${j.salary ? ' · ' + j.salary : ''} · ${j.score}% match</div>
          <div style="font-size:13px;color:#3d3b36;margin:8px 0;">${j.desc}</div>
          <a href="${j.applyUrl}" style="background:#1a4a2e;color:#fff;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Apply Now ↗</a>
          <a href="${SITE}" style="background:#f7f5f0;color:#1a1916;font-size:13px;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-block;margin-left:8px;border:1px solid #e5e1d8;">Tailor resume →</a>
        </div>`).join('');

      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,sans-serif;">
        <div style="max-width:620px;margin:0 auto;padding:24px 16px;">
          <div style="background:#1a4a2e;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
            <div style="font-size:28px;font-weight:700;color:#fff;">Job<span style="color:#c9a84c;">TA</span>i</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:6px;">Your daily job matches · ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
          </div>
          <div style="background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:16px;border:1px solid #e5e1d8;">
            <p style="font-size:14px;color:#3d3b36;margin:0;">Hi ${sub.name || 'there'}! Here are today's top ${jobs.length} matches for <strong>${sub.role || 'your target role'}</strong>.</p>
          </div>
          ${jobCards}
          <div style="text-align:center;font-size:11px;color:#9e9b94;padding-top:16px;">
            <a href="${SITE}/api/subscribe?email=${encodeURIComponent(sub.email)}" style="color:#9e9b94;">Unsubscribe</a> · 
            <a href="${SITE}" style="color:#1a4a2e;font-weight:500;">Open JobTAi</a>
          </div>
        </div></body></html>`;

      await resend.emails.send({
        from: FROM,
        to: sub.email,
        subject: `Your ${jobs.length} job matches · JobTAi`,
        html,
      });

      results.push({ email: sub.email, status: 'sent', jobs: jobs.length });
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      results.push({ email: sub.email, status: 'error', error: err.message });
    }
  }

  return Response.json({ processed: results.length, results });
}

async function searchJobs(sub) {
  const prefText = (sub.preferences || []).length
    ? '\nPreferences: ' + sub.preferences.join(', ') : '';
  const prompt = `Search LinkedIn, Indeed, Greenhouse, Built In NYC for real current jobs. Return top ${sub.alert_count || 10} as raw JSON array only, no explanation.

CANDIDATE: Role: ${sub.role}, Location: ${sub.location || 'USA'}, Skills: ${sub.skills}${prefText}

JSON: [{"title":"","company":"","location":"","salary":"","source":"","score":0,"remote":false,"applyUrl":"","tags":[],"desc":""}]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      }),
    });
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    return JSON.parse(match[0]).sort((a, b) => b.score - a.score);
  } catch { return []; }
}
