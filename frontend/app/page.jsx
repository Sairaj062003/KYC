import { redirect } from 'next/navigation';

/**
 * Home page — redirects to login.
 * The main entry point routes users to the authentication flow.
 */
export default function HomePage() {
  redirect('/login');
}
