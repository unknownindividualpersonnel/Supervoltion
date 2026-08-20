// Simple glue: hook UI controls to the Emulator
const fileInput = document.getElementById('rom-file');
const dropzone = document.getElementById('dropzone');
const info = document.getElementById('info');
const hexdump = document.getElementById('hexdump');
const consoleEl = document.getElementById('console');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const stepBtn = document.getElementById('step');
const loadDemoBtn = document.getElementById('load-demo');
const statusEl = document.getElementById('status');

const emu = new Emulator(consoleEl);

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadRomFile(f);
});

;['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, (e)=>{e.preventDefault();dropzone.classList.add('drag')}));
;['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, (e)=>{e.preventDefault();dropzone.classList.remove('drag')}));

dropzone.addEventListener('drop', (e)=>{
  const f = e.dataTransfer.files[0];
  if (f) loadRomFile(f);
});

async function loadRomFile(file){
  info.textContent = `Loading ${file.name} (${file.size} bytes)...`;
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  inspectRom(bytes, file.size);
  // keep ROM bytes globally available and load into emulator memory
  window.latestROM = bytes;
  emu.loadROMBytes(bytes);
}

function readAscii(bytes, offset, length){
  let s = '';
  for(let i=0;i<length;i++){
    const b = bytes[offset+i];
    if (!b) break;
    s += (b>=0x20 && b<=0x7e)? String.fromCharCode(b) : '.';
  }
  return s.replace(/\.+$/,'');
}

function inspectRom(bytes, size){
  const candidates = [0x7fc0, 0xffc0];
  const results = candidates.map(off => {
    if (off + 32 > bytes.length) return null;
    const title = readAscii(bytes, off, 21);
    const mapMode = bytes[off+0x15];
    const romType = bytes[off+0x16];
    const romSize = bytes[off+0x17];
    const sramSize = bytes[off+0x18];
    const country = bytes[off+0x19];
    const license = bytes[off+0x1a];
    const version = bytes[off+0x1b];
    const checksumComplement = (bytes[off+0x1c] | (bytes[off+0x1d]<<8)) >>>0;
    const checksum = (bytes[off+0x1e] | (bytes[off+0x1f]<<8)) >>>0;
    return {off,title,mapMode,romType,romSize,sramSize,country,license,version,checksumComplement,checksum};
  });

  let chosen = null;
  for(const r of results){
    if (!r) continue;
    if (r.title && /[A-Za-z0-9]/.test(r.title)) { chosen = r; break; }
  }
  if (!chosen) chosen = results.find(r=>r) || null;

  info.innerHTML = '';
  const ul = document.createElement('div');
  ul.innerHTML = `<strong>File size:</strong> ${size} bytes`;
  info.appendChild(ul);

  if (!chosen){
    info.appendChild(document.createElement('div')).textContent = 'No 32-byte header found at common SNES header locations (0x7FC0 or 0xFFC0). The ROM may be smaller than expected or use an unusual header.';
  } else {
    const el = document.createElement('div');
    el.innerHTML = `<h3>Selected header at 0x${chosen.off.toString(16)}</h3>
      <p><strong>Title:</strong> ${chosen.title || '<empty>'}</p>
      <p><strong>Map mode:</strong> 0x${chosen.mapMode.toString(16)}</p>
      <p><strong>ROM type:</strong> 0x${chosen.romType.toString(16)}</p>
      <p><strong>ROM size byte:</strong> 0x${chosen.romSize.toString(16)} (interpreted as 2^N KB)</p>
      <p><strong>SRAM size byte:</strong> 0x${chosen.sramSize.toString(16)}</p>
      <p><strong>Country code:</strong> 0x${chosen.country.toString(16)}</p>
      <p><strong>License/maker:</strong> 0x${chosen.license.toString(16)}</p>
      <p><strong>Version:</strong> 0x${chosen.version.toString(16)}</p>
      <p><strong>Checksum complement:</strong> 0x${chosen.checksumComplement.toString(16)}</p>
      <p><strong>Checksum:</strong> 0x${chosen.checksum.toString(16)}</p>
    `;
    info.appendChild(el);
  }

  const len = Math.min(512, bytes.length);
  let hex = '';
  for(let i=0;i<len;i+=16){
    const a = bytes.slice(i,i+16);
    const addr = i.toString(16).padStart(6,'0');
    const hx = Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    const ascii = Array.from(a).map(b=> (b>=0x20 && b<=0x7e)?String.fromCharCode(b):'.').join('');
    hex += `${addr}  ${hx.padEnd(16*3)}  ${ascii}\n`;
  }
  hexdump.textContent = hex;
}

loadDemoBtn.addEventListener('click', ()=>{
  consoleEl.textContent = '';
  emu.loadDemoProgram();
});

startBtn.addEventListener('click', ()=>{
  statusEl.textContent = 'Running';
  emu.start();
});

stopBtn.addEventListener('click', ()=>{
  statusEl.textContent = 'Stopped';
  emu.stop();
});

stepBtn.addEventListener('click', ()=>{
  emu.stepOnce();
});

