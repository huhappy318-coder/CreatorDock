#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print '需要 Python 3.9 或更高版本才能启动预构建网页应用。'
  read -r '?按回车关闭。'
  exit 1
fi
python3 scripts/serve-built.py
