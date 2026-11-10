#!/usr/bin/env bash
set -euo pipefail
# 2 GB VDS: swap as OOM protection. Run as root on the server.
if [ -f /swapfile ]; then
  echo "swap: /swapfile already exists"
  swapon --show || true
  exit 0
fi
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-axiona-swap.conf
echo "swap: enabled 2G"
swapon --show
