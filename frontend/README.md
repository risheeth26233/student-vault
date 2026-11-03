# Student-Vault React application

The primary application is React, TypeScript, Vite, TanStack Query, and Tailwind CSS. Vite serves it below `/app`; the root legacy vanilla-JavaScript application is retained as a fallback.

## Commands

```bash
npm install
npm run dev
npm run test -- --pool=threads --maxWorkers=1
npm run lint
npm run build
```

The dev server proxies `/api` to `http://localhost:3000`. Set `VITE_API_BASE` only when the backend uses another API origin.

Handwriting records are local-first and use the backend OCR endpoint only after explicit consent. The AI assistant never attaches saved notes or documents automatically. In the study page, the student can select up to four topic resources; PDF excerpts are retrieved on the Student-Vault backend and remain there unless the student enables external-sharing consent. Selected images may be sent to a configured OCR provider after that consent. The UI shows retrieved excerpts and extraction/provider errors separately from the generated answer. Teacher-only records are authorized on the backend, not by navigation visibility.
