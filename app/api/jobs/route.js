export const maxDuration = 60;

export async function POST(request) {
  try {
    const { role, location, prefs } = await request.json();

    const prefText = prefs && prefs.length
      ? `\nPreferences: ${prefs.slice(0, 5).join(', ')}`
      : '';

    const prompt = `Search LinkedIn Jobs, Indeed, Greenhouse, and Built In NYC for REAL current job listings for a ${role || 'Data Analyst'} in ${location || 'United States'}.${prefText}

Find 10 real job listings with DIRECT URLs to the actual job posting pages (not search pages).

Return ONLY a JSON array:
[{"title":"exact title","company":"company name","location":"city or Remote","salary":"range or empty","source":"LinkedIn","score":85,"remote":false,"applyUrl":"https://www.linkedin.com/jobs/view/JOBID or https://company.greenhouse.io/jobs/JOBID","tags":["SQL","Python"],"desc":"2 sentence description of the role and requirements."}]

Important: applyUrl must be a direct link to the specific job posting, not a search page.`;

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
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      return Response.json({ error: data.error.message }, { status: 500 });
    }

    // Extract text from response (may include tool use blocks)
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Robust JSON extraction
    let jobs = [];
    try {
      const arrStart = text.indexOf('[');
      const arrEnd = text.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
        let jsonStr = text.slice(arrStart, arrEnd + 1)
          .replace(/,\s*\]/g, ']')
          .replace(/,\s*\}/g, '}')
          .replace(/[\u0000-\u001F]/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\t/g, ' ');
        jobs = JSON.parse(jsonStr);
      }
    } catch (e) {
      // Fallback: extract objects
      const matches = text.match(/\{[^{}]*?"title"[^{}]*?"company"[^{}]*?\}/gs) || [];
      for (const m of matches) {
        try { jobs.push(JSON.parse(m.replace(/,\s*\}/g, '}'))); } catch(e) {}
      }
    }

    return Response.json({ jobs: jobs.slice(0, 15) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
