// Simple memory model for the emulator with address space hooks and ranges
class Memory {
  constructor(size = 0x1000000) { // 16MB 24-bit address space
    this.mem = new Uint8Array(size);
    this.size = size;
    this.writeHooks = new Map(); // address -> callback(value, addr)
    this.writeRanges = []; // [{start, end, cb}]
  }

  read8(addr) {
    addr = addr & 0xFFFFFF;
    return this.mem[addr];
  }

  write8(addr, value) {
    addr = addr & 0xFFFFFF;
    this.mem[addr] = value & 0xFF;
    const hook = this.writeHooks.get(addr);
    if (hook) hook(value & 0xFF, addr);
    for (const r of this.writeRanges) {
      if (addr >= r.start && addr <= r.end) {
        try { r.cb(value & 0xFF, addr); } catch (e) { console.error('writeRange callback error', e); }
      }
    }
  }

  read16(addr) {
    const lo = this.read8(addr);
    const hi = this.read8((addr + 1) & 0xFFFFFF);
    return lo | (hi << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xFF);
    this.write8((addr + 1) & 0xFFFFFF, (value >>> 8) & 0xFF);
  }

  loadAt(addr, bytes) {
    addr = addr & 0xFFFFFF;
    this.mem.set(bytes, addr);
  }

  setWriteHook(addr, cb) {
    addr = addr & 0xFFFFFF;
    this.writeHooks.set(addr, cb);
  }

  setWriteHookRange(start, end, cb) {
    start = start & 0xFFFFFF; end = end & 0xFFFFFF;
    this.writeRanges.push({start, end, cb});
  }
}

window.Memory = Memory;
