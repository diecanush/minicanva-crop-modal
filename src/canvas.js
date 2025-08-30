export function addOrUpdateVignette(color,strength){
     colorStops:[{offset:0,color:hexToRgba(color,0)},{offset:1,color:hexToRgba(color,Math.min(0.9,strength))}]});
   if(!vignetteRect){
     vignetteRect=new fabric.Rect({left:0,top:0,originX:'left',originY:'top',width:baseW,height:baseH,fill:gradient,selectable:false,evented:false});
     canvas.add(vignetteRect);
   } else {
     vignetteRect.set({left:0,top:0,width:baseW,height:baseH,fill:gradient});
     vignetteRect.setCoords();
   }
   orderBackground(); canvas.requestRenderAll();
 }
 export function removeVignette(){ if(vignetteRect){ canvas.remove(vignetteRect); vignetteRect=null; canvas.requestRenderAll(); } }
 
 // Feather mask functions
  export function applyFeatherMaskToActive(feather = 40, shape = 'rect'){
    const obj = canvas.getActiveObject();
    if(!obj || !(obj instanceof fabric.Image)){
      alert('Seleccioná una imagen para aplicar la máscara.');
      return;
    }

    const w = obj.width;
    const h = obj.height;
    const scale = ((obj.scaleX || 1) + (obj.scaleY || 1)) / 2;
    const f = feather / scale;

    // prepare off-screen canvas with radial gradient
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');

    let r2;
    if(shape === 'circle'){
      r2 = Math.min(w, h) / 2;
    } else {
      r2 = Math.hypot(w/2, h/2);
    }

    const grad = ctx.createRadialGradient(
      w/2, h/2, Math.max(r2 - f, 0),
      w/2, h/2, r2
    );
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    const maskImg = new fabric.Image(c, { originX:'center', originY:'center', left:0, top:0 });

    // clean previous mask
    if(obj._featherMask){
      obj._featherMask.dispose?.();
    }

    obj.mask = maskImg;
    obj._featherMask = maskImg;
    canvas.requestRenderAll();
  }
 
  export function removeFeatherMaskFromActive(){
    const obj = canvas.getActiveObject();
    if(!obj || !(obj instanceof fabric.Image)) return;
    if(obj._featherMask){
      obj._featherMask.dispose?.();
      delete obj._featherMask;
    }
    obj.mask = null;
    canvas.requestRenderAll();
  }
 
 // ===== Align using bounding box =====
 export function alignCanvas(where){
   const o = canvas.getActiveObject();
   if (!o) return;
   o.setCoords();
   const br = o.getBoundingRect(true);
 
   let dx = 0, dy = 0;
   if (where === 'left')      dx = 0 - br.left;
   if (where === 'centerH')   dx = (baseW/2) - (br.left + br.width/2);
   if (where === 'right')     dx = baseW - (br.left + br.width);
   if (where === 'top')       dy = 0 - br.top;
   if (where === 'centerV')   dy = (baseH/2) - (br.top + br.height/2);
   if (where === 'bottom')    dy = baseH - (br.top + br.height);
 
   o.left = Math.round((o.left || 0) + dx);
   o.top  = Math.round((o.top  || 0) + dy);
   o.setCoords();
   canvas.requestRenderAll();
   updateSelInfo();
 }
