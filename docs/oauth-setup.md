# OAuth Setup

## Supabase Project

Project URL:

```txt
https://keimfozobkyubbxojsqd.supabase.co
```

The app uses Supabase Auth directly from browser code. OAuth provider secrets for Google and GitHub are configured in the Supabase Dashboard, not in repository code.

Frontend code only needs public Supabase environment values:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Service role keys must never be exposed to frontend code. They should only be used from trusted server-side code or managed backend operations.

Google and GitHub OAuth setup is not completed by code changes alone. The providers must be configured in the Supabase Dashboard and in each provider's developer console.

## Supabase URL Configuration

1. Go to Supabase Dashboard -> Authentication -> URL Configuration.
2. Set Site URL to the main production URL.
3. Add Redirect URLs for every environment that should complete sign-in:

- `http://localhost:5173/**`
- `http://127.0.0.1:5173/**`
- `http://localhost:3000/**`
- `http://127.0.0.1:3000/**`
- any alternate local port you use with `npm run dev` or `npm run dev:next`
- Vercel production URL `/**`
- GitHub Pages URL `/**`
- custom domain `/**` if used

After provider setup, OAuth can be tested locally as long as the exact localhost origin is allowlisted here. The app redirects back to the current origin and path, so ports must match the running dev server.

## Google OAuth Setup

1. Go to Supabase Dashboard -> Authentication -> Providers -> Google.
2. Copy the Supabase callback URL:

```txt
https://keimfozobkyubbxojsqd.supabase.co/auth/v1/callback
```

3. Go to Google Cloud Console -> APIs & Services -> OAuth consent screen.
4. Create or configure an external consent screen for DSA Sheets.
5. Go to APIs & Services -> Credentials -> Create Credentials -> OAuth Client ID.
6. Select Type: Web application.
7. Add Authorized JavaScript origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- any alternate local origins you use
- Vercel origin
- GitHub Pages origin
- custom domain origin if used

8. Add Authorized redirect URI:

```txt
https://keimfozobkyubbxojsqd.supabase.co/auth/v1/callback
```

9. Paste the Google Client ID and Client Secret into the Supabase Google provider settings.
10. Enable and save the provider.

## GitHub OAuth Setup

1. Go to Supabase Dashboard -> Authentication -> Providers -> GitHub.
2. Copy the Supabase callback URL:

```txt
https://keimfozobkyubbxojsqd.supabase.co/auth/v1/callback
```

3. Go to GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App.
4. Set Application name to DSA Sheets.
5. Set Homepage URL to the main production URL.
6. Set Authorization callback URL to:

```txt
https://keimfozobkyubbxojsqd.supabase.co/auth/v1/callback
```

7. Create the app.
8. Generate or copy the Client ID and Client Secret.
9. Paste them into the Supabase GitHub provider settings.
10. Enable and save the provider.

GitHub OAuth Apps only need one callback URL because the callback points to Supabase. Supabase then handles the provider callback and redirects the user back to the app using the configured Site URL and Redirect URLs.

## Email Auth

Email auth only requires enabling the Email provider in Supabase Dashboard -> Authentication -> Providers -> Email.
