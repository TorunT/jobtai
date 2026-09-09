export const maxDuration = 55;

export async function POST(request) {
  try {
    const { role, location, skills, prefs, salaryMin } = await request.json();

    const prefText = prefs?.length
      ? `\nRequired preferences: ${prefs.slice(0, 3).join(', ')}`
      : '';
    const salaryText = salaryMin ? `\nMinimum salary: ${salaryMin}` : '';

    const prompt = `Search LinkedIn Jobs and Indeed right now for real current job listings. Find 5 real job postings for a ${role || 'Data Analyst'} in ${location || 'United States'}.

Key skills: ${(skills || '').slice(0, 150)}${prefText}${salaryText}

For each listing, search and find the DIRECT URL to the actual job posting page.

Respond with ONLY a JSON array (no markdown):
[{"title":"","company":"","location":"","salary":"","source":"LinkedIn","score":90,"remote":false,"applyUrl":"https://www.linkedin.com/jobs/view/REAL-JOB-ID","tags":["SQL","Python"],"desc":"2 sentence description."}]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

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
    } catch(e) {
      const matches = [...text.matchAll(/\{[^{}]*?"title"[^{}]*?\}/gs)];
      for (const m of matches) {
        try { jobs.push(JSON.parse(m[0].replace(/,\s*\}/g, '}'))); } catch(_) {}
      }
    }

    // Validate and fix URLs
    jobs = jobs.map(j => {
      const q = encodeURIComponent(`${j.title || ''} ${j.company || ''}`);
      const loc = encodeURIComponent(j.location || location || 'United States');
      const url = j.applyUrl || '';
      const validUrl = url.startsWith('https://www.linkedin.com/jobs/view/') ||
                       url.startsWith('https://www.indeed.com/viewjob') ||
                       url.includes('.greenhouse.io/jobs/') ||
                       url.includes('.lever.co/');
      return {
        ...j,
        applyUrl: validUrl
          ? url
          : `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}`
      };
    });

    return Response.json({ jobs });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
