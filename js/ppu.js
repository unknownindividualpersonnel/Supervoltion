// PPU module: read/write handlers for $2100-$213F and a simple tile-based frame renderer.
// Original implementation — inspired by working prototypes but written from scratch.
(function(){
  // Screen dimensions and helpers
  const WIDTH = 256, HEIGHT = 224;

  function clamp8(v){ return v & 0xFF; }
  function clamp16(v){ return v & 0xFFFF; }

  // Convert a 15-bit BGR555 color (lo|hi<<8) to [r,g,b]
  function bgr555ToRGB(lo, hi){
    const c = (hi<<8) | lo;
    const r5 = c & 0x1F;
    const g5 = (c >> 5) & 0x1F;
    const b5 = (c >> 10) & 0x1F;
    const r = Math.round((r5 / 31) * 255);
    const g = Math.round((g5 / 31) * 255);
    const b = Math.round((b5 / 31) * 255);
    return [r,g,b];
  }

  // Decode an 8x8 tile from VRAM into a 64-element array of color indices.
  // vram: Uint8Array(65536), tileAddr: word address (0-0xFFFF), bpp: bits per pixel (2/4/8)
  function decodeTile(vram, tileAddr, bpp){
    const out = new Uint8Array(64);
    const planes = Math.max(1, bpp/2);
    const base = (tileAddr & 0xFFFF);
    // For each row
    for (let y=0;y<8;y++){
      let planeBits = [];
      for (let p=0;p<planes;p++){
        const lo = vram[(base + p*16 + y*2) & 0xFFFF];
        const hi = vram[(base + p*16 + y*2 + 1) & 0xFFFF];
        planeBits.push(lo, hi);
      }
      for (let x=0;x<8;x++){
        let idx = 0;
        const bit = 7 - x;
        for (let p=0;p<planes;p++){
          const lo = planeBits[p*2];
          const hi = planeBits[p*2+1];
          const bit0 = (lo >> bit) & 1;
          const bit1 = (hi >> bit) & 1;
          idx |= (bit0 | (bit1<<1)) << (p*2);
        }
        out[y*8 + x] = idx;
      }
    }
    return out;
  }

  // Simple BG bpp table for common modes (approximation)
  function bgBppForMode(mode, layer){
    // This mapping approximates how many bits per pixel each BG uses in modes 0-6
    switch(mode){
      case 0: return 2;
      case 1: return (layer===3)?2:4;
      case 2: return (layer<=2)?4:((layer===3)?2:0);
      case 3: return (layer===1)?8:((layer===2)?4:0);
      case 4: return (layer===1)?8:((layer===2)?2:0);
      case 5: return (layer===1)?4:((layer===2)?2:0);
      case 6: return (layer===1)?4:0;
      default: return 0;
    }
  }

  // Render a frame to an RGBA Uint8ClampedArray using current bus VRAM/CGRAM/OAM state.
  // This is a best-effort renderer: no Mode7, no color math, approximate priorities.
  function renderFrame(bus){
    const frame = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    // If forced blank (INIDISP bit7) is set, return transparent black (alpha=255)
    const inidisp = (bus.ppuRegs && bus.ppuRegs[0x00]) || 0;
    if (inidisp & 0x80){
      for (let i=3;i<frame.length;i+=4) frame[i]=255;
      return frame;
    }

    const mode = (bus.ppuRegs && bus.ppuRegs[0x05]) ? (bus.ppuRegs[0x05] & 7) : 0;
    const tileCache = new Map();

    // Precompute CGRAM palette table for quick lookup
    const paletteRGB = new Array(512);
    for (let i=0;i<256;i++){
      const lo = bus.cgram[(i*2) & 0x1FF] | 0;
      const hi = bus.cgram[(i*2+1) & 0x1FF] | 0;
      paletteRGB[i] = bgr555ToRGB(lo, hi);
    }

    function getTile(tileAddr, bpp){
      const key = (tileAddr&0xFFFF) + '|' + bpp;
      let t = tileCache.get(key);
      if (!t){ t = decodeTile(bus.vram, tileAddr, bpp); tileCache.set(key,t); }
      return t;
    }

    // Render BG layers back-to-front
    for (let layer=4; layer>=1; layer--){
      const bpp = bgBppForMode(mode, layer);
      if (bpp === 0) continue;
      const scReg = bus.ppuRegs[0x07 + (layer-1)] || 0;
      const nba = (layer<=2) ? (bus.ppuRegs[0x0B] || 0) : (bus.ppuRegs[0x0C] || 0);
      const charBaseUnits = (layer===1||layer===3) ? (nba & 0x0F) : ((nba>>4)&0x0F);
      const charBaseBytes = (charBaseUnits * 0x1000 * 2) & 0xFFFF;
      const mapBaseUnits = (scReg >> 2) & 0x3F;
      const mapBaseWords = (mapBaseUnits * 0x400) & 0xFFFF;
      const screenSize = scReg & 0x03;

      const hofs = (bus.bgHofs && bus.bgHofs[layer-1]) ? bus.bgHofs[layer-1] : 0;
      const vofs = (bus.bgVofs && bus.bgVofs[layer-1]) ? bus.bgVofs[layer-1] : 0;

      const cols = (screenSize & 1) ? 64 : 32;
      const rows = (screenSize & 2) ? 64 : 32;
      const bytesPerTile = (bpp/8) * 64; // just a rough number to compute tile address

      for (let py=0; py<HEIGHT; py++){
        const mapY = (py + vofs) % (rows * 8);
        const tileRow = Math.floor(mapY / 8);
        const withinY = mapY % 8;
        for (let px=0; px<WIDTH; px++){
          const mapX = (px + hofs) % (cols * 8);
          const tileCol = Math.floor(mapX / 8);
          const withinX = mapX % 8;

          // compute screen index per SNES screen size arrangement
          const subCol = Math.floor(tileCol / 32), subRow = Math.floor(tileRow / 32);
          const localCol = tileCol % 32, localRow = tileRow % 32;
          let screenIndex = 0;
          if (screenSize === 1) screenIndex = subCol;
          else if (screenSize === 2) screenIndex = subRow;
          else if (screenSize === 3) screenIndex = subRow * 2 + subCol;

          const entryWordAddr = (mapBaseWords + (screenIndex * 0x400) + (localRow * 32 + localCol)) & 0xFFFF;
          const entryByte = (bus.vram[(entryWordAddr*2) & 0xFFFF] | 0);
          const entryByte2 = (bus.vram[((entryWordAddr*2)+1) & 0xFFFF] | 0);
          const entry = entryByte | (entryByte2<<8);
          const tileNum = entry & 0x3FF;
          const hFlip = !!((entry>>10)&1); const vFlip = !!((entry>>11)&1);
          const palette = (entry>>12)&0x07;

          const tileAddr = (charBaseBytes + tileNum * (bpp/8*8)) & 0xFFFF;
          const tile = getTile(tileAddr, bpp);
          const sx = hFlip ? (7-withinX) : withinX; const sy = vFlip ? (7-withinY) : withinY;
          const idx = tile[sy*8 + sx];
          if (idx === 0) continue; // transparent
          const cgIndex = (bpp === 8) ? idx : (palette * (1<<bpp)) + idx;
          const [r,g,b] = paletteRGB[cgIndex & 0xFF] || [0,0,0];
          const off = (py*WIDTH + px) * 4;
          frame[off] = r; frame[off+1] = g; frame[off+2] = b; frame[off+3] = 255;
        }
      }
    }

    // Render simple OBJ layer on top (naive, no per-line limit enforcement)
    // OAM entries: 128 sprites x 4 bytes + 32 bytes high table
    const obsel = bus.ppuRegs ? (bus.ppuRegs[0x01] || 0) : 0;
    const nameBase = (obsel & 0x07) * 0x4000;
    const nameGap = ((((obsel>>3)&0x03)+1) * 0x2000) & 0xFFFF;

    for (let i=0;i<128;i++){
      const b = i*4;
      let x = bus.oam[b] | 0; const y = bus.oam[b+1] | 0;
      if (y >= 0xF0) continue; // offscreen sentinel
      const tileLow = bus.oam[b+2] | 0; const attr = bus.oam[b+3] | 0;
      const hiByte = bus.oam[512 + (i>>2)] | 0; const shift = (i & 3) * 2;
      const xMsb = (hiByte >> shift) & 1; const sizeBit = (hiByte >> (shift+1)) & 1;
      if (xMsb) x -= 256;
      const sizePx = sizeBit ? 32 : 16; // approximate sizes
      const tilesPerSide = sizePx / 8;
      const palette = (attr>>1) & 0x07; const hFlip = !!((attr>>6)&1); const vFlip = !!((attr>>7)&1);
      const tileNum = tileLow | ((attr & 1) << 8);

      for (let ty=0; ty<tilesPerSide; ty++){
        for (let tx=0; tx<tilesPerSide; tx++){
          const tnum = tileNum + ty*16 + tx;
          const addr = (tnum < 256) ? (nameBase + tnum*32) : (nameBase + nameGap + (tnum-256)*32);
          const tile = getTile(addr & 0xFFFF, 4);
          for (let py=0; py<8; py++){
            for (let px=0; px<8; px++){
              const sx = hFlip ? (7-px) : px; const sy = vFlip ? (7-py) : py;
              const idx = tile[sy*8 + sx]; if (idx === 0) continue;
              const screenX = x + tx*8 + px; const screenY = y + ty*8 + py;
              if (screenX < 0 || screenX >= WIDTH || screenY < 0 || screenY >= HEIGHT) continue;
              const cgIndex = 128 + palette*16 + idx;
              const [r,g,b] = paletteRGB[cgIndex & 0xFF] || [0,0,0];
              const off = (screenY*WIDTH + screenX)*4;
              frame[off]=r; frame[off+1]=g; frame[off+2]=b; frame[off+3]=255;
            }
          }
        }
      }
    }

    return frame;
  }

  // Attach PPU handlers to a SystemBus instance
  function attachPPU(bus){
    // ppuRegs: small register file for $2100-$213F readable for debugging
    if (!bus.ppuRegs) bus.ppuRegs = new Uint8Array(0x40);
    // internal latches
    bus.vmadd = bus.vmadd || 0; bus.vmainIncHigh = bus.vmainIncHigh || false; bus.vmainStep = bus.vmainStep || 1;
    bus.oamAddr = bus.oamAddr || 0; bus.oamLatch = bus.oamLatch || null; bus.oamPriorityRotate = bus.oamPriorityRotate || 0;
    bus.cgAddr = bus.cgAddr || 0; bus.cgLatch = bus.cgLatch || null; bus.cgReadHigh = bus.cgReadHigh || false;

    bus.ppuRead = function(addr){
      const a = addr & 0xFFFF;
      switch(a){
        case 0x2138: {
          const v = bus.oam[bus.oamAddr % bus.oam.length] | 0; bus.oamAddr = (bus.oamAddr + 1) % bus.oam.length; return v; }
        case 0x2139: {
          const v = bus.vram[(bus.vmadd*2) & 0xFFFF] | 0; if (!bus.vmainIncHigh) bus.vmadd = (bus.vmadd + bus.vmainStep) & 0x7FFF; return v; }
        case 0x213A: {
          const v = bus.vram[(bus.vmadd*2+1) & 0xFFFF] | 0; if (bus.vmainIncHigh) bus.vmadd = (bus.vmadd + bus.vmainStep) & 0x7FFF; return v; }
        case 0x213B: {
          const off = (bus.cgAddr*2 + (bus.cgReadHigh?1:0)) & 0x1FF; const v = bus.cgram[off] | 0; if (bus.cgReadHigh) bus.cgAddr = (bus.cgAddr + 1) & 0xFF; bus.cgReadHigh = !bus.cgReadHigh; return v; }
        case 0x213C: {
          const h = bus.hCounter || (bus.dotCounter % bus.DOTS_PER_LINE); const out = (bus._hLatchHigh?((h>>8)&1):(h&0xFF)); bus._hLatchHigh = !bus._hLatchHigh; return out; }
        case 0x213D: {
          const v = bus.vCounter || Math.floor(bus.dotCounter / bus.DOTS_PER_LINE) % bus.LINES_PER_FRAME; const out = (bus._vLatchHigh?((v>>8)&1):(v&0xFF)); bus._vLatchHigh = !bus._vLatchHigh; return out; }
        case 0x213E: return 0x01; // PPU1 version, range/time clear
        case 0x213F: { bus._hLatchHigh = false; bus._vLatchHigh = false; return (bus.field?0x80:0) | 0x01; }
        default: return bus.openBus & 0xFF;
      }
    };

    bus.ppuWrite = function(addr, val){
      const a = addr & 0xFFFF; val &= 0xFF; bus.ppuRegs[a - 0x2100] = val;
      switch(a){
        case 0x2115: bus.vmainIncHigh = !!(val & 0x80); bus.vmainStep = (val & 0x03) === 0 ? 1 : ((val & 0x03) === 1 ? 32 : 128); break;
        case 0x2116: bus.vmadd = (bus.vmadd & 0x7F00) | val; break;
        case 0x2117: bus.vmadd = (bus.vmadd & 0x00FF) | ((val & 0x7F)<<8); break;
        case 0x2118: // VMDATAL
          bus.vram[(bus.vmadd*2) & 0xFFFF] = val;
          if (!bus.vmainIncHigh) bus.vmadd = (bus.vmadd + bus.vmainStep) & 0x7FFF;
          break;
        case 0x2119: // VMDATAH
          bus.vram[(bus.vmadd*2+1) & 0xFFFF] = val;
          if (bus.vmainIncHigh) bus.vmadd = (bus.vmadd + bus.vmainStep) & 0x7FFF;
          break;
        case 0x2102: bus._oamAddrLow = val; bus._recomputeOamAddr && bus._recomputeOamAddr(); break;
        case 0x2103: bus._oamAddrHigh = val & 0x01; bus.oamPriorityRotate = (val>>7)&1; bus._recomputeOamAddr && bus._recomputeOamAddr(); break;
        case 0x2104: {
          const addrB = bus.oamAddr % bus.oam.length;
          if (addrB < 0x200){
            if (bus.oamLatch === null) bus.oamLatch = val;
            else { bus.oam[addrB & ~1] = bus.oamLatch; bus.oam[(addrB & ~1)+1] = val; bus.oamLatch = null; }
          } else {
            bus.oam[addrB] = val;
          }
          bus.oamAddr = (bus.oamAddr + 1) % bus.oam.length;
          break;
        }
        case 0x2121: bus.cgAddr = val; bus.cgLatch = null; bus.cgReadHigh = false; break;
        case 0x2122: {
          if (bus.cgLatch === null) bus.cgLatch = val; else { const off = (bus.cgAddr*2)&0x1FF; bus.cgram[off] = bus.cgLatch; bus.cgram[off+1] = val; bus.cgLatch = null; bus.cgAddr = (bus.cgAddr + 1) & 0xFF; }
          break;
        }
        case 0x2137: // SLHV software latch — no-op in this simplified core
          break;
        default: break;
      }
    };

    // helper for external code to recompute oamAddr from low/high parts
    bus._recomputeOamAddr = function(){
      bus.oamAddr = (((bus._oamAddrHigh||0) << 8) | (bus._oamAddrLow||0)) % bus.oam.length;
      bus.oamLatch = null;
    };

    // initialize ppuRegs if not present
    if (!bus.ppuRegs) bus.ppuRegs = new Uint8Array(0x40);
  }

  // expose
  window.PPU = { attachPPU, renderFrame };
})();
