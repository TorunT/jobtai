export const maxDuration = 30;

export async function POST(request) {
  try {
    const { role, location, skills, prefs, salaryMin } = await request.json();

    const prefText = prefs?.length
      ? `\nPreferences: ${prefs.slice(0, 4).join(', ')}`
      : '';

    const prompt = `Generate 12 realistic job listings for a ${role || 'Data Analyst'} in ${location || 'United States'}. Use real companies known to hire for this role.

Skills: ${(skills||'').slice(0,200)}${prefText}${salaryMin ? `\nMin salary: ${salaryMin}` : ''}

Rules:
- Use real, well-known companies (Fortune 500, top tech startups)
- Score based on skill match (90+ = perfect match, 70-89 = good match)
- applyUrl must be a LinkedIn job search URL in this EXACT format:
  https://www.linkedin.com/jobs/search/?keywords=TITLE%20COMPANY&location=LOCATION&f_TPR=r604800
  (f_TPR=r604800 filters to jobs posted in last 7 days)
- For remote jobs use location "United States" in URL

Return ONLY a JSON array, no markdown, no explanation:
[{"title":"Senior Data Analyst","company":"Spotify","location":"New York, NY","salary":"$130k-$160k","source":"LinkedIn","score":94,"remote":false,"applyUrl":"https://www.linkedin.com/jobs/search/?keywords=Senior%20Data%20Analyst%20Spotify&location=New%20York%2C%20NY&f_TPR=r604800","tags":["SQL","Python","Tableau","A/B Testing"],"desc":"Lead analytics for music recommendation features. Partner with PMs and engineers on data-driven product decisions."}]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return Response.json({ error: `API error: ${response.status}` }, { status: 500 });

    const data = await response.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });

    const text = (data.content || []).map(b => b.text || '').join('');

    let jobs = [];
    try {
      const s = text.indexOf('[');
      const e = text.lastIndexOf(']');
      if (s !== -1 && e > s) {
        jobs = JSON.parse(
          text.slice(s, e + 1)
            .replace(/,\s*\]/g, ']')
            .replace(/,\s*\}/g, '}')
            .replace(/[\u0000-\u001F]/g, ' ')
        );
      }
    } catch(parseErr) {
      // Fallback: extract individual objects
      const matches = [...(text.matchAll(/\{[^{}]*?"title"[^{}]*?\}/gs) || [])];
      for (const m of matches) {
        try { jobs.push(JSON.parse(m[0].replace(/,\s*\}/g, '}'))); } catch(_) {}
      }
    }

    // Ensure all URLs are valid LinkedIn search URLs
    jobs = jobs.map(j => {
      let url = j.applyUrl || '';
      if (!url.startsWith('https://')) {
        const q = encodeURIComponent(`${j.title} ${j.company}`);
        const loc = encodeURIComponent(j.location || location || 'United States');
        url = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&f_TPR=r604800`;
      }
      return { ...j, applyUrl: url };
    });

    return Response.json({ jobs: jobs.slice(0, 12) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
