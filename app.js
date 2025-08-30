(() => {
  const $ = (s)=>document.querySelector(s);

  // ===== Top bar responsive =====
  const mq = window.matchMedia('(min-width: 768px)');
  function toggleDeskBar(e){ document.getElementById('deskBar').style.display = e.matches ? 'flex' : 'none'; }
  toggleDeskBar(mq); mq.addEventListener('change', toggleDeskBar);

  // ===== Panels =====
  function syncDrawers(){
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if(isDesktop){ document.getElementById('leftPanel').classList.remove('open'); document.getElementById('rightPanel').classList.remove('open'); }
  }
  window.addEventListener('resize', syncDrawers);
  document.getElementById('btnOpenTools').addEventListener('click', ()=> { document.getElementById('leftPanel').classList.toggle('open'); recenterLater(); });
  document.getElementById('btnCloseTools').addEventListener('click', ()=> { document.getElementById('leftPanel').classList.remove('open'); recenterLater(); });
  document.getElementById('btnOpenHelp').addEventListener('click', ()=> { document.getElementById('rightPanel').classList.toggle('open'); recenterLater(); });
  document.getElementById('btnCloseHelp').addEventListener('click', ()=> { document.getElementById('rightPanel').classList.remove('open'); recenterLater(); });
  const recenterLater = ()=> setTimeout(()=> { if(autoCenter) fitToViewport(); }, 320);

  // ===== Canvas model =====
  const ASPECTS={ "1:1":{w:1080,h:1080},"4:3":{w:1200,h:900},"3:4":{w:900,h:1200},"9:16":{w:1080,h:1920},"16:9":{w:1920,h:1080} };
  let baseW=1080, baseH=1080;
  let canvas, showGuides=true, hGuide=null, vGuide=null, vignetteRect=null;
  let paperRect=null, paperShadowRect=null;

  let autoCenter = true;       // si true, el zoom/resize centra; si pan del usuario -> false
  let handMode   = false;      // ✋ activado manualmente (para pan con 1 dedo)
  let spaceDown  = false;      // barra espaciadora = mano temporal

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

  function initCanvas(){
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

    // ==== PAN (drag viewport): spacebar / handMode / 2 dedos o click en vacío
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
      const e=opt.e; const p=getClientXY(e);
      const vpt = canvas.viewportTransform;
      vpt[4] += (p.x - last.x);
      vpt[5] += (p.y - last.y);
      last = p;
      canvas.requestRenderAll();
    });
    const endDrag = ()=>{ if(isDragging){ isDragging=false; canvas.selection=true; canvas.defaultCursor = (handMode||spaceDown)?'grab':'default'; } };
    canvas.on('mouse:up', endDrag);
    canvas.on('touch:gesture', (opt)=>{ if(opt.e && opt.e.touches && opt.e.touches.length<2) endDrag(); });

    updateDesignInfo();
  }

  // ===== Zoom & Centering =====
  const MIN_Z = 0.2, MAX_Z = 8;
  function updateZoomLabel(){ document.getElementById('zoomLabel').textContent = Math.round((canvas.getZoom()||1)*100)+'%'; }

  function fitToViewport(){
    const outer = document.getElementById('viewport'); if(!outer||!canvas) return;
    const M = 24; const W = outer.clientWidth - M, H = outer.clientHeight - M;
    const w = canvas.getWidth(), h = canvas.getHeight();
    const s = Math.max(MIN_Z, Math.min(MAX_Z, Math.min(W/w, H/h)));
    const tx = (W - w*s)/2, ty = (H - h*s)/2;
    canvas.setViewportTransform([s,0,0,s,tx,ty]); updateZoomLabel();
  }
  function zoomTo(newZ, centerPoint, recenter=false){
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

  // HUD Zoom buttons
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('btnZoomIn').addEventListener('click', ()=> zoomTo(canvas.getZoom()*1.1));
    document.getElementById('btnZoomOut').addEventListener('click', ()=> zoomTo(canvas.getZoom()/1.1));
    document.getElementById('btnZoomReset').addEventListener('click', ()=> zoomTo(1, null, true));
    document.getElementById('btnZoomFit').addEventListener('click', ()=> { autoCenter=true; fitToViewport(); });
    document.getElementById('btnHandHUD').addEventListener('click', ()=> toggleHand());
  });

  // Wheel zoom around pointer, keep current pan offsets
  function wheelZoom(opt){
    let z = canvas.getZoom();
    z *= Math.pow(0.999, opt.e.deltaY);
    z = Math.max(MIN_Z, Math.min(MAX_Z, z));
    const p = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
    autoCenter = false;
    canvas.zoomToPoint(p, z);
    updateZoomLabel();
    opt.e.preventDefault(); opt.e.stopPropagation();
  }

  function toggleHand(){
    handMode = !handMode;
    canvas.skipTargetFind = handMode;
    canvas.defaultCursor   = handMode ? 'grab' : 'default';
    document.getElementById('btnHand')?.classList.toggle('active', handMode);
    document.getElementById('btnHandHUD')?.classList.toggle('active', handMode);
  }

  function updateDesignInfo(){ document.getElementById('designInfo').textContent = `Lienzo: ${baseW}×${baseH}px`; }
  function updateSelInfo(){
    const a=canvas.getActiveObject();
    if(!a){ document.getElementById('selInfo').textContent='Selección: —'; return; }
    const w=Math.round(a.getScaledWidth? a.getScaledWidth(): (a.width*(a.scaleX||1)));
    const h=Math.round(a.getScaledHeight? a.getScaledHeight(): (a.height*(a.scaleY||1)));
    const pctW = Math.round((w/baseW)*100), pctH = Math.round((h/baseH)*100);
    document.getElementById('selInfo').textContent=`Selección: ${w}×${h}px (${pctW}%×${pctH}%)`;
  }

  // ===== Aspect / Background =====
  function setAspect(key){
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
  const setBg=(color)=>{ if(paperRect){ paperRect.set({ fill: color }); } if(paperShadowRect){ paperShadowRect.set({ fill: color }); } canvas.requestRenderAll(); };

  // ===== Utils (duplicate, order...) =====
  const duplicateActive=()=>{ const a=canvas.getActiveObject(); if(!a)return; a.clone((c)=>{ c.set({left:(a.left||0)+20, top:(a.top||0)+20}); canvas.add(c); canvas.setActiveObject(c); canvas.requestRenderAll(); }); };
  const bringToFront=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringToFront(); hGuide.bringToFront(); vGuide.bringToFront(); canvas.requestRenderAll(); };
  const sendToBack=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendToBack(); paperRect && paperRect.sendToBack(); paperShadowRect && paperShadowRect.sendToBack(); canvas.requestRenderAll(); };
  const bringForward=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.bringForward(); canvas.requestRenderAll(); };
  const sendBackwards=()=>{ const o=canvas.getActiveObject(); if(!o)return; o.sendBackwards(); canvas.requestRenderAll(); };
  const removeActive=()=>{ const act=canvas.getActiveObjects(); act.forEach(o=>canvas.remove(o)); canvas.discardActiveObject(); canvas.requestRenderAll(); };

  // ===== Text =====
  function currentAlign(){ const a=document.querySelector('.btnAlign.active'); return a?.dataset?.align || 'center'; }
  function addText(){
    const it=new fabric.IText('Doble click para editar',{
      left:baseW/2, top:baseH/2, originX:'center', originY:'center',
      fontFamily:document.getElementById('selFont').value, fontSize:parseInt(document.getElementById('inpSize').value||'64'),
      fill:document.getElementById('inpColor').value, textAlign:currentAlign(),
      stroke:parseInt(document.getElementById('inpStrokeWidth').value||'0')>0?document.getElementById('inpStrokeColor').value:undefined,
      strokeWidth:parseInt(document.getElementById('inpStrokeWidth').value||'0')
    });
    canvas.add(it); canvas.setActiveObject(it); canvas.requestRenderAll(); updateSelInfo();
  }
  function applyTextProps(){
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
  function addImage(file){
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

  // ===== Crop modal (same as before, shortened for brevity) =====
  let cropper=null, cropTarget=null;
  function parseAspect(v){ if(v==='free') return NaN; if(v.includes('/')){ const [a,b] = v.split('/').map(Number); return (b && !isNaN(a) && !isNaN(b)) ? (a/b) : NaN; } const n = Number(v); return isNaN(n)? NaN : n; }
  function startCrop(){
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
      canvas.setActiveObject(img); canvas.requestRenderAll();
    }, { crossOrigin:'anonymous' });
    cropTarget = null; cropper.destroy(); cropper = null; document.getElementById('cropModal').close();
  };

  // ===== Feather mask & Vignette (same as previous build) =====
  function hexToRgba(hex,a){ hex=hex.replace('#',''); if(hex.length===3){ hex=hex.split('').map(c=>c+c).join(''); } const n=parseInt(hex,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return `rgba(${r},${g},${b},${a})`; }
  function addOrUpdateVignette(color,strength){
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
  function removeVignette(){ if(vignetteRect){ canvas.remove(vignetteRect); vignetteRect=null; canvas.requestRenderAll(); } }

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

  async function exportPNG(){
    const mult = getScaleMultiplier();
    const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
    const out = isMono() ? await toGray(data) : data;
    const a=document.createElement('a'); a.href=out; a.download='diseño.png'; a.click();
  }
  async function exportPDF(){
    const mult = getScaleMultiplier();
    const data = withNeutralVPT(()=> canvas.toDataURL({ format:'png', left:0, top:0, width:baseW, height:baseH, multiplier:mult }));
    const out = isMono() ? await toGray(data) : data;
    const { jsPDF } = window.jspdf;
    const w = baseW * mult, h = baseH * mult;
    const pdf=new jsPDF({ unit:'px', format:[w,h], orientation: (w>=h?'landscape':'portrait') });
    pdf.addImage(out,'PNG',0,0,w,h,undefined,'FAST'); pdf.save('diseño.pdf');
  }
  async function printSheet(){
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

  // ===== Align using bounding box =====
  function alignCanvas(where){
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

  // ===== UI wiring =====
  window.addEventListener('DOMContentLoaded', ()=>{
    initCanvas();

    document.getElementById('selAspect').addEventListener('change',(e)=> setAspect(e.target.value));
    document.getElementById('inpBg').addEventListener('input',(e)=> setBg(e.target.value));
    document.getElementById('btnNew').addEventListener('click', ()=>{
      canvas.getObjects().slice().forEach(o=>{
        if(o!==hGuide && o!==vGuide && o!==paperRect && o!==paperShadowRect) canvas.remove(o);
      });
      if(vignetteRect){ canvas.add(vignetteRect); }
      orderBackground();
      canvas.discardActiveObject(); canvas.requestRenderAll(); updateSelInfo();
    });

    document.getElementById('btnText').addEventListener('click', addText);
    document.getElementById('fileImg').addEventListener('change',(e)=>{ const f=e.target.files&&e.target.files[0]; if(f) addImage(f); e.target.value=''; });
    document.querySelectorAll('.btnAlign').forEach(btn=>{ btn.addEventListener('click', ()=>{ document.querySelectorAll('.btnAlign').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); btn.blur(); }); });
    document.getElementById('btnApplyText').addEventListener('click', applyTextProps);

    document.getElementById('btnQRWA').addEventListener('click', ()=>{
      const phone=(document.getElementById('waPhone')?.value||'').replace(/\D/g,''); const text=encodeURIComponent(document.getElementById('waMsg')?.value||'');
      if(!phone){ alert('Ingresá el teléfono (formato internacional sin +)'); return; }
      const url=`https://wa.me/${phone}${text?`?text=${text}`:''}`; makeQR(url);
    });
    document.getElementById('btnQRURL').addEventListener('click', ()=>{
      const url=(document.getElementById('inURL')?.value||'').trim() || 'https://example.com'; makeQR(url);
    });

    document.getElementById('btnStartCrop').addEventListener('click', startCrop);

    const featherInput = document.getElementById('featherPx');
    const featherVal = document.getElementById('featherVal');
    featherInput && featherInput.addEventListener('input', ()=> featherVal.textContent = featherInput.value + ' px');
    document.getElementById('btnApplyFeather')?.addEventListener('click', ()=> applyFeatherMaskToActive(parseInt(featherInput.value,10)||0, document.getElementById('featherShape').value));
    document.getElementById('btnRemoveFeather')?.addEventListener('click', removeFeatherMaskFromActive);

    document.getElementById('btnFront').addEventListener('click', bringToFront);
    document.getElementById('btnBack').addEventListener('click', sendToBack);
    document.getElementById('btnFwd').addEventListener('click', bringForward);
    document.getElementById('btnBwd').addEventListener('click', sendBackwards);
    document.getElementById('btnDup').addEventListener('click', duplicateActive);
    document.getElementById('btnDel').addEventListener('click', removeActive);

    document.getElementById('alignLeft').addEventListener('click', ()=>alignCanvas('left'));
    document.getElementById('alignCenterH').addEventListener('click', ()=>alignCanvas('centerH'));
    document.getElementById('alignRight').addEventListener('click', ()=>alignCanvas('right'));
    document.getElementById('alignTop').addEventListener('click', ()=>alignCanvas('top'));
    document.getElementById('alignCenterV').addEventListener('click', ()=>alignCanvas('centerV'));
    document.getElementById('alignBottom').addEventListener('click', ()=>alignCanvas('bottom'));
    document.getElementById('chkGuides').addEventListener('change', (e)=>{ showGuides=e.target.checked; if(!showGuides){ hGuide.visible=false; vGuide.visible=false; canvas.requestRenderAll(); } });

    document.getElementById('btnPNG').addEventListener('click', exportPNG);
    document.getElementById('btnPDF').addEventListener('click', exportPDF);
    document.getElementById('btnPrintSheet').addEventListener('click', printSheet);

    // Móvil/alternativos
    document.getElementById('selAspectM')?.addEventListener('change', (e)=> setAspect(e.target.value));
    document.getElementById('inpBgM')?.addEventListener('input', (e)=> setBg(e.target.value));
    document.getElementById('btnPNGM')?.addEventListener('click', exportPNG);
    document.getElementById('btnPDFM')?.addEventListener('click', exportPDF);

    // HUD zoom & hand
    document.getElementById('btnZoomIn').addEventListener('click', ()=> zoomTo(canvas.getZoom()*1.1));
    document.getElementById('btnZoomOut').addEventListener('click', ()=> zoomTo(canvas.getZoom()/1.1));
    document.getElementById('btnZoomReset').addEventListener('click', ()=> zoomTo(1, null, true));
    document.getElementById('btnZoomFit').addEventListener('click', ()=> { autoCenter=true; fitToViewport(); });
    document.getElementById('btnHand').addEventListener('click', toggleHand);

    // Wheel zoom
    canvas.on('mouse:wheel', wheelZoom);

    // Resize/Orientation
    window.addEventListener('resize', ()=> { if(autoCenter) fitToViewport(); });
    window.addEventListener('orientationchange', ()=> { if(autoCenter) fitToViewport(); });

    // ResizeObserver para cambios reales del viewport (incluye abrir/cerrar paneles con animación)
    const ro = new ResizeObserver(()=> { if(autoCenter) fitToViewport(); });
    ro.observe(document.getElementById('viewport'));

    // Fit inicial en dos frames para evitar cálculos con tamaños intermedios
    requestAnimationFrame(()=> requestAnimationFrame(()=> { autoCenter=true; fitToViewport(); }));
  });

  // ===== QR =====
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
  async function makeQR(url){
    const ok=await ensureQRLib();
    if(!ok){ alert('No se pudo cargar la librería de QR.'); return; }
    createQRDataURL(url,512,(err,d)=>{
      if(err||!d){ console.error('QR error:',err); alert('No se pudo generar el QR'); return; }
      fabric.Image.fromURL(d,(img)=>{ img.set({left:baseW/2, top:baseH/2, originX:'center', originY:'center', scaleX:.5, scaleY:.5}); canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); updateSelInfo(); });
    });
  }

  // Expose for debug
  window.__miniCanva = { get canvas(){ return canvas; } };
})();