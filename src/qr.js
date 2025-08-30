// QR code generation
import { canvas, baseW, baseH, updateSelInfo } from './canvas.js';

async function ensureQRLib(){
  if (window.QRCode || window.qrcode) return true;
  const urls = [
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
    'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js'
  ];
  for(const u of urls){
    try{ await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=u; s.onload=()=>res(); s.onerror=()=>rej(); document.head.appendChild(s); }); if(window.QRCode||window.qrcode) return true; }catch(e){}
  }
  return false;
}
function createQRDataURL(text, size=512, cb){
  if (window.QRCode && window.QRCode.toDataURL){
    window.QRCode.toDataURL(text, { width: size, margin: 1 }, cb);
  } else if (window.qrcode){
    try{ const qr=window.qrcode(0,'M'); qr.addData(text); qr.make(); const url=qr.createDataURL(8); cb(null,url); }catch(e){ cb(e); }
  } else { cb(new Error('Sin librería QR')); }
}
export async function makeQR(url){
  const ok=await ensureQRLib();
  if(!ok){ alert('No se pudo cargar la librería de QR.'); return; }
  createQRDataURL(url,512,(err,d)=>{
    if(err||!d){ console.error('QR error:',err); alert('No se pudo generar el QR'); return; }
    fabric.Image.fromURL(d,(img)=>{ img.set({left:baseW/2, top:baseH/2, originX:'center', originY:'center', scaleX:.5, scaleY:.5}); canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo(); });
  });
}
