@echo off
setlocal
cd /d "%~dp0"

call :locate_node
if not defined NODE_EXE (
  echo Node.js no esta instalado. Instalando la version LTS con WinGet...
  call :install_node
  if errorlevel 1 (
    echo.
    echo No se pudo instalar Node.js automaticamente.
    echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo.
    pause
    exit /b 1
  )

  call :locate_node
)

if not defined NODE_EXE (
  echo.
  echo Node.js se instalo, pero node.exe aun no esta disponible.
  echo Reinicia Windows y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

start "MysAuth Cloud Backup" /min "%NODE_EXE%" "%~dp0client.js"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:17321/"
exit /b 0

:locate_node
set "NODE_EXE="
for %%N in (node.exe) do set "NODE_EXE=%%~$PATH:N"
if defined NODE_EXE exit /b 0

for %%N in ("%ProgramFiles%\nodejs\node.exe" "%ProgramFiles(x86)%\nodejs\node.exe" "%LocalAppData%\Programs\nodejs\node.exe") do (
  if not defined NODE_EXE if exist "%%~fN" set "NODE_EXE=%%~fN"
)
exit /b 0

:install_node
set "WINGET_EXE="
for %%W in (winget.exe) do set "WINGET_EXE=%%~$PATH:W"
if not defined WINGET_EXE if exist "%LocalAppData%\Microsoft\WindowsApps\winget.exe" set "WINGET_EXE=%LocalAppData%\Microsoft\WindowsApps\winget.exe"

if not defined WINGET_EXE (
  echo WinGet no esta disponible en esta maquina.
  exit /b 1
)

"%WINGET_EXE%" install --id OpenJS.NodeJS.LTS --exact --source winget --scope machine --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
exit /b %errorlevel%

