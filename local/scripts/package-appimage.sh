#!/usr/bin/env bash
# AgentForge Local — empacotamento AppImage (Linux x86_64)
# uso: scripts/package-appimage.sh [versão]
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:-0.1.0}"
DIST="dist"
APPDIR="build/AgentForge.AppDir"
OUT="AgentForge-Local-v${VER}-x86_64.AppImage"
TOOLS="/home/z/my-project/.tools"

echo "→ montando AppDir..."
rm -rf build
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/agentforge" "$APPDIR/usr/share/icons/hicolor/512x512/apps"

cp "$DIST/agentforge-local" "$APPDIR/usr/bin/"
cp -r "$DIST/web" "$APPDIR/usr/share/agentforge/web"
cp assets/icon.png "$APPDIR/usr/share/icons/hicolor/512x512/apps/agentforge-local.png"
cp assets/icon.png "$APPDIR/agentforge-local.png"
ln -sf agentforge-local.png "$APPDIR/.DirIcon"

cat > "$APPDIR/agentforge-local.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AgentForge
GenericName=Agente de IA local
Comment=Plataforma local de agentes de IA — ferramentas reais no seu PC
Exec=agentforge-local
Icon=agentforge-local
Terminal=false
Categories=Development;Utility;System;
StartupWMClass=agentforge-local
StartupNotify=true
X-AppImage-Version=${VER}
EOF

cat > "$APPDIR/AppRun" <<'EOF'
#!/usr/bin/env bash
set -e
HERE="$(dirname "$(readlink -f "$0")")"
export AGENTFORGE_HOME="${AGENTFORGE_HOME:-$HOME/.local/share/AgentForge}"
export AGENTFORGE_WEB="$HERE/usr/share/agentforge/web"
mkdir -p "$AGENTFORGE_HOME" 2>/dev/null || true
exec "$HERE/usr/bin/agentforge-local" "$@"
EOF
chmod +x "$APPDIR/AppRun"

echo "→ baixando appimagetool (se necessário)..."
if [ ! -x "$TOOLS/appimagetool-x86_64.AppImage" ]; then
  curl -sL -o "$TOOLS/appimagetool-x86_64.AppImage" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$TOOLS/appimagetool-x86_64.AppImage"
fi

echo "→ gerando AppImage..."
rm -f "$OUT"
# APPIMAGE_EXTRACT_AND_RUN dispensa FUSE (funciona em CI/sandbox)
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$TOOLS/appimagetool-x86_64.AppImage" "$APPDIR" "$OUT" --comp zstd

echo "→ pronto: $OUT ($(du -h "$OUT" | cut -f1))"
sha256sum "$OUT" | tee "$OUT.sha256"
