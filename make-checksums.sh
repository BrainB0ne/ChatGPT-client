#!/bin/bash
set -e

# Generate SHA256 checksums for distribution packages
# Creates individual .sha256 files for .exe, .deb, and .AppImage files in dist/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ ! -d "dist" ]; then
    echo "Error: dist/ folder not found."
    echo "Build distribution packages first with:"
    echo "  npm run build:linux     # for .deb and .AppImage"
    echo "  npm run build:win       # for Windows .exe (run on Windows)"
    exit 1
fi

echo "Generating SHA256 checksums for .exe, .deb, and .AppImage packages..."

cd dist

# Remove old checksum files
rm -f *.sha256 SHA256SUMS

# Generate individual .sha256 files for each package
shopt -s nullglob
checksum_files=()

for file in *; do
    # Only checksum top-level distribution package formats
    if [ -f "$file" ] && [[ "$file" == *.exe || "$file" == *.deb || "$file" == *.AppImage ]]; then
        sha256sum -- "$file" > "${file}.sha256"
        checksum_files+=("${file}.sha256")
        echo "  ${file}.sha256"
    fi
done

# Also create a combined SHA256SUMS file (exclude .sha256 files themselves)
# Concatenate the individual .sha256 files to create the combined file
if [ ${#checksum_files[@]} -gt 0 ]; then
    cat -- "${checksum_files[@]}" > SHA256SUMS
else
    echo "Error: no supported distribution files found in dist/."
    echo "Supported files: .exe, .deb, .AppImage"
    echo "Build packages first with npm run build:linux or npm run build:win."
    exit 1
fi

echo ""
echo "Checksum files created in dist/:"
ls -la -- *.sha256 SHA256SUMS 2>/dev/null || ls -la -- *.sha256
echo ""
echo "Verify a package with:"
echo "  sha256sum -c dist/<package>.sha256"
echo ""
echo "Or verify all with:"
echo "  cd dist && sha256sum -c SHA256SUMS"
