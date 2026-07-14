import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const maxDuration = 300;

export async function GET(request) {
  // Secure: only Vercel cron or requests with the secret can trigger this
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all active subscribers
  const { data: subscribers, error } = await supabaseAdmin
    .from('subscribers')
    .select('*')
    .eq('active', true);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subscribers?.length) return Response.json({ message: 'No active subscribers' });

  const results = [];

  for (const sub of subscribers) {
    try {
      // 1. Search for jobs using Claude with web search
      const jobs = await searchJobsForSubscriber(sub);
      if (!jobs.length) { results.push({ email: sub.email, status: 'no jobs found' }); continue; }

      // 2. Optionally generate resume text for each job
      let resumes = null;
      if (sub.include_resume === 'yes' && sub.profile) {
        resumes = await generateResumesForJobs(sub, jobs.slice(0, 3)); // max 3 resumes in email
      }

      // 3. Send email
      await sendDailyAlertEmail({ subscriber: sub, jobs, resumes });
      results.push({ email: sub.email, status: 'sent', jobs: jobs.length });

      // Small delay between subscribers to avoid rate limits
      await delay(2000);
    } catch (err) {
      console.error(`Error for ${sub.email}:`, err);
      results.push({ email: sub.email, status: 'error', error: err.message });
    }
  }

  return Response.json({ processed: results.length, results });
}

async function searchJobsForSubscriber(sub) {
  const prefText = (sub.preferences || []).length
    ? '\nREQUIRED preferences: ' + sub.preferences.join(', ')
    : '';

  const prompt = `Search LinkedIn Jobs, Indeed, Built In NYC, and Greenhouse for REAL current job listings for this candidate. Return only genuine listings you find.

CANDIDATE: Role: ${sub.role}, Location: ${sub.location || 'United States'}, Summary: ${sub.profile}, Skills: ${sub.skills}${prefText}

Return top ${sub.alert_count || 10} matches as raw JSON array only (no markdown, no explanation):
[{"title":"","company":"","location":"","salary":"","source":"LinkedIn/Indeed/Greenhouse/Built In NYC","score":0-100,"remote":true/false,"applyUrl":"","tags":[],"desc":"","perks":[]}]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  return JSON.parse(match[0]).sort((a, b) => b.score - a.score);
}

async function generateResumesForJobs(sub, jobs) {
  const resumes = [];
  for (const job of jobs) {
    try {
      const prompt = `Write an ATS-optimized resume in plain text for ${sub.name || 'this candidate'} tailored to this job.

CANDIDATE: ${sub.profile} Skills: ${sub.skills} Experience: ${sub.experience} Education: ${sub.education || ''}
JOB: ${job.title} at ${job.company}. ${job.desc}. Required: ${job.tags?.join(', ')}

Sections: PROFESSIONAL SUMMARY | CORE COMPETENCIES | PROFESSIONAL EXPERIENCE | EDUCATION
Plain text only, no markdown, no asterisks.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      resumes.push(data.content?.[0]?.text || '');
      await delay(1000);
    } catch { resumes.push(''); }
  }
  return resumes;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
