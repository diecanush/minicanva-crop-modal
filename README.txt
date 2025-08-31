Incluye centrado estable, pan con mano (botón, Space o dos dedos), y zoom que respeta el pan.
Para evitar errores de CORS al cargar los módulos ES, serví la carpeta con un servidor HTTP local.
Por ejemplo:

```
npx serve        # o npx http-server
# o
python -m http.server 8000
```

Luego navega a `http://localhost:PORT/` para ver el lienzo.

Ahora cuenta con panel de códigos QR y máscara de borde suave para imágenes.
Abre index.html.
