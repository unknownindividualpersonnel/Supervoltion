// Simple ROM mapping utilities for prototype emulator
// Provides detectFormat(bytes) and mapToMemory(mem, bytes, format)
const ROMMap = {
  detectFormat(bytes) {
    // Basic detection: look for SNES 32-byte header at 0x7FC0 or 0xFFC0
    function readTitle(off) {
      if (off + 21 > bytes.length) return null;
      let s = '';
      for (let i = 0; i < 21; i++) {
        const b = bytes[off + i];
        if (!b) break;
        if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
      }
      return s;
    }
    const candidates = [0x7FC0, 0xFFC0];
    for (const off of candidates) {
      const title = readTitle(off);
      if (title && title.length > 0) {
        // choose LoROM by default for now
        return 'lorom';
      }
    }
    // fallback
    return 'lorom';
  },

  mapToMemory(mem, bytes, format) {
    // Remove 512-byte copier header if present (common in SMC files)
    let start = 0;
    if (bytes.length % 0x8000 === 512) {
      start = 512;
    }
    const rom = bytes.subarray(start);
    const bankSize = 0x8000; // LoROM bank size for mapping to $8000-$FFFF
    const mappedBanks = Math.ceil(rom.length / bankSize);

    for (let bank = 0; bank < mappedBanks; bank++) {
      const sliceStart = bank * bankSize;
      const sliceEnd = Math.min(sliceStart + bankSize, rom.length);
      const chunk = rom.subarray(sliceStart, sliceEnd);
      const addr = (bank << 16) | 0x8000;
      if (typeof mem.loadAt === 'function') {
        mem.loadAt(addr, chunk);
      } else {
        // fallback: write byte-by-byte
        for (let i = 0; i < chunk.length; i++) mem.write8(addr + i, chunk[i]);
      }
    }

    return { mappedBanks, bankSize };
  }
};

window.ROMMap = ROMMap;
