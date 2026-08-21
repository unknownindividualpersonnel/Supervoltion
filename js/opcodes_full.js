// Comprehensive (work-in-progress) 65C816 opcode metadata
// Each entry maps opcode byte (hex) to: {mnemonic, mode, bytes, cycles, flags}
// mode: addressing helper key used by Addressing
// flags: optional booleans: dependsOnM, dependsOnX, pageCrossPossible, nativeOnly, branch
// NOTE: This file is built from standard 65C816 references and is intended to be extended/verified.

const OpcodesFull = {
  // 0x00 - 0x0F
  0x00: {mnemonic:'BRK', mode:null, bytes:1, cycles:7},
  0x01: {mnemonic:'ORA', mode:'zpIndX', bytes:2, cycles:6, pageCrossPossible:false},
  0x02: {mnemonic:'COP', mode:'imm8', bytes:2, cycles:4, nativeOnly:true},
  0x03: {mnemonic:'ORA', mode:'stackRel', bytes:2, cycles:8},
  0x04: {mnemonic:'TSB', mode:'zp', bytes:2, cycles:5, nativeOnly:true},
  0x05: {mnemonic:'ORA', mode:'zp', bytes:2, cycles:3},
  0x06: {mnemonic:'ASL', mode:'zp', bytes:2, cycles:5},
  0x07: {mnemonic:'ORA', mode:'zpIndLong', bytes:3, cycles:5, nativeOnly:true},
  0x08: {mnemonic:'PHP', mode:null, bytes:1, cycles:3},
  0x09: {mnemonic:'ORA', mode:'imm8', bytes:2, cycles:2},
  0x0A: {mnemonic:'ASL', mode:'acc', bytes:1, cycles:2},
  0x0B: {mnemonic:'PHD', mode:null, bytes:1, cycles:3, nativeOnly:true},
  0x0C: {mnemonic:'TSB', mode:'abs', bytes:3, cycles:6, nativeOnly:true},
  0x0D: {mnemonic:'ORA', mode:'abs', bytes:3, cycles:4},
  0x0E: {mnemonic:'ASL', mode:'abs', bytes:3, cycles:6},
  0x0F: {mnemonic:'ORA', mode:'absLong', bytes:4, cycles:6, nativeOnly:true},

  // 0x10 - 0x1F
  0x10: {mnemonic:'BPL', mode:'rel', bytes:2, cycles:2, branch:true},
  0x11: {mnemonic:'ORA', mode:'zpIndY', bytes:2, cycles:5, pageCrossPossible:true},
  0x12: {mnemonic:'ORA', mode:'zpInd', bytes:2, cycles:5},
  0x13: {mnemonic:'ORA', mode:'stackRelX', bytes:2, cycles:8},
  0x14: {mnemonic:'TRB', mode:'zp', bytes:2, cycles:5, nativeOnly:true},
  0x15: {mnemonic:'ORA', mode:'zpX', bytes:2, cycles:4},
  0x16: {mnemonic:'ASL', mode:'zpX', bytes:2, cycles:6},
  0x17: {mnemonic:'ORA', mode:'zpIndLongY', bytes:2, cycles:6, nativeOnly:true},
  0x18: {mnemonic:'CLC', mode:null, bytes:1, cycles:2},
  0x19: {mnemonic:'ORA', mode:'absY', bytes:3, cycles:4, pageCrossPossible:true},
  0x1A: {mnemonic:'INC', mode:'acc', bytes:1, cycles:2, nativeOnly:true},
  0x1B: {mnemonic:'TCS', mode:null, bytes:1, cycles:4, nativeOnly:true},
  0x1C: {mnemonic:'TRB', mode:'abs', bytes:3, cycles:6, nativeOnly:true},
  0x1D: {mnemonic:'ORA', mode:'absX', bytes:3, cycles:4, pageCrossPossible:true},
  0x1E: {mnemonic:'ASL', mode:'absX', bytes:3, cycles:7},
  0x1F: {mnemonic:'ORA', mode:'absLongX', bytes:4, cycles:7, nativeOnly:true},

  // 0x20 - 0x2F
  0x20: {mnemonic:'JSR', mode:'abs', bytes:3, cycles:6},
  0x21: {mnemonic:'AND', mode:'zpIndX', bytes:2, cycles:6},
  0x22: {mnemonic:'JSR', mode:'absLong', bytes:4, cycles:8, nativeOnly:true},
  0x23: {mnemonic:'AND', mode:'stackRel', bytes:2, cycles:8},
  0x24: {mnemonic:'BIT', mode:'zp', bytes:2, cycles:3},
  0x25: {mnemonic:'AND', mode:'zp', bytes:2, cycles:3},
  0x26: {mnemonic:'ROL', mode:'zp', bytes:2, cycles:5},
  0x27: {mnemonic:'AND', mode:'zpIndLong', bytes:3, cycles:5, nativeOnly:true},
  0x28: {mnemonic:'PLP', mode:null, bytes:1, cycles:4},
  0x29: {mnemonic:'AND', mode:'imm8', bytes:2, cycles:2},
  0x2A: {mnemonic:'ROL', mode:'acc', bytes:1, cycles:2},
  0x2B: {mnemonic:'PLD', mode:null, bytes:1, cycles:4, nativeOnly:true},
  0x2C: {mnemonic:'BIT', mode:'abs', bytes:3, cycles:4},
  0x2D: {mnemonic:'AND', mode:'abs', bytes:3, cycles:4},
  0x2E: {mnemonic:'ROL', mode:'abs', bytes:3, cycles:6},
  0x2F: {mnemonic:'AND', mode:'absLong', bytes:4, cycles:6, nativeOnly:true},

  // 0x30 - 0x3F
  0x30: {mnemonic:'BMI', mode:'rel', bytes:2, cycles:2, branch:true},
  0x31: {mnemonic:'AND', mode:'zpIndY', bytes:2, cycles:5, pageCrossPossible:true},
  0x32: {mnemonic:'AND', mode:'zpInd', bytes:2, cycles:5},
  0x33: {mnemonic:'AND', mode:'stackRelX', bytes:2, cycles:8},
  0x34: {mnemonic:'BIT', mode:'zpX', bytes:2, cycles:4, nativeOnly:true},
  0x35: {mnemonic:'AND', mode:'zpX', bytes:2, cycles:4},
  0x36: {mnemonic:'ROL', mode:'zpX', bytes:2, cycles:6},
  0x37: {mnemonic:'AND', mode:'zpIndLongY', bytes:2, cycles:6, nativeOnly:true},
  0x38: {mnemonic:'SEC', mode:null, bytes:1, cycles:2},
  0x39: {mnemonic:'AND', mode:'absY', bytes:3, cycles:4, pageCrossPossible:true},
  0x3A: {mnemonic:'DEC', mode:'acc', bytes:1, cycles:2, nativeOnly:true},
  0x3B: {mnemonic:'TSC', mode:null, bytes:1, cycles:4, nativeOnly:true},
  0x3C: {mnemonic:'BIT', mode:'absX', bytes:3, cycles:4, nativeOnly:true},
  0x3D: {mnemonic:'AND', mode:'absX', bytes:3, cycles:4, pageCrossPossible:true},
  0x3E: {mnemonic:'ROL', mode:'absX', bytes:3, cycles:7},
  0x3F: {mnemonic:'AND', mode:'absLongX', bytes:4, cycles:7, nativeOnly:true},

  // 0x40 - 0x4F
  0x40: {mnemonic:'RTI', mode:null, bytes:1, cycles:6},
  0x41: {mnemonic:'EOR', mode:'zpIndX', bytes:2, cycles:6},
  0x42: {mnemonic:'WDM', mode:null, bytes:1, cycles:2, nativeOnly:true},
  0x43: {mnemonic:'EOR', mode:'stackRel', bytes:2, cycles:8},
  0x44: {mnemonic:'MVP', mode:null, bytes:3, cycles:7, nativeOnly:true},
  0x45: {mnemonic:'EOR', mode:'zp', bytes:2, cycles:3},
  0x46: {mnemonic:'LSR', mode:'zp', bytes:2, cycles:5},
  0x47: {mnemonic:'EOR', mode:'zpIndLong', bytes:3, cycles:5, nativeOnly:true},
  0x48: {mnemonic:'PHA', mode:null, bytes:1, cycles:3},
  0x49: {mnemonic:'EOR', mode:'imm8', bytes:2, cycles:2},
  0x4A: {mnemonic:'LSR', mode:'acc', bytes:1, cycles:2},
  0x4B: {mnemonic:'PHK', mode:null, bytes:1, cycles:3, nativeOnly:true},
  0x4C: {mnemonic:'JMP', mode:'abs16', bytes:3, cycles:3},
  0x4D: {mnemonic:'EOR', mode:'abs', bytes:3, cycles:4},
  0x4E: {mnemonic:'LSR', mode:'abs', bytes:3, cycles:6},
  0x4F: {mnemonic:'EOR', mode:'absLong', bytes:4, cycles:6, nativeOnly:true},

  // ... continued for all 256 opcodes
};

// Export for usage by CPU; later we'll add handlers and fill the remaining opcodes.
window.OpcodesFull = OpcodesFull;
