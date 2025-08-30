// Canvas initialization and Fabric events

export const ASPECTS = { "1:1":{w:1080,h:1080},"4:3":{w:1200,h:900},"3:4":{w:900,h:1200},"9:16":{w:1080,h:1920},"16:9":{w:1920,h:1080} };

export let baseW = 1080, baseH = 1080;
export let canvas;
let showGuides = true, hGuide = null, vGuide = null, vignetteRect = null;
let paperRect = null, paperShadowRect = null;
let autoCenter = true;       // si true, el zoom/resize centra; si pan del usuario -> false
let handMode   = false;      // ✋ activado manualmente (para pan con 1 dedo)
let spaceDown  = false;      // barra espaciadora = mano temporal

export function setAutoCenter(v){ autoCenter = v; }
export function getAutoCenter(){ return autoCenter; }
export function setShowGuides(v){ showGuides = v; if(!showGuides && hGuide && vGuide){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); } }

function addOrUpdatePaper(){
  const W = canvas.getWidth(), H = canvas.getHeight();
  if(!paperRect){
    paperRect = new fabric.Rect({ left:0, top:0, width:W, height:H, fill:'#ffffff', selectable:false, evented:false });
    canvas.add(paperRect);
  } else { paperRect.set({ width:W, height:H }); paperRect.setCoords(); }

  if(!paperShadowRect){
    paperShadowRect = new fabric.Rect({
      left:0, top:0, width:W, height:H, fill:paperRect.fill,
      selectable:false, evented:false, excludeFromExport:true,
      shadow: new fabric.Shadow({ color:'rgba(0,0,0,0.25)', blur:30, offsetX:0, offsetY:10 })
    });
    canvas.add(paperShadowRect);
  } else { paperShadowRect.set({ width:W, height:H, fill:paperRect.fill }); paperShadowRect.setCoords(); }

  orderBackground();
}
function orderBackground(){
  if (paperShadowRect) canvas.moveTo(paperShadowRect, 0);
  if (paperRect)       canvas.moveTo(paperRect, 1);
  if (vignetteRect)    canvas.moveTo(vignetteRect, 2);
  if (hGuide) hGuide.bringToFront();
  if (vGuide) vGuide.bringToFront();
}

export function initCanvas(){
  if(!(window.fabric&&window.jspdf)){ alert('No se cargaron Fabric/jsPDF.'); return; }
  canvas=new fabric.Canvas('stage',{preserveObjectStacking:true, backgroundColor:'transparent', selection:true});
  canvas.setWidth(baseW); canvas.setHeight(baseH);

  hGuide=new fabric.Line([0,baseH/2,baseW,baseH/2],{stroke:'#38bdf8',strokeWidth:1,selectable:false,evented:false,excludeFromExport:true,visible:false});
  vGuide=new fabric.Line([baseW/2,0,baseW/2,baseH],{stroke:'#38bdf8',strokeWidth:1,selectable:false,evented:false,excludeFromExport:true,visible:false});
  canvas.add(hGuide); canvas.add(vGuide);

  addOrUpdatePaper();

  window.addEventListener('keydown',(e)=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){ e.preventDefault(); duplicateActive(); }
    if(e.key==='Delete'||e.key==='Backspace'){ const act=canvas.getActiveObjects(); act.forEach(o=>canvas.remove(o)); canvas.discardActiveObject(); canvas.requestRenderAll(); }
    if(e.code==='Space'){ spaceDown = true; canvas.defaultCursor = 'grab'; }
  });
  window.addEventListener('keyup',(e)=>{ if(e.code==='Space'){ spaceDown = false; canvas.defaultCursor = 'default'; } });

  // SNAP guides
  canvas.on('object:moving',(opt)=>{ if(!showGuides){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); return; }
    const o=opt.target, tol=8; let snapped=false;
    const w=o.getScaledWidth?o.getScaledWidth():(o.width*(o.scaleX||1));
    const h=o.getScaledHeight?o.getScaledHeight():(o.height*(o.scaleY||1));
    const cx=(o.left||0)+w/2, cy=(o.top||0)+h/2;
    if(Math.abs(cx-baseW/2)<tol){ o.left=(baseW-w)/2; vGuide.visible=true; snapped=true; }
    if(Math.abs(cy-baseH/2)<tol){ o.top=(baseH-h)/2; hGuide.visible=true; snapped=true; }
    if(Math.abs((o.left||0)-0)<tol){ o.left=0; vGuide.visible=true; snapped=true; }
    if(Math.abs(((o.left||0)+w)-baseW)<tol){ o.left=baseW-w; vGuide.visible=true; snapped=true; }
    if(Math.abs((o.top||0)-0)<tol){ o.top=0; hGuide.visible=true; snapped=true; }
    if(Math.abs(((o.top||0)+h)-baseH)<tol){ o.top=baseH-h; hGuide.visible=true; snapped=true; }
    if(!snapped){ hGuide.visible=false; vGuide.visible=false; }
  });
  canvas.on('mouse:up',()=>{ if(hGuide.visible||vGuide.visible){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); } });

  canvas.on('selection:updated',updateSelInfo);
  canvas.on('selection:created',updateSelInfo);
  canvas.on('selection:cleared',updateSelInfo);

  // ==== PAN (drag viewport)
  function getClientXY(e){
    if(e.touches && e.touches[0]) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
    if(e.changedTouches && e.changedTouches[0]) return {x:e.changedTouches[0].clientX, y:e.changedTouches[0].clientY};
    return {x:e.clientX, y:e.clientY};
  }
  let isDragging=false, last={x:0,y:0};
  canvas.on('mouse:down', (opt)=>{
    const e=opt.e;
    const multiTouch = !!(e.touches && e.touches.length>=2);
    const shouldPan = multiTouch || spaceDown || handMode || (!opt.target);
    if(shouldPan){
      isDragging=true; autoCenter=false; canvas.selection=false; canvas.defaultCursor='grabbing';
      const p = getClientXY(e); last.x=p.x; last.y=p.y;
    }
  });
  canvas.on('mouse:move', (opt)=>{
    if(!isDragging) return;
    const e=opt.e, p=getClientXY(e); const vpt=canvas.viewportTransform; vpt[4]+=(p.x-last.x); vpt[5]+=(p.y-last.y); last=p; canvas.requestRenderAll();
  });
  const endDrag = ()=>{ if(isDragging){ isDragging=false; canvas.selection=true; canvas.defaultCursor = (handMode||spaceDown)?'grab':'default'; } };
  canvas.on('mouse:up', endDrag);
  canvas.on('touch:gesture', (opt)=>{ if(opt.e && opt.e.touches && opt.e.touches.length<2) endDrag(); });

  canvas.on('mouse:wheel', wheelZoom);

  updateDesignInfo();
}

// ===== Zoom & Centering =====
const MIN_Z = 0.2, MAX_Z = 8;
function updateZoomLabel(){ document.getElementById('zoomLabel').textContent = Math.round((canvas.getZoom()||1)*100)+'%'; }

export function fitToViewport(){
  const outer = document.getElementById('viewport'); if(!outer||!canvas) return;
  const W = outer.clientWidth, H = outer.clientHeight;
  const w = canvas.getWidth(), h = canvas.getHeight();
  const s = Math.max(MIN_Z, Math.min(MAX_Z, Math.min(W/w, H/h)));
  const tx = (W - w*s)/2, ty = (H - h*s)/2;
  canvas.setViewportTransform([s,0,0,s,tx,ty]);
  updateZoomLabel();
  canvas.requestRenderAll();
}

export function zoomTo(newZ, centerPoint, recenter=false){
  const z = Math.max(MIN_Z, Math.min(MAX_Z, newZ));
  const cp = centerPoint || new fabric.Point(canvas.getWidth()/2, canvas.getHeight()/2);
  canvas.zoomToPoint(cp, z);
  if(recenter || autoCenter){
    const outer = document.getElementById('viewport');
    const W = outer.clientWidth, H = outer.clientHeight;
    const w = canvas.getWidth()*z, h = canvas.getHeight()*z;
    const vpt = canvas.viewportTransform; vpt[4] = (W - w)/2; vpt[5] = (H - h)/2;
    canvas.setViewportTransform(vpt);
  }
  updateZoomLabel();
}

export function wheelZoom(opt){
  let z = canvas.getZoom();
  z *= Math.pow(0.999, opt.e.deltaY);
  z = Math.max(MIN_Z, Math.min(MAX_Z, z));
  const p = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
  autoCenter = false;
  canvas.zoomToPoint(p, z);
  updateZoomLabel();
  opt.e.preventDefault(); opt.e.stopPropagation();
}

export function toggleHand(){
  handMode = !handMode;
  canvas.skipTargetFind = handMode;
  canvas.defaultCursor   = handMode ? 'grab' : 'default';
  document.getElementById('btnHand')?.classList.toggle('active', handMode);
  document.getElementById('btnHandHUD')?.classList.toggle('active', handMode);
}

function updateDesignInfo(){ document.getElementById('designInfo').textContent = `Lienzo: ${baseW}×${baseH}px`; }
export function updateSelInfo(){
  const a=canvas.getActiveObject();
  if(!a){ document.getElementById('selInfo').textContent='Selección: —'; return; }
  const w=Math.round(a.getScaledWidth? a.getScaledWidth(): (a.width*(a.scaleX||1)));
  const h=Math.round(a.getScaledHeight? a.getScaledHeight(): (a.height*(a.scaleY||1)));
  const pctW = Math.round((w/baseW)*100), pctH = Math.round((h/baseH)*100);
  document.getElementById('selInfo').textContent=`Selección: ${w}×${h}px (${pctW}%×${pctH}%)`;
}

// ===== Aspect / Background =====
export function setAspect(key){
  const {w,h}=ASPECTS[key];
  baseW = w; baseH = h;
  canvas.setWidth(w); canvas.setHeight(h);
  hGuide.set({x1:0,y1:h/2,x2:w,y2:h/2}); vGuide.set({x1:w/2,y1:0,x2:w/2,y2:h});
  addOrUpdatePaper();
  if(vignetteRect){ addOrUpdateVignette(document.getElementById('vignetteColor').value, parseFloat(document.getElementById('vignetteStrength').value)); }
  canvas.requestRenderAll();
  autoCenter = true;
  fitToViewport();
  updateDesignInfo();
}
export const setBg=(color)=>{ if(paperRect){ paperRect.set({ fill: color }); } if(paperShadowRect){ paperShadowRect.set({ fill: color }); } canvas.requestRenderAll(); };

// ===== Utils (duplicate, order...) =====
export const duplicateActive=()=>{ const a=canvas.getActiveObject(); if(!a)return; a.clone((c)=>{ c.set({left:(a.left||0)+20, top:(a.top||0)+20}); canvas.add(c); canvas.setActiveObject(c); canvas.requestRenderAll(); }); };
export const bringToFront=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringToFront(); hGuide.bringToFront(); vGuide.bringToFront(); canvas.requestRenderAll(); };
export const sendToBack=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendToBack(); paperRect && paperRect.sendToBack(); paperShadowRect && paperShadowRect.sendToBack(); canvas.requestRenderAll(); };
export const bringForward=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringForward(); canvas.requestRenderAll(); };
export const sendBackwards=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendBackwards(); canvas.requestRenderAll(); };
export const removeActive=()=>{ const act=canvas.getActiveObjects(); act.forEach(o=>canvas.remove(o)); canvas.discardActiveObject();canvas.requestRenderAll(); };
export function resetCanvas(){
  canvas.getObjects().slice().forEach(o=>{
    if(o!==hGuide && o!==vGuide && o!==paperRect && o!==paperShadowRect) canvas.remove(o);
  });
  if(vignetteRect){ canvas.add(vignetteRect); }
  orderBackground();
  canvas.discardActiveObject(); canvas.requestRenderAll(); updateSelInfo();
}


// ===== Text =====
function currentAlign(){ const a=document.querySelector('.btnAlign.active'); return a?.dataset?.align || 'center'; }
export function addText(){
  const it=new fabric.IText('Doble click para editar',{
    left:baseW/2, top:baseH/2, originX:'center', originY:'center',
    fontFamily:document.getElementById('selFont').value, fontSize:parseInt(document.getElementById('inpSize').value||'64'),
    fill:document.getElementById('inpColor').value, textAlign:currentAlign(),
    stroke:parseInt(document.getElementById('inpStrokeWidth').value||'0')>0?document.getElementById('inpStrokeColor').value:undefined,
    strokeWidth:parseInt(document.getElementById('inpStrokeWidth').value||'0')
  });
  canvas.add(it); canvas.setActiveObject(it); canvas.requestRenderAll(); updateSelInfo();
}
export function applyTextProps(){
  const obj=canvas.getActiveObject(); if(!obj||(obj.type!=='i-text'&&obj.type!=='text'))return;
  obj.set({
    fontFamily:document.getElementById('selFont').value,
    fontSize:parseInt(document.getElementById('inpSize').value||'64'),
    fill:document.getElementById('inpColor').value,
    stroke:parseInt(document.getElementById('inpStrokeWidth').value||'0')>0?document.getElementById('inpStrokeColor').value:undefined,
    strokeWidth:parseInt(document.getElementById('inpStrokeWidth').value||'0'),
    textAlign:currentAlign()
  });
  canvas.requestRenderAll(); updateSelInfo();
}

// ===== Insert image =====
export function addImage(file){
  const r=new FileReader();
  r.onload=()=>{ fabric.Image.fromURL(r.result,(img)=>{
    const maxW=baseW*0.9, maxH=baseH*0.9;
    const s=Math.min(maxW/img.width, maxH/img.height, 1);
    img.set({left:baseW/2, top:baseH/2, originX:'center', originY:'center', scaleX:s, scaleY:s, cornerStyle:'circle'});
    if(!img.__origSrc) img.__origSrc = r.result;
    canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo();
  },{crossOrigin:'anonymous'}); };
  r.readAsDataURL(file);
}

// ===== Feather mask & Vignette =====
function hexToRgba(hex,a){ hex=hex.replace('#',''); if(hex.length===3){ hex=hex.split('').map(c=>c+c).join(''); } const n=parseInt(hex,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return `rgba(${r},${g},${b},${a})`; }
export function addOrUpdateVignette(color,strength){
  const rMax=Math.max(baseW,baseH)*0.75, rInner=Math.min(baseW,baseH)*0.25;
  const gradient=new fabric.Gradient({type:'radial',coords:{x1:baseW/2,y1:baseH/2,r1:rInner,x2:baseW/2,y2:baseH/2,r2:rMax},
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

  let clipPath;
  if(shape === 'circle'){
    const radius = Math.min(w, h) / 2;
    clipPath = new fabric.Circle({
      radius,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      fill: new fabric.Gradient({
        type: 'radial',
        gradientUnits: 'pixels',
        coords: { x1: radius, y1: radius, r1: Math.max(radius - f, 0), x2: radius, y2: radius, r2: radius },
        colorStops: [
          { offset: 0, color: 'rgba(0,0,0,1)' },
          { offset: 1, color: 'rgba(0,0,0,0)' }
        ]
      })
    });
  } else {
    const r2 = Math.hypot(w/2, h/2);
    clipPath = new fabric.Rect({
      width: w,
      height: h,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      fill: new fabric.Gradient({
        type: 'radial',
        gradientUnits: 'pixels',
        coords: { x1: w/2, y1: h/2, r1: Math.max(r2 - f, 0), x2: w/2, y2: h/2, r2 },
        colorStops: [
          { offset: 0, color: 'rgba(0,0,0,1)' },
          { offset: 1, color: 'rgba(0,0,0,0)' }
        ]
      })
    });
  }

  obj.clipPath = clipPath;
  obj._featherClip = clipPath;
  canvas.requestRenderAll();
}

export function removeFeatherMaskFromActive(){
  const obj = canvas.getActiveObject();
  if(!obj || !(obj instanceof fabric.Image)) return;
  if(obj._featherClip){
    obj._featherClip.dispose?.();
    delete obj._featherClip;
  }
  obj.clipPath = null;
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

export { orderBackground };
