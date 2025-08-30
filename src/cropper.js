// Image cropping modal
import { canvas, baseW, baseH, updateSelInfo } from './canvas.js';

let cropper=null, cropTarget=null;
function parseAspect(v){ if(v==='free') return NaN; if(v.includes('/')){ const [a,b] = v.split('/').map(Number); return (b && !isNaN(a) && !isNaN(b)) ? (a/b) : NaN; } const n = Number(v); return isNaN(n)? NaN : n; }

export function startCrop(){
  const t = canvas.getActiveObject();
  if(!t || t.type!=='image'){ alert('Seleccioná una imagen primero.'); return; }
  cropTarget = t;
  const imgEl = document.getElementById('cropperImage');
  const orig = t.__origSrc || t._originalElement?.src || t.getElement?.().src || t.toDataURL({format:'png'});
  imgEl.src = orig;
  const dlg = document.getElementById('cropModal'); dlg.showModal();
  if (cropper) { cropper.destroy(); cropper = null; }
  cropper = new Cropper(imgEl, { viewMode:1, background:false, autoCrop:true, checkOrientation:false, responsive:true, dragMode:'move', autoCropArea:0.9 });
}

document.getElementById('cmClose').onclick = () => { if (cropper) { cropper.destroy(); cropper = null; } document.getElementById('cropModal').close(); };
document.getElementById('cmZoomIn').onclick  = ()=> cropper && cropper.zoom( 0.1);
document.getElementById('cmZoomOut').onclick = ()=> cropper && cropper.zoom(-0.1);
document.getElementById('cmRotate').onclick  = ()=> cropper && cropper.rotate(90);
document.getElementById('cmReset').onclick   = ()=> cropper && cropper.reset();
document.getElementById('cropAspect').onchange = (e)=>{ const r = parseAspect(e.target.value); cropper && cropper.setAspectRatio(r); };

document.getElementById('cmApply').onclick = () => {
  if(!cropper || !cropTarget) return;
  const c = cropper.getCroppedCanvas({ imageSmoothingEnabled:true, imageSmoothingQuality:'high' });
  const dataURL = c.toDataURL('image/png');
  const center = cropTarget.getCenterPoint();
  const angle  = cropTarget.angle || 0;
  const dispW  = cropTarget.getScaledWidth();
  const dispH  = cropTarget.getScaledHeight();
  const idx    = canvas.getObjects().indexOf(cropTarget);
  if(!cropTarget.__origSrc) cropTarget.__origSrc = cropTarget._originalElement?.src || cropTarget.toDataURL({format:'png'});
  canvas.remove(cropTarget);
  fabric.Image.fromURL(dataURL, (img)=>{
    img.__origSrc = dataURL;
    img.set({ originX:'center', originY:'center', left:center.x, top:center.y, angle });
    const sx = dispW / img.width, sy = dispH / img.height;
    img.set({ scaleX:sx, scaleY:sy });
    if(idx >= 0){ canvas.insertAt(img, idx, true); } else { canvas.add(img); }
    canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo();
  }, { crossOrigin:'anonymous' });
  cropTarget = null; cropper.destroy(); cropper = null; document.getElementById('cropModal').close();
};
