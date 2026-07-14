import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const body = await request.json();
    const { email, name, profile, skills, experience, education,
            role, location, linkedin, preferences,
            alertTime, alertCount, includeResume } = body;

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('subscribers')
      .upsert({
        email: email.toLowerCase().trim(),
        name: name || '',
        profile: profile || '',
        skills: skills || '',
        experience: experience || '',
        education: education || '',
        role: role || '',
        location: location || '',
        linkedin: linkedin || '',
        preferences: preferences || [],
        alert_time: alertTime || '08:00',
        alert_count: parseInt(alertCount) || 10,
        include_resume: includeResume || 'yes',
        active: true,
      }, { onConflict: 'email' });

    if (error) throw error;
    return Response.json({ success: true, message: 'Subscribed successfully!' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
  await supabase.from('subscribers').update({ active: false }).eq('email', email.toLowerCase());
  return new Response(
    '<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>Unsubscribed ✓</h2><p>Removed from JobTAi daily alerts.</p><a href="/">Back to JobTAi</a></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}
