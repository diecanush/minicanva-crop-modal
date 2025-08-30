diff --git a/src/canvas.js b/src/canvas.js
index 64e17a8b66147257bff7069f059bafdb3a5b9f72..45295c5f1efdd34e7db963f276d11ac94870ee48 100644
--- a/src/canvas.js
+++ b/src/canvas.js
@@ -243,111 +243,102 @@ export function addOrUpdateVignette(color,strength){
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
 
-  let clip;
+  let clipPath;
   if(shape === 'circle'){
-    const radius = Math.max(w, h) / 2;
-    clip = new fabric.Circle({
+    const radius = Math.min(w, h) / 2;
+    clipPath = new fabric.Circle({
       radius,
       originX: 'center',
       originY: 'center',
       left: 0,
       top: 0,
       fill: new fabric.Gradient({
         type: 'radial',
         gradientUnits: 'pixels',
-        coords: {
-          x1: 0,
-          y1: 0,
-          r1: Math.max(radius - f, 0),
-          x2: 0,
-          y2: 0,
-          r2: radius
-        },
+        coords: { x1: 0, y1: 0, r1: Math.max(radius - f, 0), x2: 0, y2: 0, r2: radius },
         colorStops: [
           { offset: 0, color: 'rgba(0,0,0,1)' },
           { offset: 1, color: 'rgba(0,0,0,0)' }
         ]
       })
     });
   } else {
-    const maxR = Math.max(w, h) / 2;
-    clip = new fabric.Rect({
+    const r2 = Math.hypot(w/2, h/2);
+    clipPath = new fabric.Rect({
       width: w,
       height: h,
       originX: 'center',
       originY: 'center',
       left: 0,
       top: 0,
       fill: new fabric.Gradient({
         type: 'radial',
         gradientUnits: 'pixels',
-        coords: {
-          x1: 0,
-          y1: 0,
-          r1: Math.max(maxR - f, 0),
-          x2: 0,
-          y2: 0,
-          r2: maxR
-        },
+        coords: { x1: 0, y1: 0, r1: Math.max(r2 - f, 0), x2: 0, y2: 0, r2 },
         colorStops: [
           { offset: 0, color: 'rgba(0,0,0,1)' },
           { offset: 1, color: 'rgba(0,0,0,0)' }
         ]
       })
     });
   }
 
-  obj.clipPath = clip;
+  obj.clipPath = clipPath;
+  obj._featherClip = clipPath;
   canvas.requestRenderAll();
 }
 
 export function removeFeatherMaskFromActive(){
   const obj = canvas.getActiveObject();
   if(!obj || !(obj instanceof fabric.Image)) return;
+  if(obj._featherClip){
+    obj._featherClip.dispose?.();
+    delete obj._featherClip;
+  }
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
