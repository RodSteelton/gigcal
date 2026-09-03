@echo off
setlocal
set PATH=%USERPROFILE%\tools\node;%PATH%
cd /d "%~dp0"
npm run dev
