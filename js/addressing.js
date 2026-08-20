// Addressing mode helpers for the 65C816-like CPU
// Each helper expects a CPU instance with fetch8() and fetch16() methods

const Addressing = {
  imm8(cpu) {
    // immediate 8-bit operand
    return cpu.fetch8();
  },
  imm16(cpu) {
    // immediate 16-bit (little-endian)
    return cpu.fetch16();
  },
  abs(cpu) {
    // absolute 16-bit address within current data bank
    const addr16 = cpu.fetch16();
    return (cpu.DB << 16) | (addr16 & 0xFFFF);
  },
  abs16(cpu) {
    // return 16-bit address only (helper)
    return cpu.fetch16();
  },
  absLong(cpu) {
    // 24-bit absolute address (3 bytes: low, mid, high)
    const lo = cpu.fetch8();
    const mid = cpu.fetch8();
    const hi = cpu.fetch8();
    return (hi << 16) | (mid << 8) | lo;
  },
  dp(cpu) {
    // Direct page (zero page) — uses D register as base and 8-bit offset
    const offset = cpu.fetch8();
    return ((cpu.D & 0xFFFF) + offset) & 0xFFFFFF;
  },
  dpX(cpu) {
    const offset = cpu.fetch8();
    return ((cpu.D & 0xFFFF) + offset + (cpu.X & 0xFF)) & 0xFFFFFF;
  },
  dpY(cpu) {
    const offset = cpu.fetch8();
    return ((cpu.D & 0xFFFF) + offset + (cpu.Y & 0xFF)) & 0xFFFFFF;
  },
  absX(cpu) {
    const addr16 = cpu.fetch16();
    return ((cpu.DB << 16) | ((addr16 + (cpu.X & 0xFF)) & 0xFFFF)) & 0xFFFFFF;
  },
  absY(cpu) {
    const addr16 = cpu.fetch16();
    return ((cpu.DB << 16) | ((addr16 + (cpu.Y & 0xFF)) & 0xFFFF)) & 0xFFFFFF;
  },
  rel(cpu) {
    // relative branch: signed 8-bit offset from PC (which has already advanced past operand)
    const disp = cpu.fetch8();
    const signed = disp < 0x80 ? disp : disp - 0x100;
    const newPc = (cpu.PC + signed) & 0xFFFF;
    return newPc;
  }
};

window.Addressing = Addressing;
