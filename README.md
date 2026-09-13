# NTA Logistics LLC website

Modern multi-page lead-generation website built around two conversion paths:
1. Request a Quote
2. Become a Carrier

## Included pages
Home, About, Freight Brokerage Services, Shippers/Quote, Carriers/Application, Industries, Service Areas, Resources/Blog, Contact, Privacy, Terms, and a CMS admin scaffold.

## Branding
The approved NTA Logistics logo is included under `assets/images/nta-logistics-logo.png`.
Design tokens were derived from the logo's navy/blue/gold palette.

## Images
The package references professional logistics/construction imagery from Unsplash by remote URL. For production, download approved/licensed final imagery into the project and serve optimized AVIF/WebP assets from your own CDN.

## Important production wiring
The frontend intentionally does not include secrets or unsafe public document storage. Connect the API contracts documented in `docs/backend-security.md`.

## Local preview
Serve this folder over HTTP (not just file://) so JSON content and future API wiring behave normally:
`python -m http.server 8080`

Then open `http://localhost:8080/`.
