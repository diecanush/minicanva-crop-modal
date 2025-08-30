// UI panel management and wiring
import {
  initCanvas, fitToViewport, setAspect, setBg, addText, addImage, applyTextProps,
  duplicateActive, bringToFront, sendToBack, bringForward, sendBackwards, removeActive,
  alignCanvas, zoomTo, toggleHand, canvas, setAutoCenter, getAutoCenter, setShowGuides,
  applyFeatherMaskToActive, removeFeatherMaskFromActive, resetCanvas
} from './canvas.js';
import { startCrop } from './cropper.js';
import { exportPNG, exportPDF, printSheet } from './export.js';
import { makeQR } from './qr.js';

window.addEventListener('DOMContentLoaded', () => {
  initCanvas();

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
  const recenterLater = ()=> setTimeout(()=> { if(getAutoCenter()) fitToViewport(); }, 320);
  document.getElementById('btnOpenTools').addEventListener('click', ()=> { document.getElementById('leftPanel').classList.toggle('open'); recenterLater(); });
  document.getElementById('btnCloseTools').addEventListener('click', ()=> { document.getElementById('leftPanel').classList.remove('open'); recenterLater(); });
  document.getElementById('btnOpenHelp').addEventListener('click', ()=> { document.getElementById('rightPanel').classList.toggle('open'); recenterLater(); });
  document.getElementById('btnCloseHelp').addEventListener('click', ()=> { document.getElementById('rightPanel').classList.remove('open'); recenterLater(); });

  // ===== Document options =====
  document.getElementById('selAspect').addEventListener('change',(e)=> setAspect(e.target.value));
  document.getElementById('inpBg').addEventListener('input',(e)=> setBg(e.target.value));
  document.getElementById('btnNew').addEventListener('click', resetCanvas);

  // ===== Insert =====
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

  // ===== Arrange =====
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
  document.getElementById('chkGuides').addEventListener('change', (e)=> setShowGuides(e.target.checked));

  // ===== Export =====
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
  document.getElementById('btnZoomFit').addEventListener('click', ()=> { setAutoCenter(true); fitToViewport(); });
  document.getElementById('btnHand').addEventListener('click', toggleHand);

  // Resize/Orientation
  window.addEventListener('resize', ()=> { if(getAutoCenter()) fitToViewport(); });
  window.addEventListener('orientationchange', ()=> { if(getAutoCenter()) fitToViewport(); });

  // ResizeObserver for panel animations
  const ro = new ResizeObserver(()=> { if(getAutoCenter()) fitToViewport(); });
  ro.observe(document.getElementById('viewport'));

  // Fit inicial en dos frames para evitar cálculos con tamaños intermedios
  requestAnimationFrame(()=> requestAnimationFrame(()=> { setAutoCenter(true); fitToViewport(); }));
});
