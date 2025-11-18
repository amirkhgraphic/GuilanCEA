# Frontend

## Stack
- Vite + React 18 with TypeScript.
- `@tanstack/react-query` for data fetching and caching.
- shadcn/ui primitives (button, card, tabs, dialog, etc.) with Tailwind CSS.
- Sonner & Toast UI for notifications, Markdown rendering, RTL layout, and Persian-digit helpers.

## Development

### Install dependencies
```bash
npm install
```

### Run dev server
```bash
npm run dev -- --host
```

### Production build
```bash
npm run build
```

## Features
- **Public site**: homepage, events list/detail, blog list, auth flows, profile, payments.
- **Admin dashboard**: staff-only portal with vertical tabs, user filtering, event filtering, popup detail with registrations/payments, and inline event editing/deletion.
- **Utils**: Persian digit formatting, price conversion (Rial → Toman), shared API client with JWT token refresh handling, and helper components (scroll area, table, dialog).

## Testing & linting
```bash
npm run lint
```

JavaScript/TypeScript linting is configured through ESLint + `typescript-eslint`. Run lint before commits to keep code healthy.
