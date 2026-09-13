# NTA Logistics production backend contract

## Lead submission
- `POST /api/leads/quote` receives quote JSON plus `meta.submitted_at`, `lead_type`, `originating_page`, referrer, and UTM/campaign fields.
- Server validates and sanitizes all fields, applies rate limiting and bot protection, persists the lead, then sends CRM/webhook + email notifications asynchronously.
- Do not expose CRM credentials, webhook secrets, email API keys, or database service-role credentials in browser JavaScript.

## Carrier application
- `POST /api/carriers/apply` creates the carrier application and returns an opaque `leadId`.
- `POST /api/carriers/upload-url` validates authenticated/authorized upload intent and returns a short-lived presigned PUT URL for one file.
- Storage must be private, encrypted at rest, blocked from public listing, and protected by object-level access rules.
- Enforce allowed MIME types, file-size limits, malware scanning, retention policy, and audit logging.
- `POST /api/carriers/attach-documents` associates private storage keys with the carrier application after upload completion.
- Never store public URLs for COI, W-9, authority paperwork, agreements, or other sensitive documents.

## Banking/payment information
Not collected by this website package. If later required, use a dedicated secure onboarding/payment provider or encrypted workflow with strict least-privilege access and audit logging.

## CMS
Production endpoints should include authenticated administrator routes for:
- posts: create, edit, publish, unpublish, delete
- categories
- featured image upload
- SEO title / description / canonical metadata
- publication date and author/editor audit trail
Use server-side role checks; hiding admin links is not access control.

## Recommended security controls
TLS/HSTS, CSP, strict CORS, CSRF protection where applicable, secure/httpOnly cookies for admin sessions, server-side schema validation, rate limiting, bot mitigation, log redaction, secrets manager, database RLS/ACLs, encrypted backups, audit logs, and dependency patching.
