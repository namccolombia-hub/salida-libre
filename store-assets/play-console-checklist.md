# Salida Libre — todo lo necesario para publicar en Google Play

Generado el 2026-08-25. Guardá este archivo — tiene todo el texto y los
archivos que vas a necesitar pegar/subir en Play Console esta noche.

## 1. Ficha de la tienda (Store listing)

**Nombre de la app** (máx. 30 caracteres):
```
Salida Libre: Parqueo Puzzle
```

**Descripción breve** (máx. 80 caracteres):
```
Mové los autos, encontrá la salida y esquivá el tráfico en la persecución.
```

**Descripción completa** (máx. 4000 caracteres):
```
Salida Libre es un rompecabezas de parqueadero: cada auto solo se mueve
en línea recta hacia adelante o hacia atrás. Tu misión es despejar el
camino y sacar todos los autos antes de quedarte sin vidas.

CÓMO SE JUEGA
• Tocá un auto para lanzarlo en su dirección.
• Si el camino está libre, sale del parqueadero.
• Si choca con otro auto, no perdés la vida de una vez — pasás al modo
  persecución en primera persona, donde podés esquivar obstáculos y
  salvarlo en el último segundo.
• Sumá niveles, subí de dificultad y desbloqueá nuevos escenarios de
  ciudad: centro comercial, casino, gasolinera, supermercado y más.

CARACTERÍSTICAS
• Decenas de niveles de dificultad creciente.
• Modo persecución con física de choques y esquive de obstáculos.
• Selector de niveles ambientado en una ciudad, con paradas reconocibles.
• Música y efectos de sonido originales, con opción de silenciarlos.
• Vinculación opcional con tu cuenta de Google Play Games para guardar
  tu progreso en la nube.
• Totalmente gratis, financiado con publicidad — sin compras obligatorias.

Salida Libre es ideal para partidas cortas: sesiones rápidas, fáciles de
retomar en cualquier momento del día.
```

**Categoría**: Puzzle (o Arcade, cualquiera de las dos encaja).

**Etiqueta de datos de contacto**:
- Correo: namccolombia@gmail.com
- Sitio web / Política de privacidad: la URL de GitHub Pages (ver sección 3).

## 2. Assets gráficos (ya generados en esta carpeta)

| Archivo | Uso en Play Console |
|---|---|
| `icon-512.png` | Ícono de la app (512×512) |
| `feature-graphic.png` | Gráfico destacado (1024×500) |
| `screenshot-1-menu.png` | Captura de pantalla — menú principal |
| `screenshot-2-level-select.png` | Captura de pantalla — selector de niveles |
| `screenshot-3-parking.png` | Captura de pantalla — jugada de parqueadero |

Son un punto de partida funcional (generados con los mismos assets del
juego). Si más adelante querés capturas más pulidas o un gráfico
destacado con más diseño, se puede regenerar con Recraft.ai como hicimos
con los autos y los landmarks — no es bloqueante para publicar.

Play te va a pedir subir el ícono también en su propio paso de "Ícono de
la app" dentro de la ficha, aparte de este 512×512 (ese otro lo toma
directo del APK/AAB, no hace falta subirlo dos veces).

## 3. Política de privacidad y Términos — activar GitHub Pages

Ya están escritos y en el repo (`docs/privacy.html` y `docs/terms.html`),
pero necesitan que actives GitHub Pages una vez (dura 1 minuto):

1. Andá a `https://github.com/namccolombia-hub/salida-libre/settings/pages`
2. En "Build and deployment" → "Source", elegí **Deploy from a branch**.
3. En "Branch", elegí **main** y la carpeta **/docs**, después **Save**.
4. Esperá 1-2 minutos. La política va a quedar en:
   `https://namccolombia-hub.github.io/salida-libre/privacy.html`
   y los términos en:
   `https://namccolombia-hub.github.io/salida-libre/terms.html`

Esa primera URL es la que pegás en Play Console (Store listing → Privacy
policy) y en la configuración de AdMob.

## 4. Firma de la app (keystore) — hacelo vos

Corré esto en PowerShell, desde la carpeta del proyecto:
```
.\scripts\generate-keystore.ps1
```
Genera una contraseña aleatoria que nunca pasa por este chat, crea el
keystore y lo conecta automáticamente al build de release. Guardá el
archivo `android/app/salida-libre-upload.keystore` y
`android/keystore.properties` en un lugar seguro (gestor de contraseñas
+ una copia de respaldo) apenas termine — si los perdés, no vas a poder
publicar actualizaciones de esta misma ficha sin pasar por el proceso de
recuperación de Google.

Después de correrlo, avisame y compilo el AAB firmado
(`android/app/build/outputs/bundle/release/app-release.aab`) — ese es el
archivo que se sube a Play Console, no el APK de debug que ya probamos
en tu teléfono.

## 5. Cuestionario de clasificación de contenido

Cuando Play Console te pida completar el IARC:
- Categoría: Casual / Puzzle.
- Violencia: no.
- Contenido sexual: no.
- Lenguaje ofensivo: no.
- Sustancias controladas: no.
- **Juego de azar simulado**: no — el ícono de "casino" en el selector de
  niveles es solo decoración de fondo (parte del skyline de la ciudad),
  no hay ninguna mecánica de apuestas ni azar en el juego.
- Interacción entre usuarios / contenido generado por usuarios: no.

Resultado esperado: clasificación para todo público ("Everyone" / "3+" o
"PEGI 3" según la región).

## 6. Formulario de seguridad de datos (Data safety)

- **¿La app recolecta o comparte datos de usuario?** Sí.
- **Identificadores de dispositivo (Advertising ID)**: se recolecta, se
  comparte con Google AdMob, con propósito de "Publicidad o marketing".
  No es obligatorio compartirlo — el usuario puede limitarlo desde la
  configuración de su teléfono (ya lo explica la política de privacidad).
- **Información personal (nombre, correo)**: no se recolecta. Si el
  usuario vincula su cuenta de Google Play Games, eso lo maneja
  directamente el SDK de Google — nosotros no operamos servidores propios
  ni almacenamos esa información.
- **Ubicación, contactos, fotos, etc.**: no se recolecta nada de esto.
- **¿Los datos se cifran en tránsito?** No aplica (no operamos
  servidores propios); lo que procesa Google/AdMob usa su propio
  cifrado.
- **¿El usuario puede pedir que se borren sus datos?** No aplica de forma
  directa (no guardamos datos personales en servidores propios); para el
  progreso guardado en la nube de Play Games, se elimina desvinculando la
  cuenta desde Configuración dentro del juego.

## 7. Vinculación de AdMob dentro de Play Console

Play Console va a pedirte vincular la cuenta de AdMob que ya tenés
configurada (`ca-app-pub-7661622406962970`) a esta ficha de la app,
dentro de la sección "Monetización con anuncios". Elegí "Sí, esta app
contiene anuncios" en el cuestionario de la ficha.

## 8. Google Play Games Services (opcional para el lanzamiento)

El guardado en la nube (vincular cuenta) está integrado en el código,
pero usa un ID de proyecto de marcador de posición
(`android/app/src/main/res/values/games-ids.xml`) hasta que configures
Play Games Services desde Play Console (Crecer → Play Games Services).
No bloquea la publicación: si no lo configurás, el botón "Vincular
cuenta" en Configuración simplemente no va a completar el inicio de
sesión — el resto del juego funciona igual. Podés configurarlo después
del lanzamiento y no hace falta una nueva versión de la app para que
empiece a funcionar.

## 9. Orden sugerido para esta noche

1. Comprar la cuenta de Google Play Console (u$s25, pago único).
2. Activar GitHub Pages (paso 3 de arriba).
3. Correr `scripts\generate-keystore.ps1` y avisarme para compilar el AAB
   firmado.
4. Crear la app en Play Console, pegar el texto de la sección 1.
5. Subir los assets de la sección 2.
6. Completar clasificación de contenido (sección 5) y seguridad de datos
   (sección 6).
7. Vincular AdMob (sección 7).
8. Subir el AAB firmado a una pista de **prueba interna** primero (no
   producción directa) — instalás la app final desde ahí en tu propio
   teléfono antes de mandarla a revisión pública.
