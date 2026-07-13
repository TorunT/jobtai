import { redirect } from 'next/navigation';

export default function Home() {
  // The full app (landing + dashboard) lives in public/app.html
  redirect('/app.html');
}
