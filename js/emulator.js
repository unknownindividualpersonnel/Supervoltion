// High-level emulator harness connecting Memory + CPU
class Emulator {
  constructor(outputConsole) {
    this.mem = new Memory();
    this.cpu = new CPU65C816(this.mem);
    this.consoleEl = outputConsole;
    // hook address 0x6000 for console output (demo only)
    this.mem.setWriteHook(0x006000, (v) => {
      const ch = String.fromCharCode(v);
      this.log(ch);
    });
  }

  log(s) {
    if (this.consoleEl) {
      this.consoleEl.textContent += s;
      this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    } else {
      console.log('[emu]', s);
    }
  }

  loadROMBytes(bytes) {
    // For now, load at address 0x8000 and set reset vector to 0x8000
    const loadAddr = 0x008000;
    this.mem.loadAt(loadAddr, bytes);
    // write a reset vector at 0x0000 pointing to 0x8000
    this.mem.write16(0x0000, loadAddr & 0xFFFF);
    this.mem.write8(0x0002, (loadAddr >>> 16) & 0xFF);
    this.cpu.PB = 0x00; // bank 0
    this.cpu.DB = 0x00;
    this.cpu.PC = loadAddr & 0xFFFF;
    this.log(`ROM loaded ${bytes.length} bytes at 0x${loadAddr.toString(16)}\n`);
  }

  loadDemoProgram() {
    // Simple program: write "HELLO" to address 0x6000 using STA absolute
    // Assembly (6502 style):
    // LDA # 'H'    -> A9 48
    // STA $6000    -> 8D 00 60
    // LDA # 'E'    -> A9 45
    // STA $6000    -> 8D 00 60
    // ... BRK -> 00
    const prog = [
      0xA9, 0x48, 0x8D, 0x00, 0x60,
      0xA9, 0x45, 0x8D, 0x00, 0x60,
      0xA9, 0x4C, 0x8D, 0x00, 0x60,
      0xA9, 0x4C, 0x8D, 0x00, 0x60,
      0xA9, 0x4F, 0x8D, 0x00, 0x60,
      0x00
    ];
    this.mem.loadAt(0x0000, prog);
    this.mem.write16(0x0000, 0x0000); // reset vector -> 0x0000
    this.cpu.PB = 0x00;
    this.cpu.DB = 0x00;
    this.cpu.PC = 0x0000;
    this.log('Demo program loaded at 0x0000\n');
  }

  start() {
    this.cpu.running = true;
    // run in a short loop to avoid blocking the UI
    const stepChunk = () => {
      if (!this.cpu.running) return;
      for (let i = 0; i < 1000; i++) {
        if (!this.cpu.running) break;
        this.cpu.step();
      }
      // schedule next chunk
      setTimeout(stepChunk, 0);
    };
    stepChunk();
  }

  stop() {
    this.cpu.running = false;
  }

  stepOnce() {
    this.cpu.step();
  }
}

window.Emulator = Emulator;
