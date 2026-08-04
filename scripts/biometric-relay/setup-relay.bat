@echo off
REM ===================================================================
REM  Qasr Alshar - Biometric attendance relay (Windows, one-click)
REM
REM  WHY THIS EXISTS: the ZKTeco terminal's firmware only accepts an IP
REM  address as its Cloud Server (no hostname), but the ERP lives on
REM  Vercel, which has no fixed inbound IP. This PC becomes the fixed
REM  address the device can reach: it listens on port 8001 and forwards
REM  every /iclock request to https://app.qasralsharsalon.com.
REM
REM  RUN THIS AS ADMINISTRATOR (right-click -> Run as administrator).
REM  Safe to re-run; it just repairs/restarts the relay.
REM ===================================================================

setlocal
set "RELAY_DIR=%LOCALAPPDATA%\QasrAlsharRelay"
set "PORT=8001"
set "UPSTREAM=app.qasralsharsalon.com"
set "CADDY_URL=https://github.com/caddyserver/caddy/releases/latest/download/caddy_windows_amd64.zip"

echo.
echo ===============================================
echo   Qasr Alshar - Attendance Relay Setup
echo ===============================================
echo.

REM --- must be admin (needed for the firewall rule) ---
net session >nul 2>&1
if errorlevel 1 (
  echo [X] Please close this and RIGHT-CLICK the file, then
  echo     choose "Run as administrator".
  echo.
  pause
  exit /b 1
)

if not exist "%RELAY_DIR%" mkdir "%RELAY_DIR%"
cd /d "%RELAY_DIR%"

REM --- 1. get Caddy (a small, trusted web-forwarding program) ---
if not exist "caddy.exe" (
  echo [1/5] Downloading the relay program...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%CADDY_URL%' -OutFile 'caddy.zip'; Expand-Archive -Path 'caddy.zip' -DestinationPath '.' -Force; Remove-Item 'caddy.zip' -Force"
  if errorlevel 1 (
    echo [X] Download failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
) else (
  echo [1/5] Relay program already installed - skipping download.
)

REM --- 2. write the forwarding config ---
echo [2/5] Writing configuration...
> Caddyfile echo {
>> Caddyfile echo     admin off
>> Caddyfile echo }
>> Caddyfile echo :%PORT% {
>> Caddyfile echo     reverse_proxy https://%UPSTREAM% {
>> Caddyfile echo         header_up Host %UPSTREAM%
>> Caddyfile echo     }
>> Caddyfile echo }

REM --- 3. allow the fingerprint machine through the Windows firewall ---
echo [3/5] Opening port %PORT% in Windows Firewall...
netsh advfirewall firewall delete rule name="Qasr Alshar Attendance Relay" >nul 2>&1
netsh advfirewall firewall add rule name="Qasr Alshar Attendance Relay" dir=in action=allow protocol=TCP localport=%PORT% >nul
if errorlevel 1 echo     (warning: could not add the firewall rule)

REM --- 4. start automatically at every logon ---
echo [4/5] Setting it to start automatically...
> "%RELAY_DIR%\start-relay.bat" echo @echo off
>> "%RELAY_DIR%\start-relay.bat" echo cd /d "%RELAY_DIR%"
>> "%RELAY_DIR%\start-relay.bat" echo start "" /min "%RELAY_DIR%\caddy.exe" run --config "%RELAY_DIR%\Caddyfile"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /y "%RELAY_DIR%\start-relay.bat" "%STARTUP%\QasrAlsharRelay.bat" >nul

REM --- 5. (re)start it now ---
echo [5/5] Starting the relay...
taskkill /f /im caddy.exe >nul 2>&1
start "" /min "%RELAY_DIR%\caddy.exe" run --config "%RELAY_DIR%\Caddyfile"
timeout /t 3 /nobreak >nul

echo.
echo ===============================================
echo   DONE. This PC's addresses:
echo ===============================================
ipconfig | findstr /i "IPv4"
echo.
echo   On the fingerprint machine, set:
echo     Server Mode      : ADMS
echo     Server Address   : the IPv4 address shown above
echo     Server Port      : %PORT%
echo     Enable Proxy     : OFF
echo.
echo   Leave this PC switched on. The relay restarts by itself
echo   whenever the PC is restarted.
echo.
pause
endlocal
