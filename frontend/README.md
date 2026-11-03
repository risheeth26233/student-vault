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

## Open the local website on Windows

From the repository root, double-click `Start-Student-Vault.cmd`, or run it from a terminal. Keep that terminal open and visit http://127.0.0.1:5173/app/. The launcher uses a fixed port and reports an error if another process already occupies it. An isolated sandbox's Vite process can be unreachable from your normal browser; start the launcher in your Windows session instead.

The current preview was started outside that sandbox and verified with HTTP 200. This launcher starts only the frontend. Local guest workflows can be reviewed without starting the API. Cloud classrooms and AI providers require the separately configured backend. No database or migrations are needed for frontend visual QA.
