@echo off
setlocal EnableDelayedExpansion

REM Generate SHA256 checksums for distribution packages
REM Creates individual .sha256 files for .exe, .deb, and .AppImage files in dist\

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

if not exist "dist\" (
    echo ============================================
    echo ERROR: dist\ folder not found!
    echo ============================================
    echo.
    echo Please build distribution packages first:
    echo.
    echo   Windows:  npm run build:win
    echo   Linux:    npm run build:linux
    echo.
    echo Or create the dist\ folder manually and place
    echo .exe, .deb, or .AppImage distribution files there.
    echo ============================================
    pause
    exit /b 1
)

cd dist

REM Check if dist folder has any supported files to checksum
set "HAS_FILES=0"
for %%f in (*.*) do (
    if /I "%%~xf"==".exe" (
        set "HAS_FILES=1"
    ) else if /I "%%~xf"==".deb" (
        set "HAS_FILES=1"
    ) else if /I "%%~xf"==".AppImage" (
        set "HAS_FILES=1"
    )
)

if "%HAS_FILES%"=="0" (
    echo ============================================
    echo ERROR: No distribution files found in dist\
    echo ============================================
    echo.
    echo The dist\ folder exists but contains no supported files to checksum.
    echo Supported files: .exe, .deb, .AppImage
    echo.
    echo Please build distribution packages first:
    echo.
    echo   Windows:  npm run build:win
    echo   Linux:    npm run build:linux
    echo ============================================
    pause
    exit /b 1
)

echo Generating SHA256 checksums for .exe, .deb, and .AppImage packages...
echo.

REM Remove old checksum files
del /f /q *.sha256 2>nul
del /f /q SHA256SUMS 2>nul

REM Generate individual .sha256 files for each package
for %%f in (*.*) do (
    REM Only checksum top-level distribution package formats
    if /I "%%~xf"==".exe" (
        call :CreateChecksum "%%f"
    ) else if /I "%%~xf"==".deb" (
        call :CreateChecksum "%%f"
    ) else if /I "%%~xf"==".AppImage" (
        call :CreateChecksum "%%f"
    )
)

goto CreateCombined

:CreateChecksum
set "PACKAGE_FILE=%~1"
echo Processing: %PACKAGE_FILE%
certutil -hashfile "%PACKAGE_FILE%" SHA256 > "%PACKAGE_FILE%.sha256.tmp" 2>nul
if errorlevel 1 (
    echo   ERROR: Failed to generate hash for %PACKAGE_FILE%
    del "%PACKAGE_FILE%.sha256.tmp" 2>nul
) else (
    REM Extract just the hash (certutil outputs extra lines)
    set "HASH_LINE="
    for /f "usebackq skip=1 tokens=*" %%a in ("%PACKAGE_FILE%.sha256.tmp") do (
        if not defined HASH_LINE (
            set "HASH_LINE=%%a"
            echo %%a  %PACKAGE_FILE% > "%PACKAGE_FILE%.sha256"
        )
    )
    del "%PACKAGE_FILE%.sha256.tmp" 2>nul
    echo   Created: %PACKAGE_FILE%.sha256
)
exit /b 0

:CreateCombined

REM Create combined SHA256SUMS file
echo.
echo Creating SHA256SUMS file...
> SHA256SUMS.tmp (
    for %%f in (*.*) do (
        if /I "%%~xf"==".exe" (
            if exist "%%f.sha256" type "%%f.sha256"
        ) else if /I "%%~xf"==".deb" (
            if exist "%%f.sha256" type "%%f.sha256"
        ) else if /I "%%~xf"==".AppImage" (
            if exist "%%f.sha256" type "%%f.sha256"
        )
    )
)
move /y SHA256SUMS.tmp SHA256SUMS >nul 2>&1

cd ..

echo.
echo ============================================
echo Checksum files created successfully!
echo ============================================
dir /b dist/*.sha256 dist/SHA256SUMS 2>nul
echo.
echo To verify a single package:
echo   certutil -hashfile "dist\ChatGPT-EX Setup X.X.X.exe" SHA256
echo.
echo Or verify all with Git Bash or Linux:
echo   cd dist ^&^& sha256sum -c SHA256SUMS
echo.
echo You can also open a .sha256 file and compare values manually.
echo ============================================
exit /b 0
