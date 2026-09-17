# NTA Logistics LLC website

Production-ready public freight brokerage website with three primary intake paths:
1. Shipper Setup
2. Request a Quote
3. Carrier Onboarding

A working general Contact form is also included.

## Supabase backend
The site is connected to the NTA Logistics Supabase project. Public forms submit through the `nta-public-intake` Edge Function. Browser clients do not receive direct write access to the intake tables.

Carrier documents are uploaded through short-lived signed upload tokens to the private `nta-carrier-documents` bucket. The public site does not expose carrier document URLs.

## Main pages
Home, About, Freight Brokerage Services, Shipper Setup, Request a Quote, Carrier Onboarding, Industries, Service Areas, Resources, Contact, Privacy, Terms, and a CMS admin scaffold.

## Branding
The approved NTA Logistics logo is under `assets/images/nta-logistics-logo.png`. The site uses the navy/blue/gold design system from the supplied package.

## Production notes
- Replace `YOUR-DOMAIN.example` in `sitemap.xml` when the production hostname is confirmed.
- Finalize the Privacy Policy and Terms with legal counsel before launch.
- Add the official business email when provided.
- Confirm actual service territory before publishing coverage claims.
- The included `admin-cms.html` remains a frontend scaffold and should not be publicly exposed until authenticated CMS administration is implemented.
