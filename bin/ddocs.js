#!/usr/bin/env node
// Committed executable bin wrapper.
//
// Pointing `package.json#bin` straight at the tsc output (`dist/index.js`) is
// unreliable: tsc emits it WITHOUT the execute bit and git does not track it, so
// whether the installed bin runs depends on npm's install-time chmod fixup. This
// wrapper is tracked with git mode 100755, so the execute bit survives every
// checkout deterministically and the bin needs no install-time chmod at all.
import '../dist/index.js';
