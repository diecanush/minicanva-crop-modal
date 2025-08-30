// Export functions (PNG/PDF)
import { canvas, baseW, baseH } from './canvas.js';

function toGray(dataURL){
  return new Promise((ok,ko)=>{
    const img=new Image();
    img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
      const d=x.getImageData(0,0,c.width,c.height); const a=d.data;
      for(let i=0;i<a.length;i+=4){ const y=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2]; a[i]=a[i+1]=a[i+2]=y; }
      x.putImageData(d,0,0); ok(c.toDataURL('image/png')); }; img.onerror=ko; img.src=dataURL; });
}
function withNeutralVPT(fn){
  const prev = (canvas.viewportTransform || [1,0,0,1,0,0]).slice();
  canvas.setViewportTransform([1,0,0,1,0,0]);
  const out = fn();
  canvas.setViewportTransform(prev);
  return out;
}
function getScaleMultiplier(){
  const elM = document.getElementById('selScaleM');
  if(elM) return parseInt(elM.value || '2', 10);
  const el = document.getElementById('selScale');
  return parseInt((el && el.value) || '2', 10);
}
function isMono(){
  const cM = document.getElementById('chkMonoM');
  if(cM) return !!cM.checked;
  const c = document.getElementById('chkMono');
  return !!(c && c.checked);
}

export async function exportPNG(){
  const mult = getScaleMultiplier();
  const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
  const out = isMono() ? await toGray(data) : data;
  const a=document.createElement('a'); a.href=out; a.download='diseño.png'; a.click();
}

export async function exportPDF(){
  const mult = getScaleMultiplier();
  const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
  const out = isMono() ? await toGray(data) : data;
  const { jsPDF } = window.jspdf;
  const w = baseW * mult, h = baseH * mult;
  const pdf=new jsPDF({ unit:'px', format:[w,h], orientation: (w>=h?'landscape':'portrait') });
  pdf.addImage(out,'PNG',0,0,w,h,undefined,'FAST'); pdf.save('diseño.pdf');
}

export async function printSheet(){
  const page=document.getElementById('selPage').value;
  const margin=parseFloat(document.getElementById('inpMargin').value||'10');
  const copyW=parseFloat(document.getElementById('inpCopyW').value||'80');
  let copies=parseInt(document.getElementById('inpCopies').value||'1',10);

  const mult=getScaleMultiplier();
  const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
  const out = isMono() ? await toGray(data) : data;

  const { jsPDF } = window.jspdf;
  const pdf=new jsPDF({unit:'mm', format:page});
  const pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight();

  const imgRatio = baseH / baseW;
  const copyH = copyW * imgRatio;

  const usableW=pageW - margin*2;
  const usableH=pageH - margin*2;

  const cols=Math.max(1, Math.floor(usableW / copyW));
  const rows=Math.max(1, Math.floor(usableH / copyH));
  if(cols*rows===0){ alert('Parámetros no válidos.'); return; }

  const leftoverW = Math.max(0, usableW - cols*copyW);
  const leftoverH = Math.max(0, usableH - rows*copyH);

  const gapX = leftoverW / (cols + 1);
  const gapY = leftoverH / (rows + 1);

  let placed=0;
  while(placed<copies){
    for(let r=0;r<rows && placed<copies;r++){
      for(let c=0;c<cols && placed<copies;c++){
        const x = margin + gapX + c*(copyW + gapX);
        const y = margin + gapY + r*(copyH + gapY);
        pdf.addImage(out,'PNG', +x.toFixed(2), +y.toFixed(2), +copyW.toFixed(2), +copyH.toFixed(2), undefined, 'FAST');
        placed++;
      }
    }
    if(placed<copies) pdf.addPage(page);
  }
  pdf.save('hoja_copias.pdf');
}
