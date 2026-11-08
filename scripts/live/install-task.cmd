@echo off
rem Registers the live runner to start at every login (Windows Task Scheduler) and keeps the laptop awake on mains power.
rem Run once from a normal (non-admin) command prompt inside the repository folder. Remove with: schtasks /delete /tn MeridianXLive /f
cd /d "%~dp0\..\.."
schtasks /create /f /tn MeridianXLive /sc onlogon /rl limited /tr "cmd /c \"\"%cd%\scripts\live\run-live.cmd\"\"" 
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
echo Installed. Start it now with: schtasks /run /tn MeridianXLive
