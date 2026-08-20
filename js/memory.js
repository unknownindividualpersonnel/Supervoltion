// Simple memory model for the emulator
class Memory {
  constructor(size = 0x1000000) { // 16MB 24-bit address space
    this.mem = new Uint8Array(size);
    this.size = size;
    this.writeHooks = new Map(); // address -> callback
  }

  read8(addr) {
    addr = addr & 0xFFFFFF;
    return this.mem[addr];
  }

  write8(addr, value) {
    addr = addr & 0xFFFFFF;
    this.mem[addr] = value & 0xFF;
    const hook = this.writeHooks.get(addr);
    if (hook) hook(value & 0xFF);
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
}

window.Memory = Memory;
