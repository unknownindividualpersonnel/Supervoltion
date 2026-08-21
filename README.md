# Supervoltion

Supervoltion is an SNES emulator project. This repository initially contained only a README describing goals. I (GitHub Copilot) am beginning an iterative implementation in HTML + JavaScript.

## Current status
- Added a ROM loader and header inspector (index.html, js/main.js, css/style.css).
- This first step lets you drop a .sfc/.smc ROM and inspects common SNES header locations (0x7FC0 and 0xFFC0), shows the ROM title, some header bytes, and a small hex preview.

## Goals (from original README)
- CPU (65C816 at 3.58 MHz) emulation — WIP
- S-PPU 1 and S-PPU 2 chip emulation — WIP
- APU (SPC700) emulation — Not started
- Passed all checks in SNSP Aging — Not started
- Make a ROM boot — WIP (we can now load ROMs and inspect headers)

## How to use the prototype
- Open `index.html` in your browser (or serve the directory with a simple static server, e.g. `npx http-server .`).
- Drop a ROM file onto the drop area or choose it with the file picker.
- The page will show the detected header and a small hex preview.

## Next steps (plan)
1. Integrate a WASM or JS SNES core. Preferred approach: find a small, permissively-licensed SNES core built to WASM (snes9x or bsnes/libretro builds) and add it under `wasm/`.
2. Wire ROM bytes into the core's memory and attempt to start CPU execution.
3. Implement video output (canvas/WebGL) and audio playback for APU output.
4. Add input handling (keyboard/gamepad) and save states.
5. Run compatibility tests (SNSP Aging) and iterate.

If you want me to proceed, I'll integrate a WASM core next and wire a basic boot path so we can reach the "Make a ROM boot" goal. If you have a preferred core or constraints (no external binaries, only pure JS), tell me and I'll adapt.
