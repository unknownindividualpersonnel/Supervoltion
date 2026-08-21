// Minimal Memory abstraction with bulk load support for ROM mapping
class Memory {
  constructor(size = 0x1000000) { // default 16MB addressable space
    this.size = size;
    this.data = new Uint8Array(size);
  }

  read8(addr) {
    addr &= (this.size - 1);
    return this.data[addr];
  }

  write8(addr, value) {
    addr &= (this.size - 1);
    this.data[addr] = value & 0xFF;
  }

  // Bulk copy a Uint8Array into the memory at a 24-bit address.
  // This is intentionally simple and fast for ROM mapping.
  loadAt(addr24, bytes) {
    let base = addr24 & 0xFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      const a = (base + i) & 0xFFFFFF;
      if (a < this.size) this.data[a] = bytes[i];
    }
  }

  // Helper to read an aligned 16-bit value from linear memory
  read16(addr) {
    const lo = this.read8(addr);
    const hi = this.read8((addr + 1) & 0xFFFFFF);
    return lo | (hi << 8);
  }

  write16(addr, val) {
    this.write8(addr, val & 0xFF);
    this.write8((addr + 1) & 0xFFFFFF, (val >>> 8) & 0xFF);
  }
}

window.Memory = Memory;
