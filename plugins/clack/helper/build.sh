#!/bin/sh
# Rebuilds bin/clackd as a universal (Apple Silicon + Intel) binary. Needs the Xcode command line tools.
set -e
cd "$(dirname "$0")"
swiftc -O -target arm64-apple-macos12 clackd.swift -o /tmp/clackd-arm64
swiftc -O -target x86_64-apple-macos12 clackd.swift -o /tmp/clackd-x86_64
lipo -create /tmp/clackd-arm64 /tmp/clackd-x86_64 -output ../bin/clackd
rm /tmp/clackd-arm64 /tmp/clackd-x86_64
