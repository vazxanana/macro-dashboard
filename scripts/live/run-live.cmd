@echo off
rem MeridianX council live runner (Windows). Keeps council/live.mjs running; on exit code 3 (new council code on main) it pulls
rem the repository and restarts; on any other exit it waits 20 s and restarts. Secrets: %USERPROFILE%\meridianx\.env (never in the repo).
cd /d "%~dp0\..\.."
:loop
git pull -q --ff-only origin main
node council\live.mjs
if %errorlevel%==3 goto loop
timeout /t 20 /nobreak >nul
goto loop
