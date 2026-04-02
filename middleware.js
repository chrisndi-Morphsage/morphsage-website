export default function middleware(request) {
  const url     = new URL(request.url);
  const cookies = request.headers.get('cookie') || '';
  const token   = cookies.split(';')
    .find(c => c.trim().startsWith('demo_auth='))
    ?.split('=').slice(1).join('=').trim();

  // Allow access if cookie matches the secret token
  if (token && token === process.env.DEMO_TOKEN) return;

  // Redirect to login, preserve intended destination
  const login = new URL('/login', request.url);
  login.searchParams.set('next', url.pathname);
  return Response.redirect(login);
}

export const config = {
  matcher: ['/demo', '/demo/'],
};
