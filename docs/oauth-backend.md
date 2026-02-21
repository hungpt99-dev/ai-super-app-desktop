# OAuth Backend Implementation Guide

This document specifies the Go + Chi backend changes required to support
"Login with Google" and "Login with GitHub" from both the web app and the
Desktop Agent.

---

## Flow Overview

```
Client (web / desktop)
  │
  │  GET /v1/auth/oauth/{provider}?redirect_uri={client_callback}
  ▼
Go API  ──────────────────────────────────────────────────────────────────────►
  │  Stores redirect_uri in the OAuth state parameter (signed / encrypted).
  │  Redirects browser to provider's authorization URL.
  ▼
Google / GitHub OAuth page
  │  User grants permission.
  │
  │  GET /v1/auth/oauth/{provider}/callback?code={code}&state={state}
  ▼
Go API  ──────────────────────────────────────────────────────────────────────►
  │  1. Validate state, extract redirect_uri.
  │  2. Exchange code for provider access token.
  │  3. Fetch user info (email, name, avatar) from provider.
  │  4. Find or create the user row in PostgreSQL.
  │  5. Issue a JWT access token + refresh token pair.
  │  6. Redirect to {redirect_uri}?access_token={jwt}&refresh_token={rt}
  ▼
Client callback page
  │  Web:     /oauth/callback reads query params, stores tokens, → /dashboard
  │  Desktop: popup emits Tauri event 'oauth-callback', main window logs in.
```

---

## New Endpoints

### `GET /v1/auth/oauth/google`

Initiate Google OAuth.

| Parameter      | Required | Description                                                                 |
|----------------|----------|-----------------------------------------------------------------------------|
| `redirect_uri` | Yes      | Where to send the user after success. Must be validated against an allowlist.|

**Behaviour:**
1. Sign a `state` JWT that encodes `{ provider, redirect_uri, nonce, exp }`.
2. Build Google's authorization URL:
   ```
   https://accounts.google.com/o/oauth2/v2/auth
     ?client_id={GOOGLE_CLIENT_ID}
     &redirect_uri={BACKEND_CALLBACK_URL}
     &response_type=code
     &scope=openid%20email%20profile
     &state={signed_state}
     &prompt=select_account
   ```
3. Return HTTP 302 to that URL.

### `GET /v1/auth/oauth/github`

Initiate GitHub OAuth.  Same contract as above, using GitHub's endpoint:

```
https://github.com/login/oauth/authorize
  ?client_id={GITHUB_CLIENT_ID}
  &redirect_uri={BACKEND_CALLBACK_URL}
  &scope=user:email
  &state={signed_state}
```

### `GET /v1/auth/oauth/google/callback`
### `GET /v1/auth/oauth/github/callback`

Registered with the OAuth provider as the redirect URI.  Never called directly by the frontend.

**Behaviour:**
1. Validate `state` JWT signature and expiry.
2. Exchange `code` for provider tokens.
3. Fetch user profile from provider (email, display name).
4. Upsert user in PostgreSQL:
   ```sql
   INSERT INTO users (email, name, oauth_provider, oauth_id)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (email)
   DO UPDATE SET oauth_provider = EXCLUDED.oauth_provider,
                 oauth_id       = EXCLUDED.oauth_id,
                 name           = COALESCE(users.name, EXCLUDED.name);
   ```
5. Issue JWT access token (15 min TTL) + refresh token (30 day TTL).
6. Redirect to `{redirect_uri}?access_token={jwt}&refresh_token={rt}`.

---

## Environment Variables

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# The backend's own registered OAuth callback base URL (no trailing slash).
OAUTH_CALLBACK_BASE=https://api.aisuperapp.com

# Signing secret for the state JWT (any strong random string, ≥32 bytes).
OAUTH_STATE_SECRET=...

# Comma-separated allowlist of redirect_uri origins the backend will accept.
# Prevents open redirects.
OAUTH_REDIRECT_ALLOWLIST=https://app.aisuperapp.com,http://localhost:5174,http://localhost:5173,tauri://localhost
```

---

## Go Dependencies

```bash
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go get github.com/golang-jwt/jwt/v5   # already used for app JWTs
```

---

## Recommended File Structure (internal/)

```
internal/
  auth/
    oauth.go          ← handler: GET /v1/auth/oauth/{provider}
    oauth_callback.go ← handler: GET /v1/auth/oauth/{provider}/callback
    oauth_state.go    ← sign / verify state JWT, allowlist check
```

---

## Security Notes

- **State parameter** — must be a short-lived signed token (exp ≤ 10 min) to
  prevent CSRF.  Do **not** store state in a cookie or session; encode
  `redirect_uri` inside the signed state so it cannot be tampered with.
- **Redirect URI allowlist** — validate `redirect_uri` strictly against
  `OAUTH_REDIRECT_ALLOWLIST` before using it.  Reject unknown origins with
  HTTP 400.
- **Token placement** — tokens are returned as query parameters for simplicity.
  The frontend removes them from the address bar immediately using
  `window.history.replaceState` to prevent leakage via browser history or the
  Referrer header.
- **Account linking** — when a user signs in via OAuth with an email that
  already exists from email/password signup, the OAuth identity is linked to
  the existing account (upsert above).  Do **not** create a duplicate account.
