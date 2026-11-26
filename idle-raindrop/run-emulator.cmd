@echo off
rem Starts the Android emulator, installs the latest debug build and opens the game.
setlocal
set SDK=%LOCALAPPDATA%\Android\Sdk
set ADB="%SDK%\platform-tools\adb.exe"
set APK="%~dp0IdleRaindrop-debug.apk"

"%SDK%\emulator\emulator-check.exe" accel | findstr /C:"is installed and usable" /C:"Hypervisor Platform" >nul
if errorlevel 1 (
  echo Hardware acceleration is not available yet. Turn on "SVM Mode" in the BIOS, then try again.
  "%SDK%\emulator\emulator-check.exe" accel
  pause
  exit /b 1
)
%ADB% get-state 2>nul | findstr device >nul
if errorlevel 1 start "" "%SDK%\emulator\emulator.exe" -avd Medium_Phone_API_36.1
echo Waiting for Android to start...
%ADB% wait-for-device
:boot
%ADB% shell getprop sys.boot_completed 2>nul | findstr 1 >nul
if errorlevel 1 (
  ping -n 3 127.0.0.1 >nul
  goto boot
)
%ADB% install -r %APK%
if errorlevel 1 (
  pause
  exit /b 1
)
%ADB% shell am start -n com.idleraindrop.game/.MainActivity
