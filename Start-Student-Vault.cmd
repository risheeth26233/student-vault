@echo off
setlocal
cd /d "%~dp0frontend"
echo Starting Student-Vault at http://127.0.0.1:5173/app/
echo Keep this window open while using the local website.
echo This starts the frontend only. Cloud features require the separately configured backend.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
if errorlevel 1 (
  echo The preview could not start. Check the error above; another server may already use port 5173.
  pause
)
endlocal
