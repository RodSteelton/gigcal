@echo off
setlocal
set PATH=%USERPROFILE%\tools\node;%PATH%
cd /d "%~dp0"
if not exist dist (
  echo First-time setup - this takes a minute or two...
  call npm install
  call npm run build
)
start "" http://localhost:5175
node server.js
