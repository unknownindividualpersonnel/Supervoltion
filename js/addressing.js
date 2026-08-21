// Addressing mode helpers for the 65C816-like CPU (extended)
const Addressing = {
  imm8(cpu) { return cpu.fetch8(); },
  imm16(cpu) { return cpu.fetch16(); },
  abs(cpu) { const addr16 = cpu.fetch16(); return (cpu.DB << 16) | (addr16 & 0xFFFF); },
  abs16(cpu) { return cpu.fetch16(); },
  absLong(cpu) { const lo = cpu.fetch8(); const mid = cpu.fetch8(); const hi = cpu.fetch8(); return (hi << 16) | (mid << 8) | lo; },
  dp(cpu) { const offset = cpu.fetch8(); return ((cpu.D & 0xFFFF) + offset) & 0xFFFFFF; },
  dpX(cpu) { const offset = cpu.fetch8(); return ((cpu.D & 0xFFFF) + offset + (cpu.X & 0xFF)) & 0xFFFFFF; },
  dpY(cpu) { const offset = cpu.fetch8(); return ((cpu.D & 0xFFFF) + offset + (cpu.Y & 0xFF)) & 0xFFFFFF; },
  absX(cpu) { const addr16 = cpu.fetch16(); return ((cpu.DB << 16) | ((addr16 + (cpu.X & 0xFF)) & 0xFFFF)) & 0xFFFFFF; },
  absY(cpu) { const addr16 = cpu.fetch16(); return ((cpu.DB << 16) | ((addr16 + (cpu.Y & 0xFF)) & 0xFFFF)) & 0xFFFFFF; },
  rel(cpu) { const disp = cpu.fetch8(); const signed = disp < 0x80 ? disp : disp - 0x100; const newPc = (cpu.PC + signed) & 0xFFFF; return newPc; },
  // zero page style addressing (direct page base + offset, 8-bit)
  zp(cpu) { const off = cpu.fetch8(); return ((cpu.D & 0xFFFF) + off) & 0xFFFFFF; },
  zpX(cpu) { const off = cpu.fetch8(); return ((cpu.D & 0xFFFF) + ((off + (cpu.X & 0xFF)) & 0xFF)) & 0xFFFFFF; },
  zpY(cpu) { const off = cpu.fetch8(); return ((cpu.D & 0xFFFF) + ((off + (cpu.Y & 0xFF)) & 0xFF)) & 0xFFFFFF; },
  // stack-relative: offset from stack (8-bit signed) — 65C816 feature
  stackRel(cpu) { const disp = cpu.fetch8(); const signed = disp < 0x80 ? disp : disp - 0x100; const sp = cpu.SP & 0xFFFF; return (sp + 1 + signed) & 0xFFFFFF; }
};

window.Addressing = Addressing;
