// Emulator harness: integrate ROM mapping (LoROM/HiROM) and wire PPU register handling
class Emulator {
  constructor(consoleEl, canvasEl) {
    this.mem = new Memory();
    this.cpu = new CPU65C816(this.mem);
    this.consoleEl = consoleEl;
    this.ppu = new SPPU(this.mem, this.cpu, canvasEl);

    // hook simple console output at 0x006000 for debug
    this.mem.setWriteHook(0x006000, (v) => { this.log(String.fromCharCode(v)); });

    // CPU VBlank callback
    this.cpu.onVBlank = () => {
      this.log('[emu] PPU: VBlank started (callback to CPU)\n');
      // For now just mark the CPU with a flag; later we implement actual IRQ vector entry
      this.cpu.vblank = true;
    };
  }

  log(s) {
    if (this.consoleEl) { this.consoleEl.textContent += s; this.consoleEl.scrollTop = this.consoleEl.scrollHeight; } else console.log('[emu]', s);
  }

  loadROMBytes(bytes) {
    const format = ROMMap.detectFormat(bytes);
    const result = ROMMap.mapToMemory(this.mem, bytes, format);
    this.format = format;
    this.log(`ROM loaded (${format}) mapped ${result.mappedBanks} banks, bankSize=${result.bankSize}\n`);
    // set reset vector to bank 0x00 at 0x008000 for LoROM, or 0x00:0x0000 for HiROM depending
    if (format === 'lorom') {
      const loadAddr = 0x008000; this.mem.write16(0x0000, loadAddr & 0xFFFF); this.mem.write8(0x0002, 0x00); this.cpu.PC = loadAddr; this.cpu.PB = 0x00; this.cpu.DB = 0x00;
    } else {
      const loadAddr = 0x0000; this.mem.write16(0x0000, loadAddr & 0xFFFF); this.mem.write8(0x0002, 0x00); this.cpu.PC = loadAddr; this.cpu.PB = 0x00; this.cpu.DB = 0x00;
    }
  }

  loadDemoProgram() {
    // Demo: CPU writes to PPU registers to set VRAM address and write VRAM data; then BRK.
    // Sequence:
    // write vram addr low/mid/high at 0x2105/06/07
    // write data to 0x2108 repeatedly
    const base = 0x0400;
    const prog = [];
    // set vram addr 0x0000
    // write to bank:address mapping: we'll write to 0x002100.. but our Memory requires bank+addr, we write into bank 0x00
    // We'll use STA abs to write to 0x002105 etc. (STA absolute 8D low high)
    const WR = (addr24, val) => {
      const low = addr24 & 0xFF; const hi = (addr24 >> 8) & 0xFF;
      // LDA #val ; STA $addrLow/addrHi
      prog.push(0xA9); prog.push(val & 0xFF);
      prog.push(0x8D); prog.push(low); prog.push(hi);
    };
    // write vram addr low/mid/high to 0x2105/06/07
    WR(0x002105, 0x00); WR(0x002106, 0x00); WR(0x002107, 0x00);
    // write increment control to 0x2120 (set increment 1)
    WR(0x002120, 0x01);
    // now write a few bytes to VRAM via 0x2108
    for (let i = 0; i < 1024; i++) {
      WR(0x002108, i & 0xFF);
    }
    prog.push(0x00); // BRK
    this.mem.loadAt(base, new Uint8Array(prog));
    this.mem.write16(0x0000, base);
    this.cpu.PC = base; this.cpu.PB = 0x00; this.cpu.DB = 0x00;
    this.log('Demo program (PPU-write) loaded at 0x0400\n');
  }

  start() {
    this.cpu.running = true;
    const stepChunk = () => {
      if (!this.cpu.running) return;
      // execute a number of CPU steps, but after every step advance PPU by consumed cycles
      for (let i = 0; i < 1000; i++) {
        if (!this.cpu.running) break;
        // before executing, optionally handle pending interrupts (not fully implemented)
        this.cpu.step();
        // assume 1 CPU step consumed a nominal 1 cycle; in our model we add entry.cycles earlier but not returned
        // use cpu.cycles delta heuristics: advance PPU by 1 for each instruction cycle count entry; we approximate by adding 3 cycles per instruction
        this.ppu.step(3);
      }
      setTimeout(stepChunk, 0);
    };
    stepChunk();
  }

  stop() { this.cpu.running = false; }
  stepOnce() { this.cpu.step(); this.ppu.step(3); }
}

window.Emulator = Emulator;
